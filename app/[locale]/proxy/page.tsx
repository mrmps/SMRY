import { setRequestLocale } from 'next-intl/server';
import { ProxyPageContent } from '@/components/pages/proxy-content';
import { Metadata } from 'next';
import { normalizeUrl } from '@/lib/validation/url';

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

  try {
    // Fetch article data for metadata with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(
      `${apiBaseUrl}/api/article/auto?url=${encodeURIComponent(normalizedUrl)}`,
      {
        signal: controller.signal,
        next: { revalidate: 3600 },
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error('Failed to fetch article');
    }

    const data = await response.json();
    const article = data.article;

    if (!article) {
      // No article data - use hostname-based metadata
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

    const title = article.title ? `${article.title} | Smry` : 'Proxy | Smry';
    const description = article.textContent
      ? article.textContent.slice(0, 200).trim() + '...'
      : 'Read articles with Smry';

    // Include title in OG image URL for faster rendering (avoids extra API call)
    const ogImageWithTitle = `${OG_BASE_URL}/api/og?url=${encodeURIComponent(normalizedUrl)}&title=${encodeURIComponent(article.title || '')}`;

    return {
      title,
      description,
      robots: { index: false, follow: true },
      openGraph: {
        type: 'article',
        title: article.title || 'Smry',
        description,
        siteName: 'smry.ai',
        url: canonicalUrl,
        images: [{
          url: ogImageWithTitle,
          width: 1200,
          height: 630,
          alt: article.title || 'Article on Smry',
        }],
      },
      twitter: {
        card: 'summary_large_image',
        title: article.title || 'Smry',
        description,
        images: [ogImageWithTitle],
      },
    };
  } catch {
    // Fetch failed - return basic metadata
    return {
      title: `Article from ${hostname} | Smry`,
      description: `Read this article from ${hostname} with Smry`,
      robots: { index: false, follow: true },
      openGraph: {
        type: 'article',
        title: `Article from ${hostname} | Smry`,
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
        title: `Article from ${hostname} | Smry`,
        description: `Read this article from ${hostname} with Smry`,
        images: [ogImageUrl],
      },
    };
  }
}

export default async function ProxyPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { sidebar } = await searchParams;
  setRequestLocale(locale);

  const initialSidebarOpen = sidebar === 'true';

  return <ProxyPageContent initialSidebarOpen={initialSidebarOpen} />;
}
