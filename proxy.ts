import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { buildProxyRedirectUrl } from "@/lib/proxy-redirect";

/**
 * Static file extensions that should be excluded from proxy middleware.
 * Root-level files ending in these extensions won't go through the redirect logic.
 * 
 * Used to build STATIC_FILE_REGEX for testing.
 * The same pattern is hardcoded in config.matcher (Next.js requires static strings).
 */
export const STATIC_EXTENSIONS = [
  "html?",      // .html, .htm
  "css",
  "js(?!on)",   // .js but NOT .json
  "jpe?g",      // .jpg, .jpeg
  "webp",
  "png",
  "gif",
  "svg",
  "ttf",
  "woff2?",     // .woff, .woff2
  "ico",
  "csv",
  "docx?",      // .doc, .docx
  "xlsx?",      // .xls, .xlsx
  "zip",
  "webmanifest",
  "txt",
  "xml",
];

/**
 * Regex pattern to match root-level static files.
 * Exported for testing in lib/proxy-matcher.test.ts
 * 
 * Pattern: [^/]+\.(?:ext1|ext2|...)(?:[?#]|$)
 * - [^/]+ = filename without slashes (root-level only)
 * - \.(?:...) = dot followed by extension
 * - (?:[?#]|$) = must end OR be followed by query/fragment
 */
export const STATIC_FILE_REGEX = new RegExp(
  `^[^/]+\\.(?:${STATIC_EXTENSIONS.join("|")})(?:[?#]|$)`,
  "i"
);

export const proxy = clerkMiddleware(async (_auth, request: NextRequest) => {
  const { pathname, search, origin } = request.nextUrl;

  // Build redirect URL for URL slugs (e.g., /nytimes.com → /proxy?url=...)
  const redirectUrl = buildProxyRedirectUrl(pathname, search, origin);

  if (redirectUrl) {
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
});

export default proxy;

/**
 * Matcher config - static file detection happens here, not in middleware.
 * 
 * Excludes:
 * - _next/* (Next.js internals)
 * - Root-level static files: /favicon.ico, /og-image.png, /script.js?v=123, etc.
 *
 * Matches (goes to middleware):
 * - /api/* and /trpc/* (for Clerk auth, won't redirect)
 * - /example.com (.com isn't a static extension, will redirect)
 * - /https://site.com/article.html (has slashes, will redirect)
 * - /nytimes.com/2025/article.html (has slashes, will redirect)
 *
 * NOTE: Pattern must be hardcoded string (Next.js analyzes at build time).
 * STATIC_FILE_REGEX above uses the same pattern for testing.
 */
export const config = {
  matcher: [
    // Main matcher: exclude _next and root-level static files
    "/((?!_next|[^/]+\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|txt|xml)(?:[?#]|$)).*)",
    // Always run for API routes (Clerk auth)
    "/(api|trpc)(.*)",
  ],
};
