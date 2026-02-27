"use client";

import { useSearchParams } from "next/navigation";
import { ProxyContent } from "@/components/features/proxy-content";
import { normalizeUrl } from "@/lib/validation/url";
import { useMemo } from "react";

interface ProxyPageContentProps {
  articleUrl?: string | null;
}

export function ProxyPageContent({ articleUrl }: ProxyPageContentProps) {
  const searchParams = useSearchParams();
  // Use articleUrl prop (from server/header) or fall back to searchParams
  const rawUrl = articleUrl || searchParams.get("url") || "";

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
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="text-center space-y-2 max-w-md">
          <div className="inline-flex items-center justify-center size-12 rounded-full bg-destructive/10 text-destructive mb-2">
            <svg
              className="size-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-foreground">Invalid URL</h2>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
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

  return <ProxyContent url={normalizedUrl!} />;
}
