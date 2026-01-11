"use client";

/**
 * useBypassDetection - Hook to detect if a paywall was bypassed
 *
 * Premium-only feature that uses AI to analyze article content
 * and determine if the full article was retrieved.
 *
 * If the article already has bypassStatus cached, returns instantly.
 */

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { getApiUrl } from "@/lib/api/config";
import type { Source, Article, BypassStatus } from "@/types/api";

export type { BypassStatus } from "@/types/api";

export interface BypassDetectionResult {
  status: BypassStatus;
  cached: boolean;
}

export interface UseBypassDetectionOptions {
  url: string;
  source: Source;
  article: Article | undefined;
  enabled: boolean; // Should be isPremium && article loaded
}

export interface UseBypassDetectionResult {
  result: BypassDetectionResult | null;
  isLoading: boolean;
  error: Error | null;
}

async function detectBypass(
  url: string,
  source: Source,
  article: Article,
  authToken: string | null
): Promise<BypassDetectionResult> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const response = await fetch(getApiUrl("/api/bypass-detection"), {
    method: "POST",
    headers,
    body: JSON.stringify({
      url,
      source,
      textContent: article.textContent,
      articleLength: article.length,
      htmlContent: article.htmlContent,
    }),
    credentials: "include",
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.userMessage || "Failed to detect bypass status");
  }

  return response.json();
}

export function useBypassDetection({
  url,
  source,
  article,
  enabled,
}: UseBypassDetectionOptions): UseBypassDetectionResult {
  const { getToken } = useAuth();

  // If article already has bypass status cached, return it instantly
  const cachedStatus = article?.bypassStatus;

  const query = useQuery({
    queryKey: ["bypass-detection", url, source] as const,
    queryFn: async () => {
      if (!article?.textContent) {
        throw new Error("No article content to analyze");
      }

      let authToken: string | null = null;
      if (typeof getToken === "function") {
        try {
          authToken = await getToken();
        } catch (error) {
          console.warn("Failed to retrieve auth token for bypass detection", error);
        }
      }

      return detectBypass(url, source, article, authToken);
    },
    // Skip API call if we already have cached status from article
    enabled: enabled && !cachedStatus && !!article?.textContent && article.textContent.length >= 100,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60,
    retry: false,
  });

  // Return cached status from article if available (instant)
  if (cachedStatus) {
    return {
      result: { status: cachedStatus, cached: true },
      isLoading: false,
      error: null,
    };
  }

  return {
    result: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error as Error | null,
  };
}
