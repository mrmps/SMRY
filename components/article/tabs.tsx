"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import React from "react";
import { ArticleContent } from "./content";
import { ArticleLength } from "./length";
import { Source, ArticleResponse } from "@/types/api";
import { UseQueryResult } from "@tanstack/react-query";

const SOURCE_LABELS: Record<Source, string> = {
  "smry-fast": "Smry Fast",
  "smry-slow": "Smry Slow",
  wayback: "Wayback",
  "jina.ai": "Jina.ai",
};

const EnhancedTabsList: React.FC<{
  sources: Source[];
  lengths: Record<Source, React.ReactNode>;
}> = ({ sources, lengths }) => {
  const getSourceLength = (source: Source): React.ReactNode => lengths[source] ?? null;

  return (
    <div className="w-full overflow-x-auto pb-2 pt-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <TabsList className="inline-flex h-auto w-max items-center justify-start gap-2 bg-transparent p-0">
        {sources.map((source, index) => (
          <TabsTrigger 
            key={index} 
            value={source} 
            className="h-8 rounded-full border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-600 shadow-sm data-[state=active]:border-zinc-900 data-[state=active]:bg-zinc-900 data-[state=active]:text-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 dark:data-[state=active]:border-zinc-50 dark:data-[state=active]:bg-zinc-50 dark:data-[state=active]:text-zinc-900"
          >
            <div className="flex items-center gap-1.5">
              {SOURCE_LABELS[source]}
              {getSourceLength(source)}
            </div>
          </TabsTrigger>
        ))}
      </TabsList>
    </div>
  );
};

type ArticleResults = Record<Source, UseQueryResult<ArticleResponse, Error>>;

interface TabProps {
  url: string;
  articleResults: ArticleResults;
  viewMode: "markdown" | "html" | "iframe";
  controls?: React.ReactNode;
}

const ArrowTabs: React.FC<TabProps> = ({ url, articleResults, viewMode, controls }) => {
  const sources: Source[] = ["smry-fast", "smry-slow", "wayback", "jina.ai"];
  const results = articleResults;

  const lengths: Record<Source, React.ReactNode> = {
    "smry-fast": (
      <ArticleLength 
        query={results["smry-fast"]}
        source="smry-fast"
      />
    ),
    "smry-slow": (
      <ArticleLength 
        query={results["smry-slow"]}
        source="smry-slow"
      />
    ),
    wayback: (
      <ArticleLength 
        query={results.wayback}
        source="wayback"
      />
    ),
    "jina.ai": (
      <ArticleLength 
        query={results["jina.ai"]}
        source="jina.ai"
      />
    ),
  };

  return (
    <div className="relative min-h-screen">
      <Tabs defaultValue={"smry-fast"}>
        {/* 
          Sticky Header:
          - z-[9] allows TopBar (z-10) to slide over it
          - backdrop-blur for modern feel
          - border-b for separation
        */}
        <div className="sticky top-0 z-[9] -mx-4 mb-4 bg-background/90 px-4 pt-2 backdrop-blur-md transition-all supports-[backdrop-filter]:bg-background/60 sm:-mx-0 sm:px-0">
          {controls && <div className="mb-2">{controls}</div>}
          <EnhancedTabsList
            sources={sources}
            lengths={lengths}
          />
          {/* Gradient mask for scrolling hint (optional, but nice) */}
          <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent sm:hidden" />
        </div>
        
        <TabsContent value={"smry-fast"} forceMount={true}>
          <ArticleContent 
            query={results["smry-fast"]} 
            source="smry-fast"
            url={url}
            viewMode={viewMode}
          />
        </TabsContent>
        <TabsContent value={"smry-slow"} forceMount={true}>
          <ArticleContent 
            query={results["smry-slow"]} 
            source="smry-slow"
            url={url}
            viewMode={viewMode}
          />
        </TabsContent>
        <TabsContent value={"wayback"} forceMount={true}>
          <ArticleContent 
            query={results.wayback} 
            source="wayback"
            url={url}
            viewMode={viewMode}
          />
        </TabsContent>
        <TabsContent value={"jina.ai"} forceMount={true}>
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
