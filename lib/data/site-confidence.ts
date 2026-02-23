/**
 * Site Confidence Data
 *
 * Static map of ~100 top domains with their historical success rate tiers.
 * Used to show a subtle confidence indicator on the homepage below the URL input.
 *
 * Tier classification based on analytics data:
 * - works-great: 95%+ success rate
 * - usually-works: 60-95% success rate
 * - limited: <60% success rate (but >0% — 0% sites are in hard-paywalls.ts)
 *
 * Last updated: 2026-02-23
 */

export type ConfidenceTier = "works-great" | "usually-works" | "limited";

const SITE_CONFIDENCE: Record<string, ConfidenceTier> = {
  // works-great (95%+)
  "theatlantic.com": "works-great",
  "smh.com.au": "works-great",
  "newyorker.com": "works-great",
  "bbc.com": "works-great",
  "bbc.co.uk": "works-great",
  "theguardian.com": "works-great",
  "wired.com": "works-great",
  "arstechnica.com": "works-great",
  "thedailybeast.com": "works-great",
  "time.com": "works-great",
  "theconversation.com": "works-great",
  "foreignpolicy.com": "works-great",
  "thehill.com": "works-great",
  "salon.com": "works-great",
  "slate.com": "works-great",
  "vox.com": "works-great",
  "theverge.com": "works-great",
  "techcrunch.com": "works-great",
  "medium.com": "works-great",
  "towardsdatascience.com": "works-great",
  "nymag.com": "works-great",
  "vanityfair.com": "works-great",
  "rollingstone.com": "works-great",
  "nationalgeographic.com": "works-great",
  "newscientist.com": "works-great",
  "scientificamerican.com": "works-great",
  "nature.com": "works-great",
  "cnbc.com": "works-great",
  "businessinsider.com": "works-great",
  "insider.com": "works-great",
  "hbr.org": "works-great",
  "thetimes.co.uk": "works-great",
  "independent.co.uk": "works-great",
  "spectator.co.uk": "works-great",
  "theaustralian.com.au": "works-great",
  "afr.com": "works-great",
  "japantimes.co.jp": "works-great",
  "scmp.com": "works-great",
  "straitstimes.com": "works-great",
  "lemonde.fr": "works-great",
  "spiegel.de": "works-great",
  "corriere.it": "works-great",
  "elpais.com": "works-great",

  // usually-works (60-95%)
  "cnn.com": "usually-works",
  "reuters.com": "usually-works",
  "apnews.com": "usually-works",
  "elespanol.com": "usually-works",
  "share.google": "usually-works",
  "news.google.com": "usually-works",
  "yahoo.com": "usually-works",
  "news.yahoo.com": "usually-works",
  "usatoday.com": "usually-works",
  "latimes.com": "usually-works",
  "chicagotribune.com": "usually-works",
  "sfchronicle.com": "usually-works",
  "bostonglobe.com": "usually-works",
  "seattletimes.com": "usually-works",
  "dallasnews.com": "usually-works",
  "miamiherald.com": "usually-works",
  "denverpost.com": "usually-works",
  "mercurynews.com": "usually-works",
  "politico.com": "usually-works",
  "axios.com": "usually-works",
  "thenation.com": "usually-works",
  "newrepublic.com": "usually-works",
  "motherjones.com": "usually-works",
  "theintercept.com": "usually-works",
  "propublica.org": "usually-works",
  "theathletic.com": "usually-works",
  "espn.com": "usually-works",
  "zdnet.com": "usually-works",
  "cnet.com": "usually-works",
  "technologyreview.com": "usually-works",
  "theinformation.com": "usually-works",

  // limited (<60%)
  "nytimes.com": "limited",
  "wsj.com": "limited",
  "washingtonpost.com": "limited",
  "bloomberg.com": "limited",
  "forbes.com": "limited",
  "economist.com": "limited",
  "ft.com": "limited",
  "barrons.com": "limited",
  "seekingalpha.com": "limited",
  "marketwatch.com": "limited",
  "investopedia.com": "limited",
};

/**
 * Extract a bare domain from user input (partial or full URL).
 * Strips protocol, www., path, query, and fragment.
 */
export function extractDomainFromInput(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Remove protocol if present
  let domain = trimmed.replace(/^https?:\/\//i, "");

  // Remove path, query, fragment
  domain = domain.split("/")[0]!;
  domain = domain.split("?")[0]!;
  domain = domain.split("#")[0]!;

  // Strip www.
  domain = domain.replace(/^www\./i, "");

  // Must have at least one dot to be a domain
  if (!domain.includes(".")) return null;

  return domain.toLowerCase();
}

/**
 * Look up the confidence tier for a user's URL input.
 * Returns null if the domain is not in our map (unknown site).
 */
export function getSiteConfidence(
  input: string
): { tier: ConfidenceTier; domain: string } | null {
  const domain = extractDomainFromInput(input);
  if (!domain) return null;

  const tier = SITE_CONFIDENCE[domain];
  if (!tier) return null;

  return { tier, domain };
}
