"use client";

import React, { useState, useMemo } from "react";
import { LANGUAGES, Source, ArticleResponse } from "@/types/api";
import { Button } from "../ui/button";
import { UseQueryResult } from "@tanstack/react-query";
import { useAutoSummary, useRegenerateSummary } from "@/lib/hooks/use-summary";

type ArticleResults = Record<Source, UseQueryResult<ArticleResponse, Error>>;

const SOURCE_LABELS: Record<Source, string> = {
  "smry-fast": "smry (fast)",
  "smry-slow": "smry (slow)",
  wayback: "Wayback",
  "jina.ai": "Jina.ai",
};

const SUMMARY_SOURCES: Source[] = ["smry-fast", "smry-slow", "wayback", "jina.ai"];

interface SummaryFormProps {
  urlProp: string;
  ipProp: string;
  articleResults: ArticleResults;
}

export default function SummaryForm({ urlProp, ipProp, articleResults }: SummaryFormProps) {
  const { preferredLanguage, setPreferredLanguage, regenerate, isRegenerating, error: regenerateError } = useRegenerateSummary();

  // Minimum character threshold for summary eligibility
  const MIN_CHARS_FOR_SUMMARY = 400;

  // Find the source with the longest content from already-loaded articles
  // Only consider sources with at least MIN_CHARS_FOR_SUMMARY characters
  const longestAvailableSource = useMemo(() => {
    const sources: { source: Source; length: number }[] = SUMMARY_SOURCES.map((source) => ({
      source,
      length: articleResults[source]?.data?.article?.textContent?.length || 0,
    })).filter((s) => s.length >= MIN_CHARS_FOR_SUMMARY);

    // Sort by length and return the longest
    sources.sort((a, b) => b.length - a.length);
    return sources[0]?.source || SUMMARY_SOURCES[0]; // Fallback to first source if none meet threshold
  }, [articleResults]);

  // Allow manual source selection, but default to longest available
  const [manualSource, setManualSource] = useState<Source | null>(null);
  const selectedSource = manualSource || longestAvailableSource;

  // Get the currently selected article data
  const selectedArticle = articleResults[selectedSource]?.data;

  // Build params for summary generation
  const summaryParams = useMemo(() => {
    if (!selectedArticle?.article?.textContent) return null;
    
    return {
      content: selectedArticle.article.textContent,
      title: selectedArticle.article.title,
      url: urlProp,
      ip: ipProp,
      language: preferredLanguage,
      source: selectedSource,
    };
  }, [selectedArticle, urlProp, ipProp, preferredLanguage, selectedSource]);

  // Auto-generate summary using useQuery - runs automatically when enabled
  // No useEffect needed! This is the pure TanStack Query pattern
  const autoSummary = useAutoSummary(summaryParams, true);

  // Determine which state to show (auto-generated or manually regenerated)
  const summary = autoSummary.data?.summary;
  const isLoading = autoSummary.isLoading || isRegenerating;
  const error = autoSummary.error || regenerateError;
  const isSuccess = autoSummary.isSuccess;

  const handleRegenerate = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (summaryParams) {
      regenerate(summaryParams);
    }
  };

  // Check if ANY article has loaded (not just if they're currently loading)
  const hasArticleData = Object.values(articleResults).some((result) => result.data?.article?.textContent);
  const allArticlesLoading = Object.values(articleResults).every((result) => result.isLoading);
  const shouldDisableSource = allArticlesLoading || !hasArticleData;

  // Get content lengths for display
  const contentLengths = SUMMARY_SOURCES.reduce<Record<Source, number>>((acc, source) => {
    acc[source] = articleResults[source].data?.article?.textContent?.length || 0;
    return acc;
  }, {
    "smry-fast": 0,
    "smry-slow": 0,
    wayback: 0,
    "jina.ai": 0,
  });

  // Helper to determine if a source should be disabled and why
  const getSourceStatus = (source: Source) => {
    const result = articleResults[source];
    const length = contentLengths[source];

    if (result.isLoading) {
      return { disabled: true, label: "Loading..." };
    }
    if (result.isError) {
      return { disabled: true, label: "Failed" };
    }
    if (length > 0 && length < MIN_CHARS_FOR_SUMMARY) {
      return { disabled: true, label: "Too short" };
    }
    if (length === 0 && !result.isLoading) {
      return { disabled: true, label: "No content" };
    }
    return { disabled: false, label: null };
  };

  return (
    <div className="space-y-5">
      <form onSubmit={handleRegenerate} className="space-y-5">
        <div className="space-y-5">
          <div>
            <label htmlFor="source" className="block text-xs font-medium text-gray-500 mb-1.5">
              Source
            </label>
            <select
              id="source"
              value={selectedSource}
              onChange={(e) => setManualSource(e.target.value as Source)}
              disabled={shouldDisableSource}
              className="w-full px-3 py-2.5 text-sm border border-zinc-200 rounded-lg bg-white hover:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-purple-100 focus:border-purple-400 disabled:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-500 transition-colors"
            >
              {SUMMARY_SOURCES.map((source) => {
                const status = getSourceStatus(source);
                const length = contentLengths[source];
                return (
                  <option key={source} value={source} disabled={status.disabled}>
                    {SOURCE_LABELS[source]}
                    {length > 0 && ` • ${length.toLocaleString()} chars`}
                    {status.label && ` • ${status.label}`}
                    {longestAvailableSource === source && !status.disabled && " • Longest"}
                  </option>
                );
              })}
            </select>
            {allArticlesLoading && (
              <p className="mt-1.5 text-xs text-gray-400">Loading article content...</p>
            )}
            {!manualSource && hasArticleData && (
              <p className="mt-1.5 text-xs text-gray-500">
                Auto-selected longest available article ({contentLengths[selectedSource].toLocaleString()} chars)
              </p>
            )}
            {!allArticlesLoading && SUMMARY_SOURCES.some((source) => getSourceStatus(source).disabled) && (
              <p className="mt-1.5 text-xs text-amber-600">
                Some sources are unavailable (failed, loading, or insufficient content - min {MIN_CHARS_FOR_SUMMARY} chars required)
              </p>
            )}
          </div>

          <div>
            <label htmlFor="language" className="block text-xs font-medium text-gray-500 mb-1.5">
              Language
            </label>
            <select
              id="language"
              value={preferredLanguage}
              onChange={(e) => setPreferredLanguage(e.target.value)}
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
            disabled={isLoading || shouldDisableSource || !selectedArticle?.article?.textContent}
            className="w-full h-10 text-sm font-medium"
          >
            {isLoading ? "Generating..." : isSuccess ? "Regenerate" : "Generate Summary"}
          </Button>
        </div>
      </form>

      {error && (
        <div className="mt-5 p-4 bg-red-50 border border-red-100 rounded-lg">
          <h3 className="text-xs font-medium text-red-900 mb-1">Error</h3>
          <p className="text-sm text-red-700 leading-relaxed">
            {error instanceof Error ? error.message : "An unexpected error occurred"}
          </p>
        </div>
      )}

      {summary && (
        <div className="mt-6 bg-gray-50 rounded-lg p-5">
          <div className="flex items-center gap-2 mb-4">
            <svg className="w-5 h-5 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
              <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
            </svg>
            <h3 className="text-sm font-semibold text-gray-900">AI Summary</h3>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{summary}</p>
        </div>
      )}
    </div>
  );
}
