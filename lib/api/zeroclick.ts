/**
 * ZeroClick API Client
 *
 * Fetches contextual ad offers from ZeroClick as a fallback when Gravity
 * doesn't fill all available ad slots. ZeroClick uses server-side offer
 * fetching but requires client-side impression tracking.
 *
 * API docs: https://developer.zeroclick.ai/docs/offers/rest-api
 *
 * Key contract:
 * - Offers: POST /api/v2/offers (server-side, requires x-zc-api-key)
 * - Impressions: POST /api/v2/impressions (client-side only, no auth)
 *   Body: { ids: [offer.id, ...] } — must be called from the browser
 */

import { createLogger } from "@/lib/logger";
import { env } from "../../server/env";

const logger = createLogger("lib:zeroclick");

/** ZeroClick API endpoint for fetching offers */
const ZEROCLICK_API_URL = "https://zeroclick.dev/api/v2/offers";

/** Timeout for ZeroClick API requests (shorter than Gravity since it's a fallback) */
const ZEROCLICK_TIMEOUT_MS = 3000;

/**
 * Raw offer shape returned by ZeroClick's /api/v2/offers endpoint.
 * See: https://developer.zeroclick.ai/docs/api-reference/offers/get-zeroclick-offers
 */
export interface ZeroClickOffer {
  /** Unique offer ID — used for impression tracking via /api/v2/impressions */
  id: string;
  title: string;
  subtitle?: string;
  content?: string;
  cta?: string;
  clickUrl: string;
  imageUrl?: string;
  brand?: {
    name?: string;
    description?: string;
    url?: string;
    iconUrl?: string;
  };
  product?: {
    productId?: string;
    title?: string;
    category?: string;
  };
}

/** Options for fetching ZeroClick offers */
export interface ZeroClickFetchOptions {
  /** Search query (typically the article title) for contextual matching */
  query: string;
  /** Maximum number of offers to return */
  limit: number;
  /** Client IP address for geo-targeting */
  ipAddress: string;
  /** Client user agent string */
  userAgent?: string;
}

/** Result from a ZeroClick fetch, including timing info */
export interface ZeroClickFetchResult {
  offers: ZeroClickOffer[];
  durationMs: number;
}

/**
 * Fetch contextual ad offers from ZeroClick.
 *
 * Makes a POST request to ZeroClick's server-side offers API with the article
 * context. Returns an empty array on timeout or error (never throws).
 */
export async function fetchOffers(
  opts: ZeroClickFetchOptions
): Promise<ZeroClickFetchResult> {
  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ZEROCLICK_TIMEOUT_MS);

  try {
    const response = await fetch(ZEROCLICK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-zc-api-key": env.ZEROCLICK_API_KEY,
      },
      body: JSON.stringify({
        method: "server",
        query: opts.query,
        limit: opts.limit,
        ipAddress: opts.ipAddress,
        userAgent: opts.userAgent,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const durationMs = Date.now() - startTime;

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      logger.warn(
        { status: response.status, error: errorBody, durationMs },
        "ZeroClick API error"
      );
      return { offers: [], durationMs };
    }

    // ZeroClick returns a flat array of offers per their docs
    const data = await response.json();
    const offers: ZeroClickOffer[] = Array.isArray(data) ? data : [];
    if (!Array.isArray(data)) {
      logger.warn({ responseKeys: data != null ? Object.keys(data) : [], durationMs }, "ZeroClick returned unexpected response shape");
    }
    logger.info({ offerCount: offers.length, durationMs }, "ZeroClick offers received");
    return { offers, durationMs };
  } catch (error) {
    clearTimeout(timeoutId);
    const durationMs = Date.now() - startTime;
    const errorMsg = String(error);
    const isTimeout = errorMsg.includes("abort");
    logger.warn({ error: errorMsg, isTimeout, durationMs }, "ZeroClick fetch error");
    return { offers: [], durationMs };
  }
}

/**
 * Normalize a ZeroClick offer into our ContextAd shape.
 *
 * Key differences from Gravity ads:
 * - `provider` is always "zeroclick"
 * - `impUrl` is empty (ZeroClick uses ID-based client-side impression tracking)
 * - `zeroClickId` carries the offer ID for client-side sendBeacon tracking
 */
export function normalizeOffer(offer: ZeroClickOffer): {
  adText: string;
  title: string;
  clickUrl: string;
  impUrl: string;
  brandName: string;
  favicon: string;
  cta: string;
  provider: "zeroclick";
  zeroClickId: string;
} {
  return {
    title: offer.title,
    adText: offer.content || offer.subtitle || "",
    clickUrl: offer.clickUrl,
    impUrl: "", // ZeroClick uses ID-based client-side tracking
    brandName: offer.brand?.name || offer.title,
    favicon: offer.brand?.iconUrl || offer.imageUrl || "",
    cta: offer.cta || "Learn more",
    provider: "zeroclick" as const,
    zeroClickId: offer.id,
  };
}
