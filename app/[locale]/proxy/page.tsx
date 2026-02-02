import { setRequestLocale } from 'next-intl/server';
import { ProxyPageContent } from '@/components/pages/proxy-content';
import { Metadata } from 'next';
import { normalizeUrl } from '@/lib/validation/url';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ url?: string; sidebar?: string }>;
};

const DEFAULT_METADATA: Metadata = {
  title: 'Proxy | Smry',
  description: 'Read articles with Smry',
};

// Generate dynamic metadata for OG tags
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

  // Get the API URL - only fetch if we have a proper API URL configured
  const apiBaseUrl = process.env.NEXT_PUBLIC_URL;

  // Build the canonical URL (the clean shareable format)
  const canonicalUrl = `${process.env.NEXT_PUBLIC_URL || 'https://smry.ai'}/${normalizedUrl}`;

  // If no API URL is configured, return basic metadata with URL info
  if (!apiBaseUrl) {
    const hostname = new URL(normalizedUrl).hostname.replace('www.', '');
    return {
      title: `Article from ${hostname} | Smry`,
      description: `Read this article from ${hostname} with Smry`,
      openGraph: {
        type: 'article',
        title: `Article from ${hostname}`,
        description: `Read this article from ${hostname} with Smry`,
        siteName: 'smry.ai',
        url: canonicalUrl,
      },
      twitter: {
        card: 'summary',
        title: `Article from ${hostname}`,
        description: `Read this article from ${hostname} with Smry`,
      },
    };
  }

  try {
    // Fetch article data for metadata with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const response = await fetch(
      `${apiBaseUrl}/api/article/auto?url=${encodeURIComponent(normalizedUrl)}`,
      {
        signal: controller.signal,
        next: { revalidate: 3600 }, // Cache for 1 hour
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error('Failed to fetch article');
    }

    const data = await response.json();
    const article = data.article;

    if (!article) {
      return DEFAULT_METADATA;
    }

    const title = article.title ? `${article.title} | Smry` : 'Proxy | Smry';
    const description = article.textContent
      ? article.textContent.slice(0, 200).trim() + '...'
      : 'Read articles with Smry';

    const metadata: Metadata = {
      title,
      description,
      openGraph: {
        type: 'article',
        title: article.title || 'Smry',
        description,
        siteName: 'smry.ai',
        url: canonicalUrl,
      },
      twitter: {
        card: 'summary_large_image',
        title: article.title || 'Smry',
        description,
      },
    };

    // Add OG image if available
    if (article.image) {
      metadata.openGraph = {
        ...metadata.openGraph,
        images: [{ url: article.image }],
      };
      metadata.twitter = {
        ...metadata.twitter,
        images: [article.image],
      };
    }

    return metadata;
  } catch {
    // If fetch fails, return basic metadata without logging error
    // This is expected in development when API URL is not set
    const hostname = new URL(normalizedUrl).hostname.replace('www.', '');
    return {
      title: `Article from ${hostname} | Smry`,
      description: `Read this article from ${hostname} with Smry`,
    };
  }
}

export default async function ProxyPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { sidebar } = await searchParams;
  setRequestLocale(locale);

  // Parse sidebar param on server to prevent layout shift
  const initialSidebarOpen = sidebar === 'true';

  return <ProxyPageContent initialSidebarOpen={initialSidebarOpen} />;
}
