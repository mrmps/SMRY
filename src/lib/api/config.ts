/**
 * API Configuration
 *
 * Prefer hitting the API through NEXT_PUBLIC_API_URL so the frontend can talk to
 * whichever backend host is actually running (Railway, local server, etc.).
 *
 * In SSR (server-side), we fall back to localhost:API_PORT since relative URLs
 * won't work with axios on the server. In the browser, relative URLs work fine.
 */

const apiBase =
  (typeof import.meta !== "undefined"
    ? import.meta.env?.NEXT_PUBLIC_API_URL
    : undefined) ??
  process.env?.NEXT_PUBLIC_API_URL ??
  null;

const API_BASE = apiBase?.replace(/\/+$/, "") ?? null;

// Detect if we're running in a server environment (SSR)
const isServer = typeof window === "undefined";

// Get API port for SSR fallback (default 3001)
const apiPort =
  (typeof process !== "undefined" ? process.env?.API_PORT : undefined) ?? "3001";

let warnedAboutMissingApiBase = false;

export function getApiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (API_BASE) {
    return `${API_BASE}${normalizedPath}`;
  }

  // In SSR, we need an absolute URL for axios to work
  if (isServer) {
    return `http://localhost:${apiPort}${normalizedPath}`;
  }

  const isProduction =
    (typeof import.meta !== "undefined" && import.meta.env?.PROD === true) ||
    process.env?.NODE_ENV === "production";

  if (!warnedAboutMissingApiBase && isProduction) {
    console.warn("NEXT_PUBLIC_API_URL is not set; falling back to relative /api routes.");
    warnedAboutMissingApiBase = true;
  }

  return normalizedPath;
}
