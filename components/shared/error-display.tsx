"use client";

import { AppError, getErrorMessage, getErrorTitle, isRetryableError } from "@/lib/errors";
import { AlertCircle, RefreshCw, XCircle, ExternalLink, FileQuestion, Clock, Ban, FileWarning, BookOpen } from "lucide-react";
import { useState } from "react";
import Link from "next/link";

interface ErrorDisplayProps {
  error: AppError;
  onRetry?: () => void;
  compact?: boolean;
  source?: string;
  originalUrl?: string;
}

/**
 * A comprehensive error display component that shows user-friendly error messages
 * with optional retry functionality
 */
export function ErrorDisplay({ error, onRetry, compact = false, source: _source, originalUrl }: ErrorDisplayProps) {
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = async () => {
    if (onRetry && !isRetrying) {
      setIsRetrying(true);
      try {
        await onRetry();
      } finally {
        setIsRetrying(false);
      }
    }
  };

  const _title = getErrorTitle(error);
  const message = getErrorMessage(error);
  const canRetry = isRetryableError(error) && onRetry;
  
  // Determine appropriate icon and heading
  let Icon = AlertCircle;
  let heading = _title;
  let iconColor = "text-rose-500";

  if (_title === "Not Found") {
    Icon = FileQuestion;
    heading = "Page Not Found";
    iconColor = "text-zinc-400";
  } else if (_title === "Timed Out") {
    Icon = Clock;
    heading = "Request Timed Out";
    iconColor = "text-amber-500";
  } else if (_title === "Rate Limited") {
    Icon = Ban;
    heading = "Rate Limit Exceeded";
    iconColor = "text-amber-500";
  } else if (_title === "Unavailable") {
    Icon = FileWarning;
    heading = "Content Unavailable";
    iconColor = "text-rose-500";
  }

  // Determine the actual URL to display (prefer originalUrl prop, fallback to error.url if it exists)
  const errorUrl = 'url' in error ? error.url : undefined;
  const displayUrl = originalUrl || errorUrl;

  // Compact mode for inline display
  if (compact) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-gray-600">
        <AlertCircle className="size-4 shrink-0 text-blue-600" />
        <span className="flex-1">{message}</span>
        {canRetry && (
          <button
            onClick={handleRetry}
            disabled={isRetrying}
            className="text-blue-600 hover:text-blue-700 disabled:opacity-50"
            aria-label="Retry"
          >
            <RefreshCw
              className={`size-4 ${isRetrying ? "animate-spin" : ""}`}
            />
          </button>
        )}
      </div>
    );
  }

  // Full display mode - subtle Attio-style
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">
          <Icon className={`size-5 ${iconColor}`} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {heading}
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            {message}
          </p>

          {/* Alternatives section */}
          {displayUrl && (
            <div className="mt-4">
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">
                Couldn&apos;t get this article? Try:
              </p>
              <div className="flex flex-col gap-2">
                {/* Archive.is - primary recommendation */}
                <a
                  href={`https://archive.is/newest/${displayUrl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-fit items-center gap-1.5 text-sm text-emerald-600 transition-colors hover:text-emerald-700 hover:underline dark:text-emerald-400 dark:hover:text-emerald-300"
                >
                  Try archive.is
                  <span className="text-xs text-zinc-500">(often works best)</span>
                  <ExternalLink className="size-3.5" />
                </a>

                {/* Wayback Machine direct */}
                <a
                  href={`https://web.archive.org/web/*/${displayUrl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-fit items-center gap-1.5 text-sm text-blue-600 transition-colors hover:text-blue-700 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
                >
                  Browse Wayback Machine
                  <ExternalLink className="size-3.5" />
                </a>

                {/* Original page link */}
                <a
                  href={displayUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-fit items-center gap-1.5 text-sm text-zinc-600 transition-colors hover:text-zinc-700 hover:underline dark:text-zinc-400 dark:hover:text-zinc-300"
                >
                  Open original page
                  <ExternalLink className="size-3.5" />
                </a>
              </div>
            </div>
          )}

          {/* Guide link */}
          <div className="mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-800">
            <Link
              href="/guide"
              className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300 transition-colors"
            >
              <BookOpen className="size-3.5" />
              Read our guide on bypassing paywalls
            </Link>
          </div>

          {/* Retry button */}
          {canRetry && (
            <div className="mt-3">
              <button
                onClick={handleRetry}
                disabled={isRetrying}
                className="inline-flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:bg-zinc-50 disabled:text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <RefreshCw
                  className={`size-3.5 ${isRetrying ? "animate-spin" : ""}`}
                />
                {isRetrying ? "Retrying..." : "Try Again"}
              </button>
            </div>
          )}

          {/* Technical details (collapsible) - minimized */}
          {/* Don't show for "Not Found" errors as they are expected/normal */}
          {error.originalError && _title !== "Not Found" && (
            <details className="mt-3 text-xs text-gray-600">
              <summary className="cursor-pointer font-medium text-gray-500 hover:text-gray-700">
                Technical details
              </summary>
              <pre className="mt-2 max-h-32 overflow-auto rounded bg-white p-2 text-xs text-gray-600">
                {error.originalError}
              </pre>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * A simpler error message component for inline display
 */
export function ErrorMessage({ error }: { error: AppError }) {
  return (
    <div className="flex items-center gap-2 text-red-600">
      <AlertCircle className="size-4 shrink-0" />
      <span className="text-sm">{getErrorMessage(error)}</span>
    </div>
  );
}

/**
 * An error badge component for compact spaces
 */
export function ErrorBadge({ error }: { error: AppError }) {
  const title = getErrorTitle(error);
  const isNotFound = title === "Not Found";

  if (isNotFound) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
        <FileQuestion className="size-3" />
        {title}
      </span>
    );
  }

  if (title === "Timed Out" || title === "Rate Limited") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 dark:border-amber-900/30 dark:bg-amber-900/20 dark:text-amber-400">
        <AlertCircle className="size-3" />
        {title}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700 dark:border-rose-900/30 dark:bg-rose-900/20 dark:text-rose-400">
      <XCircle className="size-3" />
      {title}
    </span>
  );
}

