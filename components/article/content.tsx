"use client";

import React, { useState, useEffect, useMemo, memo, useCallback, useRef } from "react";
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
import { ArticleFetchError, articleAPI } from "@/lib/api/client";
import { UpgradeCTA } from "@/components/marketing/upgrade-cta";
import { Newspaper } from "@/components/ui/icons";
import { GravityAd } from "@/components/ads/gravity-ad";
import type { GravityAd as GravityAdType } from "@/lib/hooks/use-gravity-ad";
import { HighlightToolbar } from "@/components/features/highlight-toolbar";
import { HighlightActionPopover } from "@/components/features/highlight-action-popover";
import { useHighlightsContext } from "@/lib/contexts/highlights-context";
import { useInlineHighlights } from "@/lib/hooks/use-inline-highlights";
import { ImageLightbox, type LightboxImage } from "@/components/ui/image-lightbox";

export type { Source };

/**
 * Sanitize HTML content by removing empty list items.
 * Uses DOMParser to properly detect whitespace-only elements via textContent.
 * Memoized in component to only run when content changes.
 */
function sanitizeListItems(html: string): string {
  if (!html) return html;
  if (typeof window === 'undefined') return html;

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  let changed: boolean;

  // Iterate until no more changes (handles nested empty structures)
  do {
    changed = false;

    // Find and remove empty list items
    const listItems = doc.querySelectorAll('li');
    listItems.forEach((li) => {
      // Normalize text content (including &nbsp; = \u00A0)
      const textContent = li.textContent?.replace(/[\s\u00A0]+/g, '').trim() || '';
      const hasMedia = li.querySelector('img, video, iframe, picture, canvas');

      // Check for links with visible text
      const hasVisibleLink = Array.from(li.querySelectorAll('a[href]')).some(a => {
        const href = a.getAttribute('href') || '';
        const linkText = a.textContent?.replace(/[\s\u00A0]+/g, '').trim() || '';
        return href && href !== '#' && linkText;
      });

      if (!textContent && !hasMedia && !hasVisibleLink) {
        li.remove();
        changed = true;
      }
    });

    // Remove empty ul/ol elements
    const lists = doc.querySelectorAll('ul, ol');
    lists.forEach((list) => {
      if (list.children.length === 0) {
        list.remove();
        changed = true;
      }
    });
  } while (changed);

  return doc.body.innerHTML;
}

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
  // Sanitize content by removing empty list items (memoized - only runs when content changes)
  const sanitizedContent = useMemo(() => sanitizeListItems(content), [content]);

  // Split content at a natural break point for ad insertion
  const { beforeAd, afterAd } = useMemo(() => {
    if (!inlineAd || !sanitizedContent) {
      return { beforeAd: sanitizedContent, afterAd: null };
    }

    // Find paragraph breaks
    const paragraphEnds = [...sanitizedContent.matchAll(/<\/p>/gi)];
    const totalParagraphs = paragraphEnds.length;

    // No paragraphs found - show ad at end
    if (totalParagraphs === 0) {
      return { beforeAd: sanitizedContent, afterAd: "" };
    }

    // Insert ad after ~40% of content, minimum after 1st paragraph
    const targetParagraph = Math.max(1, Math.floor(totalParagraphs * 0.4));
    const splitIndex = paragraphEnds[targetParagraph - 1]?.index;

    if (splitIndex === undefined) {
      return { beforeAd: sanitizedContent, afterAd: "" };
    }

    const splitPoint = splitIndex + 4; // +4 for "</p>"
    return {
      beforeAd: sanitizedContent.slice(0, splitPoint),
      afterAd: sanitizedContent.slice(splitPoint),
    };
  }, [sanitizedContent, inlineAd]);

  // No ad - render simply
  // Note: Font size, line-height, and max-width are controlled by CSS variables
  // set via useReaderPreferences hook (--reader-font-size, --reader-line-height, --reader-content-width)
  if (afterAd === null) {
    return (
      <div
        ref={contentRef}
        className="mt-6 wrap-break-word prose"
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
        className="wrap-break-word prose"
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
        className="wrap-break-word prose"
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

  // Highlights functionality - from shared context
  const {
    highlights,
    addHighlight,
    updateHighlight,
    deleteHighlight,
    activeHighlightId,
    setActiveHighlightId,
  } = useHighlightsContext();

  // Stable ref for highlights (advanced-event-handler-refs pattern)
  // Avoids re-registering the click handler every time highlights array changes
  const highlightsRef = useRef(highlights);
  useEffect(() => { highlightsRef.current = highlights; });

  // Highlight action popover state (shown when clicking a mark)
  const [clickedHighlight, setClickedHighlight] = useState<{
    highlight: (typeof highlights)[number];
    rect: DOMRect;
  } | null>(null);

  // Render inline highlights on article DOM (pass sanitized content so marks reapply after async load)
  useInlineHighlights(contentRef, highlights, activeHighlightId, sanitizedArticleContent);

  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxImages, setLightboxImages] = useState<LightboxImage[]>([]);

  const closeLightbox = useCallback(() => setLightboxOpen(false), []);
  const navigateLightbox = useCallback((i: number) => setLightboxIndex(i), []);

  // Helper: is this image expandable (not a link child, not an icon)?
  const isExpandable = useCallback((img: HTMLImageElement) => {
    if (img.closest("a")) return false;
    const w = img.getAttribute("width");
    const h = img.getAttribute("height");
    if ((w && parseInt(w, 10) <= 48) || (h && parseInt(h, 10) <= 48))
      return false;
    return true;
  }, []);

  // Event-delegated click handler on the article container.
  // Recomputes image list on every click — no stale closures, no per-image listeners.
  useEffect(() => {
    const container = contentRef.current;
    if (!container || !sanitizedArticleContent) return;

    const handleClick = (e: MouseEvent) => {
      // Handle highlight mark clicks — show action popover
      const mark = (e.target as HTMLElement).closest?.("mark[data-highlight-id]");
      if (mark) {
        e.preventDefault();
        e.stopPropagation();
        const highlightId = mark.getAttribute("data-highlight-id");
        if (highlightId) {
          // Read from ref to avoid stale closure (advanced-event-handler-refs)
          const hl = highlightsRef.current.find((h) => h.id === highlightId);
          if (hl) {
            const rect = mark.getBoundingClientRect();
            setClickedHighlight({ highlight: hl, rect });
            setActiveHighlightId(highlightId);
          }
        }
        return;
      }

      const img = (e.target as HTMLElement).closest?.("img");
      if (!img || !isExpandable(img)) return;

      // Build image list on-the-fly from current DOM
      const all = Array.from(
        container.querySelectorAll<HTMLImageElement>("img"),
      ).filter(isExpandable);
      const index = all.indexOf(img);
      if (index === -1) return;

      const images = all.map((el) => {
        const figure = el.closest("figure");
        const caption =
          figure?.querySelector("figcaption")?.textContent || undefined;
        return { src: el.src, alt: el.alt || "", caption };
      });

      setLightboxImages(images);
      setLightboxIndex(index);
      setLightboxOpen(true);
    };

    container.addEventListener("click", handleClick);
    return () => container.removeEventListener("click", handleClick);
    // highlights accessed via highlightsRef — no need as dep (advanced-event-handler-refs)
  }, [sanitizedArticleContent, isExpandable, setActiveHighlightId]);

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

  // Lazy-load full HTML content only when user switches to "html" view mode
  // State: null = not started, "loading" = fetching, string = result (empty string = failed)
  const [lazyHtmlContent, setLazyHtmlContent] = useState<string | null>(null);
  const htmlFetchStartedRef = useRef(false);

  // If the article already has htmlContent inline, use it directly (legacy fallback)
  const inlineHtmlContent = data?.article?.htmlContent || null;

  useEffect(() => {
    if (viewMode !== "html" || !data?.article || inlineHtmlContent || htmlFetchStartedRef.current) return;

    htmlFetchStartedRef.current = true;
    let cancelled = false;

    articleAPI.getArticleHtml(url, source).then((result) => {
      if (!cancelled) {
        setLazyHtmlContent(result?.htmlContent ?? "");
      }
    }).catch(() => {
      if (!cancelled) {
        setLazyHtmlContent("");
      }
    });

    return () => { cancelled = true; };
  }, [viewMode, data?.article, url, source, inlineHtmlContent]);

  // Loading = we need to fetch but haven't got a result yet
  const isLoadingHtml = viewMode === "html" && !!data?.article && !inlineHtmlContent && lazyHtmlContent === null;
  const rawHtmlContent = inlineHtmlContent || lazyHtmlContent;

  // Inject <base> tag into cached HTML so relative URLs (CSS, images, fonts) resolve
  // against the original article's domain instead of about:srcdoc
  const preparedHtmlContent = useMemo(() => {
    if (!rawHtmlContent) return rawHtmlContent;
    try {
      const baseTag = `<base href="${new URL(url).origin.replace(/"/g, '&quot;')}/" />`;
      // Insert after <head> if present, otherwise prepend
      if (rawHtmlContent.includes("<head>")) {
        return rawHtmlContent.replace("<head>", `<head>${baseTag}`);
      }
      if (rawHtmlContent.includes("<head ")) {
        return rawHtmlContent.replace(/<head\s[^>]*>/, `$&${baseTag}`);
      }
      return baseTag + rawHtmlContent;
    } catch {
      return rawHtmlContent;
    }
  }, [rawHtmlContent, url]);

  return (
    <div className={viewMode === "markdown" ? "mt-2" : "-mt-2"}>
      <article>
        {data && !isError && data.article && viewMode === "markdown" && (
          <div
            className="article-header mb-8 space-y-6 border-b border-border pb-6"
            dir={data.article.dir || "ltr"}
            lang={data.article.lang || undefined}
          >
            <div className="flex items-center gap-3">
              <div className="size-5 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/favicon?domain=${new URL(url).hostname}`}
                  alt=""
                  className="size-5 rounded-sm bg-white"
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
              <h1 className="text-2xl sm:text-[32px] font-bold leading-[1.25] tracking-[-0.02em] text-foreground font-sans">
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
            <div className="article-skeleton-container">
              {/* Site name skeleton */}
              <div className="flex items-center gap-3 mb-6 skeleton-group" style={{ animationDelay: '0ms' }}>
                <Skeleton className="size-5 rounded-full" />
                <Skeleton className="h-4 w-28 rounded-full" />
              </div>

              {/* Title skeleton - larger lines for title feel */}
              <div className="space-y-3 mb-6 skeleton-group" style={{ animationDelay: '80ms' }}>
                <Skeleton className="h-10 w-full rounded-md" />
                <Skeleton className="h-10 w-[85%] rounded-md" />
              </div>

              {/* Metadata skeleton */}
              <div className="flex items-center gap-4 mb-8 pb-6 border-b border-border skeleton-group" style={{ animationDelay: '160ms' }}>
                <Skeleton className="h-4 w-32 rounded-full" />
                <Skeleton className="h-4 w-20 rounded-full" />
              </div>

              {/* Content skeleton - article-like paragraphs with staggered delays */}
              <div className="space-y-6 mt-6">
                {/* First paragraph */}
                <div className="space-y-2.5 skeleton-group" style={{ animationDelay: '240ms' }}>
                  <Skeleton className="h-[18px] w-full rounded" />
                  <Skeleton className="h-[18px] w-full rounded" />
                  <Skeleton className="h-[18px] w-[92%] rounded" />
                  <Skeleton className="h-[18px] w-[78%] rounded" />
                </div>

                {/* Second paragraph */}
                <div className="space-y-2.5 skeleton-group" style={{ animationDelay: '320ms' }}>
                  <Skeleton className="h-[18px] w-full rounded" />
                  <Skeleton className="h-[18px] w-full rounded" />
                  <Skeleton className="h-[18px] w-[88%] rounded" />
                  <Skeleton className="h-[18px] w-[70%] rounded" />
                </div>

                {/* Third paragraph */}
                <div className="space-y-2.5 skeleton-group" style={{ animationDelay: '400ms' }}>
                  <Skeleton className="h-[18px] w-full rounded" />
                  <Skeleton className="h-[18px] w-[95%] rounded" />
                  <Skeleton className="h-[18px] w-[82%] rounded" />
                </div>

                {/* Fourth paragraph - shorter */}
                <div className="space-y-2.5 skeleton-group" style={{ animationDelay: '480ms' }}>
                  <Skeleton className="h-[18px] w-full rounded" />
                  <Skeleton className="h-[18px] w-[65%] rounded" />
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
                isLoadingHtml ? (
                  <div className="mt-6 flex flex-col items-center justify-center py-16 space-y-3">
                    <div className="size-8 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Loading original HTML...</p>
                  </div>
                ) : preparedHtmlContent ? (
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
                  // Fallback: load the original URL directly when cached HTML isn't available
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
                      src={url}
                      className={
                        isFullScreen
                          ? "size-full flex-1 rounded-lg border border-border bg-white"
                          : "h-[calc(100vh-12rem)] md:h-[85vh] w-full rounded-lg border border-border bg-white"
                      }
                      title="Original article"
                      sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                      loading="lazy"
                    />
                  </div>
                )
              ) : sanitizedArticleContent ? (
                <>
                  {/* Highlight toolbar - appears on text selection */}
                  <HighlightToolbar
                    onHighlight={addHighlight}
                    containerRef={contentRef}
                  />

                  {/* Highlight action popover - appears on mark click */}
                  {clickedHighlight && (
                    <HighlightActionPopover
                      highlight={clickedHighlight.highlight}
                      anchorRect={clickedHighlight.rect}
                      onChangeColor={(id, color) => {
                        updateHighlight(id, { color });
                      }}
                      onAddNote={(id) => {
                        setActiveHighlightId(id);
                        setTimeout(() => setActiveHighlightId(null), 2000);
                      }}
                      onDelete={(id) => {
                        deleteHighlight(id);
                      }}
                      onShare={async (text) => {
                        try {
                          await navigator.clipboard.writeText(text);
                        } catch { /* ignore */ }
                      }}
                      onClose={() => {
                        setClickedHighlight(null);
                        setActiveHighlightId(null);
                      }}
                    />
                  )}

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

      {/* Image lightbox (portal-rendered) */}
      <ImageLightbox
        images={lightboxImages}
        currentIndex={lightboxIndex}
        isOpen={lightboxOpen}
        onClose={closeLightbox}
        onNavigate={navigateLightbox}
      />

      {process.env.NODE_ENV === "development" && debugContext && (
        <DebugPanel debugContext={debugContext} />
      )}
    </div>
  );
});

export default ArticleContent;
