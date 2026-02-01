"use client";

import { AppError, getErrorMessage, getErrorTitle, isRetryableError } from "@/lib/errors";
import { RefreshCw, ExternalLink, Archive, Globe, ArrowRight } from "lucide-react";
import { useState } from "react";

interface ErrorDisplayProps {
  error: AppError;
  onRetry?: () => void;
  compact?: boolean;
  source?: string;
  originalUrl?: string;
}

/**
 * Minimal, interactive error display component
 */
export function ErrorDisplay({ error, onRetry, compact = false, originalUrl }: ErrorDisplayProps) {
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

  const title = getErrorTitle(error);
  const message = getErrorMessage(error);
  const canRetry = isRetryableError(error) && onRetry;

  // Determine the URL to use for alternatives
  const errorUrl = 'url' in error ? error.url : undefined;
  const displayUrl = originalUrl || errorUrl;

  // Compact mode for inline display
  if (compact) {
    return (
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span>{message}</span>
        {canRetry && (
          <button
            onClick={handleRetry}
            disabled={isRetrying}
            className="text-primary hover:text-primary/80 disabled:opacity-50"
          >
            <RefreshCw className={`size-4 ${isRetrying ? "animate-spin" : ""}`} />
          </button>
        )}
      </div>
    );
  }

  // Full display - minimal and clean
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      {/* Simple message */}
      <h2 className="text-lg font-medium text-foreground mb-2">
        {title === "Network Error" ? "Couldn't load this article" : title}
      </h2>
      <p className="text-sm text-muted-foreground mb-8 max-w-md">
        {message.includes("403")
          ? "This site blocked our request. Try one of the alternatives below."
          : message.includes("404")
          ? "This page doesn't exist or has been removed."
          : "Something went wrong. Try one of these options:"}
      </p>

      {/* Action buttons - clean and interactive */}
      {displayUrl && (
        <div className="flex flex-col sm:flex-row items-center gap-3 mb-6">
          <a
            href={`https://archive.is/newest/${displayUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium"
          >
            <Archive className="size-4" />
            Try archive.is
            <ArrowRight className="size-3.5 opacity-60 group-hover:translate-x-0.5 transition-transform" />
          </a>

          <a
            href={`https://web.archive.org/web/*/${displayUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border bg-background hover:bg-muted transition-colors text-sm font-medium"
          >
            <Globe className="size-4 text-muted-foreground" />
            Wayback Machine
            <ExternalLink className="size-3 opacity-40" />
          </a>
        </div>
      )}

      {/* Secondary actions */}
      <div className="flex items-center gap-4 text-sm">
        {canRetry && (
          <button
            onClick={handleRetry}
            disabled={isRetrying}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`size-3.5 ${isRetrying ? "animate-spin" : ""}`} />
            {isRetrying ? "Retrying..." : "Try again"}
          </button>
        )}

        {displayUrl && (
          <>
            {canRetry && <span className="text-border">•</span>}
            <a
              href={displayUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              Open original
              <ExternalLink className="size-3" />
            </a>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * A simpler error message component for inline display
 */
export function ErrorMessage({ error }: { error: AppError }) {
  return (
    <div className="text-sm text-muted-foreground">
      {getErrorMessage(error)}
    </div>
  );
}

/**
 * An error badge component for compact spaces
 */
export function ErrorBadge({ error }: { error: AppError }) {
  const title = getErrorTitle(error);

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
      {title}
    </span>
  );
}
