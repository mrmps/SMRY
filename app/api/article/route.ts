import { NextRequest, NextResponse } from "next/server";
import { ArticleRequestSchema, ArticleResponseSchema, ErrorResponseSchema } from "@/types/api";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { kv } from "@vercel/kv";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import showdown from "showdown";
import { z } from "zod";
import { fromError } from "zod-validation-error";
import { AppError, createValidationError, createNetworkError, createParseError, createUnknownError } from "@/lib/errors";

const converter = new showdown.Converter();

// Development-only logger
const devLog = (...args: any[]) => {
  if (process.env.NODE_ENV === "development") {
    console.log(...args);
  }
};

// Article schema for caching
const CachedArticleSchema = z.object({
  title: z.string(),
  content: z.string(),
  textContent: z.string(),
  length: z.number().int().positive(),
  siteName: z.string(),
});

type CachedArticle = z.infer<typeof CachedArticleSchema>;

/**
 * Get URL with source prefix
 */
function getUrlWithSource(source: string, url: string): string {
  switch (source) {
    case "jina.ai":
      return `https://r.jina.ai/${url}`;
    case "wayback":
      return `https://web.archive.org/web/2/${encodeURIComponent(url)}`;
    case "direct":
    default:
      return url;
  }
}

/**
 * Save or return longer article
 */
async function saveOrReturnLongerArticle(
  key: string,
  newArticle: CachedArticle
): Promise<CachedArticle> {
  try {
    const existingArticleString = await kv.get(key);

    const existingArticle = existingArticleString
      ? CachedArticleSchema.parse(existingArticleString)
      : null;

    if (!existingArticle || newArticle.length > existingArticle.length) {
      await kv.set(key, JSON.stringify(newArticle));
      devLog(`✓ Cached article for ${key} (${newArticle.length} chars)`);
      return newArticle;
    } else {
      devLog(`✓ Using existing cached article for ${key} (${existingArticle.length} chars)`);
      return existingArticle;
    }
  } catch (error) {
    const validationError = fromError(error);
    devLog("⚠️  Cache validation error:", validationError.toString());
    // Return the new article even if caching fails
    return newArticle;
  }
}

/**
 * Fetch and parse article
 */
async function fetchArticle(
  urlWithSource: string,
  source: string
): Promise<{ article: CachedArticle; cacheURL: string } | { error: AppError }> {
  try {
    const responseResult = await fetchWithTimeout(urlWithSource);

    if (responseResult.isErr()) {
      const error = responseResult.error;
      devLog(`❌ fetchWithTimeout failed for ${source}:`, error.type, error.message);
      return { error };
    }

    const response = responseResult.value;

    if (!response.ok) {
      const error = createNetworkError(
        `HTTP error! status: ${response.status}`,
        urlWithSource,
        response.status
      );
      devLog(`❌ HTTP error for ${source}:`, response.status);
      return { error };
    }

    const markdownToHtml = (markdown: string) => {
      return converter.makeHtml(markdown);
    };

    if (source === "jina.ai") {
      const markdown = await response.text();
      const lines = markdown.split("\n");

      // Extract title, URL source, and main content
      const title = lines[0].replace("Title: ", "").trim();
      const urlSource = lines[2].replace("URL Source: ", "").trim();
      const mainContent = lines.slice(4).join("\n").trim();

      // Convert markdown to HTML
      const contentHtml = markdownToHtml(mainContent);

      const article: CachedArticle = {
        title: title,
        content: contentHtml,
        textContent: mainContent,
        length: mainContent.length,
        siteName: new URL(urlSource).hostname,
      };

      devLog(`✓ Jina.ai article parsed: ${title} (${mainContent.length} chars)`);
      return { article, cacheURL: urlWithSource };
    }

    const html = await response.text();
    const doc = new JSDOM(html).window.document;

    const reader = new Readability(doc);
    const articleData = reader.parse();

    if (articleData) {
      const article: CachedArticle = {
        title: articleData.title,
        content: articleData.content,
        textContent: articleData.textContent,
        length: articleData.textContent.length,
        siteName: new URL(urlWithSource).hostname,
      };

      devLog(`✓ Article parsed: ${articleData.title} (${article.length} chars)`);
      return { article, cacheURL: urlWithSource };
    }

    const error = createParseError("Failed to parse article content", source);
    devLog(`❌ Parse error for ${source}`);
    return { error };
  } catch (error) {
    devLog(`❌ Article parsing exception for ${source}:`, error);
    return { error: createParseError("Failed to parse article", source, error) };
  }
}

/**
 * GET /api/article?url=...&source=...
 */
export async function GET(request: NextRequest) {
  try {
    // Parse and validate query parameters
    const searchParams = request.nextUrl.searchParams;
    const url = searchParams.get("url");
    const source = searchParams.get("source");

    const validationResult = ArticleRequestSchema.safeParse({ url, source });

    if (!validationResult.success) {
      const error = fromError(validationResult.error);
      devLog("❌ Validation error:", error.toString());
      return NextResponse.json(
        ErrorResponseSchema.parse({
          error: error.toString(),
          type: "VALIDATION_ERROR",
        }),
        { status: 400 }
      );
    }

    const { url: validatedUrl, source: validatedSource } = validationResult.data;

    devLog(`\n🔄 API Request: ${validatedSource} - ${new URL(validatedUrl).hostname}`);

    const urlWithSource = getUrlWithSource(validatedSource, validatedUrl);
    const cacheKey = `${validatedSource}:${validatedUrl}`;

    // Try to get from cache
    try {
      const cachedArticleJson = await kv.get(cacheKey);

      if (cachedArticleJson) {
        const article = CachedArticleSchema.parse(cachedArticleJson);

        if (article.length > 4000) {
          devLog(`✓ Cache hit for ${validatedSource}:${new URL(validatedUrl).hostname} (${article.length} chars)`);
          
          const response = ArticleResponseSchema.parse({
            source: validatedSource,
            cacheURL: urlWithSource,
            article: {
              ...article,
              byline: "",
              dir: "",
              lang: "",
            },
            status: "success",
          });

          return NextResponse.json(response);
        }
      }
    } catch (error) {
      devLog("⚠️  Cache read error:", error instanceof Error ? error.message : String(error));
      // Continue to fetch fresh data
    }

    // Fetch fresh data
    devLog(`📥 Fetching fresh data for ${validatedSource}...`);
    const result = await fetchArticle(urlWithSource, validatedSource);

    if ("error" in result) {
      const appError = result.error;
      devLog(`❌ Fetch failed for ${validatedSource}:`, appError.type, appError.message);
      
      return NextResponse.json(
        ErrorResponseSchema.parse({
          error: appError.message,
          type: appError.type,
          details: appError,
        }),
        { status: 500 }
      );
    }

    const { article, cacheURL } = result;

    // Save to cache
    try {
      const savedArticle = await saveOrReturnLongerArticle(cacheKey, article);
      
      const response = ArticleResponseSchema.parse({
        source: validatedSource,
        cacheURL,
        article: {
          ...savedArticle,
          byline: "",
          dir: "",
          lang: "",
        },
        status: "success",
      });

      devLog(`✅ Success for ${validatedSource}: ${savedArticle.title}`);
      return NextResponse.json(response);
    } catch (error) {
      devLog("⚠️  Cache save error:", error instanceof Error ? error.message : String(error));
      
      // Return article even if caching fails
      const response = ArticleResponseSchema.parse({
        source: validatedSource,
        cacheURL,
        article: {
          ...article,
          byline: "",
          dir: "",
          lang: "",
        },
        status: "success",
      });

      return NextResponse.json(response);
    }
  } catch (error) {
    devLog("❌ Unexpected error in API route:", error);
    
    return NextResponse.json(
      ErrorResponseSchema.parse({
        error: "An unexpected error occurred",
        type: "UNKNOWN_ERROR",
        details: error instanceof Error ? error.message : String(error),
      }),
      { status: 500 }
    );
  }
}

