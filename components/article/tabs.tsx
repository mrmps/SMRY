"use client";

import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Tabs as TabsPrimitive } from "@base-ui-components/react/tabs";
import React from "react";
import { ArticleContent } from "./content";
import { Source, ArticleResponse, SOURCES } from "@/types/api";
import { UseQueryResult } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

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
}> = ({ sources, counts }) => {
  // Helper to format word count minimally
  const formatWordCount = (count: number | undefined): string | null => {
    if (count === undefined || count === null) return null;
    
    if (count >= 1000) {
      return (count / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    }
    return Math.round(count).toString();
  };

  return (
    <div className="w-full overflow-x-auto sm:overflow-visible pb-2 pt-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <TabsPrimitive.List className="flex h-auto w-full sm:w-max items-center justify-between sm:justify-start gap-1 bg-accent p-0.5 rounded-[14px]">
        {sources.map((source, index) => {
          const wordCount = formatWordCount(counts[source]);
          
          return (
            <TabsPrimitive.Tab 
              key={index} 
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
              {wordCount && (
                <span
                  className={cn(
                    "inline-flex h-4 sm:h-5 min-w-4 sm:min-w-5 items-center justify-center rounded-md sm:rounded-lg px-1 text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider transition-colors",
                    "bg-muted text-muted-foreground group-aria-selected:bg-primary/10 group-aria-selected:text-primary",
                  )}
                >
                  {wordCount}
                </span>
              )}
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
}

const ArrowTabs: React.FC<TabProps> = ({
  url,
  articleResults,
  viewMode,
  activeSource,
  onSourceChange,
}) => {
  const results = articleResults;

  const counts: Record<Source, number | undefined> = {
    "smry-fast": results["smry-fast"].data?.article?.length,
    "smry-slow": results["smry-slow"].data?.article?.length,
    "wayback": results.wayback.data?.article?.length,
    "jina.ai": results["jina.ai"].data?.article?.length,
  };

  return (
    <div className="relative min-h-screen pb-12 md:pb-0 px-4 md:px-0">
      <Tabs value={activeSource} onValueChange={(value) => onSourceChange(value as Source)}>
        {/* Tabs List - Responsive (Scrollable on mobile) */}
        <div
          className={cn(
            "sticky top-14 z-20 mb-4 -mx-4 px-4 py-2 sm:mx-0 sm:top-0 sm:z-10 sm:rounded-xl sm:px-2",
            "bg-background/80 backdrop-blur-xl transition-all supports-backdrop-filter:bg-background/60",
            "border-b border-border/40 sm:border-0"
          )}
        >
          <EnhancedTabsList
            sources={SOURCES}
            counts={counts}
          />
        </div>
        
        <TabsContent value={"smry-fast"}>
          <ArticleContent 
            query={results["smry-fast"]} 
            source="smry-fast"
            url={url}
            viewMode={viewMode}
          />
        </TabsContent>
        <TabsContent value={"smry-slow"}>
          <ArticleContent 
            query={results["smry-slow"]} 
            source="smry-slow"
            url={url}
            viewMode={viewMode}
          />
        </TabsContent>
        <TabsContent value={"wayback"}>
          <ArticleContent 
            query={results.wayback} 
            source="wayback"
            url={url}
            viewMode={viewMode}
          />
        </TabsContent>
        <TabsContent value={"jina.ai"}>
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
