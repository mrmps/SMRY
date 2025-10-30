"use client";

import { AppError, getErrorMessage, getErrorTitle, isRetryableError } from "@/lib/errors";
import { AlertCircle, RefreshCw, XCircle, ExternalLink } from "lucide-react";
import { useState } from "react";

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
export function ErrorDisplay({ error, onRetry, compact = false, source, originalUrl }: ErrorDisplayProps) {
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
  
  // Determine the actual URL to display (prefer originalUrl prop, fallback to error.url if it exists)
  const errorUrl = 'url' in error ? error.url : undefined;
  const displayUrl = originalUrl || errorUrl;
  
  // Check if we should show the proxy link (not for smry-fast or smry-slow)
  const showProxyLink = source && source !== "smry-fast" && source !== "smry-slow";
  
  // Get the external service URL based on source
  const getExternalUrl = (src: string, url: string) => {
    switch (src) {
      case "wayback": 
        return `https://archive.org/web/2/${encodeURIComponent(url)}`;
      case "jina.ai": 
        return `https://r.jina.ai/${url}`;
      default: 
        return undefined;
    }
  };
  
  // Get source-specific labels
  const getSourceLabel = (src: string) => {
    switch (src) {
      case "wayback": return "Try archived version (archive.org)";
      case "jina.ai": return "Try reader view (jina.ai)";
      default: return "Try cached version";
    }
  };

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
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-5">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">
          <AlertCircle className="size-5 text-blue-600" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-relaxed text-gray-700">{message}</p>

          {/* Links section */}
          {displayUrl && (
            <div className="mt-3 flex flex-col gap-2">
              {/* Original page link - always show if we have a URL */}
              <a
                href={displayUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-fit items-center gap-1.5 text-sm text-blue-600 transition-colors hover:text-blue-700 hover:underline"
              >
                Open original page directly
                <ExternalLink className="size-3.5" />
              </a>

              {/* Proxy/cache link - only for wayback and jina.ai */}
              {showProxyLink && source && displayUrl && getExternalUrl(source, displayUrl) && (
                <a
                  href={getExternalUrl(source, displayUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-fit items-center gap-1.5 text-sm text-blue-600 transition-colors hover:text-blue-700 hover:underline"
                >
                  {getSourceLabel(source)}
                  <ExternalLink className="size-3.5" />
                </a>
              )}
            </div>
          )}

          {/* Retry button */}
          {canRetry && (
            <div className="mt-3">
              <button
                onClick={handleRetry}
                disabled={isRetrying}
                className="inline-flex items-center gap-2 rounded-md border border-blue-200 bg-white px-3 py-1.5 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100 disabled:bg-gray-100 disabled:text-gray-400"
              >
                <RefreshCw
                  className={`size-3.5 ${isRetrying ? "animate-spin" : ""}`}
                />
                {isRetrying ? "Retrying..." : "Try Again"}
              </button>
            </div>
          )}

          {/* Technical details (collapsible) - minimized */}
          {error.originalError && (
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
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700">
      <XCircle className="size-3" />
      {getErrorTitle(error)}
    </span>
  );
}

