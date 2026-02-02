import { locales, defaultLocale } from '@/i18n/routing';

const BASE_URL = 'https://smry.ai';

type AlternatesConfig = {
  canonical: string;
  languages: Record<string, string>;
};

/**
 * Generates proper alternates metadata for SEO with canonical and hreflang tags.
 *
 * @param pathname - The page path WITHOUT locale prefix (e.g., '/pricing', '/guide', '/')
 * @returns Alternates configuration with canonical URL and hreflang entries
 *
 * According to Google's guidelines:
 * - canonical should point to the preferred version (default locale)
 * - Each locale should have its own hreflang entry
 * - x-default should point to the default locale version
 */
export function generateAlternates(pathname: string): AlternatesConfig {
  // Normalize pathname - ensure it starts with / and handle root
  const normalizedPath = pathname === '/' || pathname === '' ? '' : pathname.startsWith('/') ? pathname : `/${pathname}`;

  // Canonical always points to the default locale (English) version
  const canonical = `${BASE_URL}${normalizedPath}`;

  // Generate hreflang entries for all locales
  const languages: Record<string, string> = {};

  for (const locale of locales) {
    if (locale === defaultLocale) {
      // Default locale (English) has no prefix
      languages[locale] = `${BASE_URL}${normalizedPath}`;
    } else {
      // Other locales have prefix
      languages[locale] = `${BASE_URL}/${locale}${normalizedPath}`;
    }
  }

  // x-default points to the default locale version
  languages['x-default'] = canonical;

  return {
    canonical,
    languages,
  };
}

/**
 * Generates alternates for pages that should NOT be indexed.
 * Only includes canonical, no hreflang tags.
 *
 * @param pathname - The page path WITHOUT locale prefix
 * @returns Alternates configuration with only canonical URL
 */
export function generateNoIndexAlternates(pathname: string): { canonical: string } {
  const normalizedPath = pathname === '/' || pathname === '' ? '' : pathname.startsWith('/') ? pathname : `/${pathname}`;
  return {
    canonical: `${BASE_URL}${normalizedPath}`,
  };
}
