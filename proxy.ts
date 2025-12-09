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
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     * - Static assets at root level only (not in URL slugs)
     * 
     * NOTE: We DO want to match paths like /https:/example.com/article.html
     * because those are URL slugs that need to be redirected to /proxy
     */
    "/((?!_next/static|_next/image|favicon\\.ico|sitemap\\.xml|robots\\.txt).*)",
  ],
};
