"use client";

import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useCompletion } from "@ai-sdk/react";
import Link from "next/link";
import { LANGUAGES, Source, ArticleResponse } from "@/types/api";
import { Button } from "../ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { UseQueryResult } from "@tanstack/react-query";
import useLocalStorage from "@/lib/hooks/use-local-storage";
import { Response } from "../ai/response";
import { UpgradeModal } from "./upgrade-modal";

const DAILY_LIMIT = process.env.NODE_ENV === "development" ? 100 : 20;

// RTL languages - summary direction is based on selected language, not article
const RTL_LANGUAGES = new Set(['ar', 'he', 'fa', 'ur']);

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
  isOpen?: boolean;
  usePortal?: boolean;
}

export default function SummaryForm({ urlProp, ipProp, articleResults, isOpen = true, usePortal = true }: SummaryFormProps) {
  // Minimum character threshold for summary eligibility
  const MIN_CHARS_FOR_SUMMARY = 400;

  // Usage tracking - updated from response headers
  const [usageCount, setUsageCount] = useState(0);
  const [isPremium, setIsPremium] = useState(false);
  const [hasLoadedUsage, setHasLoadedUsage] = useState(false);

  const showUsageCounter = hasLoadedUsage && !isPremium;
  const showSoftUpgrade = showUsageCounter && usageCount >= 10 && usageCount < DAILY_LIMIT;
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Update usage from response headers
  const handleResponse = useCallback((response: globalThis.Response) => {
    const usage = response.headers.get("X-Usage-Count");
    const premium = response.headers.get("X-Is-Premium");

    if (usage !== null) {
      setUsageCount(parseInt(usage, 10));
      setHasLoadedUsage(true);
    }
    if (premium !== null) {
      setIsPremium(premium === "true");
    }
  }, []);

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

  // Persist language preference
  const [preferredLanguage, setPreferredLanguage] = useLocalStorage<string>("summary-language", "en");

  // Custom fetch wrapper to extract usage headers
  const customFetch = useCallback(async (input: RequestInfo | URL, init?: RequestInit) => {
    const response = await globalThis.fetch(input, init);
    handleResponse(response);
    return response;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }, [handleResponse]) as any;

  // Use AI SDK's useCompletion hook for streaming
  const { completion, complete, isLoading, error } = useCompletion({
    api: '/api/summary',
    streamProtocol: 'text', // Use plain text streaming
    body: {
      title: selectedArticle?.article?.title,
      url: urlProp,
      ip: ipProp,
      language: preferredLanguage,
    },
    fetch: customFetch,
  });

  const handleRegenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedArticle?.article?.textContent) return;
    await complete(selectedArticle.article.textContent);
  };

  const handleLanguageChange = (newLanguage: string) => {
    setPreferredLanguage(newLanguage);
    // Don't auto-regenerate - user must click Regenerate button
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

  // Track if we've auto-generated
  const hasAutoGeneratedRef = useRef(false);

  // Auto-generate on mount when valid content is available and sidebar is open
  useEffect(() => {
    if (
      isOpen &&
      !hasAutoGeneratedRef.current &&
      !manualSource && // Only auto-generate if user hasn't manually selected a source
      !completion &&
      !isLoading &&
      selectedArticle?.article?.textContent &&
      contentLengths[selectedSource] >= MIN_CHARS_FOR_SUMMARY
    ) {
      hasAutoGeneratedRef.current = true;
      complete(selectedArticle.article.textContent);
    }
  }, [selectedArticle, completion, isLoading, complete, selectedSource, contentLengths, isOpen, manualSource]);


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

  // Check for rate limit error and show modal
  const isRateLimitError = error && error.message.toLowerCase().includes("limit") &&
    (error.message.toLowerCase().includes("summaries") || error.message.toLowerCase().includes("slow down"));

  // Show modal when rate limit hit
  useEffect(() => {
    if (isRateLimitError && !isPremium) {
      setShowUpgradeModal(true);
    }
  }, [isRateLimitError, isPremium]);

  const errorContent = useMemo(() => {
    if (!error || isRateLimitError) return null;

    const msg = error.message.toLowerCase();

    // Content too short
    if (msg.includes("content must be at least")) {
      return {
        title: "Content Too Short",
        message: "This article doesn't have enough content to summarize. Try a different source tab.",
        bgClass: "bg-amber-500/10",
        textClass: "text-amber-600 dark:text-amber-400",
        titleClass: "text-amber-700 dark:text-amber-300",
      };
    }

    // Generic error
    return {
      title: "Error",
      message: error.message,
      bgClass: "bg-red-500/10",
      textClass: "text-red-600 dark:text-red-400",
      titleClass: "text-red-700 dark:text-red-300",
    };
  }, [error, isRateLimitError]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-3 px-4 py-2">
          
        {errorContent && (
          <div className={`rounded-[14px] p-0.5 ${errorContent.bgClass}`}>
            <div className="rounded-xl bg-card p-4 dark:bg-card">
              <h3 className={`mb-1 text-xs font-medium uppercase tracking-wide ${errorContent.titleClass}`}>
                {errorContent.title}
              </h3>
              <p className={`text-sm ${errorContent.textClass}`}>
                {errorContent.message}
              </p>
            </div>
          </div>
        )}

        <UpgradeModal open={showUpgradeModal} onOpenChange={setShowUpgradeModal} />

        {(completion || isLoading) && (
          <div className="text-sm text-foreground">
            {isLoading && !completion && (
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-[95%]" />
                <Skeleton className="h-4 w-[90%]" />
              </div>
            )}
            {completion && (
              <>
                <Response
                  dir={RTL_LANGUAGES.has(preferredLanguage) ? 'rtl' : 'ltr'}
                  lang={preferredLanguage}
                >
                  {completion}
                </Response>
                {isLoading && (
                  <span className="inline-block h-4 w-0.5 animate-pulse bg-purple-500 mt-1"></span>
                )}
              </>
            )}
          </div>
        )}
      </div>
      </div>

      <div className="z-10 border-t border-border bg-card p-4 dark:border-border dark:bg-card">
        <form onSubmit={handleRegenerate} className="space-y-2">
          <div className="rounded-[14px] bg-accent p-0.5">
            <div className="flex flex-col gap-2 rounded-xl bg-card p-2 md:flex-row md:items-center">
              <div className="min-w-0 flex-1">
                <Select
                  value={selectedSource}
                  onValueChange={(value) => setManualSource(value as Source)}
                  disabled={shouldDisableSource || isLoading}
                >
                  <SelectTrigger className="h-9 w-full min-w-0 border-0 bg-transparent text-sm font-medium shadow-none focus:ring-0 focus:ring-offset-0">
                    <div className="flex w-full items-center gap-2 truncate text-left">
                      <span>{SOURCE_LABELS[selectedSource]}</span>
                      {longestAvailableSource === selectedSource && (
                        <span className="text-xs font-normal text-purple-500">Best</span>
                      )}
                    </div>
                  </SelectTrigger>
                  <SelectContent portal={usePortal}>
                    {SUMMARY_SOURCES.map((source) => {
                      const status = getSourceStatus(source);
                      const length = contentLengths[source];
                      return (
                        <SelectItem key={source} value={source} disabled={status.disabled}>
                          <span className="flex flex-wrap items-center gap-2 whitespace-normal leading-snug">
                            <span>{SOURCE_LABELS[source]}</span>
                            {length > 0 && <span className="text-muted-foreground">• {length.toLocaleString()} chars</span>}
                            {status.label && <span className="text-muted-foreground">• {status.label}</span>}
                            {longestAvailableSource === source && !status.disabled && <span className="text-purple-500">• Best</span>}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
  
              <div className="hidden h-4 w-px bg-border md:block" />
  
              <div className="w-full shrink-0 md:w-[110px]">
                <Select
                  value={preferredLanguage}
                  onValueChange={handleLanguageChange}
                  disabled={isLoading}
                >
                  <SelectTrigger className="h-9 w-full min-w-0 border-0 bg-transparent text-sm font-medium shadow-none focus:ring-0 focus:ring-offset-0">
                     <span className="truncate text-left">
                      {LANGUAGES.find(l => l.code === preferredLanguage)?.name || "Language"}
                     </span>
                  </SelectTrigger>
                  <SelectContent portal={usePortal}>
                    {LANGUAGES.map((lang) => (
                      <SelectItem key={lang.code} value={lang.code}>
                        {lang.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
  
              <Button 
                type="submit" 
                variant={completion ? "ghost" : "default"}
                size="sm"
                disabled={isLoading || shouldDisableSource || !selectedArticle?.article?.textContent}
                className="h-9 shrink-0 px-4 text-sm font-medium transition-all active:scale-95"
              >
                {isLoading ? "Generating..." : completion ? "Update" : "Generate"}
              </Button>
            </div>
          </div>
          
          <p className="truncate px-2 text-center text-[10px] text-muted-foreground/60">
            {!manualSource && hasArticleData && `${contentLengths[selectedSource].toLocaleString()} chars`}
            {!manualSource && hasArticleData && showUsageCounter && ' · '}
            {showUsageCounter && (
              <>
                {usageCount}/{DAILY_LIMIT} today
                {showSoftUpgrade && <Link href="/pricing" className="text-purple-500/60 hover:text-purple-500 ml-1">· unlimited</Link>}
              </>
            )}
          </p>
        </form>
      </div>
    </div>
  );
}
