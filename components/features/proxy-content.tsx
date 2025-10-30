"use client";

import React from "react";
import ArrowTabs from "@/components/article/tabs";
import { ResponsiveDrawer } from "@/components/features/responsive-drawer";
import SummaryForm from "@/components/features/summary-form";
import { useArticles } from "@/lib/hooks/use-articles";
import { Button } from "@/components/ui/button";
import { DocumentTextIcon, Squares2X2Icon } from "@heroicons/react/24/outline";
import useLocalStorage from "@/lib/hooks/use-local-storage";

interface ProxyContentProps {
  url: string;
  ip: string;
}

export function ProxyContent({ url, ip }: ProxyContentProps) {
  // Fetch all three sources in parallel at this level
  const { results } = useArticles(url);
  const [viewMode, setViewMode] = useLocalStorage<"markdown" | "iframe">("article-view-mode", "markdown");

  return (
    <>
      {/* Compact Control Bar */}
      <div className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-zinc-200 mb-4 transition-colors">
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
            className="h-8 px-3 text-xs rounded-r-none"
          >
            <DocumentTextIcon className="h-3.5 w-3.5 mr-1.5" />
            Markdown
          </Button>
          <Button
            variant={viewMode === "iframe" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("iframe")}
            className="h-8 px-3 text-xs rounded-l-none border-l"
          >
            <Squares2X2Icon className="h-3.5 w-3.5 mr-1.5" />
            Iframe
          </Button>
        </div>
      </div>

      <ArrowTabs url={url} articleResults={results} viewMode={viewMode} />
    </>
  );
}

