"use client";

import React from "react";
import ArrowTabs from "@/components/article/tabs";
import { ResponsiveDrawer } from "@/components/features/responsive-drawer";
import SummaryForm from "@/components/features/summary-form";
import { useArticles } from "@/lib/hooks/use-articles";
import { Button } from "@/components/ui/button";
import { DocumentTextIcon, Squares2X2Icon, CodeBracketIcon } from "@heroicons/react/24/outline";
import useLocalStorage from "@/lib/hooks/use-local-storage";

interface ProxyContentProps {
  url: string;
  ip: string;
}

export function ProxyContent({ url, ip }: ProxyContentProps) {
  // Fetch all three sources in parallel at this level
  const { results } = useArticles(url);
  const [viewMode, setViewMode] = useLocalStorage<"markdown" | "html" | "iframe">("article-view-mode", "markdown");

  return (
    <>
      {/* Compact Control Bar */}
      <div className="mb-4 flex items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 transition-colors">
        {/* AI Summary */}
        <ResponsiveDrawer>
          <div className="remove-all">
            <SummaryForm 
              urlProp={url} 
              ipProp={ip}
              articleResults={results}
            />
          </div>
        </ResponsiveDrawer>

        {/* View Mode Toggle */}
        <div className="inline-flex rounded-md border border-zinc-200 bg-white">
          <Button
            variant={viewMode === "markdown" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("markdown")}
            className="h-8 rounded-none rounded-l-md px-2 text-xs sm:px-3"
            title="Markdown"
          >
            <DocumentTextIcon className="size-3.5 sm:mr-1.5" />
            <span className="hidden sm:inline">Markdown</span>
          </Button>
          <Button
            variant={viewMode === "html" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("html")}
            className="h-8 rounded-none border-l px-2 text-xs sm:px-3"
            title="HTML"
          >
            <CodeBracketIcon className="size-3.5 sm:mr-1.5" />
            <span className="hidden sm:inline">HTML</span>
          </Button>
          <Button
            variant={viewMode === "iframe" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("iframe")}
            className="h-8 rounded-none rounded-r-md border-l px-2 text-xs sm:px-3"
            title="Iframe"
          >
            <Squares2X2Icon className="size-3.5 sm:mr-1.5" />
            <span className="hidden sm:inline">Iframe</span>
          </Button>
        </div>
      </div>

      <ArrowTabs url={url} articleResults={results} viewMode={viewMode} />
    </>
  );
}

