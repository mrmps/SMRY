"use client";

import React, { useState, useMemo, useRef, useCallback, useLayoutEffect, useEffect } from "react";
import { useCompletion } from "@ai-sdk/react";
import Link from "next/link";
import { LANGUAGES, Source, ArticleResponse } from "@/types/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { UseQueryResult, useQuery } from "@tanstack/react-query";
import useLocalStorage from "@/lib/hooks/use-local-storage";
import { Response } from "../ai/response";
import { useIsPremium } from "@/lib/hooks/use-is-premium";
import { ChevronDown, ChevronUp, Globe, Database } from "lucide-react";
import { cn } from "@/lib/utils";

type ArticleResults = Record<Source, UseQueryResult<ArticleResponse, Error>>;

const SUMMARY_SOURCES: Source[] = ["smry-fast", "smry-slow", "wayback", "jina.ai"];
const SOURCE_LABELS: Record<Source, string> = {
  "smry-fast": "Fast",
  "smry-slow": "Slow",
  wayback: "Wayback",
  "jina.ai": "Jina",
};
const MIN_CHARS = 400;
const RTL_LANGUAGES = ["ar", "he", "fa", "ur"];

// Rate limit error display with countdown and auto-retry
function RateLimitError({
  error,
  onRetry
}: {
  error: Error;
  onRetry: () => void;
}) {
  // Parse seconds from error message like "Wait 45s"
  const initialSeconds = useMemo(() => {
    const match = error.message.match(/wait\s+(\d+)s/i);
    return match ? parseInt(match[1], 10) : 5;
  }, [error.message]);

  const [secondsLeft, setSecondsLeft] = useState(initialSeconds);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    if (secondsLeft <= 0) {
      setIsRetrying(true);
      onRetry();
      return;
    }

    const timer = setTimeout(() => {
      setSecondsLeft((s) => s - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [secondsLeft, onRetry]);

  const progress = ((initialSeconds - secondsLeft) / initialSeconds) * 100;

  return (
    <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 mb-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
            {isRetrying ? "Retrying..." : "Rate limited"}
          </p>
          {!isRetrying && (
            <div className="mt-2">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-amber-200 dark:bg-amber-900/50 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 dark:bg-amber-400 rounded-full transition-all duration-1000 ease-linear"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-xs tabular-nums font-medium text-amber-600 dark:text-amber-400 w-6">
                  {secondsLeft}s
                </span>
              </div>
            </div>
          )}
        </div>
        <Link
          href="/pricing"
          className="shrink-0 px-3 py-1.5 text-xs font-medium rounded-full bg-amber-500 text-white hover:bg-amber-600 transition-colors"
        >
          Upgrade
        </Link>
      </div>
    </div>
  );
}

interface InlineSummaryProps {
  urlProp: string;
  ipProp: string;
  articleResults: ArticleResults;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

// Collapsed state - just a button
function CollapsedSummary({
  onExpand,
  disabled
}: {
  onExpand: () => void;
  disabled: boolean;
}) {
  return (
    <div className="mb-6">
      <button
        onClick={onExpand}
        disabled={disabled}
        className={cn(
          "w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all",
          "bg-card hover:bg-muted/50",
          "border border-border shadow-sm",
          "text-sm font-medium text-foreground",
          disabled && "opacity-50 cursor-not-allowed",
        )}
      >
        <span className="flex items-center gap-2">
          <span className="font-semibold">TL;DR</span>
          <span className="text-muted-foreground text-xs">AI summary</span>
        </span>
        <ChevronDown className="size-4 text-muted-foreground" />
      </button>
    </div>
  );
}

// Expanded state - fetches and shows summary
function ExpandedSummary({
  urlProp,
  ipProp,
  articleResults,
  onCollapse,
}: {
  urlProp: string;
  ipProp: string;
  articleResults: ArticleResults;
  onCollapse: () => void;
}) {
  const { isPremium } = useIsPremium();

  // Usage query - only fetch when expanded
  const { data: usageData, refetch: refetchUsage } = useQuery({
    queryKey: ["summary-usage", ipProp],
    queryFn: async () => {
      const res = await fetch(`/api/summary/usage?ip=${encodeURIComponent(ipProp)}`);
      return res.json() as Promise<{ usage: number; limit: number; isPremium: boolean }>;
    },
    staleTime: 30000,
  });

  const showUsageCounter = !isPremium && usageData?.usage != null && usageData?.limit != null;

  // Find best source
  const longestSource = useMemo(() => {
    const sources = SUMMARY_SOURCES
      .map((s) => ({ source: s, length: articleResults[s]?.data?.article?.textContent?.length || 0 }))
      .filter((s) => s.length >= MIN_CHARS)
      .sort((a, b) => b.length - a.length);
    return sources[0]?.source || SUMMARY_SOURCES[0];
  }, [articleResults]);

  const [selectedSource, setSelectedSource] = useState<Source>(longestSource);
  const selectedArticle = articleResults[selectedSource]?.data;
  const contentLength = selectedArticle?.article?.textContent?.length || 0;

  const [preferredLanguage, setPreferredLanguage] = useLocalStorage("summary-language", "en");

  const { completion, complete, isLoading, error } = useCompletion({
    api: "/api/summary",
    streamProtocol: "text",
    body: {
      title: selectedArticle?.article?.title,
      url: urlProp,
      ip: ipProp,
      language: preferredLanguage,
    },
    onFinish: () => {
      if (!isPremium) refetchUsage();
    },
    onError: () => {
      refetchUsage();
    },
  });

  // Generate on mount (once) - useLayoutEffect to avoid render-phase side effects
  const hasTriggered = useRef(false);
  useLayoutEffect(() => {
    if (!hasTriggered.current && contentLength >= MIN_CHARS && selectedArticle?.article?.textContent) {
      hasTriggered.current = true;
      complete(selectedArticle.article.textContent);
    }
  }, [contentLength, selectedArticle?.article?.textContent, complete]);

  // Source change handler - regenerate immediately
  const handleSourceChange = useCallback((newSource: Source) => {
    setSelectedSource(newSource);
    const article = articleResults[newSource]?.data?.article;
    if (article?.textContent && article.textContent.length >= MIN_CHARS) {
      complete(article.textContent);
    }
  }, [articleResults, complete]);

  // Language change handler - regenerate immediately
  const handleLanguageChange = useCallback((newLang: string) => {
    setPreferredLanguage(newLang);
    if (selectedArticle?.article?.textContent) {
      complete(selectedArticle.article.textContent);
    }
  }, [selectedArticle, complete, setPreferredLanguage]);

  const getSourceStatus = useCallback((source: Source) => {
    const result = articleResults[source];
    const length = result?.data?.article?.textContent?.length || 0;
    if (result?.isLoading) return { disabled: true, reason: "Loading..." };
    if (result?.isError) return { disabled: true, reason: "Failed" };
    if (length > 0 && length < MIN_CHARS) return { disabled: true, reason: "Too short" };
    if (length === 0) return { disabled: true, reason: "No content" };
    return { disabled: false, reason: null };
  }, [articleResults]);

  const isRateLimitError = useMemo(() => {
    if (!error) return false;
    const msg = error.message.toLowerCase();
    return msg.includes("too many") || msg.includes("wait");
  }, [error]);

  const errorMessage = useMemo(() => {
    if (!error) return null;
    const msg = error.message.toLowerCase();
    if (msg.includes("daily limit")) return "You've hit your daily limit. Upgrade for unlimited.";
    if (msg.includes("content must be")) return "Article too short.";
    return error.message;
  }, [error]);

  const handleRetry = useCallback(() => {
    if (selectedArticle?.article?.textContent) {
      complete(selectedArticle.article.textContent);
    }
  }, [selectedArticle, complete]);

  return (
    <div className={cn("mb-6 rounded-xl overflow-hidden", "bg-card border border-border shadow-sm")}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-border bg-muted/50">
        <button
          onClick={onCollapse}
          className="flex items-center gap-1.5 text-sm font-semibold text-foreground hover:text-muted-foreground transition-colors"
        >
          <span>TL;DR</span>
          <ChevronUp className="size-4" />
        </button>

        <div className="flex items-center gap-1.5">
          <Select value={selectedSource} onValueChange={(v) => handleSourceChange(v as Source)} disabled={isLoading}>
            <SelectTrigger className="h-7 w-auto gap-1 px-2 text-xs font-medium bg-background border border-border rounded-md shadow-sm">
              <Database className="size-3" />
              <span>{SOURCE_LABELS[selectedSource]}</span>
            </SelectTrigger>
            <SelectContent>
              {SUMMARY_SOURCES.map((source) => {
                const status = getSourceStatus(source);
                return (
                  <SelectItem key={source} value={source} disabled={status.disabled}>
                    <span className="flex items-center gap-2">
                      {SOURCE_LABELS[source]}
                      {source === longestSource && !status.disabled && (
                        <span className="text-emerald-500 text-[10px]">Best</span>
                      )}
                      {status.reason && <span className="text-muted-foreground text-[10px]">{status.reason}</span>}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>

          <Select value={preferredLanguage} onValueChange={handleLanguageChange} disabled={isLoading}>
            <SelectTrigger className="h-7 w-auto gap-1 px-2 text-xs font-medium bg-background border border-border rounded-md shadow-sm">
              <Globe className="size-3" />
              <span>{LANGUAGES.find((l) => l.code === preferredLanguage)?.name || "Lang"}</span>
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((lang) => (
                <SelectItem key={lang.code} value={lang.code}>{lang.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Content */}
      <div className="px-3 py-3 sm:px-4 sm:py-4">
        {error && isRateLimitError && (
          <RateLimitError error={error} onRetry={handleRetry} />
        )}

        {error && !isRateLimitError && errorMessage && (
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 mb-3">
            <p className="text-sm text-amber-700 dark:text-amber-300">{errorMessage}</p>
            {errorMessage.toLowerCase().includes("unlimited") && (
              <div className="mt-2">
                <Link href="/pricing" className="text-xs font-medium underline underline-offset-2">
                  Upgrade to Premium
                </Link>
              </div>
            )}
          </div>
        )}

        {isLoading && !completion && (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-[95%]" />
            <Skeleton className="h-4 w-[90%]" />
          </div>
        )}

        {completion && (
          <div className="text-sm text-foreground leading-relaxed">
            <Response dir={RTL_LANGUAGES.includes(preferredLanguage) ? "rtl" : "ltr"} lang={preferredLanguage}>
              {completion}
            </Response>
            {isLoading && <span className={cn("inline-block h-4 w-0.5 animate-pulse bg-foreground", RTL_LANGUAGES.includes(preferredLanguage) ? "mr-0.5" : "ml-0.5")} />}
          </div>
        )}

        {!completion && !isLoading && !error && contentLength < MIN_CHARS && (
          <p className="text-sm text-muted-foreground">Waiting for article content...</p>
        )}

        {completion && !isLoading && (
          <button
            onClick={onCollapse}
            className="mt-4 w-full flex items-center justify-center gap-1.5 py-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <ChevronUp className="size-3.5" />
            <span>Collapse</span>
          </button>
        )}
      </div>

      {/* Footer - show during loading and after completion */}
      {showUsageCounter && !error && usageData.usage < usageData.limit && (
        <div className={cn(
          "px-3 py-2 border-t border-border text-[10px] text-center transition-colors",
          isLoading ? "text-muted-foreground" : "text-muted-foreground/60"
        )}>
          {isLoading && <span className="inline-block size-1.5 rounded-full bg-amber-500 animate-pulse mr-1.5" />}
          {usageData.usage}/{usageData.limit} today
          {usageData.usage >= 10 && (
            <Link href="/pricing" className="text-muted-foreground hover:text-foreground ml-1">· unlimited</Link>
          )}
        </div>
      )}
    </div>
  );
}

// Main component - renders collapsed or expanded
export function InlineSummary({ urlProp, ipProp, articleResults, isOpen, onOpenChange }: InlineSummaryProps) {
  const hasArticleData = Object.values(articleResults).some((r) => r.data?.article?.textContent);

  if (!isOpen) {
    return <CollapsedSummary onExpand={() => onOpenChange(true)} disabled={!hasArticleData} />;
  }

  return (
    <ExpandedSummary
      key={urlProp}
      urlProp={urlProp}
      ipProp={ipProp}
      articleResults={articleResults}
      onCollapse={() => onOpenChange(false)}
    />
  );
}
