"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import React from "react";
import { ArticleContent } from "./article-content";
import { ArticleLength } from "./article-length";
import { Source, ArticleResponse } from "@/types/api";
import Loading from "@/app/proxy/loading";
import { UseQueryResult } from "@tanstack/react-query";

const EnhancedTabsList: React.FC<{
  sources: string[];
  activeTabIndex: number;
  setActiveTabIndex: (tabIndex: number) => void;
  lengthJina: React.ReactNode;
  lengthWayback: React.ReactNode;
  lengthDirect: React.ReactNode;
}> = ({ sources, activeTabIndex, setActiveTabIndex, lengthDirect, lengthJina, lengthWayback }) => {
  const tabsContainerRef = useRef<HTMLDivElement | null>(null);

  const scrollToActiveTab = useCallback(() => {
    if (tabsContainerRef.current) {
      const allTabs: NodeListOf<HTMLElement> =
        tabsContainerRef.current.querySelectorAll('[role="tab"]');
      const activeTab = allTabs[activeTabIndex];

      if (activeTab) {
        let cumulativeWidth = 0;

        // Calculate the cumulative width of all tabs before the active tab
        for (let i = 0; i < activeTabIndex; i++) {
          cumulativeWidth += allTabs[i].offsetWidth;
        }

        // Adjust by the desired offset (40 in this case) if it's not the first tab
        const desiredScrollPosition =
          cumulativeWidth - (activeTabIndex > 0 ? 40 : 0);

        // Set the scroll position
        tabsContainerRef.current.scrollTo({
          left: desiredScrollPosition,
          behavior: "smooth",
        });
      }
    }
  }, [activeTabIndex, tabsContainerRef]);

  useEffect(() => {
    scrollToActiveTab();
  }, [activeTabIndex, scrollToActiveTab]);

  const handleScrollAndSwitch = (direction: "left" | "right") => {
    if (tabsContainerRef.current) {
      const newIndex =
        direction === "right" ? activeTabIndex + 1 : activeTabIndex - 1;

      if (newIndex >= 0 && newIndex < sources.length) {
        setActiveTabIndex(newIndex);
        scrollToActiveTab();
        console.log("Switched to tab with index:", newIndex);
      } else {
        console.log("New index out of bounds:", newIndex);
      }
    }
  };

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
    <div className="relative border border-zinc-200 rounded-md shadow-sm p-1">
      {activeTabIndex > 0 && ( // Only display the left button if it's not the first tab
        <button
          onClick={() => handleScrollAndSwitch("left")}
          style={{
            appearance: "auto",
            backgroundAttachment: "scroll",
            backgroundClip: "border-box",
            backgroundColor: "rgba(0, 0, 0, 0)",
            backgroundImage:
              "linear-gradient(to right, rgb(245, 244, 244) 0%, rgba(245, 244, 244, 0) 100%)",
            backgroundOrigin: "padding-box",
            backgroundPosition: "0% 0%",
            backgroundRepeat: "repeat",
            backgroundSize: "auto",
            border: "none",
            boxSizing: "border-box",
            color: "#000",
            cursor: "pointer",
            fontSize: "18px",
            height: "30px",
            left: "4px",
            lineHeight: "normal",
            padding: "0",
            position: "absolute",
            top: "8px",
            width: "65px",
            zIndex: 10,
          }}
          aria-label="Scroll left"
        >
          <ChevronLeft size={24} />
        </button>
      )}

      <div
        ref={tabsContainerRef}
        className="overflow-x-auto whitespace-nowrap scrollbar-hide"
      >
        <TabsList>
          {sources.map((source, index) => (
            <TabsTrigger key={index} value={source}>
              <span>
            {source}
              {getSourceLength(source)}
          </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      {activeTabIndex < sources.length - 1 && ( // Only display the right button if it's not the last tab
        <button
          onClick={() => handleScrollAndSwitch("right")}
          className="absolute right-1"
          style={{
            appearance: "auto",
            backgroundAttachment: "scroll",
            backgroundClip: "border-box",
            backgroundColor: "rgba(0, 0, 0, 0)",
            backgroundImage:
              "linear-gradient(to left, rgb(245, 244, 244) 0%, rgba(245, 244, 244, 0) 100%)",
            backgroundOrigin: "padding-box",
            backgroundPosition: "0% 0%",
            backgroundRepeat: "repeat",
            backgroundSize: "auto",
            border: "none",
            boxSizing: "border-box",
            color: "#000",
            cursor: "pointer",
            fontSize: "18px",
            height: "30px",
            lineHeight: "normal",
            padding: "0",
            position: "absolute",
            top: "8px",
            width: "65px",
            zIndex: 10,
          }}
          aria-label="Scroll right"
        >
          <ChevronRight size={24} className="float-right" />
        </button>
      )}
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
  const initialTabIndex = 0;
  const [activeTabIndex, setActiveTabIndex] = useState(initialTabIndex);
  const sources = ["smry", "wayback", "jina.ai"];
  
  // Use the passed-in results
  const results = articleResults;

  return (
    <Tabs defaultValue={"smry"}>
      <EnhancedTabsList
        sources={sources}
        activeTabIndex={activeTabIndex}
        setActiveTabIndex={setActiveTabIndex}
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
