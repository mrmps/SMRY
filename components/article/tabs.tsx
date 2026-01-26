"use client";

import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import React, { useState, useEffect, useMemo, useCallback, memo } from "react";
import { ArticleContent } from "./content";
import { Source, ArticleResponse, SOURCES } from "@/types/api";
import { UseQueryResult } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipTrigger,
  TooltipPopup,
} from "@/components/ui/tooltip";
import { InlineSummary } from "@/components/features/inline-summary";
import { PaywallIndicator } from "./paywall-indicator";
import { useBypassDetection } from "@/lib/hooks/use-bypass-detection";
import { useIsPremium } from "@/lib/hooks/use-is-premium";
import type { BypassStatus } from "@/types/api";

const SOURCE_LABELS: Record<Source, string> = {
  "smry-fast": "Smry Fast",
  "smry-slow": "Smry Slow",
  wayback: "Wayback",
  "jina.ai": "Jina.ai",
};

const MOBILE_SOURCE_LABELS: Record<Source, string> = {
  "smry-fast": "Fast",
  "smry-slow": "Slow",
  wayback: "Wayback",
  "jina.ai": "Jina",
};

const EnhancedTabsList = memo(function EnhancedTabsList({
  sources,
  counts,
  loadingStates,
  errorStates,
  isPremium,
  bypassStatuses,
  bypassLoadingStates,
  bypassErrorStates,
}: {
  sources: readonly Source[];
  counts: Record<Source, number | undefined>;
  loadingStates: Record<Source, boolean>;
  errorStates: Record<Source, boolean>;
  isPremium: boolean;
  bypassStatuses: Record<Source, BypassStatus | null>;
  bypassLoadingStates: Record<Source, boolean>;
  bypassErrorStates: Record<Source, boolean>;
}) {

  // Helper to format word count minimally
  const formatWordCount = (count: number | undefined): string | null => {
    if (count === undefined || count === null) return null;

    if (count >= 1000) {
      return (count / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    }
    return Math.round(count).toString();
  };

  return (
    <div className="w-full flex justify-center overflow-x-auto px-4 sm:px-0 pb-2 pt-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <TabsPrimitive.List className="flex h-auto w-auto items-center justify-center gap-1 bg-accent p-0.5 rounded-[14px]">
        {sources.map((source, index) => {
          const count = counts[source];
          const wordCount = formatWordCount(count);
          const isLoading = loadingStates[source];
          const hasError = errorStates[source];

          return (
            <TabsPrimitive.Tab
              key={index}
              id={`article-tab-${source}`}
              value={source}
              className={cn(
                "group flex flex-1 sm:flex-none items-center justify-center sm:justify-start gap-1.5 sm:gap-2 rounded-xl px-1 sm:px-3 py-2 text-xs sm:text-sm font-medium transition-colors outline-none",
                // Inactive state
                "aria-[selected=false]:text-muted-foreground aria-[selected=false]:hover:text-foreground",
                // Active state
                "aria-selected:bg-card aria-selected:text-black dark:aria-selected:text-white aria-selected:shadow-sm",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
              )}
            >
              <span className="hidden sm:inline">{SOURCE_LABELS[source]}</span>
              <span className="inline sm:hidden">{MOBILE_SOURCE_LABELS[source]}</span>

              {isLoading ? (
                <Skeleton className="h-4 w-8 sm:h-5 sm:w-10 rounded-md sm:rounded-lg" />
              ) : hasError ? (
                <Tooltip>
                  <TooltipTrigger
                    render={<span />}
                    className={cn(
                      "inline-flex h-4 sm:h-5 min-w-4 sm:min-w-5 items-center justify-center rounded-md sm:rounded-lg px-1 text-[9px] sm:text-[10px] font-semibold transition-colors cursor-help",
                      "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400",
                    )}
                  >
                    ✗
                  </TooltipTrigger>
                  <TooltipPopup>
                    <p>Failed to load content</p>
                  </TooltipPopup>
                </Tooltip>
              ) : isPremium && (bypassStatuses[source] || bypassLoadingStates[source] || bypassErrorStates[source]) ? (
                <PaywallIndicator
                  status={bypassStatuses[source]}
                  isLoading={bypassLoadingStates[source]}
                  hasError={bypassErrorStates[source]}
                />
              ) : wordCount ? (
                <span
                  className={cn(
                    "inline-flex h-4 sm:h-5 min-w-4 sm:min-w-5 items-center justify-center rounded-md sm:rounded-lg px-1 text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider transition-colors",
                    "bg-muted text-muted-foreground group-aria-selected:bg-primary/10 group-aria-selected:text-primary",
                  )}
                >
                  {wordCount}
                </span>
              ) : null}
            </TabsPrimitive.Tab>
          );
        })}
      </TabsPrimitive.List>
    </div>
  );
});

type ArticleResults = Record<Source, UseQueryResult<ArticleResponse, Error>>;

interface TabProps {
  url: string;
  articleResults: ArticleResults;
  viewMode: "markdown" | "html" | "iframe";
  activeSource: Source;
  onSourceChange: (source: Source) => void;
  summaryOpen: boolean;
  onSummaryOpenChange: (open: boolean) => void;
  /** Whether to render InlineSummary inside this component. Set false when parent handles summary (e.g., sidebar). */
  showInlineSummary?: boolean;
  /** Additional class name for the container */
  className?: string;
  /** Whether mobile header is visible - controls tabs sticky position */
  mobileHeaderVisible?: boolean;
}

const ArrowTabs: React.FC<TabProps> = memo(function ArrowTabs({
  url,
  articleResults,
  viewMode,
  activeSource,
  onSourceChange,
  summaryOpen,
  onSummaryOpenChange,
  showInlineSummary = true,
  mobileHeaderVisible = true,
  className,
}) {
  const results = articleResults;
  const { isPremium } = useIsPremium();

  // Extract individual result objects for cleaner dependency tracking
  const smryFastResult = results["smry-fast"];
  const smrySlowResult = results["smry-slow"];
  const waybackResult = results.wayback;
  const jinaResult = results["jina.ai"];

  // Shared fullscreen state across all tabs
  const [isFullScreen, setIsFullScreen] = useState(() => {
    if (typeof window === "undefined") return false;
    const isMobile = window.innerWidth < 768;
    return isMobile && viewMode === "html";
  });

  // Stable callback for fullscreen changes
  const handleFullScreenChange = useCallback((fullScreen: boolean) => {
    setIsFullScreen(fullScreen);
  }, []);

  // Auto-enter fullscreen on mobile when switching to HTML view
  useEffect(() => {
    if (typeof window === "undefined") return;
    const isMobile = window.innerWidth < 768;
    if (isMobile && viewMode === "html") {
      // Schedule state update to avoid synchronous setState in effect
      const frameId = requestAnimationFrame(() => setIsFullScreen(true));
      return () => cancelAnimationFrame(frameId);
    }
  }, [viewMode]);

  // Extract values for memoization dependencies
  const smryFastLength = smryFastResult.data?.article?.length;
  const smrySlowLength = smrySlowResult.data?.article?.length;
  const waybackLength = waybackResult.data?.article?.length;
  const jinaLength = jinaResult.data?.article?.length;

  const smryFastLoading = smryFastResult.isLoading;
  const smrySlowLoading = smrySlowResult.isLoading;
  const waybackLoading = waybackResult.isLoading;
  const jinaLoading = jinaResult.isLoading;

  const smryFastError = smryFastResult.isError;
  const smrySlowError = smrySlowResult.isError;
  const waybackError = waybackResult.isError;
  const jinaError = jinaResult.isError;

  // Memoize derived state objects to prevent unnecessary re-renders
  const counts = useMemo<Record<Source, number | undefined>>(() => ({
    "smry-fast": smryFastLength,
    "smry-slow": smrySlowLength,
    "wayback": waybackLength,
    "jina.ai": jinaLength,
  }), [smryFastLength, smrySlowLength, waybackLength, jinaLength]);

  const loadingStates = useMemo<Record<Source, boolean>>(() => ({
    "smry-fast": smryFastLoading,
    "smry-slow": smrySlowLoading,
    "wayback": waybackLoading,
    "jina.ai": jinaLoading,
  }), [smryFastLoading, smrySlowLoading, waybackLoading, jinaLoading]);

  const errorStates = useMemo<Record<Source, boolean>>(() => ({
    "smry-fast": smryFastError,
    "smry-slow": smrySlowError,
    "wayback": waybackError,
    "jina.ai": jinaError,
  }), [smryFastError, smrySlowError, waybackError, jinaError]);

  // Bypass detection for premium users - run for all sources so user can compare
  const bypassFast = useBypassDetection({
    url,
    source: "smry-fast",
    article: results["smry-fast"].data?.article,
    enabled: isPremium && !results["smry-fast"].isLoading && !!results["smry-fast"].data?.article,
  });
  const bypassSlow = useBypassDetection({
    url,
    source: "smry-slow",
    article: results["smry-slow"].data?.article,
    enabled: isPremium && !results["smry-slow"].isLoading && !!results["smry-slow"].data?.article,
  });
  const bypassWayback = useBypassDetection({
    url,
    source: "wayback",
    article: results.wayback.data?.article,
    enabled: isPremium && !results.wayback.isLoading && !!results.wayback.data?.article,
  });
  const bypassJina = useBypassDetection({
    url,
    source: "jina.ai",
    article: results["jina.ai"].data?.article,
    enabled: isPremium && !results["jina.ai"].isLoading && !!results["jina.ai"].data?.article,
  });

  const bypassStatuses = useMemo<Record<Source, BypassStatus | null>>(() => ({
    "smry-fast": bypassFast.result?.status ?? null,
    "smry-slow": bypassSlow.result?.status ?? null,
    "wayback": bypassWayback.result?.status ?? null,
    "jina.ai": bypassJina.result?.status ?? null,
  }), [
    bypassFast.result?.status,
    bypassSlow.result?.status,
    bypassWayback.result?.status,
    bypassJina.result?.status,
  ]);

  const bypassLoadingStates = useMemo<Record<Source, boolean>>(() => ({
    "smry-fast": bypassFast.isLoading,
    "smry-slow": bypassSlow.isLoading,
    "wayback": bypassWayback.isLoading,
    "jina.ai": bypassJina.isLoading,
  }), [
    bypassFast.isLoading,
    bypassSlow.isLoading,
    bypassWayback.isLoading,
    bypassJina.isLoading,
  ]);

  const bypassErrorStates = useMemo<Record<Source, boolean>>(() => ({
    "smry-fast": !!bypassFast.error,
    "smry-slow": !!bypassSlow.error,
    "wayback": !!bypassWayback.error,
    "jina.ai": !!bypassJina.error,
  }), [
    bypassFast.error,
    bypassSlow.error,
    bypassWayback.error,
    bypassJina.error,
  ]);

  return (
    <div className={cn(
      "relative min-h-screen pb-12 md:pb-0",
      viewMode === "html" ? "px-0" : "md:px-0",
      className
    )}>
      <Tabs
        id="article-source-tabs"
        value={activeSource}
        onValueChange={(value) => onSourceChange(value as Source)}
      >
        {/* Tabs List - Responsive (Scrollable on mobile) */}
        <div className={cn(
          "sticky z-20 bg-gradient-to-b from-background from-70% to-transparent transition-[top] duration-300 ease-out",
          // On mobile: top-14 when header visible, top-0 when hidden. On desktop: always top-0
          mobileHeaderVisible ? "top-14 md:top-0" : "top-0",
          viewMode === "html" ? "mb-2 pb-2" : ""
        )}>
          <EnhancedTabsList
            sources={SOURCES}
            counts={counts}
            loadingStates={loadingStates}
            errorStates={errorStates}
            isPremium={isPremium}
            bypassStatuses={bypassStatuses}
            bypassLoadingStates={bypassLoadingStates}
            bypassErrorStates={bypassErrorStates}
          />
        </div>

        {/* Inline Summary - only rendered when showInlineSummary is true */}
        {showInlineSummary && (
          <InlineSummary
            urlProp={url}
            articleResults={results}
            isOpen={summaryOpen}
            onOpenChange={onSummaryOpenChange}
            variant="inline"
          />
        )}

        <TabsContent id="article-panel-smry-fast" value={"smry-fast"} keepMounted>
          <ArticleContent
            data={results["smry-fast"].data}
            isLoading={results["smry-fast"].isLoading}
            isError={results["smry-fast"].isError}
            error={results["smry-fast"].error}
            source="smry-fast"
            url={url}
            viewMode={viewMode}
            isFullScreen={isFullScreen}
            onFullScreenChange={handleFullScreenChange}
          />
        </TabsContent>
        <TabsContent id="article-panel-smry-slow" value={"smry-slow"} keepMounted>
          <ArticleContent
            data={results["smry-slow"].data}
            isLoading={results["smry-slow"].isLoading}
            isError={results["smry-slow"].isError}
            error={results["smry-slow"].error}
            source="smry-slow"
            url={url}
            viewMode={viewMode}
            isFullScreen={isFullScreen}
            onFullScreenChange={handleFullScreenChange}
          />
        </TabsContent>
        <TabsContent id="article-panel-wayback" value={"wayback"} keepMounted>
          <ArticleContent
            data={results.wayback.data}
            isLoading={results.wayback.isLoading}
            isError={results.wayback.isError}
            error={results.wayback.error}
            source="wayback"
            url={url}
            viewMode={viewMode}
            isFullScreen={isFullScreen}
            onFullScreenChange={handleFullScreenChange}
          />
        </TabsContent>
        <TabsContent id="article-panel-jina" value={"jina.ai"} keepMounted>
          <ArticleContent
            data={results["jina.ai"].data}
            isLoading={results["jina.ai"].isLoading}
            isError={results["jina.ai"].isError}
            error={results["jina.ai"].error}
            source="jina.ai"
            url={url}
            viewMode={viewMode}
            isFullScreen={isFullScreen}
            onFullScreenChange={handleFullScreenChange}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
});

export default ArrowTabs;
