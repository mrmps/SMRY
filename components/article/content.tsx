"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ArrowsPointingOutIcon, ArrowsPointingInIcon } from "@heroicons/react/24/outline";
import { QuestionMarkCircleIcon } from "@heroicons/react/24/solid";
import { Skeleton } from "../ui/skeleton";
import { UseQueryResult } from "@tanstack/react-query";
import { ArticleResponse, Source } from "@/types/api";
import { ErrorDisplay } from "../shared/error-display";
import { DebugPanel } from "../shared/debug-panel";
import { ArticleFetchError } from "@/lib/api/client";

export type { Source };

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
  const debugContext = error instanceof ArticleFetchError 
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

  return (
    <div className="mt-2">
      <article>
        {/* Header - Title and Links (Only if data available) */}
        {data && !isError && (
          <div className="mb-8 space-y-4 border-b border-border pb-6">
            {/* Metadata Row */}
            <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-muted-foreground">
              <a 
                href={url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="uppercase tracking-wide underline decoration-muted-foreground/50 underline-offset-2 hover:text-foreground hover:decoration-foreground"
              >
                {new URL(url).hostname.replace('www.', '')}
              </a>
              {/* <span>•</span> */}
              {/* <span>{data.article?.date}</span> */}
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
                className="mb-4 h-10 rounded-lg bg-zinc-200"
                style={{ width: "60%" }}
              />
              <Skeleton
                className="h-32 rounded-lg bg-zinc-200"
                style={{ width: "100%" }}
              />
            </div>
          )}

          {isError && (() => {
            const appError = error instanceof ArticleFetchError && error.errorType
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
                    <p className="text-gray-600">Article could not be retrieved.</p>
                  </div>
                )}

                {viewMode === "html" ? (
                  data.article?.htmlContent ? (
                    <div
                      className={
                        isFullScreen
                          ? "fixed inset-0 z-50 flex h-screen w-screen flex-col bg-background p-2 sm:p-4"
                          : "relative mt-6 w-full"
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
                        srcDoc={data.article.htmlContent}
                        className={
                          isFullScreen
                            ? "size-full rounded-lg border border-zinc-200 bg-white"
                            : "h-[85vh] w-full rounded-lg border border-zinc-200 bg-white"
                        }
                        title={`${source} html content of ${url}`}
                        sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                        loading="lazy"
                      />
                    </div>
                  ) : (
                    <div className="mt-6 flex items-center space-x-2">
                      <p className="text-gray-600">Original HTML not available for this source.</p>
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
                            <p>The {source} source does not provide original HTML.</p>
                            <p>Try using a different source or the Markdown/Iframe tabs.</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  )
                ) : data.article?.content ? (
                  <div
                    className="mt-6 wrap-break-word prose dark:prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ __html: data.article.content }}
                  />
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
      <DebugPanel debugContext={debugContext} />
    </div>
  );
};

export default ArticleContent;
