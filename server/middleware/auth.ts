/**
 * Auth Middleware - Clerk JWT verification with Billing support
 */

import { createClerkClient, verifyToken } from "@clerk/backend";
import { env } from "../env";

// Initialize Clerk client for billing API calls
const clerk = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });

// Cache billing status to avoid repeated API calls (5 min TTL)
// MEMORY SAFETY: Bounded cache with periodic cleanup to prevent unbounded growth
const billingCache = new Map<string, { isPremium: boolean; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_CACHE_SIZE = 1000; // Maximum entries to prevent memory leak
const CLEANUP_INTERVAL_MS = 60 * 1000; // Clean expired entries every minute

// Periodic cleanup of expired entries to prevent memory leak
let cleanupTimer: NodeJS.Timeout | null = null;

function startCacheCleanup(): void {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    let cleaned = 0;
    for (const [userId, entry] of billingCache.entries()) {
      if (entry.expiresAt <= now) {
        billingCache.delete(userId);
        cleaned++;
      }
    }
    if (cleaned > 0 && env.NODE_ENV === "development") {
      console.log(`[auth] Cleaned ${cleaned} expired cache entries, ${billingCache.size} remaining`);
    }
  }, CLEANUP_INTERVAL_MS);
  cleanupTimer.unref(); // Don't keep process alive
}

// Start cleanup on module load
startCacheCleanup();

// Helper to evict oldest entries when cache is full
function evictIfNeeded(): void {
  if (billingCache.size >= MAX_CACHE_SIZE) {
    const entriesToRemove = Math.floor(MAX_CACHE_SIZE * 0.1); // Remove 10%
    const entries = Array.from(billingCache.entries());
    entries.sort((a, b) => a[1].expiresAt - b[1].expiresAt);
    for (let i = 0; i < entriesToRemove; i++) {
      billingCache.delete(entries[i][0]);
    }
  }
}

interface AuthInfo {
  isPremium: boolean;
  userId: string | null;
}

async function checkBillingStatus(userId: string): Promise<boolean> {
  // Check cache first
  const cached = billingCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    if (env.NODE_ENV === "development") {
      console.log("[auth] Cache hit for", userId, "isPremium:", cached.isPremium);
    }
    return cached.isPremium;
  }

  try {
    const subscription = await clerk.billing.getUserBillingSubscription(userId);

    if (env.NODE_ENV === "development") {
      console.log("[auth] Subscription for", userId, JSON.stringify(subscription, null, 2));
    }

    // Check if user has an active subscription with the "premium" plan
    const isPremium = subscription.subscriptionItems?.some(
      item => item.plan?.slug === "premium" && item.status === "active"
    ) ?? false;

    // Cache the result (with size limit to prevent memory leak)
    evictIfNeeded();
    billingCache.set(userId, { isPremium, expiresAt: Date.now() + CACHE_TTL_MS });
    return isPremium;
  } catch (error) {
    if (env.NODE_ENV === "development") {
      console.log("[auth] Billing check error for", userId, error);
    }
    // No subscription found = not premium (still cache with size limit)
    evictIfNeeded();
    billingCache.set(userId, { isPremium: false, expiresAt: Date.now() + CACHE_TTL_MS });
    return false;
  }
}

export async function getAuthInfo(request: Request): Promise<AuthInfo> {
  try {
    const authHeader = request.headers.get("authorization");
    const cookieHeader = request.headers.get("cookie");

    let token: string | null = null;
    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.slice(7);
    } else if (cookieHeader) {
      const match = cookieHeader.match(/__session=([^;]+)/);
      if (match) token = match[1];
    }

    if (!token) return { isPremium: false, userId: null };

    // Build verify options. When CLERK_JWT_KEY is set, verifyToken skips JWKS
    // fetching entirely and verifies the signature locally — eliminates kid
    // mismatch errors from key rotation and network failures.
    const verifyOpts: Parameters<typeof verifyToken>[1] = {
      secretKey: env.CLERK_SECRET_KEY,
      ...(env.CLERK_JWT_KEY ? { jwtKey: env.CLERK_JWT_KEY } : {}),
    };

    let result: Awaited<ReturnType<typeof verifyToken>>;
    try {
      result = await verifyToken(token, verifyOpts);
    } catch (firstError) {
      // If kid mismatch and we're using JWKS (no jwtKey), retry with fresh JWKS.
      // Clerk SDK already retries on unknown kid, but this handles edge cases
      // where the cache was populated with stale keys from a previous rotation.
      const isKidMismatch = firstError instanceof Error &&
        firstError.message.includes("kid");
      if (isKidMismatch && !env.CLERK_JWT_KEY) {
        console.warn(`[auth] JWK kid mismatch, retrying with fresh JWKS: ${firstError.message}`);
        try {
          result = await verifyToken(token, {
            ...verifyOpts,
            skipJwksCache: true,
          });
        } catch (retryError) {
          console.error(`[auth] JWK retry also failed: ${retryError instanceof Error ? retryError.message : String(retryError)}`);
          return { isPremium: false, userId: null };
        }
      } else {
        // Non-kid error or we're using jwtKey — don't retry
        if (env.NODE_ENV === "development") {
          console.error("[auth] verifyToken error:", firstError);
        }
        return { isPremium: false, userId: null };
      }
    }

    if (!result) return { isPremium: false, userId: null };

    const claims = result as Record<string, unknown>;
    const userId = (claims.sub as string) || null;

    if (!userId) return { isPremium: false, userId: null };

    // Check billing status via Clerk API
    const isPremium = await checkBillingStatus(userId);

    if (env.NODE_ENV === "development") {
      console.log("[auth] User:", userId, "Premium:", isPremium);
    }

    return { isPremium, userId };
  } catch (error) {
    // Log auth errors in production too (kid mismatch, network failures, etc.)
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("kid") || msg.includes("JWKS") || msg.includes("signing key")) {
      console.error(`[auth] Clerk key error (possible key rotation or env mismatch): ${msg}`);
    } else if (env.NODE_ENV === "development") {
      console.error("[auth] Error:", error);
    }
    return { isPremium: false, userId: null };
  }
}
