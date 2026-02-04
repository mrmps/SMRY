"use client";

/**
 * useGravityAd - High-performance hook for fetching contextual ads from Gravity AI
 *
 * Performance optimizations:
 * - Aggressive caching with staleTime to prevent unnecessary refetches
 * - Device info collected once and cached at module level
 * - Stable query keys to maximize cache hits
 * - Memoized callbacks to prevent re-renders
 */

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { getApiUrl } from "@/lib/api/config";
import { useAuth, useUser } from "@clerk/nextjs";
import type { ContextAd, ContextDevice, ContextRequest, ContextResponse } from "@/types/api";

// Empty subscribe for useSyncExternalStore (values never change after init)
const emptySubscribe = () => () => {};

const SESSION_ID_KEY = "gravity-session-id";

// Re-export for consumers
export type { ContextAd as GravityAd };

// ============================================
// Module-level caching (computed once per page load)
// ============================================

let cachedSessionId: string | null = null;
let cachedDeviceInfo: ContextDevice | null = null;

function getSessionId(): string {
  if (cachedSessionId) return cachedSessionId;

  if (typeof window === "undefined") {
    return crypto.randomUUID();
  }

  let sessionId = localStorage.getItem(SESSION_ID_KEY);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem(SESSION_ID_KEY, sessionId);
  }
  cachedSessionId = sessionId;
  return sessionId;
}

function getDeviceInfo(): ContextDevice {
  if (cachedDeviceInfo) return cachedDeviceInfo;

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

  const ua = navigator.userAgent;
  const uaLower = ua.toLowerCase();

  // Device type detection
  let deviceType: "desktop" | "mobile" | "tablet" = "desktop";
  if (/tablet|ipad|playbook|silk/i.test(uaLower)) deviceType = "tablet";
  else if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(uaLower)) deviceType = "mobile";

  // OS detection
  let os = "unknown";
  if (/Windows/i.test(ua)) os = "windows";
  else if (/Mac OS X|Macintosh/i.test(ua)) os = "macos";
  else if (/Linux/i.test(ua) && !/Android/i.test(ua)) os = "linux";
  else if (/Android/i.test(ua)) os = "android";
  else if (/iPhone|iPad|iPod/i.test(ua)) os = "ios";
  else if (/CrOS/i.test(ua)) os = "chromeos";

  // Browser detection
  let browser = "unknown";
  const uaData = (navigator as Navigator & { userAgentData?: { brands?: Array<{ brand: string }> } }).userAgentData;
  if (uaData?.brands) {
    const dominated = ["Google Chrome", "Microsoft Edge", "Opera", "Brave"];
    for (const { brand } of uaData.brands) {
      if (dominated.includes(brand)) {
        browser = brand.split(" ").pop()?.toLowerCase() || "unknown";
        break;
      }
    }
  }
  if (browser === "unknown") {
    if (/Edg\//i.test(ua)) browser = "edge";
    else if (/OPR\//i.test(ua) || /Opera/i.test(ua)) browser = "opera";
    else if (/Firefox/i.test(ua)) browser = "firefox";
    else if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) browser = "chrome";
    else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = "safari";
    else if (/MSIE|Trident/i.test(ua)) browser = "ie";
  }

  cachedDeviceInfo = {
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    locale: navigator.language || "en-US",
    language: navigator.language?.split("-")[0] || "en",
    ua,
    os,
    browser,
    deviceType,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
  };

  return cachedDeviceInfo;
}

// ============================================
// Types
// ============================================

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

// ============================================
// Constants
// ============================================

// Cache ads for 30 seconds to prevent flickering and unnecessary refetches
const AD_STALE_TIME_MS = 30_000;
// Keep ads in cache for 2 minutes even if unused
const AD_GC_TIME_MS = 120_000;
// Refresh ads every 60 seconds for users who stay on the page
const AD_REFRESH_INTERVAL_MS = 60_000;

// ============================================
// Hook
// ============================================

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

  // SSR-safe access to client values using useSyncExternalStore
  // Server returns empty/null, client returns cached values immediately
  const sessionId = useSyncExternalStore(
    emptySubscribe,
    getSessionId,
    () => "" // Server snapshot
  );

  const deviceInfo = useSyncExternalStore(
    emptySubscribe,
    getDeviceInfo,
    () => null // Server snapshot
  );

  // Memoize user info
  const userInfo = useMemo(() => {
    if (!user) return undefined;
    return {
      id: user.id,
      email: user.primaryEmailAddress?.emailAddress,
    };
  }, [user]);

  // Stable query key - only url matters for cache identity
  // Other params are passed in body but don't affect cache key
  const queryKey = useMemo(() => ["gravity-ad", url] as const, [url]);

  // Determine if query should be enabled
  // Wait for title to be available to avoid wasting requests
  const isEnabled = !isPremium && !!url && !!title && !!sessionId;

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<ContextAd[] | null> => {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      // Add auth token if available
      try {
        const token = await getToken();
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }
      } catch {
        // Continue without auth
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

      // Only return ads if status is "filled"
      if (data.status !== "filled") {
        if (process.env.NODE_ENV === "development") {
          console.log("[useGravityAd] No ad:", data.status);
        }
        return null;
      }

      // Prefer the ads array, fall back to single ad
      if (data.ads && data.ads.length > 0) return data.ads;
      if (data.ad) return [data.ad];
      return null;
    },
    // Performance: Cache ads to prevent flickering
    staleTime: AD_STALE_TIME_MS,
    gcTime: AD_GC_TIME_MS,
    // Only fetch when conditions are met
    enabled: isEnabled,
    // Refresh ads periodically for long sessions
    refetchInterval: AD_REFRESH_INTERVAL_MS,
    refetchIntervalInBackground: false,
    // Don't refetch on window focus (annoying for users)
    refetchOnWindowFocus: false,
    // Don't retry failed requests (ad not critical)
    retry: false,
    // Use previous data while refetching to prevent flickering
    placeholderData: (prev) => prev,
  });

  // Stable tracking function - memoized to prevent re-renders
  const sendTrackingEvent = useCallback(
    (type: "impression" | "click" | "dismiss", ad: ContextAd | null) => {
      if (!ad || !sessionId) return;

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
      });

      const trackUrl = getApiUrl("/api/adtrack");

      // Use sendBeacon for reliable non-blocking tracking
      if (typeof navigator !== "undefined" && navigator.sendBeacon) {
        navigator.sendBeacon(trackUrl, new Blob([payload], { type: "application/json" }));
      } else {
        fetch(trackUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          keepalive: true,
        }).catch(() => {});
      }
    },
    [sessionId, url, deviceInfo]
  );

  // Memoized event handlers
  const fireImpression = useCallback(
    (targetAd?: ContextAd) => {
      const ad = targetAd ?? query.data?.[0];
      if (!ad) return;

      // Fire impression to Gravity via proxy (for billing)
      const proxyUrl = getApiUrl(`/api/px?url=${encodeURIComponent(ad.impUrl)}`);
      if (typeof navigator !== "undefined" && navigator.sendBeacon) {
        navigator.sendBeacon(proxyUrl);
      } else {
        fetch(proxyUrl, { method: "POST", keepalive: true }).catch(() => {});
      }

      // Track locally for analytics
      sendTrackingEvent("impression", ad);
    },
    [query.data, sendTrackingEvent]
  );

  const fireClick = useCallback(
    (targetAd?: ContextAd) => {
      const ad = targetAd ?? query.data?.[0];
      sendTrackingEvent("click", ad ?? null);
    },
    [query.data, sendTrackingEvent]
  );

  const fireDismiss = useCallback(
    (targetAd?: ContextAd) => {
      const ad = targetAd ?? query.data?.[0];
      sendTrackingEvent("dismiss", ad ?? null);
    },
    [query.data, sendTrackingEvent]
  );

  // Memoize the result to prevent object recreation
  return useMemo(() => {
    const ads = query.data ?? [];
    return {
      ad: ads[0] ?? null,
      ads,
      isLoading: query.isLoading,
      fireImpression,
      fireClick,
      fireDismiss,
    };
  }, [query.data, query.isLoading, fireImpression, fireClick, fireDismiss]);
}
