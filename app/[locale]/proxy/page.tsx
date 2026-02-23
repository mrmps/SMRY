import { setRequestLocale } from 'next-intl/server';
import { ProxyPageContent } from '@/components/pages/proxy-content';
import { Metadata } from 'next';
import { normalizeUrl } from '@/lib/validation/url';
import { headers } from 'next/headers';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ url?: string; sidebar?: string }>;
};

// Base URL for OG images - always use production URL for social sharing
const OG_BASE_URL = 'https://smry.ai';

// Default metadata
const DEFAULT_METADATA: Metadata = {
  title: 'Proxy | Smry',
  description: 'Read articles with Smry',
  robots: { index: false, follow: true },
  openGraph: {
    type: 'website',
    title: 'Proxy | Smry',
    description: 'Read articles with Smry',
    siteName: 'smry.ai',
    images: [{
      url: `${OG_BASE_URL}/opengraph-image`,
      width: 1200,
      height: 630,
      alt: 'smry - Read Anything, Summarize Everything',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Proxy | Smry',
    description: 'Read articles with Smry',
    images: [`${OG_BASE_URL}/opengraph-image`],
  },
};

// Generate dynamic metadata for OG tags
// OG images are generated via /api/og route handler (supports query params)
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { url: rawUrl } = await searchParams;

  if (!rawUrl) {
    return DEFAULT_METADATA;
  }

  // Normalize URL
  let normalizedUrl: string;
  try {
    normalizedUrl = normalizeUrl(rawUrl);
  } catch {
    return DEFAULT_METADATA;
  }

  // Build URLs
  const canonicalUrl = `${OG_BASE_URL}/${normalizedUrl}`;
  const ogImageUrl = `${OG_BASE_URL}/api/og?url=${encodeURIComponent(normalizedUrl)}`;

  // Get the API URL for fetching article data
  const apiBaseUrl = process.env.NEXT_PUBLIC_URL || OG_BASE_URL;

  // Extract hostname for fallback
  const hostname = new URL(normalizedUrl).hostname.replace('www.', '');

  // Use lightweight metadata endpoint (~200 bytes, Redis-only, no concurrency slot)
  // instead of /api/article/auto (2-8MB, uses concurrency slot).
  // The user's page component already fetches the full article — no need to do it here.
  try {
    const controller = new AbortController();
    const metaStart = Date.now();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const metaResponse = await fetch(
      `${apiBaseUrl}/api/article/meta?url=${encodeURIComponent(normalizedUrl)}`,
      { signal: controller.signal, cache: 'no-store' }
    );
    clearTimeout(timeoutId);

    if (metaResponse.ok) {
      const data = await metaResponse.json();
      const meta = data.meta;
      console.log(`[metadata] meta hit hostname=${hostname} source=${data.source} duration=${Date.now() - metaStart}ms`);

      const title = meta.title ? `${meta.title} | Smry` : `Article from ${hostname} | Smry`;
      const description = `Read this article from ${meta.siteName || hostname} with Smry`;

      // Include title and image in OG image URL for faster rendering (avoids extra API call in OG route)
      const ogImageWithTitle = `${OG_BASE_URL}/api/og?url=${encodeURIComponent(normalizedUrl)}&title=${encodeURIComponent(meta.title || '')}${meta.image ? `&image=${encodeURIComponent(meta.image)}` : ''}`;

      return {
        title,
        description,
        robots: { index: false, follow: true },
        openGraph: {
          type: 'article',
          title: meta.title || `Article from ${hostname}`,
          description,
          siteName: 'smry.ai',
          url: canonicalUrl,
          images: [{
            url: ogImageWithTitle,
            width: 1200,
            height: 630,
            alt: meta.title || `Article from ${hostname} on Smry`,
          }],
        },
        twitter: {
          card: 'summary_large_image',
          title: meta.title || `Article from ${hostname}`,
          description,
          images: [ogImageWithTitle],
        },
      };
    }
    console.log(`[metadata] meta miss hostname=${hostname} status=${metaResponse.status} duration=${Date.now() - metaStart}ms`);
  } catch (err) {
    console.log(`[metadata] meta error hostname=${hostname} error=${err instanceof Error ? err.message : String(err)}`);
  }

  // No cached metadata (article never fetched) or meta endpoint failed — use hostname defaults.
  // Do NOT fall back to /api/article/auto — the page component already fetches the article.
  console.log(`[metadata] using hostname fallback hostname=${hostname}`);
  return {
    title: `Article from ${hostname} | Smry`,
    description: `Read this article from ${hostname} with Smry`,
    robots: { index: false, follow: true },
    openGraph: {
      type: 'article',
      title: `Article from ${hostname}`,
      description: `Read this article from ${hostname} with Smry`,
      siteName: 'smry.ai',
      url: canonicalUrl,
      images: [{
        url: ogImageUrl,
        width: 1200,
        height: 630,
        alt: `Article from ${hostname} on Smry`,
      }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `Article from ${hostname}`,
      description: `Read this article from ${hostname} with Smry`,
      images: [ogImageUrl],
    },
  };
}

export default async function ProxyPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { url: searchParamUrl, sidebar } = await searchParams;
  setRequestLocale(locale);

  // Get article URL from header (set by proxy middleware for URL-as-path routing)
  // or fall back to searchParams (for direct /proxy?url=... access)
  const headersList = await headers();
  const headerUrl = headersList.get('x-proxy-article-url');
  const articleUrl = (headerUrl ? decodeURIComponent(headerUrl) : null) || searchParamUrl || null;


  const initialSidebarOpen = sidebar === 'true';

  return <ProxyPageContent initialSidebarOpen={initialSidebarOpen} articleUrl={articleUrl} />;
}
