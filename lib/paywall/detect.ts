/**
 * Paywall bypass detection - error-based only
 * Content length is not a reliable indicator of bypass success
 */

export type PaywallBypassStatus = "success" | "blocked";

/**
 * Simple error-based detection
 */
export function detectPaywallBypass(
  contentLength: number | undefined,
  hasError: boolean
): PaywallBypassStatus {
  // If there's an error or no content, it's blocked
  if (hasError || contentLength === undefined || contentLength === 0) {
    return "blocked";
  }

  return "success";
}
