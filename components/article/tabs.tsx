"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import React from "react";
import { ArticleContent } from "./content";
import { ArticleLength } from "./length";
import { Source, ArticleResponse } from "@/types/api";
import { UseQueryResult } from "@tanstack/react-query";

const SOURCE_LABELS: Record<Source, string> = {
  "smry-fast": "smry (fast)",
  "smry-slow": "smry (slow)",
  wayback: "wayback",
  "jina.ai": "jina.ai",
};

const EnhancedTabsList: React.FC<{
  sources: Source[];
  lengths: Record<Source, React.ReactNode>;
}> = ({ sources, lengths }) => {
  const getSourceLength = (source: Source): React.ReactNode => lengths[source] ?? null;

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-1">
      <div className="md:-mx-1 md:overflow-x-auto md:px-1 md:[&::-webkit-scrollbar-thumb]:rounded-full md:[&::-webkit-scrollbar-thumb]:bg-zinc-300/70 md:[&::-webkit-scrollbar-track]:bg-transparent md:[&::-webkit-scrollbar]:h-1" style={{ scrollbarWidth: "thin" }}>
        <TabsList className="h-auto w-full flex-col justify-start gap-1 md:h-10 md:w-max md:flex-row md:flex-nowrap md:justify-start md:whitespace-nowrap">
          {sources.map((source, index) => (
            <TabsTrigger key={index} value={source} className="w-full md:w-auto md:shrink-0">
              <span>
                {SOURCE_LABELS[source]}
                {getSourceLength(source)}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
    </div>
  );
};

type ArticleResults = Record<Source, UseQueryResult<ArticleResponse, Error>>;

interface TabProps {
  url: string;
  articleResults: ArticleResults;
  viewMode: "markdown" | "iframe";
}

const ArrowTabs: React.FC<TabProps> = ({ url, articleResults, viewMode }) => {
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
    <div>
      <Tabs defaultValue={"smry-fast"}>
        <EnhancedTabsList
          sources={sources}
          lengths={lengths}
        />
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
