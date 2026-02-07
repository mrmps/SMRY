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
 * Determines if a request should be rewritten to the markdown API route.
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
 * Build the rewrite URL for the markdown API route.
 */
export function buildMarkdownRewriteUrl(
  normalizedPath: string,
  origin: string
): string {
  return `${origin}/api/llm?page=${encodeURIComponent(normalizedPath)}`;
}
