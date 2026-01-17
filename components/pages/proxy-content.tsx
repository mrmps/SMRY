"use client";

import { useSearchParams } from "next/navigation";
import { ProxyContent } from "@/components/features/proxy-content";
import { normalizeUrl } from "@/lib/validation/url";
import { useMemo } from "react";

interface ProxyPageContentProps {
  initialSidebarOpen?: boolean;
}

export function ProxyPageContent({ initialSidebarOpen = false }: ProxyPageContentProps) {
  const searchParams = useSearchParams();
  const rawUrl = searchParams.get("url") ?? "";

  const { normalizedUrl, error } = useMemo(() => {
    if (!rawUrl) {
      return { normalizedUrl: null, error: null };
    }

    try {
      return { normalizedUrl: normalizeUrl(rawUrl), error: null };
    } catch (e) {
      const message =
        e instanceof Error
          ? e.message
          : "Please enter a valid URL (e.g. example.com or https://example.com).";
      return { normalizedUrl: null, error: message };
    }
  }, [rawUrl]);

  if (!rawUrl) {
    return (
      <div className="p-4 text-muted-foreground">
        Please provide a URL to load an article.
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-20 px-4 text-center text-muted-foreground">
        {error}
      </div>
    );
  }

  if (normalizedUrl?.includes("orlandosentinel.com")) {
    return (
      <div className="mt-20">
        Sorry, articles from the orlando sentinel are not available
      </div>
    );
  }

  return <ProxyContent url={normalizedUrl!} initialSidebarOpen={initialSidebarOpen} />;
}
