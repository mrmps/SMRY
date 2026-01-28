import { MetadataRoute } from 'next'

const locales = ['en', 'pt', 'de', 'zh', 'es', 'nl'] as const
const pages = ['', '/pricing', '/guide', '/hard-paywalls', '/changelog', '/history']

export default function sitemap(): MetadataRoute.Sitemap {
  const urls: MetadataRoute.Sitemap = []

  for (const page of pages) {
    for (const locale of locales) {
      // Default locale (en) has no prefix
      const path = locale === 'en' ? page : `/${locale}${page}`
      urls.push({
        url: `https://smry.ai${path}`,
        lastModified: new Date(),
        changeFrequency: page === '' ? 'daily' : 'weekly',
        priority: page === '' ? 1.0 : page === '/pricing' ? 0.9 : 0.8,
      })
    }
  }

  return urls
}
