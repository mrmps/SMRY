"use client";

import React, { useState, useMemo } from "react";
import DOMPurify from "isomorphic-dompurify";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
} from "@heroicons/react/24/outline";
import { QuestionMarkCircleIcon } from "@heroicons/react/24/solid";
import { Skeleton } from "../ui/skeleton";
import { UseQueryResult } from "@tanstack/react-query";
import { ArticleResponse, Source } from "@/types/api";
import { ErrorDisplay } from "../shared/error-display";
import { DebugPanel } from "../shared/debug-panel";
import { ArticleFetchError } from "@/lib/api/client";
import { UpgradeCTA } from "@/components/marketing/upgrade-cta";
import { Newspaper } from "lucide-react";

export type { Source };

// DOMPurify config for sanitizing the "reader" view (parsed article content)
// This is strict - only allows safe formatting tags for clean reading
const DOMPURIFY_CONFIG = {
  ALLOWED_TAGS: [
    "p",
    "br",
    "hr",
    "span",
    "div",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "ul",
    "ol",
    "li",
    "dl",
    "dt",
    "dd",
    "b",
    "i",
    "u",
    "s",
    "strong",
    "em",
    "mark",
    "small",
    "del",
    "ins",
    "sub",
    "sup",
    "article",
    "section",
    "aside",
    "header",
    "footer",
    "main",
    "nav",
    "blockquote",
    "pre",
    "code",
    "figure",
    "figcaption",
    "address",
    "time",
    "table",
    "thead",
    "tbody",
    "tfoot",
    "tr",
    "th",
    "td",
    "caption",
    "colgroup",
    "col",
    "img",
    "picture",
    "source",
    "a",
  ],
  ALLOWED_ATTR: [
    "id",
    "class",
    "lang",
    "dir",
    "title",
    "aria-label",
    "aria-hidden",
    "role",
    "href",
    "target",
    "rel",
    "src",
    "srcset",
    "sizes",
    "alt",
    "width",
    "height",
    "loading",
    "colspan",
    "rowspan",
    "scope",
    "datetime",
  ],
  FORBID_TAGS: ["script", "style", "iframe", "object", "embed"],
  FORBID_ATTR: ["style", "onerror", "onload", "onclick", "onmouseover"],
  ALLOWED_URI_REGEXP:
    /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
};

// Configure DOMPurify hooks once at module load
// Force safe attributes on links and images
// Guard against multiple hook registrations
let hooksConfigured = false;
function configureDOMPurifyHooks() {
  if (hooksConfigured) return;
  hooksConfigured = true;

  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (node.tagName === "A") {
      node.setAttribute("target", "_blank");
      node.setAttribute("rel", "noopener noreferrer");
    }
    if (node.tagName === "IMG") {
      node.setAttribute("loading", "lazy");
    }
  });
}
configureDOMPurifyHooks();

/**
 * Sanitize HTML content using our strict allowlist config
 */
function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, DOMPURIFY_CONFIG) as string;
}

interface ArticleContentProps {
  query: UseQueryResult<ArticleResponse, Error>;
  source: Source;
  url: string;
  viewMode?: "markdown" | "html" | "iframe";
}

export const ArticleContent: React.FC<ArticleContentProps> = ({
  query,
  source,
  url,
  viewMode = "markdown",
}) => {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const { data, isLoading, isError, error } = query;

  // Extract debug context from error if available
  const debugContext =
    error instanceof ArticleFetchError
      ? error.debugContext
      : data?.debugContext;

  // Helper function to get cacheURL, constructing it if needed
  const getCacheURL = (): string | undefined => {
    // First try to get from data
    if (data?.cacheURL) {
      return data.cacheURL;
    }

    // If not available, construct based on source
    switch (source) {
      case "wayback":
        return `https://web.archive.org/web/2/${url}`;
      case "jina.ai":
        return `https://r.jina.ai/${url}`;
      case "smry-fast":
      case "smry-slow":
      default:
        return url;
    }
  };

  const cacheURL = getCacheURL();

  // Sanitize article content for markdown view (prevents XSS)
  const sanitizedArticleContent = useMemo(() => {
    const content = data?.article?.content;
    if (!content) return null;
    return sanitizeHtml(content);
  }, [data?.article?.content]);

  // Get the raw HTML content for the "Original" view
  // No sanitization needed - it's rendered in a sandboxed iframe which:
  // - Blocks all script execution (sandbox without allow-scripts)
  // - Prevents navigation/popups
  // - Isolates from parent page completely
  const preparedHtmlContent = data?.article?.htmlContent ?? null;

  return (
    <div className="mt-2">
      <article>
        {/* Header - Title and Links (Only if data available) */}
        {data && !isError && data.article && (
          <div
            className="mb-8 space-y-6 border-b border-border pb-6"
            dir={data.article.dir || "ltr"}
            lang={data.article.lang || undefined}
          >
            {/* Top Row: Favicon + Site Name */}
            <div className="flex items-center gap-3">
              <div className="size-5 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://icons.duckduckgo.com/ip3/${new URL(url).hostname}.ico`}
                  alt=""
                  className="size-5 rounded-sm"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = "none";
                    const sibling = target.nextElementSibling;
                    if (sibling) sibling.classList.remove("hidden");
                  }}
                />
                <Newspaper className="hidden size-5 text-muted-foreground" />
              </div>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium tracking-wider text-muted-foreground uppercase hover:text-foreground transition-colors"
              >
                {data.article.siteName ||
                  new URL(url).hostname.replace("www.", "")}
              </a>
            </div>

            {/* Title */}
            {data.article.title && (
              <h1 className="text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl md:text-5xl font-serif">
                {data.article.title}
              </h1>
            )}

            {/* Metadata Row */}
            <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                {data.article.byline && (
                  <>
                    <span className="font-medium text-foreground">
                      {data.article.byline}
                    </span>
                    <span>•</span>
                  </>
                )}
                <span>
                  {Math.ceil((data.article.length || 0) / 5 / 200)} min read
                </span>
              </div>

              {data.article.publishedTime && (
                <span className="font-medium">
                  {new Date(data.article.publishedTime).toLocaleDateString(
                    "en-US",
                    { month: "short", day: "numeric", year: "numeric" },
                  )}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Iframe - Always rendered but hidden if not in iframe mode */}
        {cacheURL && (
          <div
            className={
              viewMode === "iframe"
                ? isFullScreen
                  ? "fixed inset-0 z-50 flex h-screen w-screen flex-col bg-background p-2 sm:p-4"
                  : "relative mt-6 w-full"
                : "hidden"
            }
          >
            <Button
              variant="outline"
              size="icon"
              className="absolute right-4 top-4 z-10 bg-background/80 shadow-sm backdrop-blur-sm hover:bg-background"
              onClick={() => setIsFullScreen(!isFullScreen)}
              title={isFullScreen ? "Exit Full Screen" : "Enter Full Screen"}
            >
              {isFullScreen ? (
                <ArrowsPointingInIcon className="size-4" />
              ) : (
                <ArrowsPointingOutIcon className="size-4" />
              )}
            </Button>
            <iframe
              src={cacheURL}
              className={
                isFullScreen
                  ? "size-full rounded-lg border border-zinc-200 bg-white"
                  : "h-[85vh] w-full rounded-lg border border-zinc-200 bg-white"
              }
              title={`${source} view of ${url}`}
              sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
              loading="lazy"
            />
          </div>
        )}

        {/* Iframe Error State - only if visible and no cacheURL */}
        {viewMode === "iframe" && !cacheURL && (
          <div className="mt-6 flex items-center space-x-2">
            <p className="text-gray-600">Iframe URL not available.</p>
            {data?.error && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <QuestionMarkCircleIcon
                      className="-ml-2 mb-3 inline-block cursor-help rounded-full"
                      height={18}
                      width={18}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Error: {data.error || "Unknown error occurred."}</p>
                    <p>There was an issue retrieving the content.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        )}

        {/* Main Content / Loading / Error - Hidden if in iframe mode */}
        <div className={viewMode !== "iframe" ? "block" : "hidden"}>
          {isLoading && (
            <div className="mt-6">
              <Skeleton
                className="mb-4 h-10 rounded-lg"
                style={{ width: "60%" }}
              />
              <Skeleton className="h-32 rounded-lg" style={{ width: "100%" }} />
            </div>
          )}

          {isError &&
            (() => {
              const appError =
                error instanceof ArticleFetchError && error.errorType
                  ? {
                      type: error.errorType as any,
                      message: error.message,
                      url: data?.cacheURL || url,
                      originalError: error.details?.originalError,
                      debugContext: error.debugContext,
                      ...(error.details || {}),
                    }
                  : {
                      type: "NETWORK_ERROR" as const,
                      message: error?.message || "Failed to load article",
                      url: data?.cacheURL || url,
                    };
              return (
                <div className="mt-6">
                  <ErrorDisplay
                    error={appError}
                    source={source}
                    originalUrl={url}
                  />
                </div>
              );
            })()}

          {!isLoading && !isError && !data && (
            <div className="mt-6">
              <p className="text-gray-600">No data available.</p>
            </div>
          )}

          {!isLoading && !isError && data && (
            <>
              {!data.article?.content && viewMode === "markdown" && (
                <div className="mt-6 flex items-center space-x-2">
                  <p className="text-gray-600">
                    Article could not be retrieved.
                  </p>
                </div>
              )}

              {viewMode === "html" ? (
                preparedHtmlContent ? (
                  <div
                    className={
                      isFullScreen
                        ? "fixed inset-0 z-50 flex flex-col bg-background p-2 sm:p-4"
                        : "relative mt-6 w-full"
                    }
                  >
                    <Button
                      variant="outline"
                      size="icon"
                      className="absolute right-4 top-4 z-10 bg-background/80 shadow-sm backdrop-blur-sm hover:bg-background"
                      onClick={() => setIsFullScreen(!isFullScreen)}
                      title={
                        isFullScreen ? "Exit Full Screen" : "Enter Full Screen"
                      }
                    >
                      {isFullScreen ? (
                        <ArrowsPointingInIcon className="size-4" />
                      ) : (
                        <ArrowsPointingOutIcon className="size-4" />
                      )}
                    </Button>
                    {/* Use iframe with srcdoc for complete style isolation */}
                    {/* This renders the article exactly as it appeared originally */}
                    <iframe
                      srcDoc={preparedHtmlContent}
                      className={
                        isFullScreen
                          ? "size-full flex-1 rounded-lg border border-border bg-white"
                          : "h-[85vh] w-full rounded-lg border border-border bg-white"
                      }
                      title="Original article content"
                      sandbox="allow-same-origin"
                      loading="lazy"
                    />
                  </div>
                ) : (
                  <div className="mt-6 flex items-center space-x-2">
                    <p className="text-gray-600">
                      Original HTML not available for this source.
                    </p>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <QuestionMarkCircleIcon
                            className="-ml-2 mb-3 inline-block cursor-help rounded-full"
                            height={18}
                            width={18}
                          />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>
                            The {source} source does not provide original HTML.
                          </p>
                          <p>
                            Try using a different source or the Markdown/Iframe
                            tabs.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                )
              ) : sanitizedArticleContent ? (
                <>
                  <div
                    className="mt-6 wrap-break-word prose dark:prose-invert max-w-none"
                    dir={data?.article?.dir || "ltr"}
                    lang={data?.article?.lang || undefined}
                    dangerouslySetInnerHTML={{
                      __html: sanitizedArticleContent,
                    }}
                  />
                  {/* Upgrade CTA - shows only for non-premium users */}
                  <UpgradeCTA />
                </>
              ) : (
                <div className="mt-6 flex items-center space-x-2">
                  <p className="text-gray-600">Content not available.</p>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <QuestionMarkCircleIcon
                          className="-ml-2 mb-3 inline-block cursor-help rounded-full"
                          height={18}
                          width={18}
                        />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Error: {data.error || "Unknown error occurred."}</p>
                        <p>There was an issue retrieving the content.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              )}
            </>
          )}
        </div>
      </article>
      {process.env.NODE_ENV === "development" && debugContext && (
        <DebugPanel debugContext={debugContext} />
      )}
    </div>
  );
};

export default ArticleContent;
