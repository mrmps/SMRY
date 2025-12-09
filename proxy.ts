import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { normalizeUrl } from "@/lib/validation/url";

const isPublicRoute = createRouteMatcher([
  "/",
  "/proxy(.*)",
  "/api(.*)",
  "/pricing(.*)",
  "/history(.*)",
  "/feedback(.*)",
]);

/**
 * Repair URLs where browser/server collapsed "://" to ":/" in the path.
 * e.g., "/https:/www.nytimes.com/..." → "https://www.nytimes.com/..."
 */
function repairAndExtractUrl(pathname: string): string | null {
  // Match paths that look like URLs: /https:/... or /http:/...
  const match = pathname.match(/^\/(https?):\/(.+)$/i);
  if (match) {
    const [, protocol, rest] = match;
    // Repair the URL: add back the second slash
    return `${protocol}://${rest}`;
  }
  return null;
}

export const proxy = clerkMiddleware(async (auth, request: NextRequest) => {
  const pathname = request.nextUrl.pathname;

  // Check if this looks like a URL path that needs redirecting to /proxy
  // This handles the case where "://" gets collapsed to ":/" in the path
  const repairedUrl = repairAndExtractUrl(pathname);
  if (repairedUrl) {
    try {
      // Normalize the URL before redirecting (handles decoding, protocol repair, validation)
      const normalizedUrl = normalizeUrl(repairedUrl);
      const proxyUrl = new URL("/proxy", request.url);
      proxyUrl.searchParams.set("url", normalizedUrl);
      return NextResponse.redirect(proxyUrl);
    } catch {
      // If normalization fails, still redirect but let proxy page handle validation
      const proxyUrl = new URL("/proxy", request.url);
      proxyUrl.searchParams.set("url", repairedUrl);
      return NextResponse.redirect(proxyUrl);
    }
  }

  // Protect non-public routes
  if (!isPublicRoute(request)) {
    await auth.protect();
  }

  return NextResponse.next();
});

export default proxy;

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};

