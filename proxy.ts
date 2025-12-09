import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { buildProxyRedirectUrl } from "@/lib/proxy-redirect";

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
    // Exclude _next and root-level static files
    "/((?!_next|[^/]+\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|txt|xml)(?:[?#]|$)).*)",
    // Always run for API routes (Clerk auth)
    "/(api|trpc)(.*)",
  ],
};
