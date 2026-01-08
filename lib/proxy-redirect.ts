import { normalizeUrl, repairProtocol } from "@/lib/validation/url";
import { routing } from "@/i18n/routing";

/**
 * Supported locales for i18n routing (imported from routing config).
 */
export const LOCALES = routing.locales;

/**
 * App routes that should NOT be treated as URL slugs.
 * These are actual pages/API routes in the app.
 */
export const APP_ROUTES = [
  "/",
  "/proxy",
  "/api",
  "/pricing",
  "/history",
  "/feedback",
  "/admin",
  "/hard-paywalls",
  "/sign-in",
  "/sign-up",
];

/**
 * SMRY-specific query parameters that should NOT be passed to the external URL.
 * These are UI params for the SMRY app itself.
 */
export const SMRY_PARAMS = ["sidebar", "tab", "source"];

/**
 * Check if a pathname is an app route (not a URL slug to proxy).
 * Only matches EXACT routes or routes followed by sub-paths.
 * Does NOT match routes that continue with more path segments (e.g., /proxy.com).
 * Also handles locale-prefixed routes (e.g., /pt/pricing, /de/proxy).
 */
export function isAppRoute(pathname: string): boolean {
  // Exact match for root
  if (pathname === "/") return true;

  // Check if path starts with a locale prefix
  const pathParts = pathname.split("/").filter(Boolean);
  const firstPart = pathParts[0];

  // If first part is a locale, check the rest of the path
  if (firstPart && (LOCALES as readonly string[]).includes(firstPart)) {
    // Exact locale path (e.g., /pt, /de)
    if (pathParts.length === 1) return true;

    // Build the path without locale prefix to check against app routes
    const pathWithoutLocale = "/" + pathParts.slice(1).join("/");
    return isAppRouteWithoutLocale(pathWithoutLocale);
  }

  return isAppRouteWithoutLocale(pathname);
}

/**
 * Check if a pathname (without locale prefix) is an app route.
 */
function isAppRouteWithoutLocale(pathname: string): boolean {
  // Check each app route
  for (const route of APP_ROUTES) {
    if (route === "/") continue; // Root handled separately

    // Exact match (e.g., /proxy, /pricing)
    if (pathname === route) return true;

    // Route with sub-paths (e.g., /api/article, /api/summary)
    if (pathname.startsWith(`${route}/`)) return true;
  }

  return false;
}

/**
 * Parse incoming request and build proxy redirect URL.
 *
 * Handles:
 * - Full URLs: smry.ai/https://foo.com/article → /proxy?url=https://foo.com/article
 * - Collapsed protocols: smry.ai/https:/foo.com → /proxy?url=https://foo.com
 * - Bare domains: smry.ai/foo.com/article → /proxy?url=https://foo.com/article
 * - External query params: smry.ai/https://foo.com?x=1 → /proxy?url=https://foo.com?x=1
 * - Mixed params: smry.ai/https://foo.com?x=1&sidebar=open → /proxy?url=https://foo.com?x=1&sidebar=open
 *
 * @param pathname - The pathname from the request (e.g., "/https://foo.com/article")
 * @param search - The search/query string from the request (e.g., "?x=1&sidebar=open")
 * @param origin - The origin of the request (e.g., "https://smry.ai")
 * @returns The redirect URL, or null if this is an app route
 */
export function buildProxyRedirectUrl(
  pathname: string,
  search: string,
  origin: string
): string | null {
  // Don't redirect app routes
  if (isAppRoute(pathname)) {
    return null;
  }

  // Extract slug (remove leading slash)
  const slug = pathname.substring(1);

  if (!slug) {
    return null;
  }

  // Parse incoming query params
  const incomingParams = new URLSearchParams(search);

  // Separate SMRY params from external URL params
  const smryParams = new URLSearchParams();
  const externalParams = new URLSearchParams();

  incomingParams.forEach((value, key) => {
    if (SMRY_PARAMS.includes(key)) {
      smryParams.set(key, value);
    } else {
      externalParams.set(key, value);
    }
  });

  // Repair collapsed protocols
  const repaired = repairProtocol(slug);

  // Build the external URL with its query params
  const externalQueryString = externalParams.toString();
  const externalUrlRaw = externalQueryString
    ? `${repaired}?${externalQueryString}`
    : repaired;

  let normalizedExternalUrl: string;
  try {
    // Normalize the URL (handles decoding, protocol repair, validation)
    normalizedExternalUrl = normalizeUrl(externalUrlRaw);
  } catch {
    // If normalization fails, try adding https:// as fallback
    normalizedExternalUrl = /^https?:\/\//i.test(externalUrlRaw)
      ? externalUrlRaw
      : `https://${externalUrlRaw}`;
  }

  // Build the redirect URL: /proxy?url=externalUrl&smryParam1=value1
  const redirectUrl = new URL("/proxy", origin);
  redirectUrl.searchParams.set("url", normalizedExternalUrl);

  // Add SMRY params back
  smryParams.forEach((value, key) => {
    redirectUrl.searchParams.set(key, value);
  });

  return redirectUrl.toString();
}
