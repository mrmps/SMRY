/**
 * Summary-specific error types and utilities
 * These provide user-friendly error messages with upgrade CTAs
 */

export type SummaryErrorCode =
  | "DAILY_LIMIT_REACHED"
  | "RATE_LIMITED"
  | "CONTENT_TOO_SHORT"
  | "GENERATION_FAILED"
  | "INVALID_CONTENT";

export interface SummaryError {
  code: SummaryErrorCode;
  message: string;
  userMessage: string;
  retryAfter?: number;
  showUpgrade?: boolean;
  usage?: number;
  limit?: number;
}

/**
 * Error definitions with user-friendly messages
 */
const SUMMARY_ERRORS: Record<SummaryErrorCode, Omit<SummaryError, "retryAfter">> = {
  DAILY_LIMIT_REACHED: {
    code: "DAILY_LIMIT_REACHED",
    message: "Daily summary limit reached",
    userMessage: "You've reached your daily limit of free summaries. Upgrade to Premium for unlimited summaries.",
    showUpgrade: true,
  },
  RATE_LIMITED: {
    code: "RATE_LIMITED",
    message: "Too many requests",
    userMessage: "Slow down! You're making requests too quickly.",
    showUpgrade: false,
  },
  CONTENT_TOO_SHORT: {
    code: "CONTENT_TOO_SHORT",
    message: "Content too short",
    userMessage: "This article is too short to summarize. Try a different source.",
    showUpgrade: false,
  },
  GENERATION_FAILED: {
    code: "GENERATION_FAILED",
    message: "Failed to generate summary",
    userMessage: "Something went wrong generating your summary. Please try again.",
    showUpgrade: false,
  },
  INVALID_CONTENT: {
    code: "INVALID_CONTENT",
    message: "Invalid content",
    userMessage: "The article content couldn't be processed. Try a different source.",
    showUpgrade: false,
  },
};

/**
 * Create a typed summary error response
 */
export function createSummaryError(
  code: SummaryErrorCode,
  options?: { retryAfter?: number; usage?: number; limit?: number }
): SummaryError {
  return {
    ...SUMMARY_ERRORS[code],
    retryAfter: options?.retryAfter,
    usage: options?.usage,
    limit: options?.limit,
  };
}

/**
 * Parse an error message/response into a SummaryError
 * Handles both JSON error responses and plain text errors
 */
export function parseSummaryError(errorInput: string | Error): SummaryError | null {
  const message = errorInput instanceof Error ? errorInput.message : errorInput;

  // Try to parse as JSON first (server response)
  try {
    const parsed = JSON.parse(message);
    if (parsed.code && parsed.code in SUMMARY_ERRORS) {
      return {
        ...SUMMARY_ERRORS[parsed.code as SummaryErrorCode],
        retryAfter: parsed.retryAfter,
        usage: parsed.usage,
        limit: parsed.limit,
      };
    }
    // Legacy format: { error: "message" }
    if (parsed.error) {
      return matchErrorMessage(parsed.error);
    }
  } catch {
    // Not JSON, try to match the message directly
  }

  return matchErrorMessage(message);
}

/**
 * Match error message text to a SummaryError
 */
function matchErrorMessage(message: string): SummaryError | null {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes("daily") && lowerMessage.includes("limit")) {
    return SUMMARY_ERRORS.DAILY_LIMIT_REACHED;
  }

  if (lowerMessage.includes("too many") || lowerMessage.includes("slow down") || lowerMessage.includes("wait")) {
    // Try to extract retry time
    const match = message.match(/wait\s+(\d+)s/i);
    const retryAfter = match ? parseInt(match[1], 10) : undefined;
    return { ...SUMMARY_ERRORS.RATE_LIMITED, retryAfter };
  }

  if (lowerMessage.includes("too short") || lowerMessage.includes("at least 100")) {
    return SUMMARY_ERRORS.CONTENT_TOO_SHORT;
  }

  if (lowerMessage.includes("failed") || lowerMessage.includes("error")) {
    return SUMMARY_ERRORS.GENERATION_FAILED;
  }

  // Unknown error - return a generic one
  return {
    code: "GENERATION_FAILED",
    message: message,
    userMessage: message,
    showUpgrade: false,
  };
}

/**
 * Format error response for API
 */
export function formatSummaryErrorResponse(error: SummaryError) {
  return {
    code: error.code,
    message: error.message,
    userMessage: error.userMessage,
    retryAfter: error.retryAfter,
    showUpgrade: error.showUpgrade,
    usage: error.usage,
    limit: error.limit,
  };
}
