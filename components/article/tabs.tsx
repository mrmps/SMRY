"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import React from "react";
import { ArticleContent } from "./content";
import { ArticleLength } from "./length";
import { Source, ArticleResponse } from "@/types/api";
import { UseQueryResult } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { DocumentTextIcon, Squares2X2Icon } from "@heroicons/react/24/outline";
import useLocalStorage from "@/lib/hooks/use-local-storage";

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
}

const ArrowTabs: React.FC<TabProps> = ({ url, articleResults }) => {
  const sources: Source[] = ["smry-fast", "smry-slow", "wayback", "jina.ai"];
  const results = articleResults;
  const [viewMode, setViewMode] = useLocalStorage<"markdown" | "iframe">("article-view-mode", "markdown");

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
      {/* View Mode Toggle */}
      <div className="mb-4 flex items-center justify-end gap-2">
        <span className="text-sm text-gray-600">View:</span>
        <div className="inline-flex rounded-lg border border-zinc-200 bg-white p-1">
          <Button
            variant={viewMode === "markdown" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("markdown")}
            className="h-8 px-3 text-xs"
          >
            <DocumentTextIcon className="mr-1.5 h-3.5 w-3.5" />
            Markdown
          </Button>
          <Button
            variant={viewMode === "iframe" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("iframe")}
            className="h-8 px-3 text-xs"
          >
            <Squares2X2Icon className="mr-1.5 h-3.5 w-3.5" />
            Iframe
          </Button>
        </div>
      </div>

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
