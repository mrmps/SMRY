"use client";

import { useQueries, useQuery, UseQueryResult } from "@tanstack/react-query";
import { articleAPI } from "@/lib/api/client";
import { ArticleResponse, Source } from "@/types/api";
import { fetchJinaArticle } from "@/lib/api/jina";
import { getApiUrl } from "@/lib/api/config";

const SERVER_SOURCES = ["smry-fast", "smry-slow", "wayback"] as const satisfies readonly Source[];

/**
 * Custom hook to fetch Jina article (client-side)
 * Flow:
 * 1. Check cache via GET /api/jina
 * 2. If cache miss or too short, fetch from Jina.ai client-side
 * 3. Update cache via POST /api/jina
 */
function useJinaArticle(url: string): UseQueryResult<ArticleResponse, Error> {
  return useQuery({
    queryKey: ["article", "jina.ai", url],
    queryFn: async () => {
      // Step 1: Check cache
      try {
        const cacheResponse = await fetch(
          getApiUrl(`/api/jina?${new URLSearchParams({ url }).toString()}`)
        );

        if (cacheResponse.ok) {
          const cachedData = await cacheResponse.json();
          return cachedData as ArticleResponse;
        }
      } catch (error) {
        // Cache check failed, continue to fetch from Jina
        console.log("Jina cache check failed, fetching fresh:", error);
      }

      // Step 2: Fetch from Jina.ai client-side
      const result = await fetchJinaArticle(url);

      if ("error" in result) {
        throw new Error(result.error.message);
      }

      // Step 3: Update cache
      const articleResponse: ArticleResponse = {
        source: "jina.ai",
        cacheURL: `https://r.jina.ai/${url}`,
        article: {
          ...result.article,
          byline: "",
          dir: "ltr", // Will be detected properly when cached via API
          lang: "",
        },
        status: "success",
      };

      // Update cache in background (don't await)
      fetch(getApiUrl("/api/jina"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          article: result.article,
        }),
      }).catch((error) => {
        console.warn("Failed to update Jina cache:", error);
      });

      return articleResponse;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes - reduced to prevent memory buildup from large articles
    retry: 1,
    enabled: !!url,
  });
}

/**
 * Custom hook to fetch articles from all three sources in parallel
 * Uses TanStack Query for caching and state management
 * Jina is fetched client-side, while smry-fast, smry-slow, and wayback are server-side
 */
export function useArticles(url: string) {
  // Fetch server-side sources (smry-fast, smry-slow, wayback)
  const serverQueries = useQueries({
    queries: SERVER_SOURCES.map((source) => ({
      queryKey: ["article", source, url],
      queryFn: () => articleAPI.getArticle(url, source),
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 5 * 60 * 1000, // 5 minutes - reduced to prevent memory buildup from large articles
      retry: 1,
      enabled: !!url, // Only fetch if URL is provided
    })),
  });

  // Fetch Jina client-side
  const jinaQuery = useJinaArticle(url);

  // Map queries to a more convenient structure
  const results: Record<Source, UseQueryResult<ArticleResponse, Error>> = {
    "smry-fast": serverQueries[0] as UseQueryResult<ArticleResponse, Error>,
    "smry-slow": serverQueries[1] as UseQueryResult<ArticleResponse, Error>,
    wayback: serverQueries[2] as UseQueryResult<ArticleResponse, Error>,
    "jina.ai": jinaQuery,
  };

  // Compute aggregate states
  const allQueries = [...serverQueries, jinaQuery];
  const isLoading = allQueries.some((q) => q.isLoading);
  const isError = allQueries.every((q) => q.isError);
  const isSuccess = allQueries.some((q) => q.isSuccess);

  return {
    results,
    isLoading,
    isError,
    isSuccess,
  };
}

/**
 * Hook to fetch a single article from a specific source
 */
export function useArticle(url: string, source: Source) {
  const { results } = useArticles(url);
  return results[source];
}

