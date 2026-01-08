/**
 * Article Route - GET /api/article
 */

import { Elysia, t } from "elysia";
import { z } from "zod";
import { fromError } from "zod-validation-error";
import { fetchArticleWithDiffbot, extractDateFromDom, extractImageFromDom } from "../../lib/api/diffbot";
import { redis } from "../../lib/redis";
import { compressAsync, decompressAsync } from "../../lib/redis-compression";
import { AppError, createNetworkError, createParseError } from "../../lib/errors";
import { isHardPaywall, getHardPaywallInfo } from "../../lib/hard-paywalls";
import { createLogger } from "../../lib/logger";
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import { createRequestContext, extractClientIp } from "../../lib/request-context";
import { getTextDirection } from "../../lib/rtl";
import { storeArticleHtml } from "../../lib/db";

const logger = createLogger("api:article");

const CachedArticleSchema = z.object({
  title: z.string(),
  content: z.string(),
  textContent: z.string(),
  length: z.number().int().positive(),
  siteName: z.string(),
  byline: z.string().optional().nullable(),
  publishedTime: z.string().optional().nullable(),
  image: z.string().nullable().optional(),
  htmlContent: z.string().optional(),
  lang: z.string().optional().nullable(),
  dir: z.enum(["rtl", "ltr"]).optional().nullable(),
});

const DiffbotArticleSchema = z.object({
  title: z.string().min(1),
  html: z.string().min(1),
  text: z.string().min(1),
  siteName: z.string().min(1),
  byline: z.string().optional().nullable(),
  publishedTime: z.string().optional().nullable(),
  image: z.string().nullable().optional(),
  htmlContent: z.string().optional(),
  lang: z.string().optional().nullable(),
});

type CachedArticle = z.infer<typeof CachedArticleSchema>;

function getUrlWithSource(source: string, url: string): string {
  return source === "wayback" ? `https://web.archive.org/web/2/${url}` : url;
}

// No truncation - we need the full HTML for the "original" view

async function saveOrReturnLongerArticle(key: string, newArticle: CachedArticle, existing?: CachedArticle | null): Promise<CachedArticle> {
  try {
    const validation = CachedArticleSchema.safeParse(newArticle);
    if (!validation.success) throw new Error("Invalid article");

    const validated = validation.data;

    const saveToCache = async (article: CachedArticle) => {
      const metaKey = `meta:${key}`;
      const metadata = { title: article.title, siteName: article.siteName, length: article.length, byline: article.byline, publishedTime: article.publishedTime, image: article.image };
      const compressed = await compressAsync(article);
      await Promise.all([redis.set(key, compressed), redis.set(metaKey, metadata)]);
    };

    let cachedData = existing;
    if (cachedData === undefined) {
      const raw = await redis.get(key);
      cachedData = await decompressAsync(raw);
    }

    if (cachedData) {
      const existingValidation = CachedArticleSchema.safeParse(cachedData);
      if (!existingValidation.success) {
        await saveToCache(validated);
        return validated;
      }
      const existingArticle = existingValidation.data;
      // Prefer article with htmlContent over one without
      if (!existingArticle.htmlContent && validated.htmlContent) {
        await saveToCache(validated);
        return validated;
      }
      // Prefer article with longer htmlContent (fixes old truncated cache entries)
      const existingHtmlLen = existingArticle.htmlContent?.length || 0;
      const newHtmlLen = validated.htmlContent?.length || 0;
      if (newHtmlLen > existingHtmlLen) {
        await saveToCache(validated);
        return validated;
      }
      // Prefer article with longer text content
      if (validated.length > existingArticle.length) {
        await saveToCache(validated);
        return validated;
      }
      return existingArticle;
    }
    await saveToCache(validated);
    return validated;
  } catch {
    return newArticle;
  }
}

async function fetchArticleWithSmryFast(url: string): Promise<{ article: CachedArticle; cacheURL: string } | { error: AppError }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    logger.info({ source: "smry-fast", hostname: new URL(url).hostname }, "Fetching article directly");

    const response = await fetch(url, {
      headers: { "User-Agent": "smry.ai bot/1.0", Accept: "text/html,application/xhtml+xml" },
      redirect: "follow",
      signal: controller.signal,
    });

    if (!response.ok) {
      logger.error({ source: "smry-fast", status: response.status }, "Direct fetch HTTP error");
      return { error: createNetworkError(`HTTP ${response.status} error when fetching article`, url, response.status) };
    }

    const html = await response.text();
    if (!html) return { error: createParseError("Received empty HTML content", "smry-fast") };

    const { document } = parseHTML(html);
    const reader = new Readability(document);
    const parsed = reader.parse();

    if (!parsed || !parsed.content || !parsed.textContent) {
      return { error: createParseError("Failed to extract article content", "smry-fast") };
    }

    const htmlLang = document.documentElement.getAttribute("lang") || parsed.lang || null;
    const textDir = getTextDirection(htmlLang, parsed.textContent);

    const articleCandidate: CachedArticle = {
      title: parsed.title || document.title || "Untitled",
      content: parsed.content,
      textContent: parsed.textContent,
      length: parsed.textContent.length,
      siteName: (() => { try { return new URL(url).hostname; } catch { return "unknown"; } })(),
      byline: parsed.byline,
      publishedTime: extractDateFromDom(document) || null,
      image: extractImageFromDom(document) || null,
      htmlContent: html,
      lang: htmlLang,
      dir: textDir,
    };

    const validation = CachedArticleSchema.safeParse(articleCandidate);
    if (!validation.success) {
      return { error: createParseError(`Invalid article: ${fromError(validation.error).toString()}`, "smry-fast") };
    }

    return { article: validation.data, cacheURL: url };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { error: createNetworkError("Request timed out", url, 408) };
    }
    return { error: createNetworkError("Failed to fetch article directly", url) };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchArticleWithDiffbotWrapper(urlWithSource: string, source: string): Promise<{ article: CachedArticle; cacheURL: string } | { error: AppError }> {
  try {
    logger.info({ source, hostname: new URL(urlWithSource).hostname }, "Fetching article with Diffbot");
    const diffbotResult = await fetchArticleWithDiffbot(urlWithSource, source);
    if (diffbotResult.isErr()) return { error: diffbotResult.error };

    const validation = DiffbotArticleSchema.safeParse(diffbotResult.value);
    if (!validation.success) return { error: createParseError(`Invalid Diffbot response`, source) };

    const va = validation.data;
    const textDir = getTextDirection(va.lang, va.text);
    const article: CachedArticle = {
      title: va.title, content: va.html, textContent: va.text, length: va.text.length,
      siteName: va.siteName, byline: va.byline, publishedTime: va.publishedTime,
      image: va.image, htmlContent: va.htmlContent, lang: va.lang, dir: textDir,
    };

    return { article, cacheURL: urlWithSource };
  } catch {
    return { error: createParseError("Failed to parse article", source) };
  }
}

async function fetchArticle(urlWithSource: string, source: string): Promise<{ article: CachedArticle; cacheURL: string } | { error: AppError }> {
  switch (source) {
    case "smry-fast": return fetchArticleWithSmryFast(urlWithSource);
    case "smry-slow":
    case "wayback": return fetchArticleWithDiffbotWrapper(urlWithSource, source);
    default: return { error: createParseError(`Unsupported source: ${source}`, source) };
  }
}

const SourceEnum = t.Union([t.Literal("smry-fast"), t.Literal("smry-slow"), t.Literal("wayback"), t.Literal("jina.ai")]);

export const articleRoutes = new Elysia({ prefix: "/api" }).get(
  "/article",
  async ({ query, request, set }) => {
    const ctx = createRequestContext({
      method: "GET",
      path: "/api/article",
      url: request.url,
      ip: extractClientIp(request),
    });
    ctx.set("endpoint", "/api/article");

    try {
      const { url, source } = query;
      ctx.merge({ url_param: url, source_param: source });

      if (source === "jina.ai") {
        ctx.error("Jina.ai source not supported", { error_type: "VALIDATION_ERROR", status_code: 400 });
        set.status = 400;
        return { error: "Use /api/jina endpoint instead.", type: "VALIDATION_ERROR" };
      }

      const hostname = new URL(url).hostname;
      ctx.merge({ source, hostname, url });

      if (isHardPaywall(hostname)) {
        const paywallInfo = getHardPaywallInfo(hostname);
        const siteName = paywallInfo?.name || hostname;
        ctx.error(`Hard paywall site: ${siteName}`, { error_type: "PAYWALL_ERROR", status_code: 403 });
        set.status = 403;
        return { error: `${siteName} uses a hard paywall.`, type: "PAYWALL_ERROR", hostname, siteName, learnMoreUrl: "/hard-paywalls" };
      }

      const urlWithSource = getUrlWithSource(source, url);
      const cacheKey = `${source}:${url}`;

      let cacheStatus: "hit" | "miss" | "invalid" | "error" = "miss";
      let existingCachedArticle: CachedArticle | null = null;

      try {
        const cacheStart = Date.now();
        const rawCachedArticle = await redis.get(cacheKey);
        ctx.set("cache_lookup_ms", Date.now() - cacheStart);

        const cachedArticle = await decompressAsync(rawCachedArticle);
        if (cachedArticle) {
          const validation = CachedArticleSchema.safeParse(cachedArticle);
          if (validation.success) {
            const article = validation.data;
            existingCachedArticle = article;
            // Cache hit if: article has good content AND htmlContent is not truncated
            // Old truncated cache entries had htmlContent capped at exactly 50KB (51200 bytes)
            // Treat entries at exactly 51200 bytes as truncated and refresh them
            const OLD_TRUNCATION_LIMIT = 51200;
            const htmlContentComplete = article.htmlContent && article.htmlContent.length !== OLD_TRUNCATION_LIMIT;
            if (article.length > 4000 && htmlContentComplete) {
              cacheStatus = "hit";
              ctx.merge({ cache_hit: true, article_length: article.length, status_code: 200 });
              ctx.success();
              return {
                source, cacheURL: urlWithSource,
                article: {
                  title: article.title, byline: article.byline || null,
                  dir: article.dir || getTextDirection(article.lang, article.textContent),
                  lang: article.lang || "", content: article.content, textContent: article.textContent,
                  length: article.length, siteName: article.siteName,
                  publishedTime: article.publishedTime || null, image: article.image || null,
                  htmlContent: article.htmlContent,
                },
                status: "success",
              };
            }
          }
        }
      } catch { cacheStatus = "error"; }

      ctx.set("cache_status", cacheStatus);

      const fetchStart = Date.now();
      const result = await fetchArticle(urlWithSource, source);
      ctx.set("fetch_ms", Date.now() - fetchStart);

      if ("error" in result) {
        ctx.error(result.error.message, { error_type: result.error.type, status_code: 500 });
        set.status = 500;
        return { error: result.error.message, type: result.error.type };
      }

      const { article, cacheURL } = result;
      if (article.htmlContent) storeArticleHtml(url, article.htmlContent);

      try {
        const cacheStart = Date.now();
        const savedArticle = await saveOrReturnLongerArticle(cacheKey, article, existingCachedArticle);
        ctx.set("cache_save_ms", Date.now() - cacheStart);
        ctx.merge({ cache_hit: false, article_length: savedArticle.length, status_code: 200 });
        ctx.success();

        return {
          source, cacheURL,
          article: {
            title: savedArticle.title, byline: savedArticle.byline || null,
            dir: savedArticle.dir || getTextDirection(savedArticle.lang, savedArticle.textContent),
            lang: savedArticle.lang || "", content: savedArticle.content, textContent: savedArticle.textContent,
            length: savedArticle.length, siteName: savedArticle.siteName,
            publishedTime: savedArticle.publishedTime || null, image: savedArticle.image || null,
            htmlContent: savedArticle.htmlContent,
          },
          status: "success",
        };
      } catch {
        ctx.merge({ cache_save_error: true, article_length: article.length, status_code: 200 });
        ctx.success();

        return {
          source, cacheURL,
          article: {
            title: article.title, byline: article.byline || null,
            dir: article.dir || getTextDirection(article.lang, article.textContent),
            lang: article.lang || "", content: article.content, textContent: article.textContent,
            length: article.length, siteName: article.siteName,
            publishedTime: article.publishedTime || null, image: article.image || null,
            htmlContent: article.htmlContent,
          },
          status: "success",
        };
      }
    } catch (error) {
      ctx.error(error instanceof Error ? error : String(error), { error_type: "UNKNOWN_ERROR", status_code: 500 });
      set.status = 500;
      return { error: "An unexpected error occurred", type: "UNKNOWN_ERROR" };
    }
  },
  { query: t.Object({ url: t.String(), source: SourceEnum }) }
);
