/**
 * Debug context for troubleshooting extraction issues
 * Captures all intermediate data and steps in the extraction pipeline
 */
export interface DebugContext {
  timestamp: string;
  url: string;
  source: string;
  steps: DebugStep[];
}

export interface DebugStep {
  step: string;
  timestamp: string;
  status: 'success' | 'error' | 'warning' | 'info';
  message: string;
  data?: {
    htmlLength?: number;
    htmlPreview?: string; // First 500 chars
    diffbotResponse?: any;
    readabilityResult?: any;
    extractedTitle?: string;
    extractedTextLength?: number;
    extractedHtmlLength?: number;
    errorDetails?: any;
    [key: string]: any;
  };
}

/**
 * Comprehensive error types for the application
 * These errors are type-safe and can be used with neverthrow's Result types
 */

export type AppError =
  | NetworkError
  | ProxyError
  | DiffbotError
  | ParseError
  | TimeoutError
  | RateLimitError
  | CacheError
  | ValidationError
  | UnknownError;

// Network-related errors
export type NetworkError = {
  type: "NETWORK_ERROR";
  message: string;
  statusCode?: number;
  url: string;
  originalError?: string;
  debugContext?: DebugContext;
};

// Proxy-related errors
export type ProxyError = {
  type: "PROXY_ERROR";
  message: string;
  url: string;
  originalError?: string;
  debugContext?: DebugContext;
};

// Diffbot API errors
export type DiffbotError = {
  type: "DIFFBOT_ERROR";
  message: string;
  url: string;
  originalError?: string;
  debugContext?: DebugContext;
};

// HTML/Content parsing errors
export type ParseError = {
  type: "PARSE_ERROR";
  message: string;
  source: string;
  originalError?: string;
  debugContext?: DebugContext;
};

// Timeout errors
export type TimeoutError = {
  type: "TIMEOUT_ERROR";
  message: string;
  url: string;
  timeoutMs: number;
  originalError?: string;
  debugContext?: DebugContext;
};

// Rate limiting errors
export type RateLimitError = {
  type: "RATE_LIMIT_ERROR";
  message: string;
  statusCode: 429;
  url: string;
  retryAfter?: number;
  originalError?: string;
  debugContext?: DebugContext;
};

// Cache-related errors
export type CacheError = {
  type: "CACHE_ERROR";
  message: string;
  operation: "read" | "write";
  originalError?: string;
  debugContext?: DebugContext;
};

// Validation errors
export type ValidationError = {
  type: "VALIDATION_ERROR";
  message: string;
  field?: string;
  originalError?: string;
  debugContext?: DebugContext;
};

// Unknown/unexpected errors
export type UnknownError = {
  type: "UNKNOWN_ERROR";
  message: string;
  originalError?: string;
  debugContext?: DebugContext;
};

// Error factory functions for easy creation
export const createNetworkError = (
  message: string,
  url: string,
  statusCode?: number,
  originalError?: unknown,
  debugContext?: DebugContext
): NetworkError => ({
  type: "NETWORK_ERROR",
  message,
  url,
  statusCode,
  originalError: originalError instanceof Error ? originalError.message : String(originalError),
  debugContext,
});

export const createProxyError = (
  message: string,
  url: string,
  originalError?: unknown,
  debugContext?: DebugContext
): ProxyError => ({
  type: "PROXY_ERROR",
  message,
  url,
  originalError: originalError instanceof Error ? originalError.message : String(originalError),
  debugContext,
});

export const createDiffbotError = (
  message: string,
  url: string,
  originalError?: unknown,
  debugContext?: DebugContext
): DiffbotError => ({
  type: "DIFFBOT_ERROR",
  message,
  url,
  originalError: originalError instanceof Error ? originalError.message : String(originalError),
  debugContext,
});

export const createParseError = (
  message: string,
  source: string,
  originalError?: unknown
): ParseError => ({
  type: "PARSE_ERROR",
  message,
  source,
  originalError: originalError instanceof Error ? originalError.message : String(originalError),
});

export const createTimeoutError = (url: string, timeoutMs: number, originalError?: unknown): TimeoutError => ({
  type: "TIMEOUT_ERROR",
  message: `Request timed out after ${timeoutMs}ms`,
  url,
  timeoutMs,
  originalError: originalError instanceof Error ? originalError.message : originalError ? String(originalError) : undefined,
});

export const createRateLimitError = (
  url: string,
  retryAfter?: number,
  originalError?: unknown
): RateLimitError => ({
  type: "RATE_LIMIT_ERROR",
  message: "Rate limit exceeded. Please try again later.",
  statusCode: 429,
  url,
  retryAfter,
  originalError: originalError instanceof Error ? originalError.message : originalError ? String(originalError) : undefined,
});

export const createCacheError = (
  message: string,
  operation: "read" | "write",
  originalError?: unknown
): CacheError => ({
  type: "CACHE_ERROR",
  message,
  operation,
  originalError: originalError instanceof Error ? originalError.message : String(originalError),
});

export const createValidationError = (
  message: string,
  field?: string,
  originalError?: unknown
): ValidationError => ({
  type: "VALIDATION_ERROR",
  message,
  field,
  originalError: originalError instanceof Error ? originalError.message : String(originalError),
});

export const createUnknownError = (originalError?: unknown): UnknownError => ({
  type: "UNKNOWN_ERROR",
  message: "An unexpected error occurred",
  originalError: originalError instanceof Error ? originalError.message : String(originalError),
});

// User-friendly error messages for frontend display
export const getErrorMessage = (error: AppError): string => {
  switch (error.type) {
    case "NETWORK_ERROR":
      if (error.statusCode === 404) {
        return "The requested page was not found. The article may have been removed or the URL is incorrect.";
      }
      if (error.statusCode === 403) {
        return "Access to this content is forbidden. The site may be blocking our requests.";
      }
      if (error.statusCode && error.statusCode >= 500) {
        return "The source server is experiencing issues. Please try again later or use a different source.";
      }
      // Check for "All fetch methods exhausted" case
      if (error.message.includes("All fetch methods exhausted")) {
        return "Unable to retrieve content from this source. All extraction methods failed. Please try a different source tab above.";
      }
      return `Network error: ${error.message}`;

    case "PROXY_ERROR":
      return "Proxy connection failed. Please try a different source or try again later.";

    case "DIFFBOT_ERROR":
      if (error.message.includes("404") || error.message.includes("not found") || error.message.includes("could not download page")) {
        return "This page couldn't be accessed. The article may no longer be available at this URL, or the site may be blocking access.";
      }
      if (error.message.includes("403") || error.message.includes("forbidden")) {
        return "Access to this content is restricted. The site appears to be blocking access to this page.";
      }
      if (error.message.includes("Rate limit") || error.message.includes("429")) {
        return "We've hit our request limit for now. Please try again in a few moments, or try using a different source tab.";
      }
      if (error.message.includes("500") || error.message.includes("502") || error.message.includes("503") || error.message.includes("Server error")) {
        return "The page's server is having issues right now. This is temporary—try again in a moment or use a different source tab.";
      }
      if (error.message.includes("timeout")) {
        return "The request took too long to complete. The page may be slow to load—try again or use a different source tab.";
      }
      if (error.message.includes("No Diffbot API key")) {
        return "Content extraction is not configured. Please contact support.";
      }
      if (error.message.includes("Incomplete article data")) {
        return "We couldn't extract the full article content from this page. Try viewing the page directly to see if it's available.";
      }
      return "We couldn't retrieve the content from this page. Try viewing it directly or using a different source tab.";

    case "PARSE_ERROR":
      return "Failed to parse the article content. The page format may not be supported.";

    case "TIMEOUT_ERROR":
      return `Request timed out after ${error.timeoutMs / 1000} seconds. The source may be slow or unavailable.`;

    case "RATE_LIMIT_ERROR":
      return error.retryAfter
        ? `Rate limit exceeded. Please wait ${error.retryAfter} seconds before trying again.`
        : "Rate limit exceeded. Please wait a moment before trying again.";

    case "CACHE_ERROR":
      return "Cache operation failed, but we'll try to fetch fresh content.";

    case "VALIDATION_ERROR":
      return error.field
        ? `Validation error in ${error.field}: ${error.message}`
        : `Validation error: ${error.message}`;

    case "UNKNOWN_ERROR":
      return "An unexpected error occurred. Please try again or use a different source.";

    default:
      return "An error occurred while processing your request.";
  }
};

// Get a short error title for display
export const getErrorTitle = (error: AppError): string => {
  switch (error.type) {
    case "NETWORK_ERROR":
      return "Network Error";
    case "PROXY_ERROR":
      return "Proxy Error";
    case "DIFFBOT_ERROR":
      return "Extraction Error";
    case "PARSE_ERROR":
      return "Parsing Error";
    case "TIMEOUT_ERROR":
      return "Timeout Error";
    case "RATE_LIMIT_ERROR":
      return "Rate Limited";
    case "CACHE_ERROR":
      return "Cache Error";
    case "VALIDATION_ERROR":
      return "Validation Error";
    case "UNKNOWN_ERROR":
      return "Unknown Error";
    default:
      return "Error";
  }
};

// Check if error is retryable
export const isRetryableError = (error: AppError): boolean => {
  switch (error.type) {
    case "TIMEOUT_ERROR":
    case "NETWORK_ERROR":
      return true;
    case "RATE_LIMIT_ERROR":
      return true; // But should wait before retrying
    default:
      return false;
  }
};

