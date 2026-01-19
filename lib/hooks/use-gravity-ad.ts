"use client";

/**
 * useGravityAd - Hook for fetching contextual ads from Gravity AI
 *
 * Collects device info for better ad targeting and higher CPMs.
 * Uses navigator.sendBeacon for reliable impression tracking.
 */

import { useCallback, useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getApiUrl } from "@/lib/api/config";
import { useAuth, useUser } from "@clerk/nextjs";
import type { ContextAd, ContextDevice, ContextRequest } from "@/types/api";

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
}

export interface UseGravityAdResult {
  ad: ContextAd | null;
  isLoading: boolean;
  fireImpression: (impUrl: string) => void;
}

export function useGravityAd({ url, title = "", textContent = "", isPremium = false }: UseGravityAdOptions): UseGravityAdResult {
  const { getToken } = useAuth();
  const { user } = useUser();
  const [sessionId, setSessionId] = useState<string>("");
  const [deviceInfo, setDeviceInfo] = useState<ContextDevice | null>(null);

  // Initialize session ID and device info on client
  useEffect(() => {
    const rafId = requestAnimationFrame(() => {
      setSessionId(getOrCreateSessionId());
      setDeviceInfo(collectDeviceInfo());
    });
    return () => cancelAnimationFrame(rafId);
  }, []);

  // Memoize user info to avoid recreating on every render
  const userInfo = useMemo(() => {
    if (!user) return undefined;
    return {
      id: user.id,
      email: user.primaryEmailAddress?.emailAddress,
    };
  }, [user]);

  const query = useQuery({
    queryKey: ["context", url, sessionId, title],
    queryFn: async (): Promise<ContextAd | null> => {
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

      // Truncate textContent to ~2000 chars (enough context without being too large)
      const articleContent = textContent ? textContent.slice(0, 2000) : "";

      const requestBody: ContextRequest = {
        url,
        title,
        articleContent,
        sessionId,
        device: deviceInfo ?? undefined,
        user: userInfo,
      };

      const response = await fetch(getApiUrl("/api/context"), {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
        credentials: "include",
      });

      // 204 means no ad available (premium user or no match)
      if (response.status === 204) {
        return null;
      }

      if (!response.ok) {
        return null;
      }

      return response.json();
    },
    // Never cache - always fetch fresh ads
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
    // Only fetch when we have session info, article content, and user is not premium
    // Wait for title to avoid wasting a request before article loads
    enabled: !!sessionId && !!deviceInfo && !isPremium && !!url && !!title,
    retry: false,
  });

  const fireImpression = useCallback((impUrl: string) => {
    // Fire impression via our proxy to avoid blockers
    // The proxy forwards the request to Gravity server-side
    const proxyUrl = getApiUrl(`/api/px?url=${encodeURIComponent(impUrl)}`);

    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon(proxyUrl);
    } else {
      fetch(proxyUrl, { method: "POST" }).catch(() => {});
    }
  }, []);

  return {
    ad: query.data ?? null,
    isLoading: query.isLoading,
    fireImpression,
  };
}
