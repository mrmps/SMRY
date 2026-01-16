"use client";

const RETURN_URL_KEY = "smry_return_url";

/**
 * Get the current page URL for use as a return URL
 * Only works client-side
 */
export function getCurrentUrl(): string {
  if (typeof window === "undefined") return "/";
  return window.location.pathname + window.location.search;
}

/**
 * Store the return URL in sessionStorage
 * Call this before initiating auth flow
 */
export function storeReturnUrl(url?: string): void {
  if (typeof window === "undefined") return;
  const urlToStore = url || getCurrentUrl();
  sessionStorage.setItem(RETURN_URL_KEY, urlToStore);
}

/**
 * Get and clear the stored return URL
 * Returns "/" if none stored
 */
export function getAndClearReturnUrl(): string {
  if (typeof window === "undefined") return "/";
  const url = sessionStorage.getItem(RETURN_URL_KEY);
  sessionStorage.removeItem(RETURN_URL_KEY);
  return url || "/";
}

/**
 * Get the stored return URL without clearing it
 */
export function getReturnUrl(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(RETURN_URL_KEY);
}

/**
 * Clear the stored return URL
 */
export function clearReturnUrl(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(RETURN_URL_KEY);
}

/**
 * Build a URL with returnUrl query parameter
 */
export function buildUrlWithReturn(baseUrl: string, returnUrl?: string): string {
  const url = returnUrl || getCurrentUrl();
  // Don't add returnUrl if we're already on the target page or home
  if (url === baseUrl || url === "/") {
    return baseUrl;
  }
  const separator = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${separator}returnUrl=${encodeURIComponent(url)}`;
}

/**
 * Extract returnUrl from URL search params
 */
export function getReturnUrlFromParams(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  return params.get("returnUrl");
}
