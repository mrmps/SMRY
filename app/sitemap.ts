import { MetadataRoute } from 'next'
import { locales, defaultLocale } from '@/i18n/routing'

const BASE_URL = 'https://smry.ai'
const pages = ['', '/pricing', '/guide', '/hard-paywalls', '/changelog']

type SitemapEntry = MetadataRoute.Sitemap[number]

/**
 * Generates a URL for a given page and locale
 */
function getUrl(page: string, locale: string): string {
  // Default locale (en) has no prefix
  const path = locale === defaultLocale ? page : `/${locale}${page}`
  return `${BASE_URL}${path}`
}

/**
 * Generates alternates (hreflang links) for a given page
 */
function generateSitemapAlternates(page: string): Record<string, string> {
  const alternates: Record<string, string> = {}

  for (const locale of locales) {
    alternates[locale] = getUrl(page, locale)
  }

  return alternates
}

export default function sitemap(): MetadataRoute.Sitemap {
  const urls: SitemapEntry[] = []

  for (const page of pages) {
    // Generate alternates for this page (links all locale versions together)
    const alternates = generateSitemapAlternates(page)

    for (const locale of locales) {
      urls.push({
        url: getUrl(page, locale),
        lastModified: new Date(),
        changeFrequency: page === '' ? 'daily' : 'weekly',
        priority: page === '' ? 1.0 : page === '/pricing' ? 0.9 : 0.8,
        alternates: {
          languages: alternates,
        },
      })
    }
  }

  return urls
}
