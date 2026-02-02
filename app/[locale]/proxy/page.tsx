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
  openGraph: {
    type: 'website',
    title: 'Proxy | Smry',
    description: 'Read articles with Smry',
    siteName: 'smry.ai',
    images: [
      {
        url: 'https://smry.ai/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'smry - Read Anything, Summarize Everything',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Proxy | Smry',
    description: 'Read articles with Smry',
    images: ['https://smry.ai/opengraph-image'],
  },
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
        images: [
          {
            url: 'https://smry.ai/opengraph-image',
            width: 1200,
            height: 630,
            alt: 'smry - Read Anything, Summarize Everything',
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title: `Article from ${hostname}`,
        description: `Read this article from ${hostname} with Smry`,
        images: ['https://smry.ai/opengraph-image'],
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

    // Add OG image - use article image if available, otherwise use default
    const defaultImage = {
      url: 'https://smry.ai/opengraph-image',
      width: 1200,
      height: 630,
      alt: 'smry - Read Anything, Summarize Everything',
    };

    if (article.image) {
      try {
        // Ensure image URL is absolute
        let imageUrl: string;
        if (article.image.startsWith('http://') || article.image.startsWith('https://')) {
          imageUrl = article.image;
        } else if (article.image.startsWith('//')) {
          // Protocol-relative URL
          imageUrl = `https:${article.image}`;
        } else if (article.image.startsWith('/')) {
          // Absolute path - resolve relative to article URL
          imageUrl = new URL(article.image, normalizedUrl).toString();
        } else {
          // Relative path - resolve relative to article URL
          imageUrl = new URL(article.image, normalizedUrl).toString();
        }

        // Validate the resulting URL is valid
        new URL(imageUrl);

        metadata.openGraph = {
          ...metadata.openGraph,
          images: [{ url: imageUrl }],
        };
        metadata.twitter = {
          ...metadata.twitter,
          images: [{ url: imageUrl }],
        };
      } catch {
        // If image URL is invalid, fall back to default
        metadata.openGraph = {
          ...metadata.openGraph,
          images: [defaultImage],
        };
        metadata.twitter = {
          ...metadata.twitter,
          images: ['https://smry.ai/opengraph-image'],
        };
      }
    } else {
      // No article image - use default OG image
      metadata.openGraph = {
        ...metadata.openGraph,
        images: [defaultImage],
      };
      metadata.twitter = {
        ...metadata.twitter,
        images: ['https://smry.ai/opengraph-image'],
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
      openGraph: {
        type: 'article',
        title: `Article from ${hostname} | Smry`,
        description: `Read this article from ${hostname} with Smry`,
        siteName: 'smry.ai',
        url: canonicalUrl,
        images: [
          {
            url: 'https://smry.ai/opengraph-image',
            width: 1200,
            height: 630,
            alt: 'smry - Read Anything, Summarize Everything',
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title: `Article from ${hostname} | Smry`,
        description: `Read this article from ${hostname} with Smry`,
        images: ['https://smry.ai/opengraph-image'],
      },
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
