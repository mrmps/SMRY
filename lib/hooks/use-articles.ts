"use client";

import { useQueries, UseQueryResult } from "@tanstack/react-query";
import { articleAPI } from "@/lib/api-client";
import { ArticleResponse, Source } from "@/types/api";

const SOURCES: Source[] = ["direct", "wayback", "jina.ai"];

/**
 * Custom hook to fetch articles from all three sources in parallel
 * Uses TanStack Query for caching and state management
 */
export function useArticles(url: string) {
  const queries = useQueries({
    queries: SOURCES.map((source) => ({
      queryKey: ["article", source, url],
      queryFn: () => articleAPI.getArticle(url, source),
      staleTime: 60 * 1000, // 1 minute
      gcTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
      enabled: !!url, // Only fetch if URL is provided
    })),
  });

  // Map queries to a more convenient structure
  const results = {
    direct: queries[0] as UseQueryResult<ArticleResponse, Error>,
    wayback: queries[1] as UseQueryResult<ArticleResponse, Error>,
    "jina.ai": queries[2] as UseQueryResult<ArticleResponse, Error>,
  };

  // Compute aggregate states
  const isLoading = queries.some((q) => q.isLoading);
  const isError = queries.every((q) => q.isError);
  const isSuccess = queries.some((q) => q.isSuccess);

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

