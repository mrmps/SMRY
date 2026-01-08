"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
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
import { useSummary, UsageData } from "@/lib/hooks/use-summary";
import { Response } from "../ai/response";
import { UpgradeModal } from "./upgrade-modal";
import { SummaryError } from "@/lib/errors/summary";
import { Zap, AlertCircle } from "lucide-react";

const RTL_LANGUAGES = new Set(["ar", "he", "fa", "ur"]);

type ArticleResults = Record<Source, UseQueryResult<ArticleResponse, Error>>;

const SOURCE_LABELS: Record<Source, string> = {
  "smry-fast": "smry (fast)",
  "smry-slow": "smry (slow)",
  wayback: "Wayback",
  "jina.ai": "Jina.ai",
};

const SUMMARY_SOURCES: Source[] = [
  "smry-fast",
  "smry-slow",
  "wayback",
  "jina.ai",
];

const MIN_CHARS_FOR_SUMMARY = 400;

function SummaryFormError({
  error,
  onRetry,
}: {
  error: SummaryError;
  onRetry: () => void;
}) {
  if (error.code === "DAILY_LIMIT_REACHED") {
    return (
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="shrink-0 rounded-full bg-muted p-2">
            <Zap className="size-4 text-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-foreground">
              Daily limit reached
            </h3>
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
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Slow down
        </h3>
        <p className="text-sm text-muted-foreground">
          {error.userMessage}
          {error.retryAfter && ` Try again in ${error.retryAfter} seconds.`}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
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

interface SummaryFormProps {
  urlProp: string;
  ipProp: string;
  articleResults: ArticleResults;
  isOpen?: boolean;
  usePortal?: boolean;
}

export default function SummaryForm({
  urlProp,
  articleResults,
  isOpen = true,
  usePortal = true,
}: SummaryFormProps) {
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const isPremium = usageData?.isPremium ?? false;
  const hasLoadedUsage = usageData !== null;

  const usageCount = usageData ? usageData.limit - usageData.remaining : 0;
  const showUsageCounter = hasLoadedUsage && !isPremium && usageData !== null;
  const showSoftUpgrade =
    showUsageCounter &&
    usageData &&
    usageCount >= 10 &&
    usageCount < usageData.limit;
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const longestAvailableSource = useMemo(() => {
    const sources: { source: Source; length: number }[] = SUMMARY_SOURCES.map(
      (source) => ({
        source,
        length: articleResults[source]?.data?.article?.textContent?.length || 0,
      }),
    ).filter((s) => s.length >= MIN_CHARS_FOR_SUMMARY);

    sources.sort((a, b) => b.length - a.length);
    return sources[0]?.source || SUMMARY_SOURCES[0];
  }, [articleResults]);

  const [manualSource, setManualSource] = useState<Source | null>(null);
  const selectedSource = manualSource || longestAvailableSource;
  const selectedArticle = articleResults[selectedSource]?.data;

  const [preferredLanguage, setPreferredLanguage] = useLocalStorage<string>(
    "summary-language",
    "en",
  );

  // Use the streaming summary hook with caching
  const { summary, isLoading, isStreaming, error, generate } = useSummary({
    url: urlProp,
    language: preferredLanguage,
    onUsageUpdate: setUsageData,
  });

  const hasArticleData = Object.values(articleResults).some(
    (result) => result.data?.article?.textContent,
  );
  const allArticlesLoading = Object.values(articleResults).every(
    (result) => result.isLoading,
  );
  const shouldDisableSource = allArticlesLoading || !hasArticleData;

  const contentLengths = SUMMARY_SOURCES.reduce<Record<Source, number>>(
    (acc, source) => {
      acc[source] =
        articleResults[source].data?.article?.textContent?.length || 0;
      return acc;
    },
    {
      "smry-fast": 0,
      "smry-slow": 0,
      wayback: 0,
      "jina.ai": 0,
    },
  );

  const hasTriggeredRef = useRef(false);

  // Auto-generate on mount when valid content is available and sidebar is open
  useEffect(() => {
    if (
      isOpen &&
      !hasTriggeredRef.current &&
      !manualSource &&
      !summary &&
      !isLoading &&
      selectedArticle?.article?.textContent &&
      contentLengths[selectedSource] >= MIN_CHARS_FOR_SUMMARY
    ) {
      hasTriggeredRef.current = true;
      generate(
        selectedArticle.article.textContent,
        selectedArticle.article.title,
      );
    }
  }, [
    isOpen,
    manualSource,
    summary,
    isLoading,
    selectedArticle,
    contentLengths,
    selectedSource,
    generate,
  ]);

  const handleRegenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedArticle?.article?.textContent) return;
    generate(
      selectedArticle.article.textContent,
      selectedArticle.article.title,
    );
  };

  const handleLanguageChange = (newLanguage: string) => {
    setPreferredLanguage(newLanguage);
    hasTriggeredRef.current = false;
  };

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

  // Show upgrade modal when daily limit reached
  useEffect(() => {
    if (error?.code === "DAILY_LIMIT_REACHED" && !isPremium) {
      const timer = setTimeout(() => setShowUpgradeModal(true), 0);
      return () => clearTimeout(timer);
    }
  }, [error, isPremium]);

  const handleRetry = () => {
    if (selectedArticle?.article?.textContent) {
      generate(
        selectedArticle.article.textContent,
        selectedArticle.article.title,
      );
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-3 px-4 py-2">
          {error && <SummaryFormError error={error} onRetry={handleRetry} />}

          <UpgradeModal
            open={showUpgradeModal}
            onOpenChange={setShowUpgradeModal}
          />

          {(summary || isLoading) && (
            <div className="text-sm text-foreground">
              {isLoading && !summary && (
                <div className="space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-[95%]" />
                  <Skeleton className="h-4 w-[90%]" />
                </div>
              )}
              {summary && (
                <>
                  <Response
                    dir={RTL_LANGUAGES.has(preferredLanguage) ? "rtl" : "ltr"}
                    lang={preferredLanguage}
                  >
                    {summary}
                  </Response>
                  {isStreaming && (
                    <span className="mt-1 inline-block h-4 w-0.5 animate-pulse bg-foreground"></span>
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
                        <span className="text-xs font-normal text-emerald-500">
                          Best
                        </span>
                      )}
                    </div>
                  </SelectTrigger>
                  <SelectContent portal={usePortal}>
                    {SUMMARY_SOURCES.map((source) => {
                      const sourceStatus = getSourceStatus(source);
                      const length = contentLengths[source];
                      return (
                        <SelectItem
                          key={source}
                          value={source}
                          disabled={sourceStatus.disabled}
                        >
                          <span className="flex flex-wrap items-center gap-2 whitespace-normal leading-snug">
                            <span>{SOURCE_LABELS[source]}</span>
                            {length > 0 && (
                              <span className="text-muted-foreground">
                                • {length.toLocaleString()} chars
                              </span>
                            )}
                            {sourceStatus.label && (
                              <span className="text-muted-foreground">
                                • {sourceStatus.label}
                              </span>
                            )}
                            {longestAvailableSource === source &&
                              !sourceStatus.disabled && (
                                <span className="text-emerald-500">• Best</span>
                              )}
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
                      {LANGUAGES.find((l) => l.code === preferredLanguage)
                        ?.name || "Language"}
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
                variant={summary ? "ghost" : "default"}
                size="sm"
                disabled={
                  isLoading ||
                  shouldDisableSource ||
                  !selectedArticle?.article?.textContent
                }
                className="h-9 shrink-0 px-4 text-sm font-medium transition-all active:scale-95"
              >
                {isLoading ? "Generating..." : summary ? "Update" : "Generate"}
              </Button>
            </div>
          </div>

          <p className="truncate px-2 text-center text-[10px] text-muted-foreground/60">
            {!manualSource &&
              hasArticleData &&
              `${contentLengths[selectedSource].toLocaleString()} chars`}
            {!manualSource && hasArticleData && showUsageCounter && " · "}
            {showUsageCounter && usageData && (
              <>
                {usageCount}/{usageData.limit} today
                {showSoftUpgrade && (
                  <Link
                    href="/pricing"
                    className="ml-1 text-muted-foreground hover:text-foreground"
                  >
                    · unlimited
                  </Link>
                )}
              </>
            )}
          </p>
        </form>
      </div>
    </div>
  );
}
