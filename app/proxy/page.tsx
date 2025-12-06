import { headers } from "next/headers";
import { ProxyContent } from "@/components/features/proxy-content";
import type { Metadata } from "next";
import { redis } from "@/lib/redis";
import { normalizeUrl } from "@/lib/validation/url";

const _adCopies = [
  {
    onClickTrack:
      "Enjoy the freedom of reading without barriers, buy me a coffee! click",
    adStart: "Enjoy the freedom of reading without barriers, ",
    adEnd: "buy me a coffee!",
    link: "https://www.buymeacoffee.com/jotarokujo",
  },
  {
    onClickTrack: "Love instant summaries? Keep us going with a coffee! click",
    adStart: "Love instant summaries? ",
    adEnd: "Keep us going with a coffee!",
    link: "https://www.buymeacoffee.com/jotarokujo",
  },
  {
    onClickTrack: "Unlock premium content effortlessly, buy me a coffee! click",
    adStart: "Unlock premium content effortlessly, ",
    adEnd: "buy me a coffee!",
    link: "https://www.buymeacoffee.com/jotarokujo",
  },
  {
    onClickTrack: "Support our ad-free experience, buy me a coffee! click",
    adStart: "Support our ad-free experience, ",
    adEnd: "buy me a coffee!",
    link: "https://www.buymeacoffee.com/jotarokujo",
  },
  {
    onClickTrack:
      "Keep enjoying clutter-free summaries, buy me a coffee! click",
    adStart: "Keep enjoying clutter-free summaries, ",
    adEnd: "buy me a coffee!",
    link: "https://www.buymeacoffee.com/jotarokujo",
  },
  {
    onClickTrack: "Enjoy ad-free summaries? Buy me a coffee! click",
    adStart: "Enjoy ad-free summaries? ",
    adEnd: "Buy me a coffee!",
    link: "https://www.buymeacoffee.com/jotarokujo",
  },
  {
    onClickTrack: "Help us keep paywalls at bay, buy me a coffee! click",
    adStart: "Help us keep paywalls at bay, ",
    adEnd: "buy me a coffee!",
    link: "https://www.buymeacoffee.com/jotarokujo",
  },
  {
    onClickTrack: "Support seamless reading, buy me a coffee! click",
    adStart: "Support seamless reading, ",
    adEnd: "buy me a coffee!",
    link: "https://www.buymeacoffee.com/jotarokujo",
  },
  {
    onClickTrack: "Enjoy uninterrupted reading? Buy me a coffee! click",
    adStart: "Enjoy uninterrupted reading? ",
    adEnd: "Buy me a coffee!",
    link: "https://www.buymeacoffee.com/jotarokujo",
  },
  {
    onClickTrack: "Keep getting summaries fast, buy me a coffee! click",
    adStart: "Keep getting summaries fast, ",
    adEnd: "buy me a coffee!",
    link: "https://www.buymeacoffee.com/jotarokujo",
  },
];

type Article = {
  title: string;
  byline: null | string;
  dir: null | string;
  lang: null | string;
  content: string;
  textContent: string;
  length: number;
  siteName: null | string;
};

export type ResponseItem = {
  source: string;
  article?: Article;
  status?: string; // Assuming 'status' is optional and a string
  error?: string;
  cacheURL: string;
};

/**
 * Fetch article data from the most reliable source for metadata
 */
async function fetchArticleForMetadata(url: string): Promise<Article | null> {
  try {
    // Try sources in order: smry-fast, smry-slow, jina.ai, wayback
    const sources = ["smry-fast", "smry-slow", "jina.ai", "wayback"];
    
    // 1. Try to check lightweight metadata cache first
    for (const source of sources) {
      try {
        let cacheKey;
        if (source === 'jina.ai') {
          cacheKey = `jina.ai:${url}`;
        } else {
          cacheKey = `${source}:${url}`;
        }
        
        const metaKey = `meta:${cacheKey}`;
        const meta = await redis.get<{ title: string; siteName: string; length: number }>(metaKey);
        
        if (meta && meta.title) {
          // Return minimal article object for metadata
          // We return empty strings for content to satisfy the type but save bandwidth
          return {
            title: meta.title,
            siteName: meta.siteName || null,
            length: meta.length || 0,
            byline: null,
            dir: null,
            lang: null,
            content: "",
            textContent: "",
          } as Article;
        }
      } catch (error) {
        // Continue to next source/fallback if redis check fails
        console.warn(`Metadata cache check failed for ${source}`, error);
      }
    }

    // 2. Fallback to full fetch if not found in metadata cache
    for (const source of sources) {
      try {
        // Add timeout to prevent hanging
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
        
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_URL}/api/article?url=${encodeURIComponent(url)}&source=${source}`,
          { 
            cache: 'no-store',
            next: { revalidate: 0 },
            signal: controller.signal
          }
        );
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const data = await response.json();
          if (data.article && data.article.title) {
            return data.article;
          }
        }
      } catch {
        // Try next source
        continue;
      }
    }
    
    return null;
  } catch (error) {
    console.error("Error fetching article for metadata:", error);
    return null;
  }
}

/**
 * Generate dynamic metadata based on the article being viewed
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}): Promise<Metadata> {
  const resolvedSearchParams = await searchParams;
  const rawUrlParam = resolvedSearchParams?.url;
  const candidateUrl = Array.isArray(rawUrlParam)
    ? rawUrlParam[0]
    : rawUrlParam ?? "";

  const fallbackMetadata: Metadata = {
    title: "SMRY - Article Reader & Summarizer",
    description: "Read articles without paywalls and get AI-powered summaries",
  };

  if (!candidateUrl) {
    return fallbackMetadata;
  }

  let normalizedUrl: string;
  try {
    normalizedUrl = normalizeUrl(candidateUrl);
  } catch (error) {
    console.error("Invalid URL provided for metadata generation:", candidateUrl, error);
    return fallbackMetadata;
  }

  // Fetch article data with timeout
  const article = await fetchArticleForMetadata(normalizedUrl);
  
  // Generate basic metadata from URL as fallback
  let title = "Article";
  let siteName = "Unknown";
  
  try {
    const urlObj = new URL(normalizedUrl);
    siteName = urlObj.hostname.replace('www.', '');
    // Extract a reasonable title from URL path
    const pathParts = urlObj.pathname.split('/').filter(Boolean);
    if (pathParts.length > 0) {
      title = pathParts[pathParts.length - 1]
        .replace(/[-_]/g, ' ')
        .replace(/\.[^/.]+$/, '') // Remove file extension
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ') || 'Article';
    }
  } catch (error) {
    console.error("Error parsing URL for fallback metadata:", error);
  }
  
  // Override with actual article data if available
  if (article) {
    title = article.title || title;
    siteName = article.siteName || siteName;
  }
  
  const description = (article && article.textContent)
    ? article.textContent.slice(0, 160).trim() + "..."
    : `Read "${title}" from ${siteName} on SMRY - No paywalls, AI summaries available`;

  return {
    title: `${title} - SMRY`,
    description,
    openGraph: {
      title: title,
      description: description,
      url: `${process.env.NEXT_PUBLIC_URL}/proxy?url=${encodeURIComponent(normalizedUrl)}`,
      siteName: "SMRY",
      type: "article",
      images: [
        {
          url: "https://smry.ai/og-image.png",
          width: 1200,
          height: 630,
          alt: "Smry - AI Summarizer and Free Paywall Remover",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: title,
      description: description,
      images: ["https://smry.ai/og-image.png"],
    },
  };
}

export default async function Page({
  params: _params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const headersList = await headers();
  
  // In Next.js 16, headers() returns a Headers object that needs to be accessed differently
  let ip = "default_ip";
  try {
    // Try to access the header value - headers might be a Headers object or a plain object
    if (headersList && typeof headersList.get === 'function') {
      ip = headersList.get("x-real-ip") || "default_ip";
    } else if (headersList && typeof headersList === 'object') {
      // Fallback for plain object access or iterator
      const headersObj = Object.fromEntries(headersList as any);
      ip = headersObj["x-real-ip"] || "default_ip";
    }
  } catch (error) {
    console.error("Error accessing headers:", error);
    ip = "default_ip";
  }

  // In Next.js 15+, searchParams and params are now Promises that need to be awaited
  const resolvedSearchParams = await searchParams;
  const rawUrlParam = resolvedSearchParams?.url;
  const candidateUrl = Array.isArray(rawUrlParam)
    ? rawUrlParam[0]
    : rawUrlParam ?? "";

  if (!candidateUrl) {
    return (
      <div className="p-4 text-muted-foreground">Please provide a URL to load an article.</div>
    );
  }

  let normalizedUrl: string;
  try {
    normalizedUrl = normalizeUrl(candidateUrl);
  } catch (error) {
    console.error(
      "URL parameter is invalid",
      candidateUrl,
      resolvedSearchParams?.url,
      error
    );
    const message =
      error instanceof Error
        ? error.message
        : "Please enter a valid URL (e.g. example.com or https://example.com).";
    return (
      <div className="mt-20 px-4 text-center text-muted-foreground">
        {message}
      </div>
    );
  }

  // if the url contains "orlandosentinel.com" then we should return nothing and let the user know that the orlando sentinel article is not available

  if (normalizedUrl.includes("orlandosentinel.com")) {
    return (
      <div className="mt-20">
        Sorry, articles from the orlando sentinel are not available
      </div>
    );
  }

  return (
    <ProxyContent
      url={normalizedUrl}
      ip={ip}
    />
  );
}
