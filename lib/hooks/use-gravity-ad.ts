"use client";

/**
 * useGravityAd - Hook for fetching contextual ads from Gravity AI
 *
 * Collects device info for better ad targeting and higher CPMs.
 * Uses navigator.sendBeacon for reliable impression tracking.
 */

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { getApiUrl } from "@/lib/api/config";
import { useAuth, useUser } from "@clerk/nextjs";
import type { ContextAd, ContextDevice, ContextRequest, ContextResponse } from "@/types/api";

const SESSION_ID_KEY = "gravity-session-id";

// Re-export for consumers
export type { ContextAd as GravityAd };

function generateSessionId(): string {
  return crypto.randomUUID();
}

function getOrCreateSessionId(): string {
  if (typeof window === "undefined") {
    return generateSessionId();
  }

  let sessionId = localStorage.getItem(SESSION_ID_KEY);
  if (!sessionId) {
    sessionId = generateSessionId();
    localStorage.setItem(SESSION_ID_KEY, sessionId);
  }
  return sessionId;
}

function getDeviceType(): "desktop" | "mobile" | "tablet" {
  if (typeof window === "undefined") return "desktop";
  const ua = navigator.userAgent.toLowerCase();
  if (/tablet|ipad|playbook|silk/i.test(ua)) return "tablet";
  if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) return "mobile";
  return "desktop";
}

function getOS(): string {
  if (typeof window === "undefined") return "unknown";
  const ua = navigator.userAgent;
  if (/Windows/i.test(ua)) return "windows";
  if (/Mac OS X|Macintosh/i.test(ua)) return "macos";
  if (/Linux/i.test(ua) && !/Android/i.test(ua)) return "linux";
  if (/Android/i.test(ua)) return "android";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/CrOS/i.test(ua)) return "chromeos";
  return "unknown";
}

function getBrowser(): string {
  if (typeof window === "undefined") return "unknown";

  // Use modern userAgentData API if available (Chrome 90+, Edge 90+, Opera 76+)
  const uaData = (navigator as Navigator & { userAgentData?: { brands?: Array<{ brand: string }> } }).userAgentData;
  if (uaData?.brands) {
    const dominated = ["Google Chrome", "Microsoft Edge", "Opera", "Brave"];
    for (const { brand } of uaData.brands) {
      if (dominated.includes(brand)) {
        return brand.split(" ").pop()?.toLowerCase() || "unknown";
      }
    }
  }

  // Fallback to UA string parsing
  const ua = navigator.userAgent;
  // Order matters - check more specific browsers first
  if (/Edg\//i.test(ua)) return "edge";
  if (/OPR\//i.test(ua) || /Opera/i.test(ua)) return "opera";
  if (/Firefox/i.test(ua)) return "firefox";
  if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) return "chrome";
  if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) return "safari";
  if (/MSIE|Trident/i.test(ua)) return "ie";
  return "unknown";
}

function collectDeviceInfo(): ContextDevice {
  if (typeof window === "undefined") {
    return {
      timezone: "UTC",
      locale: "en-US",
      language: "en",
      ua: "",
      os: "unknown",
      browser: "unknown",
      deviceType: "desktop",
      screenWidth: 1920,
      screenHeight: 1080,
      viewportWidth: 1920,
      viewportHeight: 1080,
    };
  }

  return {
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    locale: navigator.language || "en-US",
    language: navigator.language?.split("-")[0] || "en",
    ua: navigator.userAgent,
    os: getOS(),
    browser: getBrowser(),
    deviceType: getDeviceType(),
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
  };
}

export interface UseGravityAdOptions {
  /** URL of the article - triggers immediate ad fetch */
  url: string;
  /** Article title for better ad targeting */
  title?: string;
  /** Article text content for better ad targeting */
  textContent?: string;
  /** Whether the user is premium (skips ad fetch) */
  isPremium?: boolean;
  /** Author name for better ad targeting */
  byline?: string | null;
  /** Publisher name for better ad targeting */
  siteName?: string | null;
  /** Publication date for better ad targeting */
  publishedTime?: string | null;
  /** Article language for better ad targeting */
  lang?: string | null;
  /** Extra instruction for ad generation (e.g. "keep it short") */
  prompt?: string;
}

export interface UseGravityAdResult {
  ad: ContextAd | null;
  ads: ContextAd[];
  isLoading: boolean;
  fireImpression: (ad?: ContextAd) => void;
  fireClick: (ad?: ContextAd) => void;
  fireDismiss: (ad?: ContextAd) => void;
}

// Ad refresh interval in milliseconds (45 seconds)
const AD_REFRESH_INTERVAL_MS = 45_000;

// SSR-safe store subscriptions for immediate client-side values
const emptySubscribe = () => () => {};

// Cached client-side values to avoid recomputing on every render
let cachedSessionId: string | null = null;
let cachedDeviceInfo: ContextDevice | null = null;

function getClientSessionId(): string {
  if (cachedSessionId === null) {
    cachedSessionId = getOrCreateSessionId();
  }
  return cachedSessionId;
}

function getClientDeviceInfo(): ContextDevice {
  if (cachedDeviceInfo === null) {
    cachedDeviceInfo = collectDeviceInfo();
  }
  return cachedDeviceInfo;
}

export function useGravityAd({
  url,
  title = "",
  textContent = "",
  isPremium = false,
  byline,
  siteName,
  publishedTime,
  lang,
  prompt,
}: UseGravityAdOptions): UseGravityAdResult {
  const { getToken } = useAuth();
  const { user } = useUser();

  // Use useSyncExternalStore for SSR-safe immediate client values
  // Server returns empty/null, client returns real values immediately (no effect delay)
  const sessionId = useSyncExternalStore(
    emptySubscribe,
    getClientSessionId,
    () => "" // Server snapshot - empty string
  );

  const deviceInfo = useSyncExternalStore(
    emptySubscribe,
    getClientDeviceInfo,
    () => null // Server snapshot - null
  );

  // Memoize user info to avoid recreating on every render
  const userInfo = useMemo(() => {
    if (!user) return undefined;
    return {
      id: user.id,
      email: user.primaryEmailAddress?.emailAddress,
    };
  }, [user]);

  const query = useQuery({
    queryKey: ["context", url, sessionId, title, prompt],
    queryFn: async (): Promise<ContextAd[] | null> => {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      // Add auth token if available
      if (typeof getToken === "function") {
        try {
          const token = await getToken();
          if (token) {
            headers.Authorization = `Bearer ${token}`;
          }
        } catch {
          // Continue without auth
        }
      }

      // Truncate textContent to ~4000 chars for better ad targeting
      const articleContent = textContent ? textContent.slice(0, 4000) : "";

      const requestBody: ContextRequest = {
        url,
        title,
        articleContent,
        sessionId,
        device: deviceInfo ?? undefined,
        user: userInfo,
        // Additional metadata for better ad targeting
        byline: byline || undefined,
        siteName: siteName || undefined,
        publishedTime: publishedTime || undefined,
        lang: lang || undefined,
        prompt: prompt || undefined,
      };

      const response = await fetch(getApiUrl("/api/context"), {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
        credentials: "include",
      });

      if (!response.ok) {
        console.warn("[useGravityAd] Request failed:", response.status);
        return null;
      }

      const data: ContextResponse = await response.json();

      // Log the response status for debugging
      if (data.status !== "filled") {
        console.log("[useGravityAd] No ad:", data.status, data.debug);
      }

      // Only return ads if status is "filled"
      if (data.status !== "filled") return null;
      // Prefer the ads array, fall back to single ad
      if (data.ads && data.ads.length > 0) return data.ads;
      if (data.ad) return [data.ad];
      return null;
    },
    // Never cache - always fetch fresh ads
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
    // Refresh ads every 45 seconds for users who stay on the page
    refetchInterval: AD_REFRESH_INTERVAL_MS,
    refetchIntervalInBackground: false, // Don't refresh when tab is hidden
    // Only fetch when we have session info, article content, and user is not premium
    // Wait for title to avoid wasting a request before article loads
    enabled: !!sessionId && !!deviceInfo && !isPremium && !!url && !!title,
    retry: false,
  });

  // Helper to send tracking events via sendBeacon (non-blocking)
  // Uses /api/px endpoint (named to avoid ad blocker detection)
  const sendTrackingEvent = useCallback((type: "impression" | "click" | "dismiss", ad: ContextAd | null) => {
    if (!ad || !sessionId) return;

    // Extract hostname from current page URL
    let hostname = "";
    try {
      hostname = new URL(url).hostname;
    } catch {
      // Ignore invalid URLs
    }

    const payload = JSON.stringify({
      type,
      sessionId,
      hostname,
      brandName: ad.brandName,
      adTitle: ad.title,
      adText: ad.adText,
      clickUrl: ad.clickUrl,
      impUrl: ad.impUrl,
      cta: ad.cta,
      favicon: ad.favicon,
      deviceType: deviceInfo?.deviceType,
      os: deviceInfo?.os,
      browser: deviceInfo?.browser,
      provider: ad.provider,
      zeroClickId: ad.zeroClickId,
    });

    // /api/px handles Gravity forwarding (for impressions) and ClickHouse logging
    const trackUrl = getApiUrl("/api/px");

    // Use sendBeacon for reliable non-blocking tracking
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon(trackUrl, new Blob([payload], { type: "application/json" }));
    } else {
      // Fallback to fetch (non-blocking, fire-and-forget)
      fetch(trackUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true, // Ensure request completes even if page unloads
      }).catch(() => {});
    }

    // ZeroClick impressions MUST be tracked client-side from the browser (per ZeroClick docs)
    // Use sendBeacon for reliability during page unloads (matches /api/px pattern above)
    if (type === "impression" && ad.provider === "zeroclick" && ad.zeroClickId) {
      const zcPayload = JSON.stringify({ ids: [ad.zeroClickId] });
      if (typeof navigator !== "undefined" && navigator.sendBeacon) {
        navigator.sendBeacon(
          "https://zeroclick.dev/api/v2/impressions",
          new Blob([zcPayload], { type: "application/json" })
        );
      } else {
        fetch("https://zeroclick.dev/api/v2/impressions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: zcPayload,
          credentials: "omit",
          keepalive: true,
        }).catch(() => {});
      }
    }
  }, [sessionId, url, deviceInfo]);

  const fireImpression = useCallback((targetAd?: ContextAd) => {
    const ad = targetAd ?? query.data?.[0];
    if (!ad) return;

    // Single unified call to /api/px which:
    // 1. Forwards impression to Gravity (for billing)
    // 2. Logs to ClickHouse WITH the Gravity result
    // This ensures ClickHouse accurately reflects if we got paid
    sendTrackingEvent("impression", ad);
  }, [query.data, sendTrackingEvent]);

  const fireClick = useCallback((targetAd?: ContextAd) => {
    const ad = targetAd ?? query.data?.[0];
    sendTrackingEvent("click", ad ?? null);
  }, [query.data, sendTrackingEvent]);

  const fireDismiss = useCallback((targetAd?: ContextAd) => {
    const ad = targetAd ?? query.data?.[0];
    sendTrackingEvent("dismiss", ad ?? null);
  }, [query.data, sendTrackingEvent]);

  const ads = query.data ?? [];

  return {
    ad: ads[0] ?? null,
    ads,
    isLoading: query.isLoading,
    fireImpression,
    fireClick,
    fireDismiss,
  };
}
