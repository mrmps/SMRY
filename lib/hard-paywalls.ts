/**
 * Hard Paywalls Configuration
 *
 * Hard paywalls are sites that require paid subscriptions and cannot be bypassed
 * through any technical means. These sites actively block all extraction methods
 * and there is no ethical way to access their content without paying.
 *
 * This list is maintained based on analytics data showing 0% success rates
 * across all extraction sources (smry-fast, smry-slow, wayback).
 *
 * To add a site: Verify it has <5% success rate across all sources in Clickhouse
 * To remove a site: Verify the site has changed their paywall policy
 *
 * Last updated: 2026-01-06
 */

export type PaywallCategory =
  | "news"           // Traditional news/financial publications
  | "creator"        // Creator platforms (Patreon, OnlyFans, etc.)
  | "social"         // Private social media content
  | "document"       // Document download sites
  | "other";

export interface HardPaywallSite {
  hostname: string;
  name: string;
  // Category of paywall for user-friendly messaging
  category: PaywallCategory;
  // Optional: specific paths that are paywalled (if not all content)
  paywallPaths?: string[];
  // When this was added to the blocklist
  addedAt: string;
  // Notes about why this is a hard paywall
  notes?: string;
}

/**
 * User-friendly descriptions for each paywall category
 */
export const CATEGORY_INFO: Record<PaywallCategory, { title: string; description: string; errorMessage: string }> = {
  news: {
    title: "News & Publications",
    description: "These publications require paid subscriptions to access articles. Content is only delivered to authenticated subscribers.",
    errorMessage: "This publication requires a paid subscription. The article content is not available without an active subscription.",
  },
  creator: {
    title: "Creator Platforms",
    description: "Content on these platforms is uploaded directly by creators for their paying subscribers. There is no public version of this content to access.",
    errorMessage: "This is a creator platform where content is exclusively for paying subscribers. The content you're looking for was uploaded by a creator for their supporters and is not publicly available.",
  },
  social: {
    title: "Private Social Media",
    description: "Content on private social media accounts is only visible to approved followers or friends. This is not a paywall but a privacy setting.",
    errorMessage: "This appears to be private social media content that's only visible to approved followers. SMRY cannot access content from private accounts.",
  },
  document: {
    title: "Document Download Sites",
    description: "These sites require payment to download documents. The files are stored on their servers and require purchase to access.",
    errorMessage: "This document requires payment to download. The file is hosted on a paid platform and cannot be accessed without purchasing it.",
  },
  other: {
    title: "Other Paywalled Sites",
    description: "These sites have access restrictions that prevent content extraction.",
    errorMessage: "This site has access restrictions that cannot be bypassed.",
  },
};

/**
 * List of sites with hard paywalls that cannot be bypassed.
 * These sites have 0% success rate across all extraction methods.
 */
export const HARD_PAYWALL_SITES: HardPaywallSite[] = [
  // News/Financial
  {
    hostname: "www.barrons.com",
    name: "Barron's",
    category: "news",
    addedAt: "2026-01-05",
    notes: "0% success on all sources. Requires Dow Jones/WSJ subscription.",
  },

  // Creator Platforms
  {
    hostname: "patreon.com",
    name: "Patreon",
    category: "creator",
    addedAt: "2026-01-06",
  },
  {
    hostname: "onlyfans.com",
    name: "OnlyFans",
    category: "creator",
    addedAt: "2026-01-06",
  },
  {
    hostname: "fansly.com",
    name: "Fansly",
    category: "creator",
    addedAt: "2026-01-06",
  },
  {
    hostname: "fantia.jp",
    name: "Fantia",
    category: "creator",
    addedAt: "2026-01-06",
  },
  {
    hostname: "subscribestar.adult",
    name: "SubscribeStar Adult",
    category: "creator",
    addedAt: "2026-01-06",
  },
  {
    hostname: "ko-fi.com",
    name: "Ko-fi",
    category: "creator",
    addedAt: "2026-01-06",
    notes: "Exclusive posts require payment.",
  },
  {
    hostname: "fanvue.com",
    name: "Fanvue",
    category: "creator",
    addedAt: "2026-01-06",
  },
  {
    hostname: "fanfix.io",
    name: "Fanfix",
    category: "creator",
    addedAt: "2026-01-06",
  },
  {
    hostname: "fanplace.com",
    name: "Fanplace",
    category: "creator",
    addedAt: "2026-01-06",
  },
  {
    hostname: "afdian.com",
    name: "Afdian",
    category: "creator",
    addedAt: "2026-01-06",
  },
  {
    hostname: "cafecito.app",
    name: "Cafecito",
    category: "creator",
    addedAt: "2026-01-06",
  },
  {
    hostname: "passes.com",
    name: "Passes",
    category: "creator",
    addedAt: "2026-01-06",
  },
  {
    hostname: "gumroad.com",
    name: "Gumroad",
    category: "creator",
    addedAt: "2026-01-06",
    notes: "Paid products require purchase.",
  },
  {
    hostname: "itch.io",
    name: "itch.io",
    category: "creator",
    addedAt: "2026-01-06",
    notes: "Paid games require purchase.",
  },

  // Private Social
  {
    hostname: "facebook.com",
    name: "Facebook",
    category: "social",
    addedAt: "2026-01-06",
    notes: "Private posts require login/friendship.",
  },
  {
    hostname: "www.facebook.com",
    name: "Facebook",
    category: "social",
    addedAt: "2026-01-06",
    notes: "Private posts require login/friendship.",
  },
  {
    hostname: "instagram.com",
    name: "Instagram",
    category: "social",
    addedAt: "2026-01-06",
    notes: "Private accounts require login/following.",
  },
  {
    hostname: "www.instagram.com",
    name: "Instagram",
    category: "social",
    addedAt: "2026-01-06",
    notes: "Private accounts require login/following.",
  },

  // Document Downloads
  {
    hostname: "doc88.com",
    name: "Doc88",
    category: "document",
    addedAt: "2026-01-06",
  },
  {
    hostname: "www.doc88.com",
    name: "Doc88",
    category: "document",
    addedAt: "2026-01-06",
  },
  {
    hostname: "docin.com",
    name: "Docin",
    category: "document",
    addedAt: "2026-01-06",
  },
  {
    hostname: "www.docin.com",
    name: "Docin",
    category: "document",
    addedAt: "2026-01-06",
  },
  {
    hostname: "wenku.baidu.com",
    name: "Baidu Wenku",
    category: "document",
    addedAt: "2026-01-06",
  },
  {
    hostname: "book118.com",
    name: "Book118",
    category: "document",
    addedAt: "2026-01-06",
  },
  {
    hostname: "www.book118.com",
    name: "Book118",
    category: "document",
    addedAt: "2026-01-06",
  },
  {
    hostname: "mediafire.com",
    name: "MediaFire",
    category: "document",
    addedAt: "2026-01-06",
    notes: "Premium files require payment.",
  },
  {
    hostname: "www.mediafire.com",
    name: "MediaFire",
    category: "document",
    addedAt: "2026-01-06",
    notes: "Premium files require payment.",
  },
];

/**
 * Set for O(1) hostname lookup
 */
const HARD_PAYWALL_HOSTNAMES = new Set(
  HARD_PAYWALL_SITES.map((site) => site.hostname)
);

/**
 * Check if a hostname is a hard paywall site
 */
export function isHardPaywall(hostname: string): boolean {
  // Normalize hostname (remove www. if checking against non-www version)
  const normalized = hostname.toLowerCase();
  return HARD_PAYWALL_HOSTNAMES.has(normalized);
}

/**
 * Get details about a hard paywall site
 */
export function getHardPaywallInfo(hostname: string): HardPaywallSite | undefined {
  const normalized = hostname.toLowerCase();
  return HARD_PAYWALL_SITES.find((site) => site.hostname === normalized);
}

/**
 * Error message for hard paywall sites - returns category-specific messaging
 */
export function getHardPaywallError(hostname: string): {
  error: string;
  type: "PAYWALL_ERROR";
  hostname: string;
  siteName: string;
  category: PaywallCategory;
  learnMoreUrl: string;
} {
  const site = getHardPaywallInfo(hostname);
  const siteName = site?.name || hostname;
  const category = site?.category || "other";
  const categoryInfo = CATEGORY_INFO[category];

  return {
    error: categoryInfo.errorMessage,
    type: "PAYWALL_ERROR",
    hostname,
    siteName,
    category,
    learnMoreUrl: "/hard-paywalls",
  };
}

/**
 * Get sites grouped by category for display
 */
export function getSitesGroupedByCategory(): Record<PaywallCategory, HardPaywallSite[]> {
  const grouped: Record<PaywallCategory, HardPaywallSite[]> = {
    news: [],
    creator: [],
    social: [],
    document: [],
    other: [],
  };

  // Deduplicate by name (to avoid showing both www and non-www versions)
  const seen = new Set<string>();
  for (const site of HARD_PAYWALL_SITES) {
    if (!seen.has(site.name)) {
      seen.add(site.name);
      grouped[site.category].push(site);
    }
  }

  return grouped;
}
