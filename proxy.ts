import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { buildProxyRedirectUrl } from "@/lib/proxy-redirect";
import createIntlMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import {
  LLM_DISCOVERY_HEADERS,
  getMarkdownRewritePath,
  buildMarkdownRewriteUrl,
  getArticleMarkdownUrl,
  buildArticleMarkdownRewriteUrl,
} from '@/lib/llm/middleware';

const intlMiddleware = createIntlMiddleware(routing);

/**
 * Append LLM discovery headers to a response.
 */
function withLlmHeaders(response: NextResponse): NextResponse {
  response.headers.set('Link', LLM_DISCOVERY_HEADERS['Link']);
  response.headers.set('X-Llms-Txt', LLM_DISCOVERY_HEADERS['X-Llms-Txt']);
  response.headers.append('Vary', 'Accept');
  return response;
}

export const proxy = clerkMiddleware(async (_auth, request: NextRequest) => {
  const { pathname, search, origin } = request.nextUrl;

  // If x-proxy-article-url header is already set (from a previous rewrite), just pass through
  // This prevents losing the header during the second middleware run
  if (request.headers.get('x-proxy-article-url')) {
    return withLlmHeaders(NextResponse.next());
  }

  // Skip i18n for API routes, admin routes, and auth routes - just let them through
  if (pathname.startsWith('/api') || pathname.startsWith('/admin') || pathname.startsWith('/auth')) {
    return withLlmHeaders(NextResponse.next());
  }

  const accept = request.headers.get('accept') || '';

  // Content negotiation: serve Markdown for static pages when agents prefer it
  const markdownPath = getMarkdownRewritePath(pathname, accept);
  if (markdownPath !== null) {
    const rewriteUrl = new URL(buildMarkdownRewriteUrl(markdownPath, origin));
    return withLlmHeaders(NextResponse.rewrite(rewriteUrl));
  }

  // Build redirect URL for URL slugs (e.g., /nytimes.com → /proxy?url=...)
  const redirectUrl = buildProxyRedirectUrl(pathname, search, origin);

  // Content negotiation: serve Markdown for article pages when agents prefer it
  const articleUrl = getArticleMarkdownUrl(
    pathname,
    accept,
    request.nextUrl.searchParams.get('url'),
    redirectUrl,
  );
  if (articleUrl !== null) {
    const rewriteUrl = new URL(buildArticleMarkdownRewriteUrl(articleUrl, origin));
    // Pass article URL via request header because the route handler sees the
    // original request's searchParams, not the rewrite target's.
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-llm-article-url', articleUrl);
    return withLlmHeaders(NextResponse.rewrite(rewriteUrl, {
      request: { headers: requestHeaders },
    }));
  }

  if (redirectUrl) {
    // Pass article URL via header because the page sees the original request's
    // searchParams, not the rewrite target's searchParams.
    const redirectUrlObj = new URL(redirectUrl);
    const articleUrl = redirectUrlObj.searchParams.get('url');
    const requestHeaders = new Headers(request.headers);
    if (articleUrl) {
      requestHeaders.set('x-proxy-article-url', articleUrl);
    }
    return withLlmHeaders(NextResponse.rewrite(redirectUrl, {
      request: { headers: requestHeaders },
    }));
  }

  // Run i18n middleware for locale handling
  const response = intlMiddleware(request);
  return withLlmHeaders(response as NextResponse);
});

export default proxy;

/**
 * Matcher config - static file detection happens here via regex.
 *
 * Pattern breakdown: [^/]+\.(?:ext)(?:[?#]|$)
 * - [^/]+ = filename without slashes (ROOT-LEVEL ONLY)
 * - \.(?:ext) = dot followed by static extension
 * - (?:[?#]|$) = must end OR be followed by query/fragment
 *
 * This ensures:
 * - /favicon.ico → excluded (root-level static file)
 * - /nytimes.com/article.html → matched (has slashes, goes to middleware)
 * - /example.com → matched (.com isn't a static extension)
 *
 * Note: Root-level .txt files (llms.txt, llms-full.txt) are excluded,
 * so they are served directly from public/ without middleware.
 */
export const config = {
  matcher: [
    // Root path
    '/',
    // Locale prefixed paths - MANUAL SYNC REQUIRED with i18n/routing.ts
    // Pattern: `/(${nonDefaultLocales.join('|')})/:path*`
    // 'en' excluded since it's the default locale with 'as-needed' prefix strategy
    '/(pt|de|zh|es|nl)/:path*',
    // Exclude _next, api, and root-level static files + Next.js special image routes
    "/((?!_next|api|opengraph-image|twitter-image|[^/]+\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|txt|xml)(?:[?#]|$)).*)",
    // Always run for API routes (Clerk auth)
    "/(api)(.*)",
  ],
};
