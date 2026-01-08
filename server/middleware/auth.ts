/**
 * Auth Middleware - Clerk JWT verification with Billing support
 */

import { createClerkClient, verifyToken } from "@clerk/backend";
import { env } from "../../lib/env";

// Initialize Clerk client for billing API calls
const clerk = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });

// Cache billing status to avoid repeated API calls (5 min TTL)
const billingCache = new Map<string, { isPremium: boolean; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

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

    // Cache the result
    billingCache.set(userId, { isPremium, expiresAt: Date.now() + CACHE_TTL_MS });
    return isPremium;
  } catch (error) {
    if (env.NODE_ENV === "development") {
      console.log("[auth] Billing check error for", userId, error);
    }
    // No subscription found = not premium
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

    const result = await verifyToken(token, {
      secretKey: env.CLERK_SECRET_KEY,
    });

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
    if (env.NODE_ENV === "development") {
      console.error("[auth] Error:", error);
    }
    return { isPremium: false, userId: null };
  }
}
