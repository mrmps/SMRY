"use client";

import { AppError, getErrorMessage, getErrorTitle, isRetryableError } from "@/lib/errors";
import { AlertCircle, RefreshCw, XCircle, ExternalLink } from "lucide-react";
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
      <div className="flex items-center gap-2 text-sm text-gray-600 bg-blue-50 px-3 py-2 rounded-md border border-blue-200">
        <AlertCircle className="w-4 h-4 flex-shrink-0 text-blue-600" />
        <span className="flex-1">{message}</span>
        {canRetry && (
          <button
            onClick={handleRetry}
            disabled={isRetrying}
            className="text-blue-600 hover:text-blue-700 disabled:opacity-50"
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

  // Full display mode - subtle Attio-style
  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-5">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <AlertCircle className="w-5 h-5 text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-700 leading-relaxed">{message}</p>

          {/* URL link if available */}
          {(error.type === "NETWORK_ERROR" || error.type === "DIFFBOT_ERROR" || error.type === "TIMEOUT_ERROR") && error.url && (
            <a
              href={error.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-3 text-sm text-blue-600 hover:text-blue-700 hover:underline transition-colors"
            >
              View page directly
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}

          {/* Retry button */}
          {canRetry && (
            <div className="mt-3">
              <button
                onClick={handleRetry}
                disabled={isRetrying}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-700 bg-white hover:bg-blue-100 disabled:bg-gray-100 disabled:text-gray-400 rounded-md border border-blue-200 transition-colors"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isRetrying ? "animate-spin" : ""}`}
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
              <pre className="mt-2 text-xs text-gray-600 bg-white rounded p-2 overflow-auto max-h-32">
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

