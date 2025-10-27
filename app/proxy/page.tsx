import { headers } from "next/headers";
import Ad from "@/components/ad";
import { ProxyContent } from "@/components/proxy-content";
import type { Metadata } from "next";

const adCopies = [
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
    // Try sources in order: direct, jina.ai, wayback
    const sources = ["direct", "jina.ai", "wayback"];
    
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
      } catch (error) {
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
  const url = resolvedSearchParams?.url as string;
  
  if (!url) {
    return {
      title: "SMRY - Article Reader & Summarizer",
      description: "Read articles without paywalls and get AI-powered summaries",
    };
  }

  // Fetch article data with timeout
  const article = await fetchArticleForMetadata(url);
  
  // Generate basic metadata from URL as fallback
  let title = "Article";
  let siteName = "Unknown";
  
  try {
    const urlObj = new URL(url);
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

  // Generate OG image URL using our own API
  const ogImageUrl = `${process.env.NEXT_PUBLIC_URL}/api/og?title=${encodeURIComponent(title)}&siteName=${encodeURIComponent(siteName)}`;

  return {
    title: `${title} - SMRY`,
    description,
    openGraph: {
      title: title,
      description: description,
      url: `${process.env.NEXT_PUBLIC_URL}/proxy?url=${encodeURIComponent(url)}`,
      siteName: "SMRY",
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: title,
      description: description,
      images: [ogImageUrl],
    },
  };
}

export default async function Page({
  params,
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
  const url = resolvedSearchParams?.url as string;

  if (!url) {
    // Handle the case where URL is not provided or not a string
    console.error(
      "URL parameter is missing or invalid",
      url,
      resolvedSearchParams?.url,
      resolvedSearchParams
    );
  }

  // if the url contains "orlandosentinel.com" then we should return nothing and let the user know that the orlando sentinel article is not available

  if (url?.includes("orlandosentinel.com")) {
    return (
      <div className="mt-20">
        Sorry, articles from the orlando sentinel are not available
      </div>
    );
  }

  // Move random number generation to client-side or use a deterministic value
  const adSelection = 5; // Using a fixed value to avoid Math.random() during render

  return (
    <div className="mt-20">
      <Ad
        link={adCopies[adSelection].link}
        onClickTrack={adCopies[adSelection].onClickTrack}
        adStart={adCopies[adSelection].adStart}
        adEnd={adCopies[adSelection].adEnd}
      />

      <div className="px-4 py-8 md:py-12 mt-20">
        <div className="mx-auto space-y-10 max-w-prose">
          <main className="prose">
            {url ? (
              <ProxyContent url={url} ip={ip} />
            ) : (
              <div className="text-gray-600">No URL provided</div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
