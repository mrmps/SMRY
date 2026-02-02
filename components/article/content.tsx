"use client";

import React, { useState, useEffect, useMemo, memo } from "react";
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
import { ArticleResponse, Source } from "@/types/api";
import { ErrorDisplay } from "../shared/error-display";
import { DebugPanel } from "../shared/debug-panel";
import { ArticleFetchError } from "@/lib/api/client";
import { UpgradeCTA } from "@/components/marketing/upgrade-cta";
import { Newspaper } from "lucide-react";
import { GravityAd } from "@/components/ads/gravity-ad";
import type { GravityAd as GravityAdType } from "@/lib/hooks/use-gravity-ad";

export type { Source };

/**
 * Component that renders article content with a single inline ad
 * Ad is placed after ~40% of the content (or after first paragraph if short)
 * Always shows ad if available
 */
const ArticleWithInlineAd = memo(function ArticleWithInlineAd({
  contentRef,
  content,
  dir,
  lang,
  inlineAd,
  onInlineAdVisible,
  onInlineAdClick,
}: {
  contentRef: React.RefObject<HTMLDivElement | null>;
  content: string;
  dir: string;
  lang: string | undefined;
  inlineAd?: GravityAdType | null;
  onInlineAdVisible?: () => void;
  onInlineAdClick?: () => void;
}) {
  // Split content at a natural break point for ad insertion
  const { beforeAd, afterAd } = useMemo(() => {
    if (!inlineAd || !content) {
      return { beforeAd: content, afterAd: null };
    }

    // Find paragraph breaks
    const paragraphEnds = [...content.matchAll(/<\/p>/gi)];
    const totalParagraphs = paragraphEnds.length;

    // No paragraphs found - show ad at end
    if (totalParagraphs === 0) {
      return { beforeAd: content, afterAd: "" };
    }

    // Insert ad after ~40% of content, minimum after 1st paragraph
    const targetParagraph = Math.max(1, Math.floor(totalParagraphs * 0.4));
    const splitIndex = paragraphEnds[targetParagraph - 1]?.index;

    if (splitIndex === undefined) {
      return { beforeAd: content, afterAd: "" };
    }

    const splitPoint = splitIndex + 4; // +4 for "</p>"
    return {
      beforeAd: content.slice(0, splitPoint),
      afterAd: content.slice(splitPoint),
    };
  }, [content, inlineAd]);

  // No ad - render simply
  if (afterAd === null) {
    return (
      <div
        ref={contentRef}
        className="mt-6 wrap-break-word prose dark:prose-invert max-w-none"
        dir={dir}
        lang={lang}
        dangerouslySetInnerHTML={{ __html: beforeAd }}
      />
    );
  }

  // Render with inline ad (inlineAd is guaranteed non-null here since afterAd exists)
  return (
    <div ref={contentRef} className="mt-6">
      {/* First part of article */}
      <div
        className="wrap-break-word prose dark:prose-invert max-w-none"
        dir={dir}
        lang={lang}
        dangerouslySetInnerHTML={{ __html: beforeAd }}
      />

      {/* Mid-article ad */}
      {inlineAd && (
        <div className="my-8">
          <GravityAd
            ad={inlineAd}
            variant="inline"
            onVisible={onInlineAdVisible ?? (() => {})}
            onClick={onInlineAdClick}
          />
        </div>
      )}

      {/* Rest of article */}
      <div
        className="wrap-break-word prose dark:prose-invert max-w-none"
        dir={dir}
        lang={lang}
        dangerouslySetInnerHTML={{ __html: afterAd }}
      />
    </div>
  );
});

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

// Lazy-loaded DOMPurify instance (client-side only)
let DOMPurify: typeof import("dompurify").default | null = null;
let hooksConfigured = false;
const sanitizedHtmlCache = new Map<string, string>();

/**
 * Initialize DOMPurify on the client side only
 */
async function initDOMPurify() {
  if (typeof window === "undefined") return null;
  if (DOMPurify) return DOMPurify;

  const mod = await import("dompurify");
  DOMPurify = mod.default;

  // Configure hooks once
  if (!hooksConfigured) {
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

  return DOMPurify;
}

/**
 * Hook to get sanitized HTML content (client-side only)
 */
function useSanitizedHtml(html: string | undefined | null): string | null {
  const cachedValue = html ? sanitizedHtmlCache.get(html) : null;
  const [sanitized, setSanitized] = useState<string | null>(() => {
    if (!html) return null;
    return cachedValue ?? null;
  });

  useEffect(() => {
    if (!html || cachedValue) return;

    let cancelled = false;
    initDOMPurify().then((dp) => {
      if (dp && !cancelled) {
        const sanitizedHtml = dp.sanitize(html, DOMPURIFY_CONFIG) as string;
        sanitizedHtmlCache.set(html, sanitizedHtml);
        setSanitized(sanitizedHtml);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [html, cachedValue]);

  if (!html) return null;
  return cachedValue ?? sanitized;
}

interface ArticleContentProps {
  data: ArticleResponse | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  source: Source;
  url: string;
  viewMode?: "markdown" | "html" | "iframe";
  isFullScreen?: boolean;
  onFullScreenChange?: (fullScreen: boolean) => void;
  // Single inline ad - appears mid-article for higher CTR
  inlineAd?: GravityAdType | null;
  onInlineAdVisible?: () => void;
  onInlineAdClick?: () => void;
  showInlineAd?: boolean;
  // Footer ad - appears at the bottom of the article
  footerAd?: GravityAdType | null;
  onFooterAdVisible?: () => void;
  onFooterAdClick?: () => void;
}

export const ArticleContent: React.FC<ArticleContentProps> = memo(function ArticleContent({
  data,
  isLoading,
  isError,
  error,
  source,
  url,
  viewMode = "markdown",
  isFullScreen = false,
  onFullScreenChange,
  inlineAd,
  onInlineAdVisible,
  onInlineAdClick,
  showInlineAd = true,
  footerAd,
  onFooterAdVisible,
  onFooterAdClick,
}) {
  const contentRef = React.useRef<HTMLDivElement>(null);
  const articleContent = data?.article?.content;
  const sanitizedArticleContent = useSanitizedHtml(articleContent);

  // Add click-to-expand for images
  useEffect(() => {
    if (!contentRef.current || !sanitizedArticleContent) return;

    const images = contentRef.current.querySelectorAll("img");
    const handleClick = (e: Event) => {
      const img = e.target as HTMLImageElement;
      // Don't expand if image is inside a link - let the link navigate instead
      if (img.closest("a")) return;
      img.classList.toggle("expanded");
    };

    images.forEach((img) => {
      // Only add expand behavior to images not inside links
      if (!img.closest("a")) {
        img.addEventListener("click", handleClick);
        img.title = "Click to expand/collapse";
      }
    });

    return () => {
      images.forEach((img) => {
        img.removeEventListener("click", handleClick);
      });
    };
  }, [sanitizedArticleContent]);

  const debugContext = useMemo(() =>
    error instanceof ArticleFetchError ? error.debugContext : data?.debugContext,
    [error, data?.debugContext]
  );

  const dataCacheURL = data?.cacheURL;
  const cacheURL = useMemo(() => {
    if (dataCacheURL) return dataCacheURL;

    switch (source) {
      case "wayback":
        return `https://web.archive.org/web/2/${url}`;
      case "smry-fast":
      case "smry-slow":
      default:
        return url;
    }
  }, [dataCacheURL, source, url]);

  const preparedHtmlContent = useMemo(
    () => data?.article?.htmlContent ?? null,
    [data?.article?.htmlContent]
  );

  return (
    <div className={viewMode === "markdown" ? "mt-2" : "-mt-2"}>
      <article>
        {data && !isError && data.article && viewMode === "markdown" && (
          <div
            className="mb-8 space-y-6 border-b border-border pb-6"
            dir={data.article.dir || "ltr"}
            lang={data.article.lang || undefined}
          >
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

            {data.article.title && (
              <h1 className="text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl md:text-5xl font-serif">
                {data.article.title}
              </h1>
            )}

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

        {cacheURL && (
          <div
            className={
              viewMode === "iframe"
                ? isFullScreen
                  ? "fixed inset-0 z-50 flex h-screen w-screen flex-col bg-background p-2 sm:p-4"
                  : "relative w-full"
                : "hidden"
            }
          >
            <Button
              variant="outline"
              size="icon"
              className="absolute right-4 top-4 z-10 bg-background/80 shadow-sm backdrop-blur-sm hover:bg-background"
              onClick={() => onFullScreenChange?.(!isFullScreen)}
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

        <div className={viewMode !== "iframe" ? "block" : "hidden"}>
          {isLoading && (
            <div className="animate-in fade-in duration-300">
              {/* Site name skeleton */}
              <div className="flex items-center gap-3 mb-6">
                <Skeleton className="size-5 rounded-sm" />
                <Skeleton className="h-4 w-24" />
              </div>

              {/* Title skeleton */}
              <div className="space-y-3 mb-6">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-4/5" />
              </div>

              {/* Metadata skeleton */}
              <div className="flex items-center gap-4 mb-8 pb-6 border-b border-border">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-20" />
              </div>

              {/* Content skeleton - article-like paragraphs */}
              <div className="space-y-6">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-11/12" />
                  <Skeleton className="h-4 w-4/5" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                </div>
              </div>
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
                        : "relative w-full"
                    }
                  >
                    <Button
                      variant="outline"
                      size="icon"
                      className="absolute right-4 top-4 z-10 bg-background/80 shadow-sm backdrop-blur-sm hover:bg-background"
                      onClick={() => onFullScreenChange?.(!isFullScreen)}
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
                    <iframe
                      srcDoc={preparedHtmlContent}
                      className={
                        isFullScreen
                          ? "size-full flex-1 rounded-lg border border-border bg-white"
                          : "h-[calc(100vh-12rem)] md:h-[85vh] w-full rounded-lg border border-border bg-white"
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
                  {/* Article content with optional mid-article ad */}
                  <ArticleWithInlineAd
                    contentRef={contentRef}
                    content={sanitizedArticleContent}
                    dir={data?.article?.dir || "ltr"}
                    lang={data?.article?.lang || undefined}
                    inlineAd={showInlineAd ? inlineAd : null}
                    onInlineAdVisible={onInlineAdVisible}
                    onInlineAdClick={onInlineAdClick}
                  />
                  <UpgradeCTA dismissable="mobile-only" />
                  {/* Footer ad - appears below the subscription card */}
                  {footerAd && (
                    <div className="mt-4 mb-8">
                      <GravityAd
                        ad={footerAd}
                        variant="inline"
                        onVisible={onFooterAdVisible ?? (() => {})}
                        onClick={onFooterAdClick}
                      />
                    </div>
                  )}
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
});

export default ArticleContent;
