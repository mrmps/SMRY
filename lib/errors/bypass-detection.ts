/**
 * Bypass detection error types and utilities
 */

export type BypassDetectionErrorCode =
  | "NOT_PREMIUM"
  | "DETECTION_FAILED"
  | "CONTENT_TOO_SHORT"
  | "RATE_LIMITED";

export interface BypassDetectionError {
  code: BypassDetectionErrorCode;
  message: string;
  userMessage: string;
}

const BYPASS_DETECTION_ERRORS: Record<BypassDetectionErrorCode, BypassDetectionError> = {
  NOT_PREMIUM: {
    code: "NOT_PREMIUM",
    message: "Premium required",
    userMessage: "Paywall detection is a premium feature.",
  },
  DETECTION_FAILED: {
    code: "DETECTION_FAILED",
    message: "Detection failed",
    userMessage: "Could not analyze article for paywall bypass.",
  },
  CONTENT_TOO_SHORT: {
    code: "CONTENT_TOO_SHORT",
    message: "Content too short",
    userMessage: "Article is too short to analyze.",
  },
  RATE_LIMITED: {
    code: "RATE_LIMITED",
    message: "Too many requests",
    userMessage: "Too many analysis requests. Please slow down.",
  },
};

export function createBypassDetectionError(code: BypassDetectionErrorCode): BypassDetectionError {
  return BYPASS_DETECTION_ERRORS[code];
}
