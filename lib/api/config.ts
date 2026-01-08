/**
 * API Configuration
 *
 * Prefer hitting the API through NEXT_PUBLIC_API_URL so the frontend can talk to
 * whichever backend host is actually running (Railway, local server, etc.).
 * Falling back to relative URLs keeps the Next.js rewrite flow working during
 * local development if the env var isn't set.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") ?? null;
let warnedAboutMissingApiBase = false;

export function getApiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (API_BASE) {
    return `${API_BASE}${normalizedPath}`;
  }

  if (!warnedAboutMissingApiBase && process.env.NODE_ENV === "production") {
    console.warn("NEXT_PUBLIC_API_URL is not set; falling back to relative /api routes.");
    warnedAboutMissingApiBase = true;
  }

  return normalizedPath;
}
