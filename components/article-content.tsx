import React, { Suspense } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ResponseItem } from "@/app/proxy/page";
import { GlobeAltIcon, LinkIcon } from "@heroicons/react/24/outline";
import { QuestionMarkCircleIcon } from "@heroicons/react/24/solid";
import { Skeleton } from "./ui/skeleton";
import ShareButton from "./share-button";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import showdown from "showdown";
import { kv } from "@vercel/kv";
import { z } from "zod";
import { fromError } from "zod-validation-error";
import { waitUntil } from "@vercel/functions";
import { cache } from "react";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { Result, ResultAsync, ok, err } from "neverthrow";
import {
  AppError,
  createCacheError,
  createNetworkError,
  createParseError,
  createUnknownError,
  createValidationError,
} from "@/lib/errors";
import { ErrorDisplay } from "./error-display";

const converter = new showdown.Converter();
export const revalidate = 3600 * 24 * 3;

export type Source = "direct" | "jina.ai" | "wayback";

interface ArticleContentProps {
  url: string;
  source: Source;
}

export const ArticleContent: React.FC<ArticleContentProps> = async ({
  url,
  source,
}) => {
  const contentResult = await getDataResult(url, source);

  // Handle error case
  if (contentResult.isErr()) {
    return (
      <div className="mt-10">
        <ErrorDisplay error={contentResult.error} />
      </div>
    );
  }

  const content = contentResult.value;

  return (
    <div className="mt-10">
      <article>
        <Suspense
          fallback={
            <Skeleton
              className="h-10 rounded-lg animate-pulse bg-zinc-200"
              style={{ width: "100%" }}
            />
          }
        >
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
        </Suspense>
        <Suspense
          fallback={
            <Skeleton
              className="h-32 rounded-lg animate-pulse bg-zinc-200"
              style={{ width: "100%" }}
            />
          }
        >
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
        </Suspense>
      </article>
    </div>
  );
};

export default ArticleContent;

// Helper functions

const ArticleSchema = z.object({
  title: z.string(),
  content: z.string(),
  textContent: z.string(),
  length: z.number().int().positive(),
  siteName: z.string(),
});

type Article = z.infer<typeof ArticleSchema>;

/**
 * Save or return longer article with proper error handling
 */
async function saveOrReturnLongerArticle(
  key: string,
  newArticle: Article
): Promise<Result<Article, AppError>> {
  try {
    const existingArticleString = await kv.get(key);

    const existingArticle = existingArticleString
      ? ArticleSchema.parse(existingArticleString)
      : null;

    if (!existingArticle || newArticle.length > existingArticle.length) {
      await kv.set(key, JSON.stringify(newArticle));
      return ok(newArticle);
    } else {
      return ok(existingArticle);
    }
  } catch (error) {
    const validationError = fromError(error);
    console.error("Cache validation error:", validationError.toString());
    return err(
      createValidationError("Failed to validate cached article", "article", error)
    );
  }
}

/**
 * Type-safe version of getData that returns a Result
 */
export const getDataResult = cache(
  async (url: string, source: Source): Promise<Result<ResponseItem, AppError>> => {
    try {
      const urlWithSource = getUrlWithSource(source, url);
      const cacheKey = `${source}:${url}`;

      // Try to get from cache
      let cachedArticleJson: string | null = null;
      try {
        cachedArticleJson = await kv.get(cacheKey);
      } catch (error) {
        console.warn("⚠️  Cache read error:", error instanceof Error ? error.message : String(error));
        // Continue without cache
      }

      if (cachedArticleJson) {
        console.log(`✓ Using cached article for ${source}:${new URL(url).hostname}`);
        try {
          const article = ArticleSchema.parse(cachedArticleJson);

          if (article.length > 4000) {
            // Update cache in the background
            waitUntil(updateCache(urlWithSource, cacheKey, source));
            return ok({
              source,
              cacheURL: urlWithSource,
              article: {
                ...article,
                byline: "",
                dir: "",
                lang: "",
              },
              status: "success",
            });
          }
        } catch (error) {
          console.warn("⚠️  Cache parse error:", error instanceof Error ? error.message : String(error));
          // Continue to fetch fresh data
        }
      }

      // If no valid cache or need to fetch new data
      return await fetchAndUpdateCache(urlWithSource, cacheKey, source);
    } catch (error) {
      console.error("Unexpected error in getDataResult:", error);
      return err(createUnknownError(error));
    }
  }
);

/**
 * Legacy getData function for backwards compatibility
 * Throws errors instead of returning Results
 */
export const getData = cache(
  async (url: string, source: Source): Promise<ResponseItem> => {
    const result = await getDataResult(url, source);
    if (result.isErr()) {
      throw new Error(result.error.message);
    }
    return result.value;
  }
);

// Helper function to update cache
const updateCache = async (
  urlWithSource: string,
  cacheKey: string,
  source: Source
) => {
  try {
    const articleResult = await fetchArticle(urlWithSource, source);
    
    if (articleResult.isErr()) {
      const error = articleResult.error;
      console.warn(
        `⚠️  Background cache update failed for ${source}:`,
        `${error.type} - ${error.message}`
      );
      return;
    }
    
    const article = articleResult.value;
    if (article && article.article) {
      const saveResult = await saveOrReturnLongerArticle(cacheKey, {
        title: article.article.title || "",
        content: article.article.content || "",
        textContent: article.article.textContent || "",
        length: article.article.length || 0,
        siteName: article.article.siteName || "",
      });
      
      if (saveResult.isOk()) {
        console.log(`✓ Background cache updated for ${source} (${saveResult.value.length} chars)`);
      } else {
        console.warn(`⚠️  Failed to save to cache:`, saveResult.error.message);
      }
    }
  } catch (error) {
    console.warn("⚠️  Cache update error:", error instanceof Error ? error.message : String(error));
  }
};

// Helper function to fetch and update cache if needed
const fetchAndUpdateCache = async (
  urlWithSource: string,
  cacheKey: string,
  source: Source
): Promise<Result<ResponseItem, AppError>> => {
  const articleResult = await fetchArticle(urlWithSource, source);

  if (articleResult.isErr()) {
    return err(articleResult.error);
  }

  const article = articleResult.value;

  if (!article || !article.article) {
    return err(
      createNetworkError("Article data is not available", urlWithSource)
    );
  }

  const saveResult = await saveOrReturnLongerArticle(cacheKey, {
    title: article.article.title || "",
    content: article.article.content || "",
    textContent: article.article.textContent || "",
    length: article.article.length || 0,
    siteName: article.article.siteName || "",
  });

  if (saveResult.isErr()) {
    // Log cache error but still return the article
    console.warn("Failed to cache article:", saveResult.error);
  }

  const longerArticle = saveResult.isOk() ? saveResult.value : {
    title: article.article.title || "",
    content: article.article.content || "",
    textContent: article.article.textContent || "",
    length: article.article.length || 0,
    siteName: article.article.siteName || "",
  };

  return ok({
    source,
    cacheURL: urlWithSource,
    article: {
      ...longerArticle,
      byline: "",
      dir: "",
      lang: "",
    },
    status: "success",
  });
};

/**
 * Fetch article with proper Result error handling
 */
const fetchArticle = async (
  urlWithSource: string,
  source: Source
): Promise<Result<ResponseItem, AppError>> => {
  const responseResult = await fetchWithTimeout(urlWithSource);

  if (responseResult.isErr()) {
    return err(responseResult.error);
  }

  const response = responseResult.value;

  if (!response.ok) {
    return err(
      createNetworkError(
        `HTTP error! status: ${response.status}`,
        urlWithSource,
        response.status
      )
    );
  }

  try {
    const markdownToHtml = (markdown: string) => {
      return converter.makeHtml(markdown);
    };

    if (source === "jina.ai") {
      const markdown = await response.text();
      const lines = markdown.split("\n");

      // Extract title, URL source, and main content based on consistent line positions
      const title = lines[0].replace("Title: ", "").trim();
      const urlSource = lines[2].replace("URL Source: ", "").trim();
      const mainContent = lines.slice(4).join("\n").trim(); // Everything after the 4th line

      // Convert markdown to HTML
      const contentHtml = markdownToHtml(mainContent);

      return ok({
        source,
        cacheURL: urlWithSource,
        article: {
          title: title,
          content: contentHtml,
          textContent: mainContent,
          length: mainContent.length,
          siteName: new URL(urlSource).hostname,
          byline: "",
          dir: "",
          lang: "",
        },
      });
    }

    const html = await response.text();
    const doc = new JSDOM(html).window.document;

    const reader = new Readability(doc);
    const articleData = reader.parse();

    if (articleData) {
      return ok({
        source,
        cacheURL: urlWithSource,
        article: {
          title: articleData.title,
          content: articleData.content,
          textContent: articleData.textContent,
          length: articleData.textContent.length,
          siteName: new URL(urlWithSource).hostname,
          byline: articleData.byline,
          dir: articleData.dir,
          lang: articleData.lang,
        },
      });
    }

    return err(
      createParseError("Failed to parse article content", source)
    );
  } catch (error) {
    console.error("Article parsing error:", error);
    return err(createParseError("Failed to parse article", source, error));
  }
};

const getUrlWithSource = (source: Source, url: string): string => {
  switch (source) {
    case "jina.ai":
      return `https://r.jina.ai/${url}`;
    case "wayback":
      return `https://web.archive.org/web/2/${encodeURIComponent(url)}`;
    case "direct":
    default:
      return url;
  }
};
