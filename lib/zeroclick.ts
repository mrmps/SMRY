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

let signalClient: Client | null = null;
let signalClientReady = false;
let signalLastFailure = 0;
const SIGNAL_RETRY_COOLDOWN_MS = 60_000; // Back off 60s after failure

/**
 * Build a fresh MCP Signal Client with per-user context headers.
 * Creates a new client each time to support per-user headers as recommended
 * by ZeroClick docs ("One client instance per user session").
 */
async function createSignalClient(userContext?: {
  userId?: string;
  sessionId?: string;
  locale?: string;
  ip?: string;
  userAgent?: string;
}): Promise<Client | null> {
  // Per-user context = fields that require unique headers per request.
  // sessionId is excluded because it's always present and doesn't need
  // a dedicated client — only userId/locale/ip/userAgent matter.
  const hasUserContext = !!(
    userContext?.userId ||
    userContext?.locale ||
    userContext?.ip ||
    userContext?.userAgent
  );

  // Cooldown only applies to the shared client — per-user clients are
  // ephemeral and shouldn't be blocked by shared client failures.
  if (!hasUserContext) {
    if (Date.now() - signalLastFailure < SIGNAL_RETRY_COOLDOWN_MS) {
      return null;
    }
    // Reuse cached shared client if available
    if (signalClient && signalClientReady) {
      return signalClient;
    }
  }

  try {
    // Build headers — required + optional user context
    const headers: Record<string, string> = {
      "x-zc-api-key": env.ZEROCLICK_API_KEY,
      "x-zc-llm-model": "anthropic/claude-sonnet-4.5",
    };
    if (userContext?.userId) headers["x-zc-user-id"] = userContext.userId;
    if (userContext?.sessionId) headers["x-zc-user-session-id"] = userContext.sessionId;
    if (userContext?.locale) headers["x-zc-user-locale"] = userContext.locale;
    if (userContext?.ip) headers["x-zc-user-ip"] = userContext.ip;
    if (userContext?.userAgent) headers["x-zc-user-agent"] = userContext.userAgent.slice(0, 1000);

    const client = new Client({ name: "smry", version: "1.0.0" });
    const transport = new StreamableHTTPClientTransport(
      new URL("https://zeroclick.dev/mcp/v2"),
      {
        requestInit: { headers },
      },
    );
    await client.connect(transport);

    // Cache for reuse when no per-user headers
    if (!hasUserContext) {
      signalClient = client;
      signalClientReady = true;
    }
    signalLastFailure = 0;
    logger.info("MCP signal client connected");
    return client;
  } catch (error) {
    logger.warn({ error: String(error) }, "Failed to connect MCP signal client — will retry in 60s");
    // Only set cooldown for shared client failures
    if (!hasUserContext) {
      signalClient = null;
      signalClientReady = false;
      signalLastFailure = Date.now();
    }
    return null;
  }
}

/**
 * Broadcast article context to ZeroClick via MCP signal.
 * Sends an "interest" signal with the article title and content so ZeroClick
 * can build preference profiles for better ad targeting.
 *
 * Fire-and-forget — errors are logged but don't affect the ad flow.
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
  // Match createSignalClient's logic — sessionId excluded (always present)
  const isPerUser = !!(article.userId || article.locale || article.ip || article.userAgent);
  let client: Client | null = null;
  try {
    client = await createSignalClient({
      userId: article.userId,
      sessionId: article.sessionId,
      locale: article.locale,
      ip: article.ip,
      userAgent: article.userAgent,
    });
    if (!client) return;

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
    logger.info({ url: article.url, result: JSON.stringify(result).slice(0, 200) }, "Article signal broadcasted");

    // Close per-user clients to avoid resource leaks
    if (isPerUser) {
      await client.close().catch(() => {});
    }
  } catch (error) {
    logger.warn({ error: String(error) }, "Failed to broadcast article signal");
    // Only reset global state if this was the shared (non-per-user) client.
    // Per-user failures should NOT trigger a 60s cooldown for all users.
    if (!isPerUser) {
      signalClient = null;
      signalClientReady = false;
      signalLastFailure = Date.now();
    }
    // Close per-user client on error to avoid resource leaks
    if (isPerUser && client) {
      await client.close().catch(() => {});
    }
  }
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
      return offers;
    } catch (error) {
      clearTimeout(timeoutId);
      const errorMsg = String(error);
      const isTimeout = errorMsg.includes("abort");
      logger.warn({ error: errorMsg, isTimeout, attempt }, "ZeroClick offers fetch failed");
      return [];
    }
  }

  return [];
}

// =============================================================================
// Offer → ContextAd Mapping
// =============================================================================

/**
 * Convert a ZeroClick offer to our unified ContextAd format.
 *
 * clickUrl uses `https://mcp.zeroclick.ai/offers/{id}` — the ZeroClick
 * redirect URL that tracks clicks and sends users to the advertiser.
 * The original advertiser URL is stored in `url` for reference.
 * impUrl uses `zeroclick://offer/{id}` — synthetic URL used client-side
 * to extract the offer ID for manual impression tracking via the API.
 */
export function mapZeroClickOfferToAd(offer: ZeroClickOffer): ContextAd {
  return {
    adText: offer.subtitle || offer.content || "",
    title: offer.title,
    clickUrl: `https://mcp.zeroclick.ai/offers/${offer.id}`,
    impUrl: `zeroclick://offer/${offer.id}`,
    url: offer.clickUrl,
    brandName: offer.brand?.name || "",
    favicon: offer.brand?.iconUrl,
    cta: offer.cta,
    ad_provider: "zeroclick",
  };
}

