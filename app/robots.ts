import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/api/og/*'],
        disallow: ['/api/proxy', '/proxy', '/admin', '/history'],
      },
    ],
    sitemap: 'https://smry.ai/sitemap.xml',
  };
}
