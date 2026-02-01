"use client";

import { useQuery, useQueries, UseQueryResult } from "@tanstack/react-query";
import { articleAPI } from "@/lib/api/client";
import { ArticleResponse, Source } from "@/types/api";

const SERVER_SOURCES = ["smry-fast", "smry-slow", "wayback"] as const satisfies readonly Source[];

/**
 * Custom hook to fetch article using auto-selection (races all sources server-side)
 * This is the recommended hook for most use cases - single request, fastest result
 */
export function useArticleAuto(url: string) {
  return useQuery({
    queryKey: ["article", "auto", url],
    queryFn: () => articleAPI.getArticleAuto(url),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
    enabled: !!url,
  });
}

/**
 * @deprecated Use useArticleAuto instead for better performance (single request)
 * Custom hook to fetch articles from all three sources in parallel
 * Uses TanStack Query for caching and state management
 */
export function useArticles(url: string) {
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

  // Map queries to a more convenient structure
  const results: Record<Source, UseQueryResult<ArticleResponse, Error>> = {
    "smry-fast": serverQueries[0] as UseQueryResult<ArticleResponse, Error>,
    "smry-slow": serverQueries[1] as UseQueryResult<ArticleResponse, Error>,
    wayback: serverQueries[2] as UseQueryResult<ArticleResponse, Error>,
  };

  // Compute aggregate states
  const isLoading = serverQueries.some((q) => q.isLoading);
  const isError = serverQueries.every((q) => q.isError);
  const isSuccess = serverQueries.some((q) => q.isSuccess);

  return {
    results,
    isLoading,
    isError,
    isSuccess,
  };
}

/**
 * @deprecated Use useArticleAuto instead for better performance
 * Hook to fetch a single article from a specific source
 */
export function useArticle(url: string, source: Source) {
  const { results } = useArticles(url);
  return results[source];
}
