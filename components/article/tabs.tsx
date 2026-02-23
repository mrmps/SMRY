"use client";

import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import React, { useState, useEffect, useMemo, useCallback, memo } from "react";
import { ArticleContent } from "./content";
import { Source, SOURCES } from "@/types/api";
import type { SourceTabState } from "@/lib/hooks/use-articles";
import type { GravityAd as GravityAdType } from "@/lib/hooks/use-gravity-ad";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { PaywallIndicator } from "./paywall-indicator";
import { useBypassDetection } from "@/lib/hooks/use-bypass-detection";
import { useIsPremium } from "@/lib/hooks/use-is-premium";
import type { BypassStatus } from "@/types/api";

const SOURCE_LABELS: Record<Source, string> = {
  "smry-fast": "Direct",
  "smry-slow": "AI Extract",
  wayback: "Archive",
};

const MOBILE_SOURCE_LABELS: Record<Source, string> = {
  "smry-fast": "Direct",
  "smry-slow": "AI",
  wayback: "Archive",
};

const SOURCE_TOOLTIPS: Record<Source, string> = {
  "smry-fast": "Direct fetch — fastest, but may miss paywalled content",
  "smry-slow": "AI extraction — best for paywalled or complex pages",
  wayback: "Archived version from archive.org",
};

const EnhancedTabsList = memo(function EnhancedTabsList({
  sources,
  counts,
  loadingStates,
  errorStates,
  idleStates,
  isPremium,
  bypassStatuses,
  bypassLoadingStates,
  bypassErrorStates,
  winningSource,
}: {
  sources: readonly Source[];
  counts: Record<Source, number | undefined>;
  loadingStates: Record<Source, boolean>;
  errorStates: Record<Source, boolean>;
  idleStates: Record<Source, boolean>;
  isPremium: boolean;
  bypassStatuses: Record<Source, BypassStatus | null>;
  bypassLoadingStates: Record<Source, boolean>;
  bypassErrorStates: Record<Source, boolean>;
  winningSource: Source | null;
}) {
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
          const isWinner = winningSource === source;

          return (
            <TabsPrimitive.Tab
              key={index}
              id={`article-tab-${source}`}
              value={source}
              className={cn(
                "group flex flex-1 sm:flex-none items-center justify-center sm:justify-start gap-1.5 sm:gap-2 rounded-xl px-2 sm:px-3 py-2 text-[13px] sm:text-sm font-medium transition-colors outline-none",
                // Inactive state
                "aria-[selected=false]:text-muted-foreground aria-[selected=false]:hover:text-foreground",
                // Active state
                "aria-selected:bg-card aria-selected:text-black dark:aria-selected:text-white aria-selected:shadow-sm",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
              )}
            >
              <Tooltip>
                <TooltipTrigger
                  render={<span />}
                  className="cursor-default"
                >
                  <span className="hidden sm:inline">{SOURCE_LABELS[source]}</span>
                  <span className="inline sm:hidden">{MOBILE_SOURCE_LABELS[source]}</span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{SOURCE_TOOLTIPS[source]}</p>
                </TooltipContent>
              </Tooltip>

              {idleStates[source] ? null : isLoading ? (
                <Skeleton className="h-4 w-8 sm:h-5 sm:w-10 rounded-md sm:rounded-lg" />
              ) : hasError ? (
                <Tooltip>
                  <TooltipTrigger
                    render={<span />}
                    className={cn(
                      "inline-flex h-5 min-w-5 items-center justify-center rounded-lg px-1.5 text-[11px] font-semibold transition-colors cursor-help",
                      "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400",
                    )}
                  >
                    ✗
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Failed to load content</p>
                  </TooltipContent>
                </Tooltip>
              ) : isPremium && (bypassStatuses[source] || bypassLoadingStates[source] || bypassErrorStates[source]) ? (
                <PaywallIndicator
                  status={bypassStatuses[source]}
                  isLoading={bypassLoadingStates[source]}
                  hasError={bypassErrorStates[source]}
                />
              ) : wordCount ? (
                <>
                  <span
                    className={cn(
                      "inline-flex h-5 min-w-5 items-center justify-center rounded-lg px-1.5 text-[11px] font-semibold uppercase tracking-wider transition-colors",
                      "bg-muted text-muted-foreground group-aria-selected:bg-primary/10 group-aria-selected:text-primary",
                    )}
                  >
                    {wordCount}
                  </span>
                  {isWinner && (
                    <span className="hidden sm:inline-flex items-center bg-primary/10 text-primary rounded-md px-1 text-[10px] font-medium">
                      fastest
                    </span>
                  )}
                </>
              ) : null}
            </TabsPrimitive.Tab>
          );
        })}
      </TabsPrimitive.List>
    </div>
  );
});

interface TabProps {
  url: string;
  sourceStates: Record<Source, SourceTabState>;
  viewMode: "markdown" | "html" | "iframe";
  activeSource: Source;
  onSourceChange: (source: Source) => void;
  className?: string;
  mobileHeaderVisible?: boolean;
  winningSource?: Source | null;
  // Ad props to pass through to ArticleContent
  inlineAd?: GravityAdType | null;
  onInlineAdVisible?: () => void;
  onInlineAdClick?: () => void;
  showInlineAd?: boolean;
  footerAd?: GravityAdType | null;
  onFooterAdVisible?: () => void;
  onFooterAdClick?: () => void;
  onAskAI?: (text: string) => void;
  onOpenNoteEditor?: (id: string) => void;
}

const ArrowTabs: React.FC<TabProps> = memo(function ArrowTabs({
  url,
  sourceStates,
  viewMode,
  activeSource,
  onSourceChange,
  mobileHeaderVisible = true,
  className,
  winningSource = null,
  inlineAd,
  onInlineAdVisible,
  onInlineAdClick,
  showInlineAd,
  footerAd,
  onFooterAdVisible,
  onFooterAdClick,
  onAskAI,
  onOpenNoteEditor,
}) {
  const { isPremium } = useIsPremium();

  const [isFullScreen, setIsFullScreen] = useState(() => {
    if (typeof window === "undefined") return false;
    const isMobile = window.innerWidth < 768;
    return isMobile && viewMode === "html";
  });

  const handleFullScreenChange = useCallback((fullScreen: boolean) => {
    setIsFullScreen(fullScreen);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const isMobile = window.innerWidth < 768;
    if (isMobile && viewMode === "html") {
      const frameId = requestAnimationFrame(() => setIsFullScreen(true));
      return () => cancelAnimationFrame(frameId);
    } else if (isMobile && viewMode !== "html" && isFullScreen) {
      const frameId = requestAnimationFrame(() => setIsFullScreen(false));
      return () => cancelAnimationFrame(frameId);
    }
  }, [viewMode, isFullScreen]);

  // Extract per-source states for stable dependency references
  const fastState = sourceStates["smry-fast"];
  const slowState = sourceStates["smry-slow"];
  const waybackState = sourceStates["wayback"];

  const fastLength = fastState.data?.article?.length;
  const slowLength = slowState.data?.article?.length;
  const wbLength = waybackState.data?.article?.length;

  const counts = useMemo<Record<Source, number | undefined>>(() => ({
    "smry-fast": fastLength,
    "smry-slow": slowLength,
    "wayback": wbLength,
  }), [fastLength, slowLength, wbLength]);

  const loadingStates = useMemo<Record<Source, boolean>>(() => ({
    "smry-fast": fastState.isLoading,
    "smry-slow": slowState.isLoading,
    "wayback": waybackState.isLoading,
  }), [fastState.isLoading, slowState.isLoading, waybackState.isLoading]);

  const errorStates = useMemo<Record<Source, boolean>>(() => ({
    "smry-fast": fastState.isError,
    "smry-slow": slowState.isError,
    "wayback": waybackState.isError,
  }), [fastState.isError, slowState.isError, waybackState.isError]);

  const idleStates = useMemo<Record<Source, boolean>>(() => ({
    "smry-fast": fastState.isIdle,
    "smry-slow": slowState.isIdle,
    "wayback": waybackState.isIdle,
  }), [fastState.isIdle, slowState.isIdle, waybackState.isIdle]);

  // Bypass detection — only for non-idle sources with loaded data
  const bypassFast = useBypassDetection({
    url,
    source: "smry-fast",
    article: fastState.data?.article,
    enabled: isPremium && !fastState.isIdle && !fastState.isLoading && !!fastState.data?.article,
  });
  const bypassSlow = useBypassDetection({
    url,
    source: "smry-slow",
    article: slowState.data?.article,
    enabled: isPremium && !slowState.isIdle && !slowState.isLoading && !!slowState.data?.article,
  });
  const bypassWayback = useBypassDetection({
    url,
    source: "wayback",
    article: waybackState.data?.article,
    enabled: isPremium && !waybackState.isIdle && !waybackState.isLoading && !!waybackState.data?.article,
  });

  const bypassStatuses = useMemo<Record<Source, BypassStatus | null>>(() => ({
    "smry-fast": bypassFast.result?.status ?? null,
    "smry-slow": bypassSlow.result?.status ?? null,
    "wayback": bypassWayback.result?.status ?? null,
  }), [
    bypassFast.result?.status,
    bypassSlow.result?.status,
    bypassWayback.result?.status,
  ]);

  const bypassLoadingStates = useMemo<Record<Source, boolean>>(() => ({
    "smry-fast": bypassFast.isLoading,
    "smry-slow": bypassSlow.isLoading,
    "wayback": bypassWayback.isLoading,
  }), [
    bypassFast.isLoading,
    bypassSlow.isLoading,
    bypassWayback.isLoading,
  ]);

  const bypassErrorStates = useMemo<Record<Source, boolean>>(() => ({
    "smry-fast": !!bypassFast.error,
    "smry-slow": !!bypassSlow.error,
    "wayback": !!bypassWayback.error,
  }), [
    bypassFast.error,
    bypassSlow.error,
    bypassWayback.error,
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
        <div className={cn(
          "sticky z-20 bg-gradient-to-b from-background from-70% to-transparent transition-[top] duration-300 ease-out",
          mobileHeaderVisible ? "top-14 md:top-0" : "top-0",
          viewMode === "html" ? "mb-2 pb-2" : ""
        )}>
          <EnhancedTabsList
            sources={SOURCES}
            counts={counts}
            loadingStates={loadingStates}
            errorStates={errorStates}
            idleStates={idleStates}
            isPremium={isPremium}
            bypassStatuses={bypassStatuses}
            bypassLoadingStates={bypassLoadingStates}
            bypassErrorStates={bypassErrorStates}
            winningSource={winningSource}
          />
        </div>

        {SOURCES.map((src) => {
          const state = sourceStates[src];
          return (
            <TabsContent key={src} id={`article-panel-${src}`} value={src} keepMounted>
              <ArticleContent
                data={state.data}
                isLoading={state.isIdle || state.isLoading}
                isError={state.isError}
                error={state.error}
                source={src}
                url={url}
                viewMode={viewMode}
                isFullScreen={isFullScreen}
                onFullScreenChange={handleFullScreenChange}
                inlineAd={inlineAd}
                onInlineAdVisible={onInlineAdVisible}
                onInlineAdClick={onInlineAdClick}
                showInlineAd={showInlineAd}
                footerAd={footerAd}
                onFooterAdVisible={onFooterAdVisible}
                onFooterAdClick={onFooterAdClick}
                onAskAI={onAskAI}
                onOpenNoteEditor={onOpenNoteEditor}
              />
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
});

export default ArrowTabs;
