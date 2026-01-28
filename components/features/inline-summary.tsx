"use client";

import React, {
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef,
  memo,
} from "react";
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
import { useSummary, UsageData } from "@/lib/hooks/use-summary";
import { Response } from "../ai/response";
import {
  ChevronDown,
  ChevronUp,
  Database,
  AlertCircle,
  Zap,
  Infinity,
  PanelRightClose,
} from "lucide-react";
import { LanguageIcon } from "@/components/ui/custom-icons";
import { cn } from "@/lib/utils";
import { SummaryError } from "@/lib/errors/summary";
import { GravityAd } from "@/components/ads/gravity-ad";
import type { GravityAd as GravityAdType } from "@/lib/hooks/use-gravity-ad";

type ArticleResults = Record<Source, UseQueryResult<ArticleResponse, Error>>;

const SUMMARY_SOURCES: Source[] = [
  "smry-fast",
  "smry-slow",
  "wayback",
  "jina.ai",
];
const SOURCE_LABELS: Record<Source, string> = {
  "smry-fast": "Fast",
  "smry-slow": "Slow",
  wayback: "Wayback",
  "jina.ai": "Jina",
};
const MIN_CHARS = 400;
const RTL_LANGUAGES = new Set(["ar", "he", "fa", "ur"]);

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

  const progress =
    initialSeconds > 0
      ? ((initialSeconds - secondsLeft) / initialSeconds) * 100
      : 0;

  if (error.code === "DAILY_LIMIT_REACHED") {
    if (isPremium) {
      return (
        <div className="mb-3 rounded-lg border border-border bg-muted/50 p-3">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-foreground">
                Something went wrong. Please try again.
              </p>
              <button
                onClick={onRetry}
                className="mt-1.5 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (!isSignedIn) {
      return (
        <div className="mb-3 rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="shrink-0 rounded-full bg-muted p-2">
              <Zap className="size-4 text-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">
                Daily limit reached
                {error.usage != null && error.limit != null && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    ({error.usage} / {error.limit} used)
                  </span>
                )}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Sign in for more free summaries, or go unlimited with Premium.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <Link
                  href="/sign-in"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
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

    return (
      <div className="mb-3 rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="shrink-0 rounded-full bg-muted p-2">
            <Zap className="size-4 text-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">
              Daily limit reached
              {error.usage != null && error.limit != null && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  ({error.usage} / {error.limit} used)
                </span>
              )}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {error.userMessage}
            </p>
            <Link
              href="/pricing"
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Upgrade to Premium
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (error.code === "RATE_LIMITED") {
    return (
      <div className="mb-3 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
              {isRetrying ? "Retrying..." : "Slow down"}
            </p>
            <p className="mt-0.5 text-xs text-amber-600/80 dark:text-amber-400/80">
              {error.userMessage}
            </p>
            {!isRetrying && secondsLeft > 0 && (
              <div className="mt-2">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-amber-200 dark:bg-amber-900/50">
                    <div
                      className="h-full rounded-full bg-amber-500 transition-all duration-1000 ease-linear dark:bg-amber-400"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <span className="w-6 text-xs font-medium tabular-nums text-amber-600 dark:text-amber-400">
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

  return (
    <div className="mb-3 rounded-lg border border-border bg-muted/50 p-3">
      <div className="flex items-start gap-2.5">
        <AlertCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-foreground">{error.userMessage}</p>
          {error.code === "GENERATION_FAILED" && (
            <button
              onClick={onRetry}
              className="mt-1.5 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
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
  articleResults: ArticleResults;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  variant?: "inline" | "sidebar";
  /** Ad to display in sidebar mode */
  ad?: GravityAdType | null;
  /** Callback when ad becomes visible */
  onAdVisible?: () => void;
  /** Callback when ad is clicked */
  onAdClick?: () => void;
}

const CollapsedSummary = memo(function CollapsedSummary({
  onExpand,
  disabled,
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
          "flex w-full items-center justify-between rounded-xl px-3 py-2.5 transition-all",
          "bg-card hover:bg-muted/50",
          "border border-border shadow-sm",
          "text-sm font-medium text-foreground",
          disabled && "cursor-not-allowed opacity-50",
        )}
      >
        <span className="flex items-center gap-2">
          <span className="font-semibold">TL;DR</span>
          <span className="text-xs text-muted-foreground">AI summary</span>
        </span>
        <ChevronDown className="size-4 text-muted-foreground" />
      </button>
    </div>
  );
});

const ExpandedSummary = memo(function ExpandedSummary({
  urlProp,
  articleResults,
  onCollapse,
  variant = "inline",
  ad,
  onAdVisible,
  onAdClick,
}: {
  urlProp: string;
  articleResults: ArticleResults;
  onCollapse: () => void;
  variant?: "inline" | "sidebar";
  ad?: GravityAdType | null;
  onAdVisible?: () => void;
  onAdClick?: () => void;
}) {
  const { isSignedIn } = useAuth();

  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const isPremium = usageData?.isPremium ?? false;
  const showUsageCounter = usageData?.limit != null && usageData.limit > 0;

  const longestSource = useMemo(() => {
    const sources = SUMMARY_SOURCES.map((s) => ({
      source: s,
      length: articleResults[s]?.data?.article?.textContent?.length || 0,
    }))
      .filter((s) => s.length >= MIN_CHARS)
      .sort((a, b) => b.length - a.length);
    return sources[0]?.source || SUMMARY_SOURCES[0];
  }, [articleResults]);

  const [selectedSource, setSelectedSource] = useState<Source>(longestSource);
  const selectedArticle = articleResults[selectedSource]?.data;
  const contentLength = selectedArticle?.article?.textContent?.length || 0;

  const [preferredLanguage, setPreferredLanguage, hasLoaded] = useLocalStorage(
    "summary-language",
    "en",
  );

  // Use the streaming summary hook with caching
  const { summary, isLoading, isStreaming, error, generate } = useSummary({
    url: urlProp,
    language: preferredLanguage,
    source: selectedSource,
    onUsageUpdate: setUsageData,
  });

  // Note: Ad fetching is now handled in ProxyContent for consistent display across layouts

  // Track if we've auto-triggered using a ref to avoid setState in effect
  const hasTriggeredRef = useRef(false);

  // Auto-generate on mount when valid content is available (wait for language to load from storage)
  useEffect(() => {
    if (
      hasLoaded &&
      !hasTriggeredRef.current &&
      !summary &&
      !isLoading &&
      contentLength >= MIN_CHARS &&
      selectedArticle?.article?.textContent
    ) {
      hasTriggeredRef.current = true;
      generate(
        selectedArticle.article.textContent,
        selectedArticle.article.title,
      );
    }
  }, [hasLoaded, summary, isLoading, contentLength, selectedArticle, generate]);

  // Reset trigger when language or source changes
  useEffect(() => {
    hasTriggeredRef.current = false;
  }, [preferredLanguage, selectedSource]);

  const handleSourceChange = useCallback(
    (newSource: Source | null) => {
      if (!newSource) return;
      setSelectedSource(newSource);
      // Auto-generate effect will handle generation if no cached summary exists
    },
    [],
  );

  const handleLanguageChange = useCallback(
    (newLang: string | null) => {
      if (!newLang) return;
      setPreferredLanguage(newLang);
      hasTriggeredRef.current = false;
    },
    [setPreferredLanguage],
  );

  const getSourceStatus = useCallback(
    (source: Source) => {
      const result = articleResults[source];
      const length = result?.data?.article?.textContent?.length || 0;
      if (result?.isLoading) return { disabled: true, reason: "Loading..." };
      if (result?.isError) return { disabled: true, reason: "Failed" };
      if (length > 0 && length < MIN_CHARS)
        return { disabled: true, reason: "Too short" };
      if (length === 0) return { disabled: true, reason: "No content" };
      return { disabled: false, reason: null };
    },
    [articleResults],
  );

  const handleRetry = useCallback(() => {
    if (selectedArticle?.article?.textContent) {
      generate(
        selectedArticle.article.textContent,
        selectedArticle.article.title,
      );
    }
  }, [selectedArticle, generate]);

  return (
    <div
      className={cn(
        "overflow-hidden",
        variant === "sidebar"
          ? "flex h-full w-full flex-col"
          : "rounded-xl border border-border bg-card shadow-sm mb-6",
      )}
    >
      {/* Header - always has collapse button */}
      <div className={cn(
        "flex items-center justify-between gap-2 overflow-hidden px-3 py-2.5",
        variant === "sidebar" ? "border-b border-border" : "border-b border-border bg-muted/50"
      )}>
        <div className="flex items-center gap-2">
          {variant === "sidebar" ? (
            <span className="text-sm font-semibold text-foreground">TL;DR</span>
          ) : (
            <button
              onClick={onCollapse}
              className="flex items-center gap-1.5 text-sm font-semibold text-foreground transition-colors hover:text-muted-foreground"
            >
              <span>TL;DR</span>
              <ChevronUp className="size-4" />
            </button>
          )}
          {isPremium && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              <Infinity className="size-2.5" />
              Unlimited
            </span>
          )}
        </div>

        <div className="flex min-w-0 items-center gap-1.5">
          <Select
            value={selectedSource}
            onValueChange={(v) => handleSourceChange(v as Source)}
            disabled={isLoading}
          >
            <SelectTrigger className="h-7 w-auto min-w-0 gap-1 rounded-md border border-border bg-background px-2 text-xs font-medium shadow-sm">
              <Database className="size-3" />
              <span className="truncate">{SOURCE_LABELS[selectedSource]}</span>
            </SelectTrigger>
            <SelectContent>
              {SUMMARY_SOURCES.map((source) => {
                const sourceStatus = getSourceStatus(source);
                return (
                  <SelectItem
                    key={source}
                    value={source}
                    disabled={sourceStatus.disabled}
                  >
                    <span className="flex items-center gap-2">
                      {SOURCE_LABELS[source]}
                      {source === longestSource && !sourceStatus.disabled && (
                        <span className="text-[10px] text-emerald-500">
                          Best
                        </span>
                      )}
                      {sourceStatus.reason && (
                        <span className="text-[10px] text-muted-foreground">
                          {sourceStatus.reason}
                        </span>
                      )}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>

          <Select
            value={preferredLanguage}
            onValueChange={handleLanguageChange}
            disabled={isLoading}
          >
            <SelectTrigger className="h-7 w-auto min-w-0 gap-1 rounded-md border border-border bg-background px-2 text-xs font-medium shadow-sm">
              <LanguageIcon className="size-3" />
              <span className="truncate">
                {LANGUAGES.find((l) => l.code === preferredLanguage)?.name ||
                  "Lang"}
              </span>
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((lang) => (
                <SelectItem key={lang.code} value={lang.code}>
                  {lang.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {variant === "sidebar" && (
            <button
              onClick={onCollapse}
              className="ml-1 flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Collapse sidebar"
            >
              <PanelRightClose className="size-4" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className={cn(
        "px-3 py-3 sm:px-4 sm:py-4",
        variant === "sidebar" && "flex-1 overflow-y-auto"
      )}>
        {error && (
          <SummaryErrorDisplay
            error={error}
            onRetry={handleRetry}
            isSignedIn={isSignedIn ?? false}
            isPremium={isPremium}
          />
        )}

        {isLoading && !summary && (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-[95%]" />
            <Skeleton className="h-4 w-[90%]" />
          </div>
        )}

        {summary && (
          <div className="text-sm leading-relaxed text-foreground">
            <Response
              dir={RTL_LANGUAGES.has(preferredLanguage) ? "rtl" : "ltr"}
              lang={preferredLanguage}
              isAnimating={isStreaming}
            >
              {summary}
            </Response>
          </div>
        )}

        {!summary && !isLoading && !error && contentLength < MIN_CHARS && (
          <p className="text-sm text-muted-foreground">
            {contentLength === 0
              ? "Loading article..."
              : `Article too short for summary (${contentLength}/${MIN_CHARS} chars)`}
          </p>
        )}
      </div>

      {/* Sidebar ad - fixed at bottom */}
      {variant === "sidebar" && ad && onAdVisible && (
        <div className="shrink-0 border-t border-border px-3 py-3">
          <GravityAd ad={ad} onVisible={onAdVisible} onClick={onAdClick} variant="sidebar" />
        </div>
      )}

      {/* Footer - only render if there's content to show */}
      {(isPremium || showUsageCounter || variant !== "sidebar") && (
        <div className={cn(
          "border-t border-border px-3 py-2 text-center",
          variant === "sidebar" && "shrink-0"
        )}>
          {isPremium && summary && !isStreaming && usageData?.model && (
            <div className="text-[10px] text-muted-foreground/60">
              <Zap className="mr-1 inline-block size-2.5" />
              {usageData.model}
            </div>
          )}
          {!isPremium && showUsageCounter && usageData && (
            <div
              className={cn(
                "flex items-center gap-2 text-[10px] transition-colors",
                isLoading ? "text-muted-foreground" : "text-muted-foreground/60",
              )}
            >
              <span className="flex items-center">
                {isLoading && (
                  <span className="mr-1.5 inline-block size-1.5 animate-pulse rounded-full bg-amber-500" />
                )}
                {usageData.remaining > 0 ? (
                  <>
                    {usageData.remaining}/{usageData.limit} summaries
                  </>
                ) : (
                  <>0 summaries left</>
                )}
              </span>
              <Link
                href="/pricing"
                className="rounded-sm bg-primary/10 px-1.5 py-0.5 font-medium text-primary hover:bg-primary/20"
              >
                Upgrade
              </Link>
            </div>
          )}

          {/* Collapse button - only show in inline mode */}
          {variant !== "sidebar" && (
            <button
              onClick={onCollapse}
              className={cn(
                "flex w-full items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground",
                !isPremium && showUsageCounter && "mt-1",
              )}
            >
              <ChevronUp className="size-3.5" />
              <span>Collapse</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
});

export const InlineSummary = memo(function InlineSummary({
  urlProp,
  articleResults,
  isOpen,
  onOpenChange,
  variant = "inline",
  ad,
  onAdVisible,
  onAdClick,
}: InlineSummaryProps) {
  const hasArticleData = Object.values(articleResults).some(
    (r) => r.data?.article?.textContent,
  );

  // Mobile collapsed state: just show the button (ad handled by parent)
  if (!isOpen && variant === "inline") {
    return (
      <CollapsedSummary
        onExpand={() => onOpenChange(true)}
        disabled={!hasArticleData}
      />
    );
  }

  // Sidebar closed: render nothing (ad handled by parent)
  if (!isOpen && variant === "sidebar") {
    return null;
  }

  return (
    <ExpandedSummary
      key={`${urlProp}-expanded`}
      urlProp={urlProp}
      articleResults={articleResults}
      onCollapse={() => onOpenChange(false)}
      variant={variant}
      ad={ad}
      onAdVisible={onAdVisible}
      onAdClick={onAdClick}
    />
  );
});
