import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { buildProxyRedirectUrl } from "@/lib/proxy-redirect";

/**
 * Static file extensions that should be excluded from proxy middleware.
 * Root-level files ending in these extensions won't go through the redirect logic.
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
 * 
 * Pattern: [^/]+\.(?:ext1|ext2|...)(?:[?#]|$)
 * - [^/]+ = filename without slashes (root-level only)
 * - \.(?:...) = dot followed by extension
 * - (?:[?#]|$) = must end OR be followed by query/fragment
 * 
 * See lib/proxy-matcher.test.ts for comprehensive test coverage.
 */
export const STATIC_FILE_REGEX = new RegExp(
  `^[^/]+\\.(?:${STATIC_EXTENSIONS.join("|")})(?:[?#]|$)`,
  "i"
);

/**
 * Check if a pathname is a root-level static file.
 */
function isStaticFile(pathname: string): boolean {
  // Remove leading slash and check against regex
  const path = pathname.startsWith("/") ? pathname.substring(1) : pathname;
  return STATIC_FILE_REGEX.test(path);
}

export const proxy = clerkMiddleware(async (_auth, request: NextRequest) => {
  const { pathname, search, origin } = request.nextUrl;

  // Skip static files - let Next.js serve them directly
  if (isStaticFile(pathname)) {
    return NextResponse.next();
  }

  // Build redirect URL for URL slugs
  // Passes pathname, search params, and origin for proper URL reconstruction
  const redirectUrl = buildProxyRedirectUrl(pathname, search, origin);

  if (redirectUrl) {
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
});

export default proxy;

/*
 * Matcher config - only exclude Next.js internals.
 * Static file detection is handled by STATIC_FILE_REGEX in the middleware.
 */
export const config = {
  matcher: [
    // Match everything except _next
    "/((?!_next).*)",
  ],
};
