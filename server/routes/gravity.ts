/**
 * Gravity Context Routes - POST /api/context, POST /api/px
 *
 * Fetches contextual content from Gravity AI for free users.
 * Passes device/user info for better targeting.
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
const GRAVITY_TIMEOUT_MS = 3000;

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
    async ({ query, set }) => {
      const url = query.url;

      if (!url) {
        set.status = 400;
        return { error: "Missing url parameter" };
      }

      // Validate URL is from Gravity
      try {
        const parsedUrl = new URL(url);
        if (!parsedUrl.hostname.endsWith("trygravity.ai")) {
          set.status = 400;
          return { error: "Invalid impression URL" };
        }
      } catch {
        set.status = 400;
        return { error: "Invalid URL format" };
      }

      // Forward the impression request to Gravity
      try {
        logger.info({ impUrl: url }, "Forwarding impression to Gravity");
        const response = await fetch(url, {
          method: "GET",
          headers: {
            "User-Agent": "13ft-impression-proxy/1.0",
          },
        });
        // Consume body to release connection resources
        await response.text().catch(() => {});
        logger.info({ impUrl: url, status: response.status }, "Impression forwarded successfully");
      } catch (error) {
        logger.warn({ impUrl: url, error: String(error) }, "Failed to forward impression");
        // Silently fail - impression tracking is best-effort
      }

      // Return 204 No Content - the client doesn't need a response
      set.status = 204;
      return;
    },
    {
      query: t.Object({
        url: t.String(),
      }),
    }
  )
  .post(
  "/context",
  async ({ body, request }) => {
    const startTime = Date.now();
    const { title, url, articleContent, sessionId, device, user } = body;

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
      userId?: string | null;
      isPremium?: boolean;
    } = {}) => {
      trackAdEvent({
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

      // Build conversation context for Gravity
      const messages: GravityMessage[] = [
        {
          role: "user",
          content: `I'm reading this article:\n\nTitle: ${title}\nURL: ${url}\n\nArticle content:\n${articleContent}`,
        },
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
        placements: [{ placement: "below_response", placement_id: "smry-summary-bottom" }],
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
          logger.info({ url, brandName: ads[0].brandName }, "Ad received from Gravity");
          track("filled", { gravityStatus: 200, brandName: ads[0].brandName, adTitle: ads[0].title, userId });
          return {
            status: "filled" as const,
            ad: ads[0],
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
      articleContent: t.String(), // The actual article text (truncated to ~2000 chars)
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
    }),
  }
);
