/**
 * Jina Route - GET/POST /api/jina
 */

import { Elysia, t } from "elysia";
import { z } from "zod";
import { redis } from "../../lib/redis";
import { compressAsync, decompressAsync } from "../../lib/redis-compression";
import { getTextDirection } from "../../lib/rtl";
import { createRequestContext, extractClientIp } from "../../lib/request-context";
import { isHardPaywall, getHardPaywallInfo } from "../../lib/hard-paywalls";
import { abuseRateLimiter } from "../../lib/rate-limit-memory";

const CachedArticleSchema = z.object({
  title: z.string(),
  content: z.string(),
  textContent: z.string(),
  length: z.number().int().positive(),
  siteName: z.string(),
  byline: z.string().optional().nullable(),
  publishedTime: z.string().optional().nullable(),
  htmlContent: z.string().optional(),
  lang: z.string().optional().nullable(),
  dir: z.enum(["rtl", "ltr"]).optional().nullable(),
});

type CachedArticle = z.infer<typeof CachedArticleSchema>;

const ArticleSchema = t.Object({
  title: t.String(),
  content: t.String(),
  textContent: t.String(),
  length: t.Integer({ minimum: 1 }),
  siteName: t.String(),
  byline: t.Optional(t.Nullable(t.String())),
  publishedTime: t.Optional(t.Nullable(t.String())),
  htmlContent: t.Optional(t.String()),
});

export const jinaRoutes = new Elysia({ prefix: "/api" })
  .get("/jina", async ({ query, request, set }) => {
    const clientIp = extractClientIp(request);
    const ctx = createRequestContext({
      method: "GET",
      path: "/api/jina",
      url: request.url,
      ip: clientIp,
    });
    ctx.set("endpoint", "/api/jina");
    ctx.set("source", "jina.ai");

    // Abuse prevention rate limit (high threshold)
    const rateLimit = abuseRateLimiter.check(clientIp);
    if (!rateLimit.success) {
      ctx.error("Rate limit exceeded", { error_type: "RATE_LIMIT_ERROR", status_code: 429 });
      set.status = 429;
      set.headers["retry-after"] = String(Math.ceil((rateLimit.reset - Date.now()) / 1000));
      return { error: "Too many requests", type: "RATE_LIMIT_ERROR" };
    }

    try {
      const { url } = query;
      const hostname = new URL(url).hostname;
      const cacheKey = `jina.ai:${url}`;

      ctx.merge({ hostname, url });

      if (isHardPaywall(hostname)) {
        const paywallInfo = getHardPaywallInfo(hostname);
        const siteName = paywallInfo?.name || hostname;

        ctx.error(`Hard paywall site: ${siteName}`, { error_type: "PAYWALL_ERROR", status_code: 403 });
        set.status = 403;
        return {
          error: `${siteName} uses a hard paywall that cannot be bypassed.`,
          type: "PAYWALL_ERROR",
          hostname,
          siteName,
          learnMoreUrl: "/hard-paywalls",
        };
      }

      try {
        const cacheStart = Date.now();
        const rawCachedArticle = await redis.get(cacheKey);
        const cachedArticle = await decompressAsync(rawCachedArticle);
        ctx.set("cache_lookup_ms", Date.now() - cacheStart);

        if (cachedArticle) {
          const article = CachedArticleSchema.parse(cachedArticle);

          if (article.length > 4000) {
            ctx.merge({ cache_hit: true, article_length: article.length, status_code: 200 });
            ctx.success();

            return {
              source: "jina.ai" as const,
              cacheURL: `https://r.jina.ai/${url}`,
              article: {
                ...article,
                byline: article.byline || null,
                dir: article.dir || getTextDirection(article.lang, article.textContent),
                lang: article.lang || "",
                publishedTime: article.publishedTime || null,
                htmlContent: article.content,
              },
              status: "success",
            };
          }
        }
      } catch {
        ctx.set("cache_status", "error");
      }

      ctx.merge({ cache_hit: false, status_code: 404 });
      ctx.success();

      set.status = 404;
      return { error: "Not cached", type: "CACHE_MISS" };
    } catch (error) {
      ctx.error(error instanceof Error ? error : String(error), { error_type: "UNKNOWN_ERROR", status_code: 500 });
      set.status = 500;
      return { error: "An unexpected error occurred", type: "UNKNOWN_ERROR" };
    }
  }, { query: t.Object({ url: t.String() }) })

  .post("/jina", async ({ body, request, set }) => {
    const clientIp = extractClientIp(request);
    const ctx = createRequestContext({
      method: "POST",
      path: "/api/jina",
      url: request.url,
      ip: clientIp,
    });
    ctx.set("endpoint", "/api/jina");
    ctx.set("source", "jina.ai");

    // Abuse prevention rate limit (high threshold)
    const rateLimit = abuseRateLimiter.check(clientIp);
    if (!rateLimit.success) {
      ctx.error("Rate limit exceeded", { error_type: "RATE_LIMIT_ERROR", status_code: 429 });
      set.status = 429;
      set.headers["retry-after"] = String(Math.ceil((rateLimit.reset - Date.now()) / 1000));
      return { error: "Too many requests", type: "RATE_LIMIT_ERROR" };
    }

    try {
      const { url, article } = body;
      const hostname = new URL(url).hostname;
      const cacheKey = `jina.ai:${url}`;

      ctx.merge({ hostname, url, article_length: article.length });

      try {
        const cacheStart = Date.now();
        const rawExistingArticle = await redis.get(cacheKey);
        const existingArticle = await decompressAsync(rawExistingArticle);
        ctx.set("cache_lookup_ms", Date.now() - cacheStart);

        let validatedExisting: CachedArticle | null = null;
        if (existingArticle) {
          const parseResult = CachedArticleSchema.safeParse(existingArticle);
          if (parseResult.success) {
            validatedExisting = parseResult.data;
          }
        }

        const saveToCache = async (newArticle: CachedArticle) => {
          const metaKey = `meta:${cacheKey}`;
          const metadata = {
            title: newArticle.title,
            siteName: newArticle.siteName,
            length: newArticle.length,
            byline: newArticle.byline,
            publishedTime: newArticle.publishedTime,
          };

          const compressedArticle = await compressAsync(newArticle);
          await Promise.all([
            redis.set(cacheKey, compressedArticle),
            redis.set(metaKey, metadata),
          ]);
        };

        const articleDir = getTextDirection(null, article.textContent);
        const articleWithDir: CachedArticle = { ...article, dir: articleDir, lang: null };

        if (!validatedExisting || article.length > validatedExisting.length) {
          await saveToCache(articleWithDir);
          ctx.merge({ cache_updated: true, status_code: 200 });
          ctx.success();

          return {
            source: "jina.ai" as const,
            cacheURL: `https://r.jina.ai/${url}`,
            article: {
              ...articleWithDir,
              byline: article.byline || null,
              dir: articleDir,
              lang: "",
              publishedTime: article.publishedTime || null,
              htmlContent: article.content,
            },
            status: "success",
          };
        } else {
          ctx.merge({ cache_updated: false, status_code: 200 });
          ctx.success();

          return {
            source: "jina.ai" as const,
            cacheURL: `https://r.jina.ai/${url}`,
            article: {
              ...validatedExisting,
              byline: validatedExisting.byline || null,
              dir: validatedExisting.dir || getTextDirection(validatedExisting.lang, validatedExisting.textContent),
              lang: validatedExisting.lang || "",
              publishedTime: validatedExisting.publishedTime || null,
              htmlContent: validatedExisting.content,
            },
            status: "success",
          };
        }
      } catch {
        const articleDir = getTextDirection(null, article.textContent);
        ctx.merge({ status_code: 200 });
        ctx.success();

        return {
          source: "jina.ai" as const,
          cacheURL: `https://r.jina.ai/${url}`,
          article: {
            ...article,
            byline: article.byline || null,
            dir: articleDir,
            lang: "",
            publishedTime: article.publishedTime || null,
            htmlContent: article.content,
          },
          status: "success",
        };
      }
    } catch (error) {
      ctx.error(error instanceof Error ? error : String(error), { error_type: "UNKNOWN_ERROR", status_code: 500 });
      set.status = 500;
      return { error: "An unexpected error occurred", type: "UNKNOWN_ERROR" };
    }
  }, { body: t.Object({ url: t.String(), article: ArticleSchema }) });
