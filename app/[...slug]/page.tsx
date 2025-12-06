"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { normalizeUrl } from "@/lib/validation/url";

export default function RedirectPage() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    // Skip Next.js internal routes and API routes
    if (pathname.startsWith('/_next') || pathname.startsWith('/api')) {
      return;
    }

    // Extract the path after the initial '/'
    const slug = pathname.substring(1);

    if (!slug) {
      return;
    }

    try {
      const normalized = normalizeUrl(slug);
      router.push(`/proxy?url=${encodeURIComponent(normalized)}`);
    } catch (error) {
      console.error("Failed to normalize path slug", slug, error);
      const fallback = slug.startsWith("http") ? slug : `https://${slug}`;
      router.push(`/proxy?url=${encodeURIComponent(fallback)}`);
    }
  }, [router, pathname]);

  // Render nothing or a loading indicator
  return null;
}
