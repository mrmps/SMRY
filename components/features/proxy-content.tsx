"use client";

import React from "react";
import ArrowTabs from "@/components/article/tabs";
import { ResponsiveDrawer } from "@/components/features/responsive-drawer";
import SummaryForm from "@/components/features/summary-form";
import { useArticles } from "@/lib/hooks/use-articles";
import { DocumentTextIcon, Squares2X2Icon, CodeBracketIcon } from "@heroicons/react/24/outline";
import useLocalStorage from "@/lib/hooks/use-local-storage";
import { cn } from "@/lib/utils";

interface ProxyContentProps {
  url: string;
  ip: string;
}

export function ProxyContent({ url, ip }: ProxyContentProps) {
  // Fetch all three sources in parallel at this level
  const { results } = useArticles(url);
  const [viewMode, setViewMode] = useLocalStorage<"markdown" | "html" | "iframe">("article-view-mode", "markdown");

  const controls = (
    <div className="flex items-center justify-between gap-2">
      {/* AI Summary */}
      <ResponsiveDrawer>
        <div className="remove-all h-full">
          <SummaryForm 
            urlProp={url} 
            ipProp={ip}
            articleResults={results}
          />
        </div>
      </ResponsiveDrawer>

      {/* View Mode Toggle - IOS Segmented Control Style */}
      <div className="inline-flex h-8 items-center rounded-lg bg-zinc-100 p-0.5 dark:bg-zinc-800">
        <button
          onClick={() => setViewMode("markdown")}
          className={cn(
            "flex h-full items-center justify-center rounded-md px-2.5 text-xs font-medium transition-all",
            viewMode === "markdown" 
              ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-50" 
              : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
          )}
          title="Markdown"
        >
          <DocumentTextIcon className="size-4" />
        </button>
        <button
          onClick={() => setViewMode("html")}
          className={cn(
            "flex h-full items-center justify-center rounded-md px-2.5 text-xs font-medium transition-all",
            viewMode === "html" 
              ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-50" 
              : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
          )}
          title="HTML"
        >
          <CodeBracketIcon className="size-4" />
        </button>
        <button
          onClick={() => setViewMode("iframe")}
          className={cn(
            "flex h-full items-center justify-center rounded-md px-2.5 text-xs font-medium transition-all",
            viewMode === "iframe" 
              ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-50" 
              : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
          )}
          title="Iframe"
        >
          <Squares2X2Icon className="size-4" />
        </button>
      </div>
    </div>
  );

  return (
    <ArrowTabs 
      url={url} 
      articleResults={results} 
      viewMode={viewMode} 
      controls={controls}
    />
  );
}
