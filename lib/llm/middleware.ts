import { locales, defaultLocale } from '@/i18n/routing';
import { prefersMarkdown } from './accept-header';
import { LLM_ELIGIBLE_ROUTES } from './content';

const BASE_URL = 'https://smry.ai';

/** Headers added to all responses for LLM discoverability */
export const LLM_DISCOVERY_HEADERS = {
  'Link': `<${BASE_URL}/llms.txt>; rel="llms-txt"`,
  'X-Llms-Txt': `${BASE_URL}/llms.txt`,
} as const;

/**
 * Strip locale prefix from pathname to get the normalized route.
 * e.g., /de/pricing → /pricing, /pt → /, /pricing → /pricing
 */
export function stripLocalePrefix(pathname: string): string {
  for (const locale of locales) {
    if (locale === defaultLocale) continue;
    if (pathname === `/${locale}`) return '/';
    if (pathname.startsWith(`/${locale}/`)) {
      return pathname.slice(`/${locale}`.length);
    }
  }
  return pathname;
}

/**
 * Determines if a request should be rewritten to the markdown API route
 * for static pages (/, /pricing, /guide, etc.).
 * Returns the normalized path if eligible, null otherwise.
 */
export function getMarkdownRewritePath(
  pathname: string,
  acceptHeader: string
): string | null {
  if (!prefersMarkdown(acceptHeader)) return null;

  const normalizedPath = stripLocalePrefix(pathname);
  if ((LLM_ELIGIBLE_ROUTES as readonly string[]).includes(normalizedPath)) {
    return normalizedPath;
  }

  return null;
}

/**
 * Build the rewrite URL for the static page markdown API route.
 */
export function buildMarkdownRewriteUrl(
  normalizedPath: string,
  origin: string
): string {
  return `${origin}/api/llm?page=${encodeURIComponent(normalizedPath)}`;
}

/**
 * Determines if a request for an article URL should be rewritten to the
 * article markdown API route.
 *
 * Handles two patterns:
 * - /proxy?url=https://example.com → article URL from query param
 * - /<url-slug> → article URL extracted from the proxy redirect
 *
 * Returns the article URL if eligible, null otherwise.
 */
export function getArticleMarkdownUrl(
  pathname: string,
  acceptHeader: string,
  urlSearchParam: string | null,
  proxyRedirectUrl: string | null
): string | null {
  if (!prefersMarkdown(acceptHeader)) return null;

  // Case 1: /proxy?url=...
  const normalizedPath = stripLocalePrefix(pathname);
  if (normalizedPath === '/proxy' && urlSearchParam) {
    return urlSearchParam;
  }

  // Case 2: URL slug that would be redirected to /proxy?url=...
  if (proxyRedirectUrl) {
    try {
      const redirectUrlObj = new URL(proxyRedirectUrl);
      const articleUrl = redirectUrlObj.searchParams.get('url');
      if (articleUrl) return articleUrl;
    } catch {
      // Invalid URL, fall through
    }
  }

  return null;
}

/**
 * Build the rewrite URL for the article markdown API route.
 */
export function buildArticleMarkdownRewriteUrl(
  articleUrl: string,
  origin: string
): string {
  return `${origin}/api/llm/article?url=${encodeURIComponent(articleUrl)}`;
}
