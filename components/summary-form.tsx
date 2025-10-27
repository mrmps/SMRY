"use client";

import React, { useState, useEffect, useMemo } from "react";
import { LANGUAGES, Source, ArticleResponse } from "@/types/api";
import { Button } from "./ui/button";
import { UseQueryResult } from "@tanstack/react-query";

interface SummaryFormProps {
  urlProp: string;
  ipProp: string;
  articleResults: {
    direct: UseQueryResult<ArticleResponse, Error>;
    wayback: UseQueryResult<ArticleResponse, Error>;
    "jina.ai": UseQueryResult<ArticleResponse, Error>;
  };
}

export default function SummaryForm({ urlProp, ipProp, articleResults }: SummaryFormProps) {
  const [language, setLanguage] = useState("en");
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Find the source with the longest content
  const longestSource = useMemo(() => {
    const sources: { source: Source; length: number }[] = [
      {
        source: "direct",
        length: articleResults.direct.data?.article?.textContent?.length || 0,
      },
      {
        source: "wayback",
        length: articleResults.wayback.data?.article?.textContent?.length || 0,
      },
      {
        source: "jina.ai",
        length: articleResults["jina.ai"].data?.article?.textContent?.length || 0,
      },
    ];

    // Sort by length and return the longest
    sources.sort((a, b) => b.length - a.length);
    return sources[0].source;
  }, [articleResults]);

  const [selectedSource, setSelectedSource] = useState<Source>(longestSource);

  // Update selected source when longest source changes
  useEffect(() => {
    setSelectedSource(longestSource);
  }, [longestSource]);

  // Get the currently selected article data
  const selectedArticle = articleResults[selectedSource]?.data;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSummary(null);

    try {
      if (!selectedArticle?.article?.textContent) {
        throw new Error("No content available from the selected source");
      }

      const response = await fetch("/api/summary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: selectedArticle.article.textContent,
          title: selectedArticle.article.title,
          url: urlProp,
          ip: ipProp,
          language,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate summary");
      }

      setSummary(data.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  // Check if any article is loading
  const anyLoading = Object.values(articleResults).some((result) => result.isLoading);

  // Get content lengths for display
  const contentLengths = {
    direct: articleResults.direct.data?.article?.textContent?.length || 0,
    wayback: articleResults.wayback.data?.article?.textContent?.length || 0,
    "jina.ai": articleResults["jina.ai"].data?.article?.textContent?.length || 0,
  };

  return (
    <div className="mt-6">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-5">
          <div>
            <label htmlFor="source" className="block text-xs font-medium text-gray-500 mb-1.5">
              Source
            </label>
            <select
              id="source"
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value as Source)}
              disabled={anyLoading}
              className="w-full px-3 py-2.5 text-sm border border-zinc-200 rounded-lg bg-white hover:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-purple-100 focus:border-purple-400 disabled:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-500 transition-colors"
            >
              <option value="direct">
                Direct {contentLengths.direct > 0 && `• ${contentLengths.direct.toLocaleString()} chars`}
                {longestSource === "direct" && " • Recommended"}
              </option>
              <option value="wayback">
                Wayback {contentLengths.wayback > 0 && `• ${contentLengths.wayback.toLocaleString()} chars`}
                {longestSource === "wayback" && " • Recommended"}
              </option>
              <option value="jina.ai">
                Jina.ai {contentLengths["jina.ai"] > 0 && `• ${contentLengths["jina.ai"].toLocaleString()} chars`}
                {longestSource === "jina.ai" && " • Recommended"}
              </option>
            </select>
            {anyLoading && (
              <p className="mt-1.5 text-xs text-gray-400">Loading article content...</p>
            )}
          </div>

          <div>
            <label htmlFor="language" className="block text-xs font-medium text-gray-500 mb-1.5">
              Language
            </label>
            <select
              id="language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-zinc-200 rounded-lg bg-white hover:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-purple-100 focus:border-purple-400 transition-colors"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name}
                </option>
              ))}
            </select>
          </div>

          <Button 
            type="submit" 
            disabled={isLoading || anyLoading || !selectedArticle?.article?.textContent}
            className="w-full h-10 text-sm font-medium"
          >
            {isLoading ? "Generating..." : "Generate Summary"}
          </Button>
        </div>
      </form>

      {error && (
        <div className="mt-5 p-4 bg-red-50 border border-red-100 rounded-lg">
          <h3 className="text-xs font-medium text-red-900 mb-1">Error</h3>
          <p className="text-sm text-red-700 leading-relaxed">{error}</p>
        </div>
      )}

      {summary && (
        <div className="mt-5 p-5 bg-white border border-zinc-200 rounded-lg shadow-sm">
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Summary</h3>
          <p className="text-sm text-gray-800 leading-relaxed">{summary}</p>
        </div>
      )}
    </div>
  );
}
