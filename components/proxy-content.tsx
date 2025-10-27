"use client";

import React from "react";
import ArrowTabs from "@/components/arrow-tabs";
import { ResponsiveDrawer } from "@/components/responsiveDrawer";
import SummaryForm from "@/components/summary-form";
import { useArticles } from "@/lib/hooks/use-articles";

interface ProxyContentProps {
  url: string;
  ip: string;
}

export function ProxyContent({ url, ip }: ProxyContentProps) {
  // Fetch all three sources in parallel at this level
  const { results } = useArticles(url);

  return (
    <>
      <div className="flex items-center justify-between bg-white px-3 py-2.5 rounded-lg border border-zinc-200 mb-4 hover:border-zinc-300 transition-colors">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-600">AI Summary</span>
          <span className="text-xs text-gray-400">•</span>
          <span className="text-xs text-gray-500">Generate key points</span>
        </div>
        <ResponsiveDrawer>
          <div className="remove-all">
            <SummaryForm 
              urlProp={url} 
              ipProp={ip}
              articleResults={results}
            />
          </div>
        </ResponsiveDrawer>
      </div>
      <ArrowTabs url={url} articleResults={results} />
    </>
  );
}

