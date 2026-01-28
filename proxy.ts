import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { buildProxyRedirectUrl } from "@/lib/proxy-redirect";
import createIntlMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

const intlMiddleware = createIntlMiddleware(routing);

export const proxy = clerkMiddleware(async (_auth, request: NextRequest) => {
  const { pathname, search, origin } = request.nextUrl;

  // Skip i18n for API routes, admin routes, and auth routes - just let them through
  if (pathname.startsWith('/api') || pathname.startsWith('/admin') || pathname.startsWith('/auth')) {
    return NextResponse.next();
  }

  // Build redirect URL for URL slugs (e.g., /nytimes.com → /proxy?url=...)
  const redirectUrl = buildProxyRedirectUrl(pathname, search, origin);

  if (redirectUrl) {
    return NextResponse.redirect(redirectUrl);
  }

  // Run i18n middleware for locale handling
  return intlMiddleware(request);
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
