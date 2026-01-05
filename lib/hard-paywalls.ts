/**
 * Hard Paywalls Configuration
 *
 * Hard paywalls are sites that require paid subscriptions and cannot be bypassed
 * through any technical means. These sites actively block all extraction methods
 * and there is no ethical way to access their content without paying.
 *
 * This list is maintained based on analytics data showing 0% success rates
 * across all extraction sources (smry-fast, smry-slow, wayback, jina.ai).
 *
 * To add a site: Verify it has <5% success rate across all sources in Clickhouse
 * To remove a site: Verify the site has changed their paywall policy
 *
 * Last updated: 2026-01-05
 */

export interface HardPaywallSite {
  hostname: string;
  name: string;
  // Optional: specific paths that are paywalled (if not all content)
  paywallPaths?: string[];
  // When this was added to the blocklist
  addedAt: string;
  // Notes about why this is a hard paywall
  notes?: string;
}

/**
 * List of sites with hard paywalls that cannot be bypassed.
 * These sites have 0% success rate across all extraction methods.
 */
export const HARD_PAYWALL_SITES: HardPaywallSite[] = [
  {
    hostname: "www.bloomberg.com",
    name: "Bloomberg",
    addedAt: "2026-01-05",
    notes: "0% success on all sources. Requires Bloomberg subscription.",
  },
  {
    hostname: "www.barrons.com",
    name: "Barron's",
    addedAt: "2026-01-05",
    notes: "0% success on all sources. Requires Dow Jones/WSJ subscription.",
  },
  {
    hostname: "www.ft.com",
    name: "Financial Times",
    addedAt: "2026-01-05",
    notes: "Very low success rate. Premium financial news paywall.",
  },
  {
    hostname: "www.economist.com",
    name: "The Economist",
    addedAt: "2026-01-05",
    notes: "Hard paywall with metered access. Most content blocked.",
  },
  {
    hostname: "www.wsj.com",
    name: "Wall Street Journal",
    addedAt: "2026-01-05",
    notes: "Some articles accessible via wayback, but most are hard paywalled.",
  },
  {
    hostname: "www.thetimes.com",
    name: "The Times (UK)",
    addedAt: "2026-01-05",
    notes: "0% success. Strict hard paywall.",
  },
  {
    hostname: "www.telegraph.co.uk",
    name: "The Telegraph",
    addedAt: "2026-01-05",
    notes: "Hard paywall on most content.",
  },
  {
    hostname: "theathletic.com",
    name: "The Athletic",
    addedAt: "2026-01-05",
    notes: "NYT-owned sports site with strict paywall.",
  },
  {
    hostname: "www.theatlantic.com",
    name: "The Atlantic",
    addedAt: "2026-01-05",
    notes: "Metered paywall, most content blocked.",
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
 * Error message for hard paywall sites
 */
export function getHardPaywallError(hostname: string): {
  error: string;
  type: "PAYWALL_ERROR";
  hostname: string;
  learnMoreUrl: string;
} {
  const site = getHardPaywallInfo(hostname);
  const siteName = site?.name || hostname;

  return {
    error: `${siteName} uses a hard paywall that cannot be bypassed. This site requires a paid subscription to access content.`,
    type: "PAYWALL_ERROR",
    hostname,
    learnMoreUrl: "/hard-paywalls",
  };
}
