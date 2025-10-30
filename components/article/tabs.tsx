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
    <div className="border border-zinc-200 rounded-lg p-1 bg-white">
      <div className="md:-mx-1 md:overflow-x-auto md:px-1 md:[&::-webkit-scrollbar]:h-1 md:[&::-webkit-scrollbar-thumb]:rounded-full md:[&::-webkit-scrollbar-thumb]:bg-zinc-300/70 md:[&::-webkit-scrollbar-track]:bg-transparent" style={{ scrollbarWidth: "thin" }}>
        <TabsList className="flex-col md:flex-row md:flex-nowrap w-full md:w-max h-auto md:h-10 gap-1 justify-start md:justify-start md:whitespace-nowrap">
          {sources.map((source, index) => (
            <TabsTrigger key={index} value={source} className="w-full md:w-auto md:flex-shrink-0">
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
