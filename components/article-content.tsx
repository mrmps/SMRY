"use client";

import React, { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { GlobeAltIcon, LinkIcon, QuestionMarkCircleIcon } from "@heroicons/react/24/outline";
import { Source } from "@/lib/data";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import ShareButton from "./share-button";

type Article = {
  title: string;
  byline: null | string;
  dir: null | string;
  lang: null | string;
  content: string;
  textContent: string;
  length: number;
  siteName: null | string;
};

type ResponseItem = {
  source: string;
  article?: Article;
  status?: string;
  error?: string;
  cacheURL: string;
};

interface ArticleContentProps {
  url: string;
  source: Source;
}

export const ArticleContent: React.FC<ArticleContentProps> = ({ url, source }) => {
  const [content, setContent] = useState<ResponseItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchArticle = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/article?url=${encodeURIComponent(url)}&source=${source}`);
        
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const data = await response.json();
        setContent(data);
      } catch (err) {
        console.error(err);
        setError("Failed to load article content");
      } finally {
        setIsLoading(false);
      }
    };

    fetchArticle();
  }, [url, source]);

  if (isLoading) {
    return (
      <div className="mt-10">
        <article>
          <Skeleton
            className="h-10 rounded-lg animate-pulse bg-zinc-200 mb-4"
            style={{ width: "100%" }}
          />
          <Skeleton
            className="h-32 rounded-lg animate-pulse bg-zinc-200"
            style={{ width: "100%" }}
          />
        </article>
      </div>
    );
  }

  if (error || !content) {
    return <div>Error loading data: {error || "Unknown error occurred"}</div>;
  }

  return (
    <div className="mt-10">
      <article>
        <div>
          {content.article?.title && <h1>{content.article.title}</h1>}
          {!content.article?.content && (
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
                href={content.cacheURL}
                target="_blank"
                rel="noreferrer"
                className="text-gray-600 hover:text-gray-400 transition"
              >
                {new URL(url).hostname}
              </a>
            </div>
            <div className="flex items-center mt-4 ml-4 space-x-1.5">
              <LinkIcon className="w-4 h-4 text-gray-600" />
              <a
                href={decodeURIComponent(content.cacheURL) ?? ""}
                target="_blank"
                rel="noreferrer"
                className="text-gray-600 hover:text-gray-400 transition"
              >
                {content.source}
              </a>
            </div>
          </div>
        </div>
        <div>
          {content.article?.content ? (
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
        </div>
      </article>
    </div>
  );
};

export default ArticleContent;
