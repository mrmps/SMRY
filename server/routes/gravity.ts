/**
 * Gravity Routes - POST /api/context, POST /api/px
 *
 * /api/context - Fetches contextual ads from Gravity AI for free users.
 * /api/px - Unified tracking for impressions, clicks, dismissals.
 *           For impressions, wraps Gravity forwarding + ClickHouse logging atomically.
 *
 * Endpoint names are neutral to avoid content blockers (no "ad" or "track" in names).
 */

import { Elysia, t } from "elysia";
import { getAuthInfo } from "../middleware/auth";
import { env } from "../env";
import { extractClientIp } from "../../lib/request-context";
import { createLogger } from "../../lib/logger";
import { trackAdEvent, type AdEventStatus } from "../../lib/clickhouse";
import {
  fetchZeroClickOffers,
  mapZeroClickOfferToAd,
  broadcastArticleSignal,
} from "../../lib/zeroclick";
import type { ContextAd } from "../../types/api";
import { startMemoryTrack } from "../../lib/memory-tracker";

const logger = createLogger("api:gravity");

const GRAVITY_API_URL = "https://server.trygravity.ai/api/v1/ad";
const GRAVITY_TIMEOUT_MS = 6000;

// Use test ads in development
const USE_TEST_ADS = env.NODE_ENV === "development";

// DEV ONLY: Skip Gravity to test ZeroClick fallback path
const SKIP_GRAVITY = env.NODE_ENV === "development" && false;

interface GravityMessage {
  role: "user" | "assistant";
  content: string;
}

interface GravityPlacement {
  placement: "above_response" | "below_response" | "inline_response" | "left_response" | "right_response";
  placement_id: string;
}

interface GravityDevice {
  ip?: string;
  os?: string;
  timezone?: string;
  locale?: string;
  language?: string;
  ua?: string;
  browser?: string;
  device_type?: "desktop" | "mobile" | "tablet";
  screen_width?: number;
  screen_height?: number;
  viewport_width?: number;
  viewport_height?: number;
}

interface GravityUser {
  id?: string;
  email?: string;
}

interface GravityRequest {
  messages: GravityMessage[];
  sessionId: string;
  placements: GravityPlacement[];
  testAd?: boolean;
  relevancy?: number;
  device?: GravityDevice;
  user?: GravityUser;
}

export interface GravityAdResponse {
  adText: string;
  title: string;
  clickUrl: string;
  impUrl: string;
  brandName: string;
  url?: string;
  favicon?: string;
  cta?: string;
}

// Timeout for Gravity impression forwarding (keep short to not block)
const GRAVITY_IMPRESSION_TIMEOUT_MS = 3000;

/**
 * Forward impression to Gravity and return the result
 * This is the critical path for monetization - if this fails, we don't get paid
 */
async function forwardImpressionToGravity(impUrl: string): Promise<{
  forwarded: boolean;
  statusCode: number;
  error?: string;
}> {
  // Validate URL is from Gravity
  try {
    const parsedUrl = new URL(impUrl);
    if (!parsedUrl.hostname.endsWith("trygravity.ai")) {
      return { forwarded: false, statusCode: 0, error: "Invalid impression URL domain" };
    }
  } catch {
    return { forwarded: false, statusCode: 0, error: "Invalid URL format" };
  }

  // Forward the impression to Gravity with timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GRAVITY_IMPRESSION_TIMEOUT_MS);

  try {
    const response = await fetch(impUrl, {
      method: "GET",
      headers: {
        "User-Agent": "13ft-impression-proxy/1.0",
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    // Consume body to release connection resources
    await response.text().catch(() => {});

    logger.info({ impUrl: impUrl.slice(-50), status: response.status }, "Impression forwarded to Gravity");
    return { forwarded: true, statusCode: response.status };
  } catch (error) {
    clearTimeout(timeoutId);
    const errorMsg = String(error);
    const isTimeout = errorMsg.includes("abort");
    logger.warn({ impUrl: impUrl.slice(-50), error: errorMsg, isTimeout }, "Failed to forward impression to Gravity");
    return {
      forwarded: false,
      statusCode: 0,
      error: isTimeout ? "timeout" : errorMsg.slice(0, 100)
    };
  }
}

export const gravityRoutes = new Elysia({ prefix: "/api" })
  /**
   * Unified tracking endpoint for impressions, clicks, and dismissals.
   *
   * CRITICAL: For impressions, this endpoint WRAPS the Gravity impression pixel call.
   * This ensures ClickHouse accurately reflects whether Gravity received the impression.
   * Without this, we'd log impressions locally without knowing if we got paid.
   *
   * Named "/px" to avoid ad blocker detection (no "ad" or "track" in the name).
   */
  .post(
    "/px",
    async ({ body, set }) => {
      const { type, sessionId, hostname, brandName, adTitle, adText, clickUrl, impUrl, cta, favicon, deviceType, os, browser, adProvider } = body;

      // Derive provider from impUrl prefix only — never trust client-sent adProvider
      // for forwarding decisions (prevents spoofing to skip Gravity billing)
      const isZeroClick = impUrl?.startsWith("zeroclick://") ?? false;
      // adProvider from client is used only for ClickHouse logging, not forwarding logic
      const provider = isZeroClick ? "zeroclick" : "gravity";

      // For impressions with impUrl, forward to the appropriate provider
      // ZeroClick impressions are tracked client-side (required by ZeroClick docs for accurate IP/UA)
      // so we only forward Gravity impressions server-side
      let gravityResult: { forwarded: boolean; statusCode: number; error?: string } | null = null;

      if (type === "impression" && impUrl && provider !== "zeroclick") {
        gravityResult = await forwardImpressionToGravity(impUrl);
      }

      // Now track to ClickHouse WITH the Gravity result
      try {
        trackAdEvent({
          event_type: type,
          session_id: sessionId,
          hostname,
          brand_name: brandName,
          ad_title: adTitle,
          ad_text: adText,
          click_url: clickUrl,
          imp_url: impUrl,
          cta,
          favicon,
          device_type: deviceType,
          os,
          browser,
          status: "filled", // Client-side events only fire for filled ads
          // Include Gravity forwarding result for impressions
          // gravity_forwarded = 1 means Gravity received it (we got paid)
          gravity_forwarded: gravityResult?.forwarded ? 1 : 0,
          gravity_status_code: gravityResult?.statusCode ?? 0,
          error_message: gravityResult?.error ?? "",
        });

        logger.debug({
          type,
          hostname,
          brandName,
          gravityForwarded: gravityResult?.forwarded,
          gravityStatus: gravityResult?.statusCode,
        }, "Event tracked");
      } catch (error) {
        // Log but don't fail the request - tracking is best-effort
        logger.warn({ error: String(error), type }, "Failed to track event");
      }

      // Return 204 No Content - client doesn't need a response body
      set.status = 204;
      return;
    },
    {
      body: t.Object({
        type: t.Union([
          t.Literal("impression"),
          t.Literal("click"),
          t.Literal("dismiss"),
        ]),
        sessionId: t.String(),
        hostname: t.String(),
        brandName: t.Optional(t.String()),
        adTitle: t.Optional(t.String()),
        adText: t.Optional(t.String()),
        clickUrl: t.Optional(t.String()),
        impUrl: t.Optional(t.String()),
        cta: t.Optional(t.String()),
        favicon: t.Optional(t.String()),
        deviceType: t.Optional(t.String()),
        os: t.Optional(t.String()),
        browser: t.Optional(t.String()),
        adProvider: t.Optional(t.String()),
      }),
    }
  )
  .post(
  "/context",
  async ({ body, request }) => {
    const startTime = Date.now();
    const { title, url, articleContent, sessionId, device, user, byline, siteName, publishedTime, lang, prompt } = body;
    const hostname = (() => { try { return new URL(url).hostname; } catch { return "unknown"; } })();
    const memTracker = startMemoryTrack("ad-context-request", {
      url_host: hostname,
      session_id: sessionId?.slice(-8),
      article_content_length: articleContent?.length || 0,
    });

    // Helper to extract hostname from URL
    const getHostname = (urlStr: string): string => {
      try { return new URL(urlStr).hostname; } catch { return ""; }
    };

    // Helper to track ad event
    const track = (status: AdEventStatus, extra: {
      gravityStatus?: number;
      errorMessage?: string;
      brandName?: string;
      adTitle?: string;
      adText?: string;
      clickUrl?: string;
      impUrl?: string;
      cta?: string;
      favicon?: string;
      userId?: string | null;
      isPremium?: boolean;
      adCount?: number;
    } = {}) => {
      trackAdEvent({
        event_type: "request", // Server-side events are always "request" type
        url,
        hostname: getHostname(url),
        article_title: title,
        article_content_length: articleContent?.length || 0,
        session_id: sessionId,
        user_id: extra.userId ?? user?.id ?? "",
        is_premium: extra.isPremium ? 1 : 0,
        device_type: device?.deviceType ?? "",
        os: device?.os ?? "",
        browser: device?.browser ?? "",
        status,
        gravity_status_code: extra.gravityStatus ?? 0,
        error_message: extra.errorMessage ?? "",
        brand_name: extra.brandName ?? "",
        ad_title: extra.adTitle ?? "",
        ad_text: extra.adText ?? "",
        click_url: extra.clickUrl ?? "",
        imp_url: extra.impUrl ?? "",
        cta: extra.cta ?? "",
        favicon: extra.favicon ?? "",
        ad_count: extra.adCount ?? 0,
        duration_ms: Date.now() - startTime,
      });
    };

    try {
      // Check premium status
      const { isPremium, userId } = await getAuthInfo(request);
      if (isPremium) {
        track("premium_user", { userId, isPremium: true });
        memTracker.end({ status: "premium_user" });
        return { status: "premium_user" as const };
      }

      // Build conversation context for Gravity with rich metadata
      const metadataParts = [
        `Title: ${title}`,
        `URL: ${url}`,
        byline && `Author: ${byline}`,
        siteName && `Publisher: ${siteName}`,
        publishedTime && `Published: ${publishedTime}`,
        lang && `Language: ${lang}`,
      ].filter(Boolean).join("\n");

      const userContent = prompt
        ? `I'm reading this article:\n\n${metadataParts}\n\nArticle content:\n${articleContent}\n\nAd instruction: ${prompt}`
        : `I'm reading this article:\n\n${metadataParts}\n\nArticle content:\n${articleContent}`;

      const messages: GravityMessage[] = [
        { role: "user", content: userContent },
      ];

      // Build device info with IP from request
      const clientIp = extractClientIp(request);
      const gravityDevice: GravityDevice | undefined = device ? {
        ip: clientIp,
        os: device.os,
        timezone: device.timezone,
        locale: device.locale,
        language: device.language,
        ua: device.ua,
        browser: device.browser,
        device_type: device.deviceType,
        screen_width: device.screenWidth,
        screen_height: device.screenHeight,
        viewport_width: device.viewportWidth,
        viewport_height: device.viewportHeight,
      } : undefined;

      // Build user info - prefer authenticated user ID
      const gravityUser: GravityUser | undefined = (userId || user) ? {
        id: userId || user?.id,
        email: user?.email,
      } : undefined;

      // Request ads from Gravity
      // Note: Gravity may return duplicate ads if inventory is limited
      // We deduplicate on our side before showing to users
      // Number of ads returned = placements array length (per Gravity docs)
      const gravityRequest: GravityRequest = {
        messages,
        sessionId,
        placements: [
          { placement: "right_response", placement_id: "smry-sidebar-right" },
          { placement: "inline_response", placement_id: "smry-article-inline" },
          { placement: "below_response", placement_id: "smry-footer-bottom" },
          { placement: "above_response", placement_id: "smry-chat-header" },
          { placement: "left_response", placement_id: "smry-input-micro" },
        ],
        ...(USE_TEST_ADS && { testAd: true }),
        relevancy: 0,
        device: gravityDevice,
        user: gravityUser,
      };

      // DEV: Skip Gravity entirely to test ZeroClick fallback
      if (SKIP_GRAVITY) {
        logger.info({ url }, "SKIP_GRAVITY enabled — skipping Gravity, going straight to ZeroClick");
        broadcastArticleSignal({
          url, title, content: articleContent || "",
          sessionId,
          userId: userId || user?.id,
          locale: device?.locale,
          ip: clientIp,
          userAgent: device?.ua,
        }).catch(() => {});
        const zcOffers = await fetchZeroClickOffers({
          query: `${title} ${articleContent || ""}`.slice(0, 500),
          limit: 5,
          ipAddress: clientIp,
          userAgent: device?.ua,
          sessionId,
          userId: userId || user?.id,
          origin: url,
        });
        const zcAds: ContextAd[] = zcOffers.map(mapZeroClickOfferToAd);
        if (zcAds.length > 0) {
          const primaryAd = zcAds[0];
          track("filled", {
            brandName: primaryAd.brandName,
            adTitle: primaryAd.title,
            adText: primaryAd.adText,
            clickUrl: primaryAd.clickUrl,
            impUrl: primaryAd.impUrl,
            cta: primaryAd.cta,
            favicon: primaryAd.favicon,
            userId,
            adCount: zcAds.length,
          });
          memTracker.end({ status: "filled", ad_count: zcAds.length, provider: "zeroclick_skip_gravity" });
          return { status: "filled" as const, ad: primaryAd, ads: zcAds };
        }
        track("no_fill", { userId });
        memTracker.end({ status: "no_fill", reason: "skip_gravity_no_zeroclick" });
        return { status: "no_fill" as const, debug: { errorMessage: "ZeroClick returned no offers" } };
      }

      // Log the request being sent to Gravity
      logger.info({
        url,
        sessionId,
        titleLength: title?.length || 0,
        articleContentLength: articleContent?.length || 0,
        hasDevice: !!gravityDevice,
        hasUser: !!gravityUser,
        testAd: USE_TEST_ADS,
      }, "Sending ad request to Gravity");

      // Call Gravity API with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), GRAVITY_TIMEOUT_MS);

      try {
        const response = await fetch(GRAVITY_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${env.GRAVITY_API_KEY}`,
          },
          body: JSON.stringify(gravityRequest),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Parse Gravity response into ads array
        let gravityAds: ContextAd[] = [];

        if (response.status === 204) {
          logger.info({ url, status: 204 }, "No matching ad from Gravity");
        } else if (!response.ok) {
          const errorBody = await response.text().catch(() => "");
          logger.warn({ url, status: response.status, error: errorBody }, "Gravity API error");
          track("gravity_error", { gravityStatus: response.status, errorMessage: errorBody.slice(0, 200), userId });
        } else {
          const rawAds = (await response.json()) as GravityAdResponse[];
          if (rawAds && rawAds.length > 0) {
            const adSummary = rawAds.map((ad, i) => ({
              index: i,
              brandName: ad.brandName,
              title: ad.title?.slice(0, 50),
              impUrl: ad.impUrl?.slice(-20),
            }));
            logger.info({
              url,
              adCount: rawAds.length,
              uniqueBrands: [...new Set(rawAds.map(a => a.brandName))].length,
              uniqueImpUrls: [...new Set(rawAds.map(a => a.impUrl))].length,
              ads: adSummary,
            }, "Ad(s) received from Gravity");
            // Tag Gravity ads with provider
            gravityAds = rawAds.map((ad) => ({
              ...ad,
              ad_provider: "gravity" as const,
            }));
          } else {
            logger.info({ url }, "Empty ad array from Gravity");
          }
        }

        // --- ZeroClick Waterfall ---
        // If Gravity returned fewer than 5 ads, try ZeroClick for remaining slots
        const TARGET_AD_COUNT = 5;
        let allAds: ContextAd[] = [...gravityAds];

        if (gravityAds.length < TARGET_AD_COUNT) {
          const remaining = TARGET_AD_COUNT - gravityAds.length;
          logger.info({ url, gravityCount: gravityAds.length, remaining }, "Trying ZeroClick for remaining slots");

          // Fire signal in background (don't await — best-effort)
          broadcastArticleSignal({
            url, title, content: articleContent || "",
            sessionId,
            userId: userId || user?.id,
            locale: device?.locale,
            ip: clientIp,
            userAgent: device?.ua,
          }).catch(() => {});

          const zcOffers = await fetchZeroClickOffers({
            query: `${title} ${articleContent || ""}`.slice(0, 500),
            limit: remaining,
            ipAddress: clientIp,
            userAgent: device?.ua,
            sessionId,
            userId: userId || user?.id,
            origin: url,
          });

          if (zcOffers.length > 0) {
            const zcAds = zcOffers.map(mapZeroClickOfferToAd);
            allAds = [...gravityAds, ...zcAds];
            logger.info({ url, gravityCount: gravityAds.length, zcCount: zcAds.length, totalCount: allAds.length }, "Waterfall merged ads");
          }
        }

        // Return combined results
        if (allAds.length > 0) {
          const primaryAd = allAds[0];
          const gravityCount = gravityAds.length;
          const zcCount = allAds.length - gravityCount;
          track("filled", {
            gravityStatus: response.ok ? 200 : response.status,
            brandName: primaryAd.brandName,
            adTitle: primaryAd.title,
            adText: primaryAd.adText,
            clickUrl: primaryAd.clickUrl,
            impUrl: primaryAd.impUrl,
            cta: primaryAd.cta,
            favicon: primaryAd.favicon,
            userId,
            adCount: allAds.length,
          });
          memTracker.end({ status: "filled", ad_count: allAds.length, gravity_count: gravityCount, zeroclick_count: zcCount });
          return {
            status: "filled" as const,
            ad: primaryAd,
            ads: allAds,
          };
        }

        // Nothing from either provider
        track("no_fill", { gravityStatus: response.status, userId });
        memTracker.end({ status: "no_fill", gravity_status: response.status });
        return {
          status: "no_fill" as const,
          debug: { gravityStatus: response.status },
        };
      } catch (fetchError) {
        clearTimeout(timeoutId);
        const errorMsg = String(fetchError);
        const isTimeout = errorMsg.includes("abort");
        logger.warn({ error: errorMsg, isTimeout }, "Gravity fetch error");

        // Gravity failed entirely — try ZeroClick as full fallback
        let zcAds: ContextAd[] = [];
        try {
          broadcastArticleSignal({
            url, title, content: articleContent || "",
            sessionId,
            userId: userId || user?.id,
            locale: device?.locale,
            ip: clientIp,
            userAgent: device?.ua,
          }).catch(() => {});
          const zcOffers = await fetchZeroClickOffers({
            query: `${title} ${articleContent || ""}`.slice(0, 500),
            limit: 5,
            ipAddress: clientIp,
            userAgent: device?.ua,
            sessionId,
            userId: userId || user?.id,
            origin: url,
          });
          zcAds = zcOffers.map(mapZeroClickOfferToAd);
        } catch (zcError) {
          logger.warn({ error: String(zcError) }, "ZeroClick fallback also failed");
        }

        if (zcAds.length > 0) {
          const primaryAd = zcAds[0];
          logger.info({ url, zcCount: zcAds.length }, "ZeroClick fallback filled after Gravity failure");
          track("filled", {
            errorMessage: `gravity_failed: ${errorMsg.slice(0, 100)}`,
            brandName: primaryAd.brandName,
            adTitle: primaryAd.title,
            adText: primaryAd.adText,
            clickUrl: primaryAd.clickUrl,
            impUrl: primaryAd.impUrl,
            cta: primaryAd.cta,
            favicon: primaryAd.favicon,
            userId,
            adCount: zcAds.length,
          });
          memTracker.end({ status: "filled", ad_count: zcAds.length, provider: "zeroclick_fallback", gravity_error: true });
          return {
            status: "filled" as const,
            ad: primaryAd,
            ads: zcAds,
          };
        }

        const status = isTimeout ? "timeout" : "gravity_error";
        track(status, { errorMessage: errorMsg.slice(0, 200), userId });
        memTracker.end({ status, is_timeout: isTimeout });
        return {
          status: status as "timeout" | "gravity_error",
          debug: { errorMessage: errorMsg.slice(0, 200) },
        };
      }
    } catch (error) {
      const errorMsg = String(error);
      logger.error({ error: errorMsg }, "Unexpected error in context route");
      track("error", { errorMessage: errorMsg.slice(0, 200) });
      memTracker.end({ status: "error", error: errorMsg.slice(0, 100) });
      return {
        status: "error" as const,
        debug: { errorMessage: errorMsg.slice(0, 200) },
      };
    }
  },
  {
    body: t.Object({
      url: t.String(),
      title: t.String(),
      articleContent: t.String(), // The actual article text (truncated to ~4000 chars)
      sessionId: t.String(),
      device: t.Optional(t.Object({
        timezone: t.Optional(t.String()),
        locale: t.Optional(t.String()),
        language: t.Optional(t.String()),
        ua: t.Optional(t.String()),
        os: t.Optional(t.String()),
        browser: t.Optional(t.String()),
        deviceType: t.Optional(t.Union([
          t.Literal("desktop"),
          t.Literal("mobile"),
          t.Literal("tablet"),
        ])),
        screenWidth: t.Optional(t.Number()),
        screenHeight: t.Optional(t.Number()),
        viewportWidth: t.Optional(t.Number()),
        viewportHeight: t.Optional(t.Number()),
      })),
      user: t.Optional(t.Object({
        id: t.Optional(t.String()),
        email: t.Optional(t.String()),
      })),
      // Additional article metadata for better ad targeting
      byline: t.Optional(t.String()),
      siteName: t.Optional(t.String()),
      publishedTime: t.Optional(t.String()),
      lang: t.Optional(t.String()),
      prompt: t.Optional(t.String()),
    }),
  }
);
