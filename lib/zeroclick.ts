/**
 * ZeroClick Ad Integration
 *
 * Fallback ad provider used when Gravity returns fewer than 5 ads.
 * - MCP signal broadcasting (article context → ZeroClick)
 * - REST API for fetching offers
 * - Offer → ContextAd mapping
 *
 * Docs: https://developer.zeroclick.ai/docs
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { env } from "../server/env";
import { createLogger } from "./logger";
import { startMemoryTrack } from "./memory-tracker";
import type { ContextAd } from "../types/api";

const logger = createLogger("zeroclick");

// =============================================================================
// Types — matches ZeroClick API v2 response shape
// =============================================================================

export interface ZeroClickOffer {
  id: string;
  title: string;
  subtitle?: string;
  content?: string;
  cta?: string;
  clickUrl: string;
  imageUrl?: string;
  brand?: {
    name: string;
    description?: string;
    url?: string;
    iconUrl?: string;
  };
  product?: {
    productId?: string;
    title?: string;
    category?: string;
    availability?: string;
  };
  price?: {
    amount?: number;
    currency?: string;
    originalPrice?: number;
    discount?: string;
    interval?: string;
  };
  context?: string;
  metadata?: Record<string, unknown>;
}

// =============================================================================
// MCP Signal Client
//
// Broadcasts article context to ZeroClick's Signal Server so it can build
// user preference profiles for better ad targeting / higher revenue.
//
// Required headers (from docs):
//   x-zc-api-key      — authentication
//   x-zc-llm-model    — LLM model identifier
//   Content-Type       — application/json  (set by SDK)
//   Accept             — application/json, text/event-stream  (set by SDK)
//
// Optional user context headers:
//   x-zc-user-id, x-zc-user-session-id, x-zc-user-locale,
//   x-zc-user-ip, x-zc-user-agent, x-zc-grouping-id
//
// Docs: https://developer.zeroclick.ai/docs/signal-collection/headers
// =============================================================================

// =============================================================================
// Session-Based Client Pool
//
// Per ZeroClick docs: "Create one client per user session"
// We cache clients by sessionId and reuse them, with TTL-based cleanup.
// This prevents creating hundreds of MCP connections per minute.
// =============================================================================

interface CachedClient {
  client: Client;
  lastUsed: number;
  sessionId: string;
}

const clientCache = new Map<string, CachedClient>();
const CLIENT_TTL_MS = 2 * 60 * 1000; // 2 minutes (reduced from 5 - shorter = less orphans)
const CLIENT_CLEANUP_INTERVAL_MS = 30 * 1000; // Cleanup every 30 seconds (more aggressive)
const MAX_CACHED_CLIENTS = 50; // Reduced from 100 - fewer cached = less memory
const CLIENT_CLOSE_TIMEOUT_MS = 1000; // 1 second (reduced from 2)
const SIGNAL_RETRY_COOLDOWN_MS = 10_000; // Back off 10s after failure

// Track failures per session instead of globally
const sessionFailures = new Map<string, number>();

// Track orphaned clients for debugging memory leaks
let orphanedClientCount = 0;
let totalClientsCreated = 0;
let totalClientsClosed = 0;

/**
 * Close a client - fire and forget to avoid blocking.
 * Tracks orphaned clients (close timed out) for debugging.
 */
function closeClientFireAndForget(client: Client): void {
  const closePromise = client.close();
  const timeoutPromise = new Promise<"timeout">((resolve) =>
    setTimeout(() => resolve("timeout"), CLIENT_CLOSE_TIMEOUT_MS)
  );

  Promise.race([closePromise, timeoutPromise])
    .then((result) => {
      if (result === "timeout") {
        orphanedClientCount++;
        logger.warn(
          { orphanedCount: orphanedClientCount, created: totalClientsCreated, closed: totalClientsClosed },
          "MCP client close timed out - potential memory leak"
        );
      } else {
        totalClientsClosed++;
      }
    })
    .catch(() => {
      // Close failed - still count as closed since we can't do more
      totalClientsClosed++;
    });
}

/**
 * Cleanup expired clients and stale failure entries from caches.
 * Called periodically to prevent memory leaks from abandoned sessions.
 */
function cleanupExpiredClients(): void {
  const now = Date.now();

  // Cleanup expired MCP clients
  const expiredClientKeys: string[] = [];
  for (const [key, cached] of clientCache) {
    if (now - cached.lastUsed > CLIENT_TTL_MS) {
      expiredClientKeys.push(key);
    }
  }

  if (expiredClientKeys.length > 0) {
    logger.info({ count: expiredClientKeys.length }, "Cleaning up expired MCP signal clients");
    for (const key of expiredClientKeys) {
      const cached = clientCache.get(key);
      if (cached) {
        clientCache.delete(key);
        closeClientFireAndForget(cached.client);
      }
    }
  }

  // Cleanup expired session failures (CRITICAL: prevents unbounded memory growth)
  // Also enforce hard cap to prevent accumulation during high-traffic periods
  const MAX_FAILURE_ENTRIES = 200;
  let failuresRemoved = 0;

  for (const [key, time] of sessionFailures) {
    if (now - time > SIGNAL_RETRY_COOLDOWN_MS) {
      sessionFailures.delete(key);
      failuresRemoved++;
    }
  }

  // If still over cap after removing expired, evict oldest entries
  if (sessionFailures.size > MAX_FAILURE_ENTRIES) {
    const sortedFailures = Array.from(sessionFailures.entries())
      .sort((a, b) => a[1] - b[1]); // oldest first
    const toRemove = sortedFailures.slice(0, sessionFailures.size - MAX_FAILURE_ENTRIES);
    for (const [key] of toRemove) {
      sessionFailures.delete(key);
      failuresRemoved++;
    }
  }

  if (failuresRemoved > 0) {
    logger.info({ removed: failuresRemoved, remaining: sessionFailures.size }, "Cleaned up session failure entries");
  }
}

/**
 * Evict oldest clients if cache is full.
 */
function evictOldestClients(count: number): void {
  const entries = Array.from(clientCache.entries())
    .sort((a, b) => a[1].lastUsed - b[1].lastUsed)
    .slice(0, count);

  for (const [key, cached] of entries) {
    clientCache.delete(key);
    closeClientFireAndForget(cached.client);
  }
  logger.info({ count, cacheSize: clientCache.size }, "Evicted oldest MCP signal clients");
}

// Start periodic cleanup
let cleanupInterval: ReturnType<typeof setInterval> | null = null;
function startCleanupInterval() {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(() => {
    try {
      cleanupExpiredClients();
    } catch (err) {
      logger.warn({ error: String(err) }, "Error during client cleanup");
    }
  }, CLIENT_CLEANUP_INTERVAL_MS);
  // Don't block process exit
  if (cleanupInterval.unref) cleanupInterval.unref();
}
startCleanupInterval();

/**
 * Graceful shutdown — close all cached signal clients.
 * Fires close for all clients then clears the cache.
 * Close is fire-and-forget so we don't block shutdown.
 */
export function shutdownSignalClient(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }

  const clientCount = clientCache.size;
  if (clientCount > 0) {
    logger.info({ count: clientCount }, "Closing all MCP signal clients on shutdown");
    for (const cached of clientCache.values()) {
      closeClientFireAndForget(cached.client);
    }
    clientCache.clear();
  }
}

// Register shutdown handlers (once only)
let shutdownHandlersRegistered = false;
function registerShutdownHandlers() {
  if (shutdownHandlersRegistered || typeof process === "undefined") return;
  shutdownHandlersRegistered = true;

  const handleShutdown = () => {
    try {
      shutdownSignalClient();
    } catch {
      // Ignore shutdown errors
    }
  };
  process.once("SIGTERM", handleShutdown);
  process.once("SIGINT", handleShutdown);
}
registerShutdownHandlers();

/**
 * Get cache statistics for monitoring/debugging.
 * Used by memory monitor to track cache growth.
 */
export function getZeroClickCacheStats(): {
  clientCacheSize: number;
  sessionFailuresSize: number;
  maxClients: number;
  totalCreated: number;
  totalClosed: number;
  orphanedCount: number;
} {
  return {
    clientCacheSize: clientCache.size,
    sessionFailuresSize: sessionFailures.size,
    maxClients: MAX_CACHED_CLIENTS,
    totalCreated: totalClientsCreated,
    totalClosed: totalClientsClosed,
    orphanedCount: orphanedClientCount,
  };
}

/**
 * Get or create an MCP Signal Client for the given session.
 * Per ZeroClick docs: "Create one client per user session"
 *
 * Clients are cached by sessionId and reused for subsequent requests.
 * This drastically reduces connection overhead vs per-request clients.
 */
async function getOrCreateSignalClient(userContext: {
  sessionId: string;
  userId?: string;
  locale?: string;
  ip?: string;
  userAgent?: string;
}): Promise<Client | null> {
  const cacheKey = userContext.sessionId;

  // Check per-session cooldown (not global - one failure shouldn't block all users)
  const lastFailure = sessionFailures.get(cacheKey);
  if (lastFailure && Date.now() - lastFailure < SIGNAL_RETRY_COOLDOWN_MS) {
    return null;
  }

  // Check cache first
  const cached = clientCache.get(cacheKey);
  if (cached) {
    cached.lastUsed = Date.now();
    return cached.client;
  }

  // Evict oldest clients if cache is full (more aggressive - evict 20 to prevent churn)
  if (clientCache.size >= MAX_CACHED_CLIENTS) {
    evictOldestClients(20); // Fire-and-forget eviction
  }
  // Note: sessionFailures cleanup is handled by periodic cleanupExpiredClients()

  try {
    // Build headers — required + optional user context
    const headers: Record<string, string> = {
      "x-zc-api-key": env.ZEROCLICK_API_KEY,
      "x-zc-llm-model": "anthropic/claude-sonnet-4.5",
    };
    if (userContext.userId) headers["x-zc-user-id"] = userContext.userId;
    if (userContext.sessionId) headers["x-zc-user-session-id"] = userContext.sessionId;
    if (userContext.locale) headers["x-zc-user-locale"] = userContext.locale;
    if (userContext.ip) headers["x-zc-user-ip"] = userContext.ip;
    if (userContext.userAgent) headers["x-zc-user-agent"] = userContext.userAgent.slice(0, 1000);

    const client = new Client({ name: "smry", version: "1.0.0" });
    const transport = new StreamableHTTPClientTransport(
      new URL("https://zeroclick.dev/mcp/v2"),
      {
        requestInit: { headers },
      },
    );
    await client.connect(transport);
    totalClientsCreated++;

    // Cache the client for reuse
    clientCache.set(cacheKey, {
      client,
      lastUsed: Date.now(),
      sessionId: userContext.sessionId,
    });

    // Clear any previous failure for this session
    sessionFailures.delete(cacheKey);
    logger.info({
      sessionId: cacheKey.slice(-8),
      cacheSize: clientCache.size,
      created: totalClientsCreated,
      closed: totalClientsClosed,
      orphaned: orphanedClientCount,
    }, "MCP signal client connected");
    return client;
  } catch (error) {
    logger.warn({ error: String(error), sessionId: cacheKey.slice(-8) }, "Failed to connect MCP signal client — will retry in 10s");
    sessionFailures.set(cacheKey, Date.now());
    return null;
  }
}

/**
 * Broadcast article context to ZeroClick via MCP signal.
 * Sends an "interest" signal with the article title and content so ZeroClick
 * can build preference profiles for better ad targeting.
 *
 * Fire-and-forget — errors are logged but don't affect the ad flow.
 * Clients are cached per-session and reused (not closed after each call).
 *
 * Docs:
 *   Tools: https://developer.zeroclick.ai/docs/signal-collection/tools
 *   Headers: https://developer.zeroclick.ai/docs/signal-collection/headers
 */
export async function broadcastArticleSignal(article: {
  url: string;
  title: string;
  content: string;
  sessionId?: string;
  userId?: string;
  locale?: string;
  ip?: string;
  userAgent?: string;
}): Promise<void> {
  // sessionId is required for client caching
  if (!article.sessionId) {
    logger.warn({ url: article.url }, "Missing sessionId for signal broadcast — skipping");
    return;
  }

  const memTracker = startMemoryTrack("zeroclick-signal-broadcast", {
    session_id: article.sessionId.slice(-8),
    content_length: article.content.length,
  });

  try {
    const client = await getOrCreateSignalClient({
      sessionId: article.sessionId,
      userId: article.userId,
      locale: article.locale,
      ip: article.ip,
      userAgent: article.userAgent,
    });
    if (!client) {
      memTracker.end({ success: false, reason: "no_client" });
      return;
    }

    memTracker.checkpoint("client-acquired");
    const result = await client.callTool({
      name: "broadcast_signal",
      arguments: {
        signals: [
          {
            category: "interest" as const,
            confidence: 0.7,
            subject: article.title.slice(0, 500),
            sourceContext: article.content.slice(0, 2000),
            extractionReason: "User is reading this article",
            attributes: {
              url: article.url,
              content_type: "article",
            },
          },
        ],
      },
    });
    memTracker.end({ success: true });
    logger.info({ url: article.url, result: JSON.stringify(result).slice(0, 200) }, "Article signal broadcasted");
  } catch (error) {
    const errorMsg = String(error);
    const isConnectionError = errorMsg.includes("ECONNRESET") || errorMsg.includes("socket") || errorMsg.includes("closed");
    logger.warn({ error: errorMsg, sessionId: article.sessionId?.slice(-8) }, "Failed to broadcast article signal");
    memTracker.end({ success: false, error: errorMsg.slice(0, 100), is_connection_error: isConnectionError });

    // If connection error, remove from cache and set per-session cooldown
    if (article.sessionId && isConnectionError) {
      const cached = clientCache.get(article.sessionId);
      if (cached) {
        clientCache.delete(article.sessionId);
        closeClientFireAndForget(cached.client);
        logger.info({ sessionId: article.sessionId.slice(-8) }, "Removed failed client from cache");
      }
      // Set per-session cooldown (doesn't block other users)
      sessionFailures.set(article.sessionId, Date.now());
    }
  }
  // No finally close — clients are cached and closed by cleanup interval or shutdown
}

// =============================================================================
// REST API — Fetch Offers (v2)
// Docs: https://developer.zeroclick.ai/docs/api-reference/offers/get-zeroclick-offers
// =============================================================================

const ZEROCLICK_OFFERS_URL = "https://zeroclick.dev/api/v2/offers";
const ZEROCLICK_TIMEOUT_MS = 5000;

/**
 * Fetch ad offers from ZeroClick REST API.
 * Uses method: "server" since we're calling from the backend.
 * Returns empty array on any failure (timeout, HTTP error, parse error).
 * Retries once on empty response (ZeroClick can intermittently return 0 offers).
 */
export async function fetchZeroClickOffers(context: {
  query: string;
  limit: number;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  userId?: string;
  origin?: string;
}): Promise<ZeroClickOffer[]> {
  const memTracker = startMemoryTrack("zeroclick-fetch-offers", {
    session_id: context.sessionId?.slice(-8),
    limit: context.limit,
    query_length: context.query.length,
  });

  const body: Record<string, unknown> = {
    method: "server",
    query: context.query,
    limit: context.limit,
  };
  if (context.ipAddress) body.ipAddress = context.ipAddress;
  if (context.userAgent) body.userAgent = context.userAgent;
  if (context.sessionId) body.userSessionId = context.sessionId;
  if (context.userId) body.userId = context.userId;
  if (context.origin) body.origin = context.origin;

  logger.info({ query: context.query.slice(0, 80), limit: context.limit }, "Fetching ZeroClick offers");

  // Try up to 2 times (initial + 1 retry on empty)
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ZEROCLICK_TIMEOUT_MS);

    try {
      const response = await fetch(ZEROCLICK_OFFERS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-zc-api-key": env.ZEROCLICK_API_KEY,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        logger.warn(
          { status: response.status, error: errorBody.slice(0, 200), attempt },
          "ZeroClick offers API error",
        );
        memTracker.end({ success: false, reason: "api_error", status: response.status, attempt });
        return [];
      }

      const data = await response.json();
      const offers: ZeroClickOffer[] = Array.isArray(data) ? data : data?.offers ?? [];

      if (offers.length === 0 && attempt === 0) {
        logger.info({ attempt, rawResponse: JSON.stringify(data).slice(0, 200) }, "ZeroClick returned 0 offers, retrying...");
        // Brief pause before retry
        await new Promise(r => setTimeout(r, 300));
        continue;
      }

      logger.info({ count: offers.length, requested: context.limit, attempt }, "ZeroClick offers received");
      memTracker.end({ success: true, offer_count: offers.length, attempt });
      return offers;
    } catch (error) {
      clearTimeout(timeoutId);
      const errorMsg = String(error);
      const isTimeout = errorMsg.includes("abort");
      logger.warn({ error: errorMsg, isTimeout, attempt }, "ZeroClick offers fetch failed");
      memTracker.end({ success: false, reason: isTimeout ? "timeout" : "fetch_error", attempt });
      return [];
    }
  }

  memTracker.end({ success: false, reason: "max_retries" });
  return [];
}

// =============================================================================
// Offer → ContextAd Mapping
// =============================================================================

/**
 * Convert a ZeroClick offer to our unified ContextAd format.
 *
 * clickUrl uses offer.clickUrl directly — the ZeroClick tracking redirect
 * URL (e.g. https://zero.click/{id}) that tracks clicks and sends users
 * to the advertiser.
 * impUrl uses `zeroclick://offer/{id}` — synthetic URL used client-side
 * to extract the offer ID for impression tracking via the v2 API.
 */
export function mapZeroClickOfferToAd(offer: ZeroClickOffer): ContextAd {
  return {
    adText: offer.subtitle || offer.content || "",
    title: offer.title,
    clickUrl: offer.clickUrl,
    impUrl: `zeroclick://offer/${offer.id}`,
    url: offer.clickUrl,
    brandName: offer.brand?.name || "",
    favicon: offer.brand?.iconUrl,
    cta: offer.cta,
    ad_provider: "zeroclick",
  };
}

