/**
 * API Configuration
 *
 * Prefer hitting the API through NEXT_PUBLIC_API_URL so the frontend can talk to
 * whichever backend host is actually running (Railway, local server, etc.).
 *
 * In SSR (server-side), we fall back to localhost:API_PORT since relative URLs
 * won't work with axios on the server. In the browser, relative URLs work fine.
 */

function getApiBase(): string | null {
  const apiBase =
    (typeof import.meta !== "undefined"
      ? import.meta.env?.NEXT_PUBLIC_API_URL
      : undefined) ??
    (typeof process !== "undefined" ? process.env?.NEXT_PUBLIC_API_URL : undefined) ??
    null;

  return apiBase?.replace(/\/+$/, "") ?? null;
}

// Get API port for SSR fallback (default 3001)
function getApiPort(): string {
  return (typeof process !== "undefined" ? process.env?.API_PORT : undefined) ?? "3001";
}

let warnedAboutMissingApiBase = false;

export function getApiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  const apiBase = getApiBase();
  if (apiBase) {
    return `${apiBase}${normalizedPath}`;
  }

  // Check if we're in a server environment at call time (not module load time)
  // This is important for Vite SSR where modules may be shared
  const isServer = typeof window === "undefined" || typeof document === "undefined";

  // In SSR, we need an absolute URL for axios to work
  if (isServer) {
    const port = getApiPort();
    return `http://localhost:${port}${normalizedPath}`;
  }

  const isProduction =
    (typeof import.meta !== "undefined" && import.meta.env?.PROD === true) ||
    (typeof process !== "undefined" && process.env?.NODE_ENV === "production");

  if (!warnedAboutMissingApiBase && isProduction) {
    console.warn("NEXT_PUBLIC_API_URL is not set; falling back to relative /api routes.");
    warnedAboutMissingApiBase = true;
  }

  return normalizedPath;
}
