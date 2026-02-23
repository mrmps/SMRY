"use client";

import { useQuery, useQueries, UseQueryResult } from "@tanstack/react-query";
import { useEffect, useState, useRef, useCallback } from "react";
import { articleAPI } from "@/lib/api/client";
import { ArticleResponse, Source, ArticleAutoResponse, SOURCES } from "@/types/api";

const SERVER_SOURCES = ["smry-fast", "smry-slow", "wayback"] as const satisfies readonly Source[];

// Delay before checking for enhanced version (ms)
const ENHANCED_CHECK_DELAY = 4000;

/**
 * Normalize URL for consistent comparison
 * Handles trailing slashes, query param order, and protocol differences
 */
function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Sort query params for consistent ordering
    parsed.searchParams.sort();
    // Remove trailing slash from pathname (unless it's just "/")
    if (parsed.pathname.length > 1 && parsed.pathname.endsWith("/")) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }
    // Return normalized URL without hash
    parsed.hash = "";
    return parsed.toString();
  } catch {
    // If URL parsing fails, return original
    return url;
  }
}

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
  // Normalize URL once for consistent comparisons
  const normalizedUrl = normalizeUrl(url);

  // Track if we've already checked for enhanced version for this URL
  const checkedUrlRef = useRef<string | null>(null);

  // State to hold the enhanced article with its URL (to know if it's stale)
  const [enhanced, setEnhanced] = useState<EnhancedState | null>(null);

  // Main query for initial article
  const query = useQuery({
    queryKey: ["article", "auto", normalizedUrl],
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
    // 3. We haven't already checked for this URL (using normalized URL)
    // 4. We have article data with length
    if (
      !query.data ||
      !query.data.mayHaveEnhanced ||
      checkedUrlRef.current === normalizedUrl ||
      !query.data.article?.length
    ) {
      return;
    }

    const currentUrl = url;
    const currentNormalizedUrl = normalizedUrl;
    const timeoutId = setTimeout(async () => {
      // Mark as checked to prevent duplicate checks (use normalized URL)
      checkedUrlRef.current = currentNormalizedUrl;

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
  }, [query.data, url, normalizedUrl]);

  // Only use enhanced data if it's for the current URL (use normalized URL for comparison)
  const isEnhancedForCurrentUrl = enhanced !== null && normalizeUrl(enhanced.url) === normalizedUrl;

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
 * State for a single source tab — simplified interface for ArrowTabs
 */
export interface SourceTabState {
  data: ArticleResponse | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  isIdle: boolean; // true = not yet fetched (user hasn't clicked tab)
}

/**
 * Hook that wraps useArticleAuto with lazy per-source tab loading.
 * Initial load: single server-side race via useArticleAuto.
 * Tab switch: lazy fetch via /api/article?source=X only when user clicks a tab.
 * Auto-switch: if winner is truncated/blocked, auto-activates smry-slow tab.
 */
export function useArticleWithTabs(url: string) {
  const normalizedUrl = normalizeUrl(url);
  const autoQuery = useArticleAuto(url);
  const winningSource = autoQuery.data?.source ?? null;

  // Track which tabs user has clicked (triggers lazy fetch)
  const [activatedSources, setActivatedSources] = useState<Set<Source>>(new Set());

  // Track user's explicit tab selection (null = follow winning source / auto-switch)
  const [userSelectedSource, setUserSelectedSource] = useState<Source | null>(null);

  // Reset state when URL changes (React "adjust state during render" pattern)
  const [prevUrl, setPrevUrl] = useState(normalizedUrl);
  if (prevUrl !== normalizedUrl) {
    setPrevUrl(normalizedUrl);
    setActivatedSources(new Set());
    setUserSelectedSource(null);
  }

  // Detect if winning source is truncated/blocked (pure derivation, no effect needed)
  const winnerIsTruncated = !!(
    autoQuery.data?.article
    && autoQuery.data.source === "smry-fast"
    && ((autoQuery.data.article.length ?? 0) < 500 || autoQuery.data.status === "blocked")
  );

  // Active source: user selection > auto-switch > winning source > default
  const activeSource = userSelectedSource
    ?? (winnerIsTruncated ? "smry-slow" as Source : null)
    ?? winningSource
    ?? "smry-fast" as Source;

  // Determine if a non-winning source should fetch
  const isSourceEnabled = (s: Source): boolean => {
    if (s === winningSource) return false; // Already have data from auto
    if (activatedSources.has(s)) return true; // User clicked this tab
    if (winnerIsTruncated && s === "smry-slow") return true; // Auto-switch
    return false;
  };

  // Per-source queries — enabled only when user clicks that tab
  // AND it's not the winning source (which we already have from auto)
  const smryFastQuery = useQuery({
    queryKey: ["article", "smry-fast", normalizedUrl],
    queryFn: () => articleAPI.getArticle(url, "smry-fast"),
    enabled: isSourceEnabled("smry-fast"),
    staleTime: 2 * 60 * 1000,
    gcTime: 2 * 60 * 1000,
    retry: 1,
  });

  const smrySlowQuery = useQuery({
    queryKey: ["article", "smry-slow", normalizedUrl],
    queryFn: () => articleAPI.getArticle(url, "smry-slow"),
    enabled: isSourceEnabled("smry-slow"),
    staleTime: 2 * 60 * 1000,
    gcTime: 2 * 60 * 1000,
    retry: 1,
  });

  const waybackQuery = useQuery({
    queryKey: ["article", "wayback", normalizedUrl],
    queryFn: () => articleAPI.getArticle(url, "wayback"),
    enabled: isSourceEnabled("wayback"),
    staleTime: 2 * 60 * 1000,
    gcTime: 2 * 60 * 1000,
    retry: 1,
  });

  // User clicks a tab: activate source + set as selected
  const activateSource = useCallback((source: Source) => {
    setActivatedSources(prev => {
      const next = new Set(prev);
      next.add(source);
      return next;
    });
    setUserSelectedSource(source);
  }, []);

  // Build SourceTabState record
  const perSourceQueries: Record<Source, typeof smryFastQuery> = {
    "smry-fast": smryFastQuery,
    "smry-slow": smrySlowQuery,
    "wayback": waybackQuery,
  };

  const sourceStates = {} as Record<Source, SourceTabState>;
  for (const s of SOURCES) {
    if (s === winningSource) {
      // Winning source uses data from autoQuery
      sourceStates[s] = {
        data: autoQuery.data as ArticleResponse | undefined,
        isLoading: autoQuery.isLoading,
        isError: autoQuery.isError,
        error: autoQuery.error,
        isIdle: false,
      };
    } else {
      const q = perSourceQueries[s];
      const enabled = isSourceEnabled(s);
      sourceStates[s] = {
        data: q.data,
        isLoading: q.isLoading,
        isError: q.isError,
        error: q.error,
        isIdle: !enabled,
      };
    }
  }

  return {
    sourceStates,
    activeSource,
    activateSource,
    autoQuery,
    wasEnhanced: autoQuery.wasEnhanced,
    winningSource,
  };
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
