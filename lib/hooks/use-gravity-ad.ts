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

const SESSION_ID_KEY = "gravity-session-id";

export interface GravityAd {
  adText: string;
  title: string;
  clickUrl: string;
  impUrl: string;
  brandName: string;
  url?: string;
  favicon?: string;
  cta?: string;
}

interface DeviceInfo {
  timezone: string;
  locale: string;
  language: string;
  ua: string;
  deviceType: "desktop" | "mobile" | "tablet";
  screenWidth: number;
  screenHeight: number;
  viewportWidth: number;
  viewportHeight: number;
}

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

function collectDeviceInfo(): DeviceInfo {
  if (typeof window === "undefined") {
    return {
      timezone: "UTC",
      locale: "en-US",
      language: "en",
      ua: "",
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
  /** Whether the user is premium (skips ad fetch) */
  isPremium?: boolean;
}

export interface UseGravityAdResult {
  ad: GravityAd | null;
  isLoading: boolean;
  fireImpression: (impUrl: string) => void;
}

export function useGravityAd({ url, isPremium = false }: UseGravityAdOptions): UseGravityAdResult {
  const { getToken } = useAuth();
  const { user } = useUser();
  const [sessionId, setSessionId] = useState<string>("");
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);

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
    queryKey: ["gravity-ad", url, sessionId],
    queryFn: async (): Promise<GravityAd | null> => {
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

      const response = await fetch(getApiUrl("/api/gravity-ad"), {
        method: "POST",
        headers,
        body: JSON.stringify({
          url,
          title: "", // API will extract from URL
          summary: "",
          sessionId,
          device: deviceInfo,
          user: userInfo,
        }),
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
    // Only fetch when we have session info and user is not premium
    enabled: !!sessionId && !!deviceInfo && !isPremium && !!url,
    retry: false,
  });

  const fireImpression = useCallback((impUrl: string) => {
    // Fire impression via our proxy to avoid ad blockers
    // The proxy forwards the request to Gravity server-side
    const proxyUrl = getApiUrl(`/api/track-impression?url=${encodeURIComponent(impUrl)}`);

    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon(proxyUrl);
    } else {
      fetch(proxyUrl, { method: "GET" }).catch(() => {});
    }
  }, []);

  return {
    ad: query.data ?? null,
    isLoading: query.isLoading,
    fireImpression,
  };
}
