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
      <div className="flex items-center justify-between bg-[#FBF8FB] p-2 rounded-lg shadow-sm mb-4 border-zinc-100 border">
        <h2 className="ml-4 mt-0 mb-0 text-sm font-semibold text-gray-600">
          Get AI-powered key points
        </h2>
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

