"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

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

    // Check if the slug starts with 'http:/' or 'https:/', if not, prepend 'https://'
    console.log("slug is " , slug)
    const formattedSlug = pathname.includes('http:/') || pathname.includes('https:/') ? pathname.slice(1) : `https://${slug}`;

    // Perform the redirection
    router.push(`/proxy?url=${(encodeURIComponent(formattedSlug))}`);
  }, [router, pathname]);

  // Render nothing or a loading indicator
  return null;
}
