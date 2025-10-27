import { NextRequest, NextResponse } from "next/server";
import { ArticleRequestSchema, ArticleResponseSchema, ErrorResponseSchema } from "@/types/api";
import { fetchArticleWithDiffbot } from "@/lib/api/diffbot";
import { kv } from "@vercel/kv";
import { z } from "zod";
import { fromError } from "zod-validation-error";
import { AppError, createParseError } from "@/lib/errors";
import { createLogger } from "@/lib/logger";

const logger = createLogger('api:article');

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
      logger.debug({ key, length: newArticle.length }, 'Cached article');
      return newArticle;
    } else {
      logger.debug({ key, length: existingArticle.length }, 'Using existing cached article');
      return existingArticle;
    }
  } catch (error) {
    const validationError = fromError(error);
    logger.warn({ error: validationError.toString() }, 'Cache validation error');
    // Return the new article even if caching fails
    return newArticle;
  }
}

/**
 * Fetch and parse article using Diffbot (for direct and wayback sources)
 */
async function fetchArticleWithDiffbotWrapper(
  urlWithSource: string,
  source: string
): Promise<{ article: CachedArticle; cacheURL: string } | { error: AppError }> {
  try {
    logger.info({ source, hostname: new URL(urlWithSource).hostname }, 'Fetching article with Diffbot');
    
    const diffbotResult = await fetchArticleWithDiffbot(urlWithSource);

    if (diffbotResult.isErr()) {
      const error = diffbotResult.error;
      logger.error({ source, errorType: error.type, message: error.message }, 'Diffbot fetch failed');
      return { error };
    }

    const diffbotArticle = diffbotResult.value;

    const article: CachedArticle = {
      title: diffbotArticle.title,
      content: diffbotArticle.html,
      textContent: diffbotArticle.text,
      length: diffbotArticle.text.length,
      siteName: diffbotArticle.siteName,
    };

    logger.debug({ source, title: article.title, length: article.length }, 'Diffbot article parsed');
    return { article, cacheURL: urlWithSource };
  } catch (error) {
    logger.error({ source, error }, 'Article parsing exception');
    return { error: createParseError("Failed to parse article", source, error) };
  }
}

/**
 * Fetch and parse article - routes to appropriate method based on source
 */
async function fetchArticle(
  urlWithSource: string,
  source: string
): Promise<{ article: CachedArticle; cacheURL: string } | { error: AppError }> {
  // Direct and Wayback use Diffbot
  return fetchArticleWithDiffbotWrapper(urlWithSource, source);
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
      logger.error({ error: error.toString() }, 'Validation error');
      return NextResponse.json(
        ErrorResponseSchema.parse({
          error: error.toString(),
          type: "VALIDATION_ERROR",
        }),
        { status: 400 }
      );
    }

    const { url: validatedUrl, source: validatedSource } = validationResult.data;

    // Jina.ai is handled by a separate endpoint (/api/jina) for client-side fetching
    if (validatedSource === "jina.ai") {
      logger.warn({ source: validatedSource }, 'Jina.ai source not supported in this endpoint');
      return NextResponse.json(
        ErrorResponseSchema.parse({
          error: "Jina.ai source is handled client-side. Use /api/jina endpoint instead.",
          type: "VALIDATION_ERROR",
        }),
        { status: 400 }
      );
    }

    logger.info({ source: validatedSource, hostname: new URL(validatedUrl).hostname }, 'API Request');

    const urlWithSource = getUrlWithSource(validatedSource, validatedUrl);
    const cacheKey = `${validatedSource}:${validatedUrl}`;

    // Try to get from cache
    try {
      const cachedArticleJson = await kv.get(cacheKey);

      if (cachedArticleJson) {
        const article = CachedArticleSchema.parse(cachedArticleJson);

        if (article.length > 4000) {
          logger.debug({ source: validatedSource, hostname: new URL(validatedUrl).hostname, length: article.length }, 'Cache hit');
          
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
      logger.warn({ error: error instanceof Error ? error.message : String(error) }, 'Cache read error');
      // Continue to fetch fresh data
    }

    // Fetch fresh data
    logger.info({ source: validatedSource }, 'Fetching fresh data');
    const result = await fetchArticle(urlWithSource, validatedSource);

    if ("error" in result) {
      const appError = result.error;
      logger.error({ source: validatedSource, errorType: appError.type, message: appError.message }, 'Fetch failed');
      
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

      logger.info({ source: validatedSource, title: savedArticle.title }, 'Success');
      return NextResponse.json(response);
    } catch (error) {
      logger.warn({ error: error instanceof Error ? error.message : String(error) }, 'Cache save error');
      
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
    logger.error({ error }, 'Unexpected error in API route');
    
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

