"use client";

import { AppError, getErrorMessage, getErrorTitle, isRetryableError } from "@/lib/errors";
import { AlertCircle, RefreshCw, XCircle } from "lucide-react";
import { useState } from "react";

interface ErrorDisplayProps {
  error: AppError;
  onRetry?: () => void;
  compact?: boolean;
}

/**
 * A comprehensive error display component that shows user-friendly error messages
 * with optional retry functionality
 */
export function ErrorDisplay({ error, onRetry, compact = false }: ErrorDisplayProps) {
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

  // Compact mode for inline display
  if (compact) {
    return (
      <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 px-3 py-2 rounded-md border border-amber-200">
        <AlertCircle className="w-4 h-4 flex-shrink-0" />
        <span className="flex-1">{message}</span>
        {canRetry && (
          <button
            onClick={handleRetry}
            disabled={isRetrying}
            className="text-amber-700 hover:text-amber-900 disabled:opacity-50"
            aria-label="Retry"
          >
            <RefreshCw
              className={`w-4 h-4 ${isRetrying ? "animate-spin" : ""}`}
            />
          </button>
        )}
      </div>
    );
  }

  // Full display mode
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-6">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          <XCircle className="w-6 h-6 text-red-600" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-red-900 mb-2">{title}</h3>
          <p className="text-sm text-red-700 mb-4">{message}</p>

          {/* Technical details (collapsible) */}
          {error.originalError && (
            <details className="text-xs text-red-600 bg-red-100 rounded p-3 mb-4">
              <summary className="cursor-pointer font-medium">
                Technical Details
              </summary>
              <pre className="mt-2 whitespace-pre-wrap break-all">
                {error.originalError}
              </pre>
            </details>
          )}

          {/* Error-specific information */}
          <div className="text-xs text-red-600 space-y-1">
            {error.type === "NETWORK_ERROR" && error.statusCode && (
              <p>Status Code: {error.statusCode}</p>
            )}
            {error.type === "NETWORK_ERROR" && error.url && (
              <p className="break-all">URL: {error.url}</p>
            )}
            {error.type === "TIMEOUT_ERROR" && (
              <p>Timeout: {error.timeoutMs / 1000}s</p>
            )}
            {error.type === "RATE_LIMIT_ERROR" && error.retryAfter && (
              <p>Retry After: {error.retryAfter}s</p>
            )}
          </div>

          {/* Retry button */}
          {canRetry && (
            <div className="mt-4">
              <button
                onClick={handleRetry}
                disabled={isRetrying}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:bg-red-400 rounded-md transition-colors"
              >
                <RefreshCw
                  className={`w-4 h-4 ${isRetrying ? "animate-spin" : ""}`}
                />
                {isRetrying ? "Retrying..." : "Try Again"}
              </button>
            </div>
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
      <AlertCircle className="w-4 h-4 flex-shrink-0" />
      <span className="text-sm">{getErrorMessage(error)}</span>
    </div>
  );
}

/**
 * An error badge component for compact spaces
 */
export function ErrorBadge({ error }: { error: AppError }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-700 bg-red-100 rounded-full">
      <XCircle className="w-3 h-3" />
      {getErrorTitle(error)}
    </span>
  );
}

