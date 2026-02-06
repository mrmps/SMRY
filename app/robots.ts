import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/api/og/*',
          '/proxy',           // Allow proxy pages for OG crawlers (Twitter, Facebook, etc.)
          '/*/proxy',         // Allow locale-prefixed proxy pages (e.g., /de/proxy)
        ],
        disallow: [
          '/api/proxy',       // Block API proxy endpoint (not needed for crawlers)
          '/admin',
          '/history',
        ],
      },
    ],
    sitemap: 'https://smry.ai/sitemap.xml',
  };
}
