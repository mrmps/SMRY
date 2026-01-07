"use client";

import React, { useState, useMemo, useRef, useCallback, useLayoutEffect, useEffect } from "react";
import { useCompletion } from "@ai-sdk/react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { LANGUAGES, Source, ArticleResponse } from "@/types/api";
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
import { ChevronDown, ChevronUp, Globe, Database, AlertCircle, Zap, Infinity } from "lucide-react";
import { cn } from "@/lib/utils";
import { getApiUrl } from "@/lib/api/config";
import { parseSummaryError, SummaryError } from "@/lib/errors/summary";

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

/**
 * STATE MACHINE FOR SUMMARY ERRORS
 *
 * User Types:
 *   - Anonymous: Not signed in
 *   - Free: Signed in, no premium
 *   - Premium: Signed in with active subscription
 *
 * Error States:
 *   - DAILY_LIMIT_REACHED: Out of daily quota
 *   - RATE_LIMITED: Too many requests per minute (with countdown)
 *   - CONTENT_TOO_SHORT: Article too short to summarize
 *   - GENERATION_FAILED: AI error, can retry
 *   - INVALID_CONTENT: Bad content, no retry
 *
 * What to show:
 *   | Error              | Anonymous           | Free                | Premium             |
 *   |--------------------|---------------------|---------------------|---------------------|
 *   | DAILY_LIMIT        | "Sign in for more"  | "Upgrade to Pro"    | "Contact support"   |
 *   | RATE_LIMITED       | Countdown + retry   | Countdown + retry   | Countdown + retry   |
 *   | CONTENT_TOO_SHORT  | Generic message     | Generic message     | Generic message     |
 *   | GENERATION_FAILED  | Retry button        | Retry button        | Retry button        |
 *   | INVALID_CONTENT    | Generic message     | Generic message     | Generic message     |
 */

// Error display component with proper state handling
function SummaryErrorDisplay({
  error,
  onRetry,
  isSignedIn,
  isPremium,
}: {
  error: SummaryError;
  onRetry: () => void;
  isSignedIn: boolean;
  isPremium: boolean;
}) {
  const [secondsLeft, setSecondsLeft] = useState(error.retryAfter || 0);
  const [isRetrying, setIsRetrying] = useState(false);
  const initialSeconds = error.retryAfter || 0;

  // Auto-retry countdown for rate limit errors
  useEffect(() => {
    if (error.code !== "RATE_LIMITED" || !error.retryAfter) return;

    if (secondsLeft <= 0) {
      const retryTimer = setTimeout(() => {
        setIsRetrying(true);
        onRetry();
      }, 0);
      return () => clearTimeout(retryTimer);
    }

    const timer = setTimeout(() => {
      setSecondsLeft((s) => s - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [secondsLeft, onRetry, error.code, error.retryAfter]);

  const progress = initialSeconds > 0 ? ((initialSeconds - secondsLeft) / initialSeconds) * 100 : 0;

  // Daily limit reached - different CTAs based on user state
  if (error.code === "DAILY_LIMIT_REACHED") {
    // Premium users should never see this, but handle gracefully
    if (isPremium) {
      return (
        <div className="rounded-lg bg-muted/50 border border-border p-3 mb-3">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="size-4 text-muted-foreground shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground">
                Something went wrong. Please try again.
              </p>
              <button
                onClick={onRetry}
                className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 mt-1.5"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Anonymous users - prompt to sign in
    if (!isSignedIn) {
      return (
        <div className="rounded-xl bg-card border border-border p-4 mb-3 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="shrink-0 p-2 rounded-full bg-muted">
              <Zap className="size-4 text-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">
                Daily limit reached
                {error.usage != null && error.limit != null && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    ({error.usage} / {error.limit} used)
                  </span>
                )}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Sign in for more free summaries, or go unlimited with Premium.
              </p>
              <div className="flex items-center gap-2 mt-3">
                <Link
                  href="/sign-in"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Sign in
                </Link>
                <Link
                  href="/pricing"
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  or go Premium
                </Link>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Free users - prompt to upgrade
    return (
      <div className="rounded-xl bg-card border border-border p-4 mb-3 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="shrink-0 p-2 rounded-full bg-muted">
            <Zap className="size-4 text-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">
              Daily limit reached
              {error.usage != null && error.limit != null && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  ({error.usage} / {error.limit} used)
                </span>
              )}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {error.userMessage}
            </p>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-1.5 mt-3 px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Upgrade to Premium
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Rate limited - countdown with auto-retry
  if (error.code === "RATE_LIMITED") {
    return (
      <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 mb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
              {isRetrying ? "Retrying..." : "Slow down"}
            </p>
            <p className="text-xs text-amber-600/80 dark:text-amber-400/80 mt-0.5">
              {error.userMessage}
            </p>
            {!isRetrying && secondsLeft > 0 && (
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
        </div>
      </div>
    );
  }

  // Generic errors (content too short, generation failed, etc.)
  return (
    <div className="rounded-lg bg-muted/50 border border-border p-3 mb-3">
      <div className="flex items-start gap-2.5">
        <AlertCircle className="size-4 text-muted-foreground shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-foreground">
            {error.userMessage}
          </p>
          {error.code === "GENERATION_FAILED" && (
            <button
              onClick={onRetry}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 mt-1.5"
            >
              Try again
            </button>
          )}
        </div>
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
  const { isSignedIn } = useAuth();

  // Usage state - updated from response headers after each request
  const [usageData, setUsageData] = useState<{ remaining: number; limit: number; isPremium: boolean } | null>(null);

  // Use API's isPremium as source of truth (from backend Clerk billing check)
  const isPremium = usageData?.isPremium ?? false;

  // Show usage counter for free users (limit > 0), hide for premium (limit = -1)
  const showUsageCounter = usageData?.limit != null && usageData.limit > 0;

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

  const apiUrl = getApiUrl("/api/summary");

  // Custom fetch that captures usage headers
  const customFetch = useCallback(async (input: RequestInfo | URL, init?: RequestInit) => {
    const response = await fetch(input, init);

    // Read headers to update usage state
    const remaining = response.headers.get("X-Usage-Remaining");
    const limit = response.headers.get("X-Usage-Limit");
    const premium = response.headers.get("X-Is-Premium");

    if (remaining !== null && limit !== null) {
      setUsageData({
        remaining: parseInt(remaining, 10),
        limit: parseInt(limit, 10),
        isPremium: premium === "true",
      });
    }

    return response;
  }, []) as typeof fetch;

  const { completion, complete, isLoading, error } = useCompletion({
    api: apiUrl,
    streamProtocol: "text",
    credentials: "include",
    fetch: customFetch,
    body: {
      title: selectedArticle?.article?.title,
      url: urlProp,
      ip: ipProp,
      language: preferredLanguage,
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
  // Must pass language in body override since state update is async
  const handleLanguageChange = useCallback((newLang: string) => {
    setPreferredLanguage(newLang);
    if (selectedArticle?.article?.textContent) {
      complete(selectedArticle.article.textContent, {
        body: { language: newLang },
      });
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

  // Parse error into typed SummaryError
  const parsedError = useMemo(() => {
    if (!error) return null;
    return parseSummaryError(error);
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
        <div className="flex items-center gap-2">
          <button
            onClick={onCollapse}
            className="flex items-center gap-1.5 text-sm font-semibold text-foreground hover:text-muted-foreground transition-colors"
          >
            <span>TL;DR</span>
            <ChevronUp className="size-4" />
          </button>
          {isPremium && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground bg-muted rounded-full">
              <Infinity className="size-2.5" />
              Unlimited
            </span>
          )}
        </div>

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
        {parsedError && (
          <SummaryErrorDisplay
            error={parsedError}
            onRetry={handleRetry}
            isSignedIn={isSignedIn ?? false}
            isPremium={isPremium}
          />
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
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-border text-center">
        {/* Usage info for free users - only show after first request */}
        {!isPremium && showUsageCounter && usageData && (
          <div className={cn(
            "text-[10px] transition-colors",
            isLoading ? "text-muted-foreground" : "text-muted-foreground/60"
          )}>
            {isLoading && <span className="inline-block size-1.5 rounded-full bg-amber-500 animate-pulse mr-1.5" />}
            {usageData.remaining > 0 ? (
              <>{usageData.remaining} left today</>
            ) : (
              <>{usageData.limit - usageData.remaining} / {usageData.limit} used</>
            )}
            {isSignedIn ? (
              <Link href="/pricing" className="text-muted-foreground hover:text-foreground ml-1">· go unlimited</Link>
            ) : (
              <Link href="/sign-in" className="text-muted-foreground hover:text-foreground ml-1">· sign in for more</Link>
            )}
          </div>
        )}

        {/* Collapse button - show when summary is done */}
        {completion && !isLoading && (
          <button
            onClick={onCollapse}
            className={cn(
              "w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground",
              !isPremium && showUsageCounter && "mt-1"
            )}
          >
            <ChevronUp className="size-3.5" />
            <span>Collapse</span>
          </button>
        )}
      </div>
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
