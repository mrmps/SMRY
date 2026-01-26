/**
 * Generates share URLs for various social platforms
 */

export interface ShareUrls {
  x: string;
  linkedin: string;
  reddit: string;
}

/**
 * Generates a clean smry.ai URL from an original article URL
 * @param originalUrl - The original article URL (e.g., "www.example.com/article")
 * @returns The clean smry.ai URL (e.g., "https://smry.ai/www.example.com/article")
 */
export function getSmryUrl(originalUrl: string): string {
  if (!originalUrl) {
    return "https://smry.ai/";
  }
  return `https://smry.ai/${originalUrl}`;
}

/**
 * Generates share URLs for social platforms
 * @param originalUrl - The original article URL (without protocol for X, with smry.ai prefix for others)
 * @returns Object containing share URLs for each platform
 */
export function generateShareUrls(originalUrl: string): ShareUrls {
  const smryUrl = getSmryUrl(originalUrl);

  // X/Twitter uses text parameter with short format (no https://)
  const xShareText = originalUrl ? `smry.ai/${originalUrl}` : "smry.ai/";

  return {
    x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(xShareText)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(smryUrl)}`,
    reddit: `https://www.reddit.com/submit?url=${encodeURIComponent(smryUrl)}`,
  };
}
