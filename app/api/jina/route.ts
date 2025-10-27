import { NextRequest, NextResponse } from "next/server";
import { JinaCacheRequestSchema, JinaCacheUpdateSchema, ArticleResponseSchema, ErrorResponseSchema } from "@/types/api";
import { kv } from "@vercel/kv";
import { z } from "zod";
import { fromError } from "zod-validation-error";

// Development-only logger
const devLog = (...args: any[]) => {
  if (process.env.NODE_ENV === "development") {
    console.log(...args);
  }
};

// Cached article schema
const CachedArticleSchema = z.object({
  title: z.string(),
  content: z.string(),
  textContent: z.string(),
  length: z.number().int().positive(),
  siteName: z.string(),
});

type CachedArticle = z.infer<typeof CachedArticleSchema>;

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
      devLog("❌ Validation error:", error.toString());
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

    devLog(`🔍 Checking Jina cache for: ${new URL(validatedUrl).hostname}`);

    try {
      const cachedArticleJson = await kv.get(cacheKey);

      if (cachedArticleJson) {
        const article = CachedArticleSchema.parse(cachedArticleJson);

        // Only return if cached article is reasonably long
        if (article.length > 4000) {
          devLog(`✓ Jina cache hit: ${new URL(validatedUrl).hostname} (${article.length} chars)`);
          
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
          devLog(`⚠️  Jina cache too short: ${article.length} chars, will fetch fresh`);
        }
      } else {
        devLog(`⚠️  Jina cache miss for: ${new URL(validatedUrl).hostname}`);
      }
    } catch (error) {
      devLog("⚠️  Jina cache read error:", error instanceof Error ? error.message : String(error));
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
    devLog("❌ Unexpected error in Jina GET:", error);
    
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
      devLog("❌ Validation error:", error.toString());
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

    devLog(`💾 Updating Jina cache for: ${new URL(url).hostname} (${article.length} chars)`);

    try {
      const existingArticleString = await kv.get(cacheKey);

      const existingArticle = existingArticleString
        ? CachedArticleSchema.parse(existingArticleString)
        : null;

      // Only update if new article is longer or doesn't exist
      if (!existingArticle || article.length > existingArticle.length) {
        await kv.set(cacheKey, JSON.stringify(article));
        devLog(`✓ Jina cache updated: ${new URL(url).hostname} (${article.length} chars)`);
        
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
        devLog(`✓ Keeping existing Jina cache: ${new URL(url).hostname} (${existingArticle.length} chars > ${article.length} chars)`);
        
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
      devLog("⚠️  Jina cache update error:", error instanceof Error ? error.message : String(error));
      
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
    devLog("❌ Unexpected error in Jina POST:", error);
    
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

