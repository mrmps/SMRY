import { NextRequest, NextResponse } from "next/server";
import { JinaCacheRequestSchema, JinaCacheUpdateSchema, ArticleResponseSchema, ErrorResponseSchema } from "@/types/api";
import { kv } from "@vercel/kv";
import { z } from "zod";
import { fromError } from "zod-validation-error";
import { createLogger } from "@/lib/logger";

const logger = createLogger('api:jina');

// Cached article schema
const CachedArticleSchema = z.object({
  title: z.string(),
  content: z.string(),
  textContent: z.string(),
  length: z.number().int().positive(),
  siteName: z.string(),
});

/**
 * GET /api/jina?url=...
 * Check cache for Jina article
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const url = searchParams.get("url");

    const validationResult = JinaCacheRequestSchema.safeParse({ url });

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

    const { url: validatedUrl } = validationResult.data;
    const cacheKey = `jina.ai:${validatedUrl}`;

    logger.debug({ hostname: new URL(validatedUrl).hostname }, 'Checking Jina cache');

    try {
      const cachedArticleJson = await kv.get(cacheKey);

      if (cachedArticleJson) {
        const article = CachedArticleSchema.parse(cachedArticleJson);

        // Only return if cached article is reasonably long
        if (article.length > 4000) {
          logger.debug({ hostname: new URL(validatedUrl).hostname, length: article.length }, 'Jina cache hit');
          
          const response = ArticleResponseSchema.parse({
            source: "jina.ai",
            cacheURL: `https://r.jina.ai/${validatedUrl}`,
            article: {
              ...article,
              byline: "",
              dir: "",
              lang: "",
            },
            status: "success",
          });

          return NextResponse.json(response);
        } else {
          logger.debug({ length: article.length }, 'Jina cache too short, will fetch fresh');
        }
      } else {
        logger.debug({ hostname: new URL(validatedUrl).hostname }, 'Jina cache miss');
      }
    } catch (error) {
      logger.warn({ error: error instanceof Error ? error.message : String(error) }, 'Jina cache read error');
    }

    // No cache or cache too short - return empty success
    return NextResponse.json(
      ErrorResponseSchema.parse({
        error: "Not cached",
        type: "CACHE_MISS",
      }),
      { status: 404 }
    );
  } catch (error) {
    logger.error({ error }, 'Unexpected error in Jina GET');
    
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

/**
 * POST /api/jina
 * Update cache with Jina article if it's longer than existing or doesn't exist
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const validationResult = JinaCacheUpdateSchema.safeParse(body);

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

    const { url, article } = validationResult.data;
    const cacheKey = `jina.ai:${url}`;

    logger.info({ hostname: new URL(url).hostname, length: article.length }, 'Updating Jina cache');

    try {
      const existingArticleString = await kv.get(cacheKey);

      const existingArticle = existingArticleString
        ? CachedArticleSchema.parse(existingArticleString)
        : null;

      // Only update if new article is longer or doesn't exist
      if (!existingArticle || article.length > existingArticle.length) {
        await kv.set(cacheKey, JSON.stringify(article));
        logger.info({ hostname: new URL(url).hostname, length: article.length }, 'Jina cache updated');
        
        const response = ArticleResponseSchema.parse({
          source: "jina.ai",
          cacheURL: `https://r.jina.ai/${url}`,
          article: {
            ...article,
            byline: "",
            dir: "",
            lang: "",
          },
          status: "success",
        });

        return NextResponse.json(response);
      } else {
        logger.debug({ hostname: new URL(url).hostname, existingLength: existingArticle.length, newLength: article.length }, 'Keeping existing Jina cache');
        
        const response = ArticleResponseSchema.parse({
          source: "jina.ai",
          cacheURL: `https://r.jina.ai/${url}`,
          article: {
            ...existingArticle,
            byline: "",
            dir: "",
            lang: "",
          },
          status: "success",
        });

        return NextResponse.json(response);
      }
    } catch (error) {
      logger.warn({ error: error instanceof Error ? error.message : String(error) }, 'Jina cache update error');
      
      // Return the article even if caching fails
      const response = ArticleResponseSchema.parse({
        source: "jina.ai",
        cacheURL: `https://r.jina.ai/${url}`,
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
    logger.error({ error }, 'Unexpected error in Jina POST');
    
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

