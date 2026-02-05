/**
 * Gravity Routes - POST /api/context, POST /api/px
 *
 * /api/context - Fetches contextual ads from Gravity AI for free users
 * /api/px - Unified ad event tracking (impression, click, dismiss)
 *   - For impressions: forwards to Gravity for billing + tracks locally
 *   - For clicks/dismisses: tracks locally only
 *
 * Endpoint names are neutral to avoid content blockers.
 */

import { Elysia, t } from "elysia";
import { getAuthInfo } from "../middleware/auth";
import { env } from "../env";
import { extractClientIp } from "../../lib/request-context";
import { createLogger } from "../../lib/logger";
import { trackAdEvent, type AdEventStatus } from "../../lib/clickhouse";

const logger = createLogger("api:gravity");

const GRAVITY_API_URL = "https://server.trygravity.ai/api/v1/ad";
const GRAVITY_TIMEOUT_MS = 6000;

// Use test ads in development
const USE_TEST_ADS = env.NODE_ENV === "development";

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
  numAds?: number;
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

export const gravityRoutes = new Elysia({ prefix: "/api" })
  .post(
    "/px",
    async ({ query, body, set }) => {
      const impUrl = query.url;
      const eventType = body.type || "impression";

      // Track validation/forwarding status for analytics
      let gravityStatusCode = 0;
      let validationError = "";

      // For impressions, validate and forward to Gravity for billing
      if (eventType === "impression" && impUrl) {
        // Validate URL is from Gravity
        let isValidUrl = false;
        try {
          const parsedUrl = new URL(impUrl);
          if (parsedUrl.hostname.endsWith("trygravity.ai")) {
            isValidUrl = true;
          } else {
            validationError = "Invalid impression URL: not from trygravity.ai";
            logger.warn({ impUrl }, validationError);
          }
        } catch {
          validationError = "Invalid URL format";
          logger.warn({ impUrl }, validationError);
        }

        // Forward to Gravity only if URL is valid
        if (isValidUrl) {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), GRAVITY_TIMEOUT_MS);

          try {
            logger.info({ impUrl }, "Forwarding impression to Gravity");
            const response = await fetch(impUrl, {
              method: "GET",
              headers: {
                "User-Agent": "13ft-impression-proxy/1.0",
              },
              signal: controller.signal,
            });
            clearTimeout(timeoutId);
            await response.text().catch(() => {});
            gravityStatusCode = response.status;

            if (response.ok) {
              logger.info({ impUrl, status: response.status }, "Impression forwarded successfully");
            } else {
              validationError = `Gravity returned ${response.status}`;
              logger.warn({ impUrl, status: response.status }, "Gravity returned non-2xx status");
            }
          } catch (error) {
            clearTimeout(timeoutId);
            const errorMsg = String(error);
            const isTimeout = errorMsg.includes("abort");
            validationError = isTimeout ? "Timeout forwarding to Gravity" : `Failed to forward: ${errorMsg}`;
            logger.warn({ impUrl, error: errorMsg, isTimeout }, "Failed to forward impression");
          }
        }
      }

      // Always track event locally for analytics (even if Gravity forwarding failed)
      trackAdEvent({
        event_type: eventType as "impression" | "click" | "dismiss",
        session_id: body.sessionId,
        hostname: body.hostname || "",
        brand_name: body.brandName || "",
        ad_title: body.adTitle || "",
        ad_text: body.adText || "",
        click_url: body.clickUrl || "",
        imp_url: body.impUrl || impUrl || "",
        cta: body.cta || "",
        favicon: body.favicon || "",
        device_type: body.deviceType || "",
        os: body.os || "",
        browser: body.browser || "",
        status: "filled",
        gravity_status_code: gravityStatusCode,
        error_message: validationError,
      });
      logger.debug({
        type: eventType,
        hostname: body.hostname,
        brandName: body.brandName,
        gravityStatusCode,
        validationError: validationError || undefined,
      }, "Ad event tracked");

      set.status = 204;
      return;
    },
    {
      query: t.Object({
        url: t.Optional(t.String()),
      }),
      body: t.Object({
        type: t.Optional(t.Union([
          t.Literal("impression"),
          t.Literal("click"),
          t.Literal("dismiss"),
        ])),
        sessionId: t.String(),
        hostname: t.Optional(t.String()),
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
      }),
    }
  )
  .post(
  "/context",
  async ({ body, request }) => {
    const startTime = Date.now();
    const { title, url, articleContent, sessionId, device, user, byline, siteName, publishedTime, lang, prompt } = body;

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
        duration_ms: Date.now() - startTime,
      });
    };

    try {
      // Check premium status
      const { isPremium, userId } = await getAuthInfo(request);
      if (isPremium) {
        track("premium_user", { userId, isPremium: true });
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

      const gravityRequest: GravityRequest = {
        messages,
        sessionId,
        numAds: 5, // Request 5 ads: sidebar, inline, footer, chat, micro
        placements: [
          { placement: "right_response", placement_id: "smry-sidebar-right" },
          { placement: "inline_response", placement_id: "smry-article-inline" },
          { placement: "below_response", placement_id: "smry-footer-bottom" },
          { placement: "above_response", placement_id: "smry-chat-header" },
          { placement: "below_response", placement_id: "smry-input-micro" },
        ],
        ...(USE_TEST_ADS && { testAd: true }),
        relevancy: 0,
        device: gravityDevice,
        user: gravityUser,
      };

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

        // No matching ad from Gravity
        if (response.status === 204) {
          logger.info({ url, status: 204 }, "No matching ad from Gravity");
          track("no_fill", { gravityStatus: 204, userId });
          return {
            status: "no_fill" as const,
            debug: { gravityStatus: 204 },
          };
        }

        // Gravity API error
        if (!response.ok) {
          const errorBody = await response.text().catch(() => "");
          logger.warn({ url, status: response.status, error: errorBody }, "Gravity API error");
          track("gravity_error", { gravityStatus: response.status, errorMessage: errorBody.slice(0, 200), userId });
          return {
            status: "gravity_error" as const,
            debug: { gravityStatus: response.status, errorMessage: errorBody.slice(0, 200) },
          };
        }

        const ads = (await response.json()) as GravityAdResponse[];

        if (ads && ads.length > 0) {
          logger.info({ url, brandName: ads[0].brandName, adCount: ads.length }, "Ad(s) received from Gravity");
          // Track each ad
          for (const ad of ads) {
            track("filled", {
              gravityStatus: 200,
              brandName: ad.brandName,
              adTitle: ad.title,
              adText: ad.adText,
              clickUrl: ad.clickUrl,
              impUrl: ad.impUrl,
              cta: ad.cta,
              favicon: ad.favicon,
              userId,
            });
          }
          return {
            status: "filled" as const,
            ad: ads[0],
            ads,
          };
        }

        // Empty array from Gravity
        logger.info({ url }, "Empty ad array from Gravity");
        track("no_fill", { gravityStatus: 200, errorMessage: "Empty ad array", userId });
        return {
          status: "no_fill" as const,
          debug: { gravityStatus: 200, errorMessage: "Empty ad array" },
        };
      } catch (fetchError) {
        clearTimeout(timeoutId);
        const errorMsg = String(fetchError);
        const isTimeout = errorMsg.includes("abort");
        logger.warn({ error: errorMsg, isTimeout }, "Gravity fetch error");
        const status = isTimeout ? "timeout" : "gravity_error";
        track(status, { errorMessage: errorMsg.slice(0, 200), userId });
        return {
          status: status as "timeout" | "gravity_error",
          debug: { errorMessage: errorMsg.slice(0, 200) },
        };
      }
    } catch (error) {
      const errorMsg = String(error);
      logger.error({ error: errorMsg }, "Unexpected error in context route");
      track("error", { errorMessage: errorMsg.slice(0, 200) });
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
