"use client";

import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Tabs as TabsPrimitive } from "@base-ui-components/react/tabs";
import React from "react";
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

const EnhancedTabsList: React.FC<{
  sources: readonly Source[];
  counts: Record<Source, number | undefined>;
  loadingStates: Record<Source, boolean>;
  errorStates: Record<Source, boolean>;
  isPremium: boolean;
  bypassStatuses: Record<Source, BypassStatus | null>;
  bypassLoadingStates: Record<Source, boolean>;
  bypassErrorStates: Record<Source, boolean>;
}> = ({ sources, counts, loadingStates, errorStates, isPremium, bypassStatuses, bypassLoadingStates, bypassErrorStates }) => {

  // Helper to format word count minimally
  const formatWordCount = (count: number | undefined): string | null => {
    if (count === undefined || count === null) return null;

    if (count >= 1000) {
      return (count / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    }
    return Math.round(count).toString();
  };

  return (
    <div className="w-full flex justify-center overflow-x-auto pb-2 pt-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
};

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
}

const ArrowTabs: React.FC<TabProps> = ({
  url,
  articleResults,
  viewMode,
  activeSource,
  onSourceChange,
  summaryOpen,
  onSummaryOpenChange,
  showInlineSummary = true,
}) => {
  const results = articleResults;
  const { isPremium } = useIsPremium();

  const counts: Record<Source, number | undefined> = {
    "smry-fast": results["smry-fast"].data?.article?.length,
    "smry-slow": results["smry-slow"].data?.article?.length,
    "wayback": results.wayback.data?.article?.length,
    "jina.ai": results["jina.ai"].data?.article?.length,
  };

  const loadingStates: Record<Source, boolean> = {
    "smry-fast": results["smry-fast"].isLoading,
    "smry-slow": results["smry-slow"].isLoading,
    "wayback": results.wayback.isLoading,
    "jina.ai": results["jina.ai"].isLoading,
  };

  const errorStates: Record<Source, boolean> = {
    "smry-fast": results["smry-fast"].isError,
    "smry-slow": results["smry-slow"].isError,
    "wayback": results.wayback.isError,
    "jina.ai": results["jina.ai"].isError,
  };

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

  const bypassStatuses: Record<Source, BypassStatus | null> = {
    "smry-fast": bypassFast.result?.status ?? null,
    "smry-slow": bypassSlow.result?.status ?? null,
    "wayback": bypassWayback.result?.status ?? null,
    "jina.ai": bypassJina.result?.status ?? null,
  };

  const bypassLoadingStates: Record<Source, boolean> = {
    "smry-fast": bypassFast.isLoading,
    "smry-slow": bypassSlow.isLoading,
    "wayback": bypassWayback.isLoading,
    "jina.ai": bypassJina.isLoading,
  };

  const bypassErrorStates: Record<Source, boolean> = {
    "smry-fast": !!bypassFast.error,
    "smry-slow": !!bypassSlow.error,
    "wayback": !!bypassWayback.error,
    "jina.ai": !!bypassJina.error,
  };

  return (
    <div className="relative min-h-screen pb-12 md:pb-0 px-4 md:px-0">
      <Tabs
        id="article-source-tabs"
        value={activeSource}
        onValueChange={(value) => onSourceChange(value as Source)}
      >
        {/* Tabs List - Responsive (Scrollable on mobile) */}
        <div className="sticky top-0 z-20 mb-4 pb-4 bg-gradient-to-b from-background from-70% to-transparent">
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
            query={results["smry-fast"]}
            source="smry-fast"
            url={url}
            viewMode={viewMode}
          />
        </TabsContent>
        <TabsContent id="article-panel-smry-slow" value={"smry-slow"} keepMounted>
          <ArticleContent
            query={results["smry-slow"]}
            source="smry-slow"
            url={url}
            viewMode={viewMode}
          />
        </TabsContent>
        <TabsContent id="article-panel-wayback" value={"wayback"} keepMounted>
          <ArticleContent
            query={results.wayback}
            source="wayback"
            url={url}
            viewMode={viewMode}
          />
        </TabsContent>
        <TabsContent id="article-panel-jina" value={"jina.ai"} keepMounted>
          <ArticleContent
            query={results["jina.ai"]}
            source="jina.ai"
            url={url}
            viewMode={viewMode}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ArrowTabs;
