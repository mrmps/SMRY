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
    <div className="mt-2">
      <form onSubmit={handleSubmit}>
        <div className="flex flex-col space-y-4">
          <div>
            <label htmlFor="source" className="block text-sm font-semibold text-gray-600 mb-2">
              Choose Source:
            </label>
            <select
              id="source"
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value as Source)}
              disabled={anyLoading}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value="direct">
                Direct {contentLengths.direct > 0 && `(${contentLengths.direct.toLocaleString()} chars)`}
                {longestSource === "direct" && " ⭐"}
              </option>
              <option value="wayback">
                Wayback {contentLengths.wayback > 0 && `(${contentLengths.wayback.toLocaleString()} chars)`}
                {longestSource === "wayback" && " ⭐"}
              </option>
              <option value="jina.ai">
                Jina.ai {contentLengths["jina.ai"] > 0 && `(${contentLengths["jina.ai"].toLocaleString()} chars)`}
                {longestSource === "jina.ai" && " ⭐"}
              </option>
            </select>
            {anyLoading && (
              <p className="mt-1 text-xs text-gray-500">Loading article content...</p>
            )}
          </div>

          <div>
            <label htmlFor="language" className="block text-sm font-semibold text-gray-600 mb-2">
              Summary Language:
            </label>
            <select
              id="language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
          >
            {isLoading ? "Generating Summary..." : "Generate Summary"}
          </Button>
        </div>
      </form>

      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <h3 className="text-sm font-semibold text-red-800">Error</h3>
          <p className="mt-1 text-sm text-red-700">{error}</p>
        </div>
      )}

      {summary && (
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="text-sm font-semibold text-blue-800 mb-2">Summary</h3>
          <p className="text-sm text-gray-700 leading-relaxed">{summary}</p>
        </div>
      )}
    </div>
  );
}
