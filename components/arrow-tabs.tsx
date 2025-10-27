"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import React from "react";
import { ArticleContent } from "./article-content";
import { ArticleLength } from "./article-length";
import { Source, ArticleResponse } from "@/types/api";
import { UseQueryResult } from "@tanstack/react-query";

const EnhancedTabsList: React.FC<{
  sources: string[];
  lengthJina: React.ReactNode;
  lengthWayback: React.ReactNode;
  lengthDirect: React.ReactNode;
}> = ({ sources, lengthDirect, lengthJina, lengthWayback }) => {
  const getSourceLength = (source: string): React.ReactNode => {
    let content;
    switch (source) {
      case "smry":
        content = lengthDirect;
        break;
      case "wayback":
        content = lengthWayback;
        break;
      case "jina.ai":
        content = lengthJina;
        break;
      default:
        content = null;
    }

    return content;
  }

  return (
    <div className="border border-zinc-200 rounded-lg p-1 bg-white">
      <TabsList className="flex-col md:flex-row w-full md:w-auto h-auto md:h-10 gap-1">
        {sources.map((source, index) => (
          <TabsTrigger key={index} value={source} className="w-full md:w-auto">
            <span>
              {source}
              {getSourceLength(source)}
            </span>
          </TabsTrigger>
        ))}
      </TabsList>
    </div>
  );
};

interface TabProps {
  url: string;
  articleResults: {
    direct: UseQueryResult<ArticleResponse, Error>;
    wayback: UseQueryResult<ArticleResponse, Error>;
    "jina.ai": UseQueryResult<ArticleResponse, Error>;
  };
}

const ArrowTabs: React.FC<TabProps> = ({ url, articleResults }) => {
  const sources = ["smry", "wayback", "jina.ai"];
  const results = articleResults;

  return (
    <Tabs defaultValue={"smry"}>
      <EnhancedTabsList
        sources={sources}
        lengthDirect={
          <ArticleLength 
            query={results.direct} 
            source="direct"
          />
        }
        lengthJina={
          <ArticleLength 
            query={results["jina.ai"]} 
            source="jina.ai"
          />
        }
        lengthWayback={
          <ArticleLength 
            query={results.wayback} 
            source="wayback"
          />
        }
      />
      <TabsContent value={"smry"}>
        <ArticleContent 
          query={results.direct} 
          source="direct"
          url={url}
        />
      </TabsContent>
      <TabsContent value={"wayback"}>
        <ArticleContent 
          query={results.wayback} 
          source="wayback"
          url={url}
        />
      </TabsContent>
      <TabsContent value={"jina.ai"}>
        <ArticleContent 
          query={results["jina.ai"]} 
          source="jina.ai"
          url={url}
        />
      </TabsContent>
    </Tabs>
  );
};

export default ArrowTabs;
