const BASE_URL = "https://smry.ai";

/**
 * Routes eligible for LLM content negotiation.
 * These are static marketing/info pages, not dynamic reader pages.
 */
export const LLM_ELIGIBLE_ROUTES = [
  "/",
  "/pricing",
  "/guide",
  "/hard-paywalls",
  "/changelog",
] as const;

const LLMS_TXT_BLOCKQUOTE = `> ## Documentation Index
> Fetch the complete documentation index at: ${BASE_URL}/llms.txt
> Full documentation: ${BASE_URL}/llms-full.txt
> Use these files to discover all available pages.
`;

/**
 * Returns curated Markdown content for a given page route.
 * Returns null for routes that are not eligible (proxy, history, chat, etc.).
 */
export function getMarkdownForRoute(path: string): string | null {
  switch (path) {
    case "/":
      return getHomepageMarkdown();
    case "/pricing":
      return getPricingMarkdown();
    case "/guide":
      return getGuideMarkdown();
    case "/hard-paywalls":
      return getHardPaywallsMarkdown();
    case "/changelog":
      return getChangelogMarkdown();
    default:
      return null;
  }
}

function getHomepageMarkdown(): string {
  return `${LLMS_TXT_BLOCKQUOTE}
# SMRY — Read Any Article, Bypass Any Paywall

[SMRY](${BASE_URL}) is a free paywall bypass and article reader trusted by **300,000+ readers monthly**. Paste any paywalled article link and get the full text plus an AI summary. No account required, no browser extension needed.

## How It Works

SMRY fetches articles from **3 sources simultaneously** to maximize success:

1. **Direct Access (smry-fast)** — Fetches the original URL directly
2. **Premium Proxy (smry-slow)** — Uses intelligent article extraction via proxy
3. **Wayback Machine** — Retrieves archived versions from archive.org

The first source to return complete content wins. This parallel approach achieves a **76% success rate** on major publications.

## Key Features

- **Paywall Bypass** — Works with 1,000+ publications including NYT, WSJ, Bloomberg, The Atlantic, Washington Post, Medium, and more
- **Clean Reading** — Removes paywalls, popups, cookie banners, and ads for a distraction-free experience
- **AI Summaries** — Get key points in seconds, available in 8 languages (English, German, Spanish, French, Portuguese, Dutch, Chinese, Japanese)
- **No Signup Required** — Free to use immediately, no account or browser extension needed
- **Chat with Articles** — Ask AI questions about any article you read
- **Reading History** — Track and search everything you've read

## Quick Start

**Option 1:** Prepend \`smry.ai/\` to any article URL:
\`\`\`
smry.ai/nytimes.com/2025/01/some-article
\`\`\`

**Option 2:** Paste a URL at [smry.ai](${BASE_URL})

**Option 3:** Use the bookmarklet — drag it to your bookmarks bar for one-click access on any page

## Stats

- **300,000+** monthly active readers
- **2.4M** articles read per month
- **76%** success rate on major sites
- **4.9/5** star user rating
- **1,000+** supported publications

## Links

- [Homepage](${BASE_URL})
- [Pricing](${BASE_URL}/pricing)
- [Paywall Bypass Guide](${BASE_URL}/guide)
- [Understanding Hard Paywalls](${BASE_URL}/hard-paywalls)
- [Changelog](${BASE_URL}/changelog)
- [GitHub (Open Source)](https://github.com/mrmps/SMRY)
`;
}

function getPricingMarkdown(): string {
  return `${LLMS_TXT_BLOCKQUOTE}
# SMRY Pricing

SMRY offers a free tier and a Pro subscription for power readers.

## Free Plan

- **20 articles per day**
- Limited AI summaries per day
- Basic reading history (limited articles stored)
- Ad-supported reading experience
- **Cost: Free forever, no signup required**

## Pro Plan

- **Unlimited articles**
- **Unlimited AI summaries** with premium models (Claude, Gemini, GPT)
- **Unlimited reading history** with full-text search
- **Ad-free** clean reading experience
- **Bypass detection indicator** — know instantly if the full article was retrieved
- **Priority support**
- **Cost: ~$3–5/month** (yearly billing available at 50% discount)
- **7-day free trial**, cancel anytime, 30-day money-back guarantee

## Value Comparison

Individual news subscriptions cost $100+/month:
- NYT: $17/mo
- WSJ: $20/mo
- Bloomberg: $35/mo
- Plus many more...

SMRY Pro gives access to 1,000+ publications from **~$3/month** — saving readers **$89+/month** on average.

## Links

- [View pricing page](${BASE_URL}/pricing)
- [Homepage](${BASE_URL})
`;
}

function getGuideMarkdown(): string {
  return `${LLMS_TXT_BLOCKQUOTE}
# SMRY Paywall Bypass Guide

## How Paywall Bypass Works

There are two types of paywalls:

### Soft Paywalls (SMRY works)

Content is loaded in the page but hidden by JavaScript overlays, popups, or CSS. Common on most major news sites. Signs of a soft paywall:
- Some content visible before being obscured
- Content accessible to search engine crawlers (for SEO)
- Incognito mode sometimes reveals content

SMRY bypasses soft paywalls by fetching content from multiple sources simultaneously:
1. **Direct fetch** with browser-like headers
2. **Premium proxy** using intelligent article extraction
3. **Wayback Machine** for archived versions

### Hard Paywalls (Cannot be bypassed)

Content is never sent to the client without authentication. No tool can bypass these. Examples:
- Patreon, OnlyFans (login-gated content)
- Download-only content behind authentication
- Sites that verify subscription server-side before sending any content

Signs of a hard paywall:
- No content visible at all without logging in
- No bypass tool works (SMRY, archive.is, etc.)

## How to Use SMRY

1. **Prepend smry.ai/** to any URL: \`smry.ai/nytimes.com/article\`
2. **Paste a URL** at [smry.ai](${BASE_URL})
3. **Use the bookmarklet** for one-click access from any page

## Supported Publications (1,000+)

Major publications include: New York Times, Wall Street Journal, Bloomberg, The Atlantic, Washington Post, Medium, The Guardian, Financial Times, Forbes, The Economist, Reuters, CNN, BBC, Wired, and many more.

## Rate Limits

- **Free:** 20 articles/day, 6 per minute per IP
- **Pro:** Unlimited articles and summaries

## Links

- [Homepage](${BASE_URL})
- [Pricing](${BASE_URL}/pricing)
- [Hard paywalls explained](${BASE_URL}/hard-paywalls)
`;
}

function getHardPaywallsMarkdown(): string {
  return `${LLMS_TXT_BLOCKQUOTE}
# Understanding Hard Paywalls

## What is a Hard Paywall?

A hard paywall is a content protection method where the server never sends article content to the client unless the user is authenticated and subscribed. Unlike soft paywalls (which hide content with JavaScript), hard paywalls cannot be bypassed by any external tool — including SMRY.

## Soft Paywalls vs Hard Paywalls

| Feature | Soft Paywall | Hard Paywall |
|---------|-------------|-------------|
| Content in page source | Yes (hidden by JS/CSS) | No |
| Bypassable | Yes, with tools like SMRY | No |
| SEO-friendly | Yes (crawlers see content) | No |
| Examples | NYT, WSJ, Bloomberg, Medium | Patreon, OnlyFans |

## Why Can't Hard Paywalls Be Bypassed?

With hard paywalls, the content simply does not exist in the HTTP response unless you have valid credentials. There is no content to extract because the server checks authentication before rendering any article text.

## What to Try When SMRY Doesn't Work

1. Check if the site uses a hard paywall (no content visible at all)
2. Try a different source in SMRY (direct, proxy, or Wayback Machine)
3. Check [archive.org](https://archive.org) for archived versions
4. Try searching for the article title — sometimes the full text appears in search results
5. Check if your local library provides digital access to the publication

## Links

- [SMRY Guide](${BASE_URL}/guide)
- [Homepage](${BASE_URL})
- [Pricing](${BASE_URL}/pricing)
`;
}

function getChangelogMarkdown(): string {
  return `${LLMS_TXT_BLOCKQUOTE}
# SMRY Changelog

Recent features and improvements to SMRY.

## February 3, 2026
- **Chat with articles** — Ask AI questions about any article instead of just getting summaries. Conversational interface with streaming responses.
- **Conversation sync** — Chat history syncs across devices when signed in.
- **Smart conversation starters** — One-tap suggestions like "Summarize this" or "What are the key points?"

## February 1, 2026
- **Automatic smart source selection** — Articles automatically fetched from the best available source.  System races multiple sources and picks the most complete content.
- **Optimistic content updates** — Content may update in real-time when a more complete version is found.
- **Improved loading experience** — New richer loading skeleton and compact error display.
- **Mobile horizontal scroll fix** — Cards and ads now scale properly on all screen sizes.

## January 25, 2025
- **Language switcher on article page** — Switch languages directly from the reader view.
- **Fixed mobile keyboard behavior** — Keyboard no longer auto-opens on mobile homepage.

## January 11, 2025
- **Premium AI summaries** — Pro users get summaries powered by Claude, Gemini Flash, and GPT models.

## January 10, 2025
- **Bypass status indicator** — See whether each source successfully retrieved the full article.

## December 15, 2024
- **Multi-language support** — Available in English, Spanish, German, Portuguese, Dutch, and Chinese.
- **Reading history** — Track and search through reading history. Pro users get unlimited history.

## December 1, 2024
- **Parallel source fetching** — Articles fetched from multiple sources simultaneously.

## November 20, 2024
- **AI summaries** — AI-generated summaries in 8 languages. Premium users get unlimited.
- **Copy to LLMs** — One-click copy articles as clean markdown for ChatGPT, Claude, or other AI tools.

## November 10, 2024
- **Improved paywall detection** — Better handling of soft paywalls using JavaScript content hiding.

## Links

- [Homepage](${BASE_URL})
- [Pricing](${BASE_URL}/pricing)
`;
}
