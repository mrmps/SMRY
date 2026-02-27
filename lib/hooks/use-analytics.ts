"use client";

import { useCallback } from "react";
import { usePostHog } from "posthog-js/react";
import { useIsPremium } from "./use-is-premium";

// All tracked event names — only add events that are actually used in code
export type AnalyticsEvent =
  // Home
  | "article_submitted"
  | "url_validation_error"
  // Article reader
  | "article_loaded"
  | "article_error"
  | "chat_opened"
  | "settings_opened"
  | "ad_loaded"
  | "ad_impression_client"
  | "ad_click_client"
  | "ad_dismiss_client"
  // Chat
  | "chat_message_sent"
  | "chat_suggestion_clicked"
  | "chat_message_copied"
  | "chat_cleared"
  // Share
  | "article_shared"
  // Highlights
  | "highlight_created"
  | "highlights_exported"
  // Settings
  | "setting_changed"
  // TTS
  | "tts_played"
  | "tts_paused"
  | "tts_voice_changed";

function getDeviceType(): "mobile" | "tablet" | "desktop" {
  if (typeof window === "undefined") return "desktop";
  const w = window.innerWidth;
  if (w < 768) return "mobile";
  if (w < 1024) return "tablet";
  return "desktop";
}

/**
 * Shared analytics hook wrapping PostHog with auto-enrichment.
 *
 * Usage:
 *   const { track, trackArticle } = useAnalytics();
 *   track("article_shared", { method: "copy_link" });
 *   trackArticle("article_loaded", articleUrl, { source: "smry-fast" });
 */
export function useAnalytics() {
  const posthog = usePostHog();
  const { isPremium } = useIsPremium();

  const track = useCallback(
    (event: AnalyticsEvent, props?: Record<string, unknown>) => {
      if (!posthog) return;
      try {
        posthog.capture(event, {
          is_premium: isPremium,
          device_type: getDeviceType(),
          locale: typeof navigator !== "undefined" ? navigator.language : undefined,
          ...props,
        });
      } catch {
        // Analytics should never crash the app
      }
    },
    [posthog, isPremium],
  );

  const trackArticle = useCallback(
    (event: AnalyticsEvent, articleUrl: string, props?: Record<string, unknown>) => {
      try {
        const hostname = new URL(articleUrl).hostname;
        track(event, { article_url: articleUrl, hostname, ...props });
      } catch {
        track(event, { article_url: articleUrl, ...props });
      }
    },
    [track],
  );

  /**
   * Mark a feature as "used" on the user's PostHog profile.
   * Uses $set_once so only the first usage date is recorded.
   * Build cohorts in PostHog: "users who used TTS", "users who shared", etc.
   */
  const markFeatureUsed = useCallback(
    (feature: "tts" | "chat" | "share" | "highlights" | "export_highlights") => {
      if (!posthog) return;
      try {
        posthog.capture("feature_used", {
          feature,
          is_premium: isPremium,
          device_type: getDeviceType(),
          $set_once: { [`first_used_${feature}`]: new Date().toISOString() },
          $set: { [`last_used_${feature}`]: new Date().toISOString() },
        });
      } catch {
        // Analytics should never crash the app
      }
    },
    [posthog, isPremium],
  );

  return { track, trackArticle, markFeatureUsed };
}
