"use client";

import { useQuery, useQueries, UseQueryResult } from "@tanstack/react-query";
import { useEffect, useState, useRef } from "react";
import { articleAPI } from "@/lib/api/client";
import { ArticleResponse, Source, ArticleAutoResponse } from "@/types/api";

const SERVER_SOURCES = ["smry-fast", "smry-slow", "wayback"] as const satisfies readonly Source[];

// Delay before checking for enhanced version (ms)
const ENHANCED_CHECK_DELAY = 4000;

// State for enhanced article data with URL tracking
interface EnhancedState {
  url: string;
  data: ArticleAutoResponse;
}

/**
 * Custom hook to fetch article using auto-selection (races all sources server-side)
 * This is the recommended hook for most use cases - single request, fastest result
 *
 * Features optimistic updates: if a longer article is found from slower sources,
 * it automatically updates the content seamlessly.
 */
export function useArticleAuto(url: string) {
  // Track if we've already checked for enhanced version for this URL
  const checkedUrlRef = useRef<string | null>(null);

  // State to hold the enhanced article with its URL (to know if it's stale)
  const [enhanced, setEnhanced] = useState<EnhancedState | null>(null);

  // Main query for initial article
  const query = useQuery({
    queryKey: ["article", "auto", url],
    queryFn: () => articleAPI.getArticleAuto(url),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
    enabled: !!url,
  });

  // Check for enhanced version after delay
  useEffect(() => {
    // Only check if:
    // 1. We have data
    // 2. mayHaveEnhanced is true
    // 3. We haven't already checked for this URL
    // 4. We have article data with length
    if (
      !query.data ||
      !query.data.mayHaveEnhanced ||
      checkedUrlRef.current === url ||
      !query.data.article?.length
    ) {
      return;
    }

    const currentUrl = url;
    const timeoutId = setTimeout(async () => {
      // Mark as checked to prevent duplicate checks
      checkedUrlRef.current = currentUrl;

      try {
        const enhancedResult = await articleAPI.getArticleEnhanced(
          currentUrl,
          query.data.article!.length,
          query.data.source
        );

        if (enhancedResult.enhanced) {
          // Found a longer article - update seamlessly
          setEnhanced({
            url: currentUrl,
            data: {
              source: enhancedResult.source,
              cacheURL: enhancedResult.cacheURL,
              article: enhancedResult.article,
              status: "success",
              mayHaveEnhanced: false, // No need to check again
            },
          });
        }
      } catch {
        // Silently fail - user still has the initial article
      }
    }, ENHANCED_CHECK_DELAY);

    return () => clearTimeout(timeoutId);
  }, [query.data, url]);

  // Only use enhanced data if it's for the current URL
  const isEnhancedForCurrentUrl = enhanced !== null && enhanced.url === url;

  // Return enhanced data if available and for current URL, otherwise return original query data
  const data = isEnhancedForCurrentUrl ? enhanced.data : query.data;

  // Track if content was enhanced (for optional UI feedback)
  const wasEnhanced = isEnhancedForCurrentUrl;

  // Return query with potentially enhanced data
  // We return the query object directly but override data
  return Object.assign({}, query, {
    data,
    wasEnhanced,
  }) as typeof query & { wasEnhanced: boolean };
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
