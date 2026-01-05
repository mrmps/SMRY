import { NextRequest, NextResponse } from "next/server";
import { JinaCacheRequestSchema, JinaCacheUpdateSchema, ArticleResponseSchema, ErrorResponseSchema } from "@/types/api";
import { z } from "zod";
import { fromError } from "zod-validation-error";
import { redis } from "@/lib/redis";
import { compress, decompress } from "@/lib/redis-compression";
import { getTextDirection } from "@/lib/rtl";
import { createRequestContext, extractRequestInfo, extractClientIp } from "@/lib/request-context";

// Cached article schema
const CachedArticleSchema = z.object({
  title: z.string(),
  content: z.string(),
  textContent: z.string(),
  length: z.number().int().positive(),
  siteName: z.string(),
  byline: z.string().optional().nullable(),
  publishedTime: z.string().optional().nullable(),
  htmlContent: z.string().optional(), // Not available for jina.ai source
  lang: z.string().optional().nullable(),
  dir: z.enum(['rtl', 'ltr']).optional().nullable(),
});

/**
 * GET /api/jina?url=...
 * Check cache for Jina article
 *
 * Uses wide event pattern - one canonical log line per request.
 */
export async function GET(request: NextRequest) {
  const ctx = createRequestContext({
    ...extractRequestInfo(request),
    ip: extractClientIp(request),
  });
  ctx.set("endpoint", "/api/jina");

  try {
    const searchParams = request.nextUrl.searchParams;
    const url = searchParams.get("url");

    ctx.set("url_param", url);

    const validationResult = JinaCacheRequestSchema.safeParse({ url });

    if (!validationResult.success) {
      const error = fromError(validationResult.error);
      ctx.error(error.toString(), { error_type: "VALIDATION_ERROR", status_code: 400 });
      return NextResponse.json(
        ErrorResponseSchema.parse({
          error: error.toString(),
          type: "VALIDATION_ERROR",
        }),
        { status: 400 }
      );
    }

    const { url: validatedUrl } = validationResult.data;
    const hostname = new URL(validatedUrl).hostname;
    const cacheKey = `jina.ai:${validatedUrl}`;

    ctx.merge({ hostname, url: validatedUrl });

    try {
      const cacheStart = Date.now();
      const rawCachedArticle = await redis.get(cacheKey);
      const cachedArticle = decompress(rawCachedArticle);
      ctx.set("cache_lookup_ms", Date.now() - cacheStart);

      if (cachedArticle) {
        const article = CachedArticleSchema.parse(cachedArticle);

        if (article.length > 4000) {
          ctx.merge({
            cache_hit: true,
            article_length: article.length,
            status_code: 200,
          });

          const response = ArticleResponseSchema.parse({
            source: "jina.ai",
            cacheURL: `https://r.jina.ai/${validatedUrl}`,
            article: {
              ...article,
              byline: article.byline || "",
              dir: article.dir || getTextDirection(article.lang, article.textContent),
              lang: article.lang || "",
              publishedTime: article.publishedTime || null,
              htmlContent: article.content,
            },
            status: "success",
          });

          ctx.success();
          return NextResponse.json(response);
        } else {
          ctx.set("cache_status", "too_short");
        }
      } else {
        ctx.set("cache_status", "miss");
      }
    } catch {
      ctx.set("cache_status", "error");
    }

    ctx.merge({ cache_hit: false, status_code: 404 });
    ctx.success();

    return NextResponse.json(
      ErrorResponseSchema.parse({
        error: "Not cached",
        type: "CACHE_MISS",
      }),
      { status: 404 }
    );
  } catch (error) {
    ctx.error(error instanceof Error ? error : String(error), {
      error_type: "UNKNOWN_ERROR",
      status_code: 500,
    });

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
 *
 * Uses wide event pattern - one canonical log line per request.
 */
export async function POST(request: NextRequest) {
  const ctx = createRequestContext({
    ...extractRequestInfo(request),
    ip: extractClientIp(request),
  });
  ctx.set("endpoint", "/api/jina");

  try {
    const body = await request.json();

    const validationResult = JinaCacheUpdateSchema.safeParse(body);

    if (!validationResult.success) {
      const error = fromError(validationResult.error);
      ctx.error(error.toString(), { error_type: "VALIDATION_ERROR", status_code: 400 });
      return NextResponse.json(
        ErrorResponseSchema.parse({
          error: error.toString(),
          type: "VALIDATION_ERROR",
        }),
        { status: 400 }
      );
    }

    const { url, article } = validationResult.data;
    const hostname = new URL(url).hostname;
    const cacheKey = `jina.ai:${url}`;

    ctx.merge({
      hostname,
      url,
      article_length: article.length,
    });

    try {
      const cacheStart = Date.now();
      const rawExistingArticle = await redis.get(cacheKey);
      const existingArticle = decompress(rawExistingArticle);
      ctx.set("cache_lookup_ms", Date.now() - cacheStart);

      const validatedExisting = existingArticle
        ? CachedArticleSchema.parse(existingArticle)
        : null;

      if (validatedExisting) {
        ctx.set("existing_length", validatedExisting.length);
      }

      const saveToCache = async (newArticle: z.infer<typeof CachedArticleSchema>) => {
        const metaKey = `meta:${cacheKey}`;
        const metadata = {
          title: newArticle.title,
          siteName: newArticle.siteName,
          length: newArticle.length,
          byline: newArticle.byline,
          publishedTime: newArticle.publishedTime,
        };

        await Promise.all([
          redis.set(cacheKey, compress(newArticle)),
          redis.set(metaKey, metadata)
        ]);
      };

      const articleDir = getTextDirection(null, article.textContent);
      const articleWithDir = { ...article, dir: articleDir, lang: null };

      if (!validatedExisting || article.length > validatedExisting.length) {
        const saveStart = Date.now();
        await saveToCache(articleWithDir);
        ctx.merge({
          cache_save_ms: Date.now() - saveStart,
          cache_updated: true,
          status_code: 200,
        });

        const response = ArticleResponseSchema.parse({
          source: "jina.ai",
          cacheURL: `https://r.jina.ai/${url}`,
          article: {
            ...articleWithDir,
            byline: article.byline || "",
            dir: articleDir,
            lang: "",
            publishedTime: article.publishedTime || null,
            htmlContent: article.content,
          },
          status: "success",
        });

        ctx.success();
        return NextResponse.json(response);
      } else {
        ctx.merge({
          cache_updated: false,
          status_code: 200,
        });

        const response = ArticleResponseSchema.parse({
          source: "jina.ai",
          cacheURL: `https://r.jina.ai/${url}`,
          article: {
            ...validatedExisting,
            byline: validatedExisting.byline || "",
            dir: validatedExisting.dir || getTextDirection(validatedExisting.lang, validatedExisting.textContent),
            lang: validatedExisting.lang || "",
            publishedTime: validatedExisting.publishedTime || null,
            htmlContent: validatedExisting.content,
          },
          status: "success",
        });

        ctx.success();
        return NextResponse.json(response);
      }
    } catch {
      ctx.set("cache_error", true);

      const articleDir = getTextDirection(null, article.textContent);

      const response = ArticleResponseSchema.parse({
        source: "jina.ai",
        cacheURL: `https://r.jina.ai/${url}`,
        article: {
          ...article,
          byline: article.byline || "",
          dir: articleDir,
          lang: "",
          publishedTime: article.publishedTime || null,
          htmlContent: article.content,
        },
        status: "success",
      });

      ctx.merge({ status_code: 200 });
      ctx.success();
      return NextResponse.json(response);
    }
  } catch (error) {
    ctx.error(error instanceof Error ? error : String(error), {
      error_type: "UNKNOWN_ERROR",
      status_code: 500,
    });

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
