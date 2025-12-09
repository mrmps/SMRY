import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { buildProxyRedirectUrl } from "@/lib/proxy-redirect";

export const proxy = clerkMiddleware(async (_auth, request: NextRequest) => {
  const { pathname, search, origin } = request.nextUrl;

  // Build redirect URL for URL slugs
  // Passes pathname, search params, and origin for proper URL reconstruction
  const redirectUrl = buildProxyRedirectUrl(pathname, search, origin);

  if (redirectUrl) {
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
});

export default proxy;

export const config = {
  matcher: [
    /*
     * Match all paths EXCEPT:
     * - _next/* (Next.js internals)
     * - Root-level static files (no slashes after initial /):
     *   /favicon.ico, /og-image.png, /robots.txt, etc.
     *
     * DOES match URL slugs (have slashes or aren't static extensions):
     * - /example.com (.com isn't a static extension)
     * - /https://site.com/article.html (has slashes, not root-level)
     * - /nytimes.com/2025/article.html (has slashes)
     */
    "/((?!_next|[^/]+\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|txt|xml)$).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
