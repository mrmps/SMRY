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

const converter = new showdown.Converter();
export const revalidate = 3600*24*3;

export type Source = "direct" | "jina.ai" | "wayback" | "archive";

interface ArticleContentProps {
  url: string;
  source: Source;
}

export const ArticleContent: React.FC<ArticleContentProps> = async ({
  url,
  source,
}) => {
  let content: ResponseItem;
  try {
    content = await getData(url, source);
  } catch (err) {
    console.error(err);
    return <div>Error loading data</div>;
  }

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

async function saveOrReturnLongerArticle(
  key: string,
  newArticle: Article
): Promise<Article> {
  try {
    const existingArticleString = await kv.get(key);

    const existingArticle = existingArticleString
      ? ArticleSchema.parse(existingArticleString)
      : null;

    if (!existingArticle || newArticle.length > existingArticle.length) {
      await kv.set(key, JSON.stringify(newArticle));
      return newArticle;
    } else {
      return existingArticle;
    }
  } catch (err) {
    const validationError = fromError(err);
    console.log(validationError.toString());
    throw validationError;
  }
}

export const getData = cache(
  async (url: string, source: Source): Promise<ResponseItem> => {
    try {
      const urlWithSource = getUrlWithSource(source, url);
      const cacheKey = `${source}:${url}`;

      let cachedArticleJson: string | null = null;
      cachedArticleJson = await kv.get(cacheKey);

      if (cachedArticleJson) {
        console.log("cachedArticleJson", cachedArticleJson);
        const article = ArticleSchema.parse(cachedArticleJson);

        if (article.length > 4000) {
          // Update cache in the background
          waitUntil(updateCache(urlWithSource, cacheKey, source));
          return {
            source,
            cacheURL: urlWithSource,
            article: {
              ...article,
              byline: "", // Placeholder, as byline is unlikely to be extracted from markdown
              dir: "", // Directionality, keep as empty if not applicable
              lang: "", // Language, keep as empty if not known
            },
            status: "success",
          };
        }
      }

      // If no valid cache or need to fetch new data
      return await fetchAndUpdateCache(urlWithSource, cacheKey, source);
    } catch (err) {
      const validationError = fromError(err);
      console.error(validationError.toString());

      const urlWithSource = getUrlWithSource(source, url);
      return createErrorResponse(
        validationError.toString(),
        source,
        urlWithSource,
        500
      );
    }
  }
);

// Helper function to update cache
const updateCache = async (
  urlWithSource: string,
  cacheKey: string,
  source: Source
) => {
  try {
    const article = await fetchArticle(urlWithSource, source);
    if (article && article.article) {
      await saveOrReturnLongerArticle(cacheKey, {
        title: article.article.title || "",
        content: article.article.content || "",
        textContent: article.article.textContent || "",
        length: article.article.length || 0,
        siteName: article.article.siteName || "",
      });
    }
  } catch (err) {
    console.error(err);
  }
};

// Helper function to fetch and update cache if needed
const fetchAndUpdateCache = async (
  urlWithSource: string,
  cacheKey: string,
  source: Source
) => {
  try {
    const article = await fetchArticle(urlWithSource, source);

    if (!article || !article.article) {
      throw new Error("Article data is not available.");
    }

    const longerArticle = await saveOrReturnLongerArticle(cacheKey, {
      title: article.article.title || "",
      content: article.article.content || "",
      textContent: article.article.textContent || "",
      length: article.article.length || 0,
      siteName: article.article.siteName || "",
    });

    return {
      source,
      cacheURL: urlWithSource,
      article: {
        ...longerArticle,
        byline: "", // Placeholder, as byline is unlikely to be extracted from markdown
        dir: "", // Directionality, keep as empty if not applicable
        lang: "", // Language, keep as empty if not known
      },
      status: "success",
    };
  } catch (err) {
    console.error(err);
    throw err;
  }
};

const fetchArticle = async (
  urlWithSource: string,
  source: Source
): Promise<ResponseItem | null> => {
  try {
    const response = await fetchWithTimeout(urlWithSource);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
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

      return {
        source,
        cacheURL: urlWithSource,
        article: {
          title: title,
          content: contentHtml,
          textContent: mainContent,
          length: mainContent.length,
          siteName: new URL(urlSource).hostname,
          byline: "", // Placeholder, as byline is unlikely to be extracted from markdown
          dir: "", // Directionality, keep as empty if not applicable
          lang: "", // Language, keep as empty if not known
        },
      };
    }

    const html = await response.text();
    const doc = new JSDOM(html).window.document;

    // Prepend archive.is to all image URLs if source is 'archive'
    if (source === "archive") {
      const images = doc.querySelectorAll("img");
      images.forEach((img: HTMLImageElement) => {
        let src = img.getAttribute("src");
        if (src && !src.startsWith("http")) {
          src = `http://archive.is${src}`;
          img.setAttribute("src", src);
        }
      });
    }

    const reader = new Readability(doc);
    const articleData = reader.parse();

    if (articleData) {
      return {
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
      };
    }
  } catch (err) {
    console.error(err);
    return null;
  }

  return null;
};

const createErrorResponse = (
  message: string,
  source: Source,
  cacheURL: string,
  status: number
): ResponseItem => ({
  source: source,
  article: undefined,
  status: status.toString(),
  error: message,
  cacheURL: cacheURL,
});

const getUrlWithSource = (source: Source, url: string): string => {
  switch (source) {
    case "jina.ai":
      return `https://r.jina.ai/${url}`;
    case "wayback":
      return `https://web.archive.org/web/2/${encodeURIComponent(url)}`;
    case "archive":
      return `http://archive.is/latest/${encodeURIComponent(url)}`;
    case "direct":
    default:
      return url;
  }
};
