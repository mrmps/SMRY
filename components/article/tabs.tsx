"use client";

import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Tabs as TabsPrimitive } from "@base-ui-components/react/tabs";
import React from "react";
import { ArticleContent } from "./content";
import { Source, ArticleResponse, SOURCES } from "@/types/api";
import { UseQueryResult } from "@tanstack/react-query";
import { MenuDock, MenuDockItem } from "@/components/ui/menu-dock";
import { Zap, Clock, Archive, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQueryState, parseAsStringLiteral } from "nuqs";

const SOURCE_LABELS: Record<Source, string> = {
  "smry-fast": "Smry Fast",
  "smry-slow": "Smry Slow",
  wayback: "Wayback",
  "jina.ai": "Jina.ai",
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
    <div className="w-full overflow-x-auto pb-2 pt-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <TabsPrimitive.List className="inline-flex h-auto w-max items-center justify-start gap-1 bg-accent p-0.5 rounded-[14px]">
        {sources.map((source, index) => {
          const wordCount = formatWordCount(counts[source]);
          
          return (
            <TabsPrimitive.Tab 
              key={index} 
              value={source} 
              className={cn(
                "group flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors outline-none",
                "text-muted-foreground hover:text-foreground",
                "data-selected:bg-card data-selected:text-foreground data-selected:shadow-sm",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
              )}
            >
              {SOURCE_LABELS[source]}
              {wordCount && (
                <span
                  className={cn(
                    "inline-flex h-5 min-w-5 items-center justify-center rounded-lg px-1.5 text-[10px] font-semibold uppercase tracking-wider transition-colors",
                    "bg-muted text-muted-foreground group-data-selected:bg-primary/10 group-data-selected:text-primary",
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
  controls?: React.ReactNode; // Kept for compatibility
}

const ArrowTabs: React.FC<TabProps> = ({ url, articleResults, viewMode }) => {
  const results = articleResults;
  const [activeTab, setActiveTab] = useQueryState<Source>(
    "source",
    parseAsStringLiteral(SOURCES).withDefault("smry-fast")
  );

  const counts: Record<Source, number | undefined> = {
    "smry-fast": results["smry-fast"].data?.article?.length,
    "smry-slow": results["smry-slow"].data?.article?.length,
    "wayback": results.wayback.data?.article?.length,
    "jina.ai": results["jina.ai"].data?.article?.length,
  };

  // Helper to format badge content intelligently
  const formatBadge = (count: number | undefined): string | undefined => {
    if (count === undefined || count === null) return undefined;
    
    if (count >= 1000) {
      return (count / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    }
    return Math.round(count).toString();
  };

  // Menu dock items for mobile
  const menuDockItems: MenuDockItem[] = [
    {
      label: "fast",
      icon: Zap,
      value: "smry-fast",
      badge: formatBadge(counts["smry-fast"]),
      badgeVariant: counts["smry-fast"] ? 'count' : undefined,
      onClick: () => setActiveTab("smry-fast"),
    },
    {
      label: "slow",
      icon: Clock,
      value: "smry-slow",
      badge: formatBadge(counts["smry-slow"]),
      badgeVariant: counts["smry-slow"] ? 'count' : undefined,
      onClick: () => setActiveTab("smry-slow"),
    },
    {
      label: "wayback",
      icon: Archive,
      value: "wayback",
      badge: formatBadge(counts.wayback),
      badgeVariant: counts.wayback ? 'count' : undefined,
      onClick: () => setActiveTab("wayback"),
    },
    {
      label: "jina",
      icon: Globe,
      value: "jina.ai",
      badge: formatBadge(counts["jina.ai"]),
      badgeVariant: counts["jina.ai"] ? 'count' : undefined,
      onClick: () => setActiveTab("jina.ai"),
    },
  ];

  return (
    <div className="relative min-h-screen pb-24 md:pb-0">
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as Source)}>
        {/* Desktop tabs - shown on medium screens and up */}
        <div
          className={cn(
            "sticky top-0 z-10 mb-4 -mx-4 hidden px-4 py-2 sm:mx-0 sm:rounded-xl sm:px-2 md:block",
            "bg-background/80 backdrop-blur-xl transition-all supports-backdrop-filter:bg-background/60",
          )}
        >
          <EnhancedTabsList
            sources={SOURCES}
            counts={counts}
          />
        </div>

        {/* Mobile menu dock - floating at bottom */}
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 md:hidden">
          <MenuDock
            items={menuDockItems}
            variant="compact"
            orientation="horizontal"
            showLabels={true}
            activeValue={activeTab}
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
