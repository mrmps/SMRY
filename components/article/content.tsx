"use client";

import React from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { GlobeAltIcon, LinkIcon } from "@heroicons/react/24/outline";
import { QuestionMarkCircleIcon } from "@heroicons/react/24/solid";
import { Skeleton } from "../ui/skeleton";
import ShareButton from "../features/share-button";
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
  viewMode?: "markdown" | "iframe";
}

export const ArticleContent: React.FC<ArticleContentProps> = ({
  query,
  source,
  url,
  viewMode = "markdown",
}) => {
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
        return `https://web.archive.org/web/0/${url}`;
      case "jina.ai":
        return `https://r.jina.ai/${url}`;
      case "smry-fast":
      case "smry-slow":
      default:
        return url;
    }
  };

  // Loading state
  if (isLoading) {
    const cacheURL = getCacheURL();
    
    return (
      <div className="mt-10">
        {viewMode === "iframe" && cacheURL ? (
          <iframe
            src={cacheURL}
            className="w-full h-[600px] border border-zinc-200 rounded-lg"
            title={`${source} view of ${url}`}
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
            loading="lazy"
          />
        ) : (
          <>
            <Skeleton
              className="h-10 rounded-lg animate-pulse bg-zinc-200 mb-4"
              style={{ width: "60%" }}
            />
            <Skeleton
              className="h-32 rounded-lg animate-pulse bg-zinc-200"
              style={{ width: "100%" }}
            />
          </>
        )}
      </div>
    );
  }

  // Error state
  if (isError) {
    // If it's an ArticleFetchError, extract the AppError from it
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
    
    const cacheURL = getCacheURL();
    
    return (
      <>
        <div className="mt-10">
          <ErrorDisplay 
            error={appError} 
            source={source}
            originalUrl={url}
          />
          {viewMode === "iframe" && cacheURL && (
            <div className="mt-10 w-full">
              <iframe
                src={cacheURL}
                className="w-full h-[600px] border border-zinc-200 rounded-lg"
                title={`${source} view of ${url}`}
                sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                loading="lazy"
              />
            </div>
          )}
        </div>
        <DebugPanel debugContext={debugContext} />
      </>
    );
  }

  // No data state
  if (!data) {
    const cacheURL = getCacheURL();
    
    return (
      <div className="mt-10">
        {viewMode === "iframe" && cacheURL ? (
          <iframe
            src={cacheURL}
            className="w-full h-[600px] border border-zinc-200 rounded-lg"
            title={`${source} view of ${url}`}
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
            loading="lazy"
          />
        ) : (
          <p className="text-gray-600">No data available.</p>
        )}
      </div>
    );
  }

  const content = data;

  return (
    <div className="mt-10">
      <article>
        {content.article?.title && <h1>{content.article.title}</h1>}
        {!content.article?.content && viewMode === "markdown" && (
          <div className="mt-10 flex items-center space-x-2">
            <p className="text-gray-600">Article could not be retrieved.</p>
          </div>
        )}
        <div className="leading-3 text-gray-600 flex space-x-4 items-center -ml-4 -mt-4 flex-wrap">
          <div className="flex items-center mt-4 ml-4 space-x-1.5">
            <ShareButton url={`https://smry.ai/${url}`} />
          </div>
          <div className="flex items-center mt-4 ml-4 space-x-1.5">
            <GlobeAltIcon className="w-4 h-4 text-gray-600" />
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="text-gray-600 hover:text-gray-400 transition"
            >
              {new URL(url).hostname}
            </a>
          </div>
          {/* Only show cache URL link for wayback and jina.ai sources */}
          {(content.source === "wayback" || content.source === "jina.ai") && (
            <div className="flex items-center mt-4 ml-4 space-x-1.5">
              <LinkIcon className="w-4 h-4 text-gray-600" />
              <a
                href={decodeURIComponent(content.cacheURL) ?? ""}
                target="_blank"
                rel="noreferrer"
                className="text-gray-600 hover:text-gray-400 transition"
              >
                {content.source === "wayback" ? "Wayback Machine" : "jina.ai reader"}
              </a>
            </div>
          )}
        </div>
        {viewMode === "iframe" ? (() => {
          const cacheURL = getCacheURL();
          return (
            <div className="mt-10 w-full">
              {cacheURL ? (
                <iframe
                  src={cacheURL}
                  className="w-full h-[600px] border border-zinc-200 rounded-lg"
                  title={`${source} view of ${url}`}
                  sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                  loading="lazy"
                />
              ) : (
                <div className="mt-10 flex items-center space-x-2">
                  <p className="text-gray-600">Iframe URL not available.</p>
                  {content.error && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <QuestionMarkCircleIcon
                            className="inline-block mb-3 -ml-2 rounded-full cursor-help"
                            height={18}
                            width={18}
                          />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Error: {content.error || "Unknown error occurred."}</p>
                          <p>There was an issue retrieving the content.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              )}
            </div>
          );
        })() : content.article?.content ? (
          <div
            className="max-w-full overflow-wrap break-words mt-10"
            dangerouslySetInnerHTML={{ __html: content.article.content }}
          />
        ) : (
          <div className="mt-10 flex items-center space-x-2">
            <p className="text-gray-600">Content not available.</p>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <QuestionMarkCircleIcon
                    className="inline-block mb-3 -ml-2 rounded-full cursor-help"
                    height={18}
                    width={18}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Error: {content.error || "Unknown error occurred."}</p>
                  <p>There was an issue retrieving the content.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}
      </article>
      <DebugPanel debugContext={debugContext} />
    </div>
  );
};

export default ArticleContent;
