/**
 * Ad Tracking Routes - POST /api/adtrack
 *
 * Lightweight endpoint for client-side ad event tracking (impressions, clicks, dismissals).
 * Uses sendBeacon on client for reliable tracking during navigation.
 * All tracking is non-blocking and fire-and-forget.
 */

import { Elysia, t } from "elysia";
import { trackAdEvent, type AdEventType } from "../../lib/clickhouse";
import { createLogger } from "../../lib/logger";

const logger = createLogger("api:adtrack");

export const adtrackRoutes = new Elysia({ prefix: "/api" }).post(
  "/adtrack",
  async ({ body, set }) => {
    const { type, sessionId, hostname, brandName, adTitle, adText, clickUrl, impUrl, cta, favicon, deviceType, os, browser } = body;

    // Fire-and-forget tracking - don't block the response
    try {
      trackAdEvent({
        event_type: type as AdEventType,
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
      });

      logger.debug({ type, hostname, brandName }, "Ad event tracked");
    } catch (error) {
      // Log but don't fail the request - tracking is best-effort
      logger.warn({ error: String(error), type }, "Failed to track ad event");
    }

    // Return 204 No Content immediately - client doesn't need a response body
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
    }),
  }
);
