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
import { safeText, ResponseTooLargeError } from "../../lib/safe-fetch";
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import { createRequestContext, extractClientIp } from "../../lib/request-context";
import { getTextDirection } from "../../lib/rtl";
import { abuseRateLimiter } from "../../lib/rate-limit-memory";

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
  // Bypass detection status (cached for instant results on reload)
  bypassStatus: z.enum(["bypassed", "blocked", "uncertain"]).optional(),
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
      headers: {
        // Use a browser-like User-Agent to avoid bot detection (sites like Medium block bots)
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
      },
      redirect: "follow",
      signal: controller.signal,
    });

    if (!response.ok) {
      logger.error({ source: "smry-fast", status: response.status }, "Direct fetch HTTP error");
      return { error: createNetworkError(`HTTP ${response.status} error when fetching article`, url, response.status) };
    }

    const html = await safeText(response);
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
    if (error instanceof ResponseTooLargeError) {
      return { error: createNetworkError("Response too large", url, 413) };
    }
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

const SourceEnum = t.Union([t.Literal("smry-fast"), t.Literal("smry-slow"), t.Literal("wayback")]);

const SOURCES = ["smry-fast", "smry-slow", "wayback"] as const;

export const articleRoutes = new Elysia({ prefix: "/api" }).get(
  "/article",
  async ({ query, request, set }) => {
    const clientIp = extractClientIp(request);
    const ctx = createRequestContext({
      method: "GET",
      path: "/api/article",
      url: request.url,
      ip: clientIp,
    });
    ctx.set("endpoint", "/api/article");

    // Abuse prevention rate limit (high threshold)
    const rateLimit = abuseRateLimiter.check(clientIp);
    if (!rateLimit.success) {
      ctx.error("Rate limit exceeded", { error_type: "RATE_LIMIT_ERROR", status_code: 429 });
      set.status = 429;
      set.headers["retry-after"] = String(Math.ceil((rateLimit.reset - Date.now()) / 1000));
      return { error: "Too many requests", type: "RATE_LIMIT_ERROR" };
    }

    try {
      const { url, source } = query;
      ctx.merge({ url_param: url, source_param: source });

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
).get(
  "/article/auto",
  async ({ query, request, set }) => {
    const clientIp = extractClientIp(request);
    const ctx = createRequestContext({
      method: "GET",
      path: "/api/article/auto",
      url: request.url,
      ip: clientIp,
    });
    ctx.set("endpoint", "/api/article/auto");

    // Abuse prevention rate limit
    const rateLimit = abuseRateLimiter.check(clientIp);
    if (!rateLimit.success) {
      ctx.error("Rate limit exceeded", { error_type: "RATE_LIMIT_ERROR", status_code: 429 });
      set.status = 429;
      set.headers["retry-after"] = String(Math.ceil((rateLimit.reset - Date.now()) / 1000));
      return { error: "Too many requests", type: "RATE_LIMIT_ERROR" };
    }

    try {
      const { url } = query;
      ctx.merge({ url_param: url });

      const hostname = new URL(url).hostname;
      ctx.merge({ hostname, url });

      // Hard paywall check
      if (isHardPaywall(hostname)) {
        const paywallInfo = getHardPaywallInfo(hostname);
        const siteName = paywallInfo?.name || hostname;
        ctx.error(`Hard paywall site: ${siteName}`, { error_type: "PAYWALL_ERROR", status_code: 403 });
        set.status = 403;
        return { error: `${siteName} uses a hard paywall.`, type: "PAYWALL_ERROR", hostname, siteName, learnMoreUrl: "/hard-paywalls" };
      }

      // Check cache for ALL sources - return first hit
      for (const source of SOURCES) {
        const cacheKey = `${source}:${url}`;
        try {
          const rawCachedArticle = await redis.get(cacheKey);
          const cachedArticle = await decompressAsync(rawCachedArticle);
          if (cachedArticle) {
            const validation = CachedArticleSchema.safeParse(cachedArticle);
            if (validation.success) {
              const article = validation.data;
              const OLD_TRUNCATION_LIMIT = 51200;
              const htmlContentComplete = article.htmlContent && article.htmlContent.length !== OLD_TRUNCATION_LIMIT;
              if (article.length > 4000 && htmlContentComplete) {
                ctx.merge({ cache_hit: true, cache_source: source, article_length: article.length, status_code: 200 });
                ctx.success();
                return {
                  source,
                  cacheURL: getUrlWithSource(source, url),
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
        } catch {
          // Continue to next source on cache error
        }
      }

      // OPTIMIZED: "First success wins" pattern
      // Returns immediately when first source succeeds, others continue in background for caching
      const fetchStart = Date.now();

      type FetchResult = { source: typeof SOURCES[number]; article: CachedArticle; cacheURL: string };

      const fetchPromises: Promise<FetchResult | null>[] = [
        fetchArticleWithSmryFast(url).then(r => "article" in r ? { source: "smry-fast" as const, ...r } : null),
        fetchArticleWithDiffbotWrapper(url, "smry-slow").then(r => "article" in r ? { source: "smry-slow" as const, ...r } : null),
        fetchArticleWithDiffbotWrapper(getUrlWithSource("wayback", url), "wayback").then(r => "article" in r ? { source: "wayback" as const, ...r } : null),
      ];

      // Track cached sources to prevent duplicate writes
      const cachedSources = new Set<string>();

      const cacheResult = (result: FetchResult) => {
        if (cachedSources.has(result.source)) return; // Already cached
        cachedSources.add(result.source);
        const cacheKey = `${result.source}:${url}`;
        saveOrReturnLongerArticle(cacheKey, result.article).catch(() => {});
      };

      // Helper: race for first quality result, but don't cancel others
      const raceForFirstSuccess = async (): Promise<FetchResult | null> => {
        return new Promise((resolve) => {
          let resolved = false;
          let completedCount = 0;
          const results: (FetchResult | null)[] = [];

          // Cache all results in background after race completes
          const cacheAllInBackground = () => {
            results.forEach((r) => {
              if (r) cacheResult(r);
            });
          };

          fetchPromises.forEach((promise, index) => {
            promise.then((result) => {
              completedCount++;
              results[index] = result;

              // If we have a quality result and haven't resolved yet, resolve immediately
              if (!resolved && result && result.article.length > 500) {
                resolved = true;
                ctx.set("fetch_ms", Date.now() - fetchStart);
                ctx.set("winning_source", result.source);

                // Cache winner immediately
                cacheResult(result);

                // Let other fetches continue and cache in background
                Promise.allSettled(fetchPromises).then(cacheAllInBackground);

                resolve(result);
              }

              // If all completed and we still haven't resolved, use best available or null
              if (!resolved && completedCount === fetchPromises.length) {
                resolved = true;
                ctx.set("fetch_ms", Date.now() - fetchStart);

                // Cache all successful results
                cacheAllInBackground();

                // Return best available
                resolve(results.find(r => r !== null) ?? null);
              }
            }).catch(() => {
              completedCount++;
              results[index] = null;

              // Check if all failed
              if (!resolved && completedCount === fetchPromises.length) {
                resolved = true;
                ctx.set("fetch_ms", Date.now() - fetchStart);
                resolve(null);
              }
            });
          });
        });
      };

      const bestResult = await raceForFirstSuccess();

      // Return best result
      if (bestResult) {
        ctx.merge({ cache_hit: false, result_source: bestResult.source, article_length: bestResult.article.length, status_code: 200 });
        ctx.success();
        return {
          source: bestResult.source,
          cacheURL: bestResult.cacheURL,
          article: {
            title: bestResult.article.title, byline: bestResult.article.byline || null,
            dir: bestResult.article.dir || getTextDirection(bestResult.article.lang, bestResult.article.textContent),
            lang: bestResult.article.lang || "", content: bestResult.article.content, textContent: bestResult.article.textContent,
            length: bestResult.article.length, siteName: bestResult.article.siteName,
            publishedTime: bestResult.article.publishedTime || null, image: bestResult.article.image || null,
            htmlContent: bestResult.article.htmlContent,
          },
          status: "success",
          // Flag to indicate other sources may have longer content
          // Client should poll /article/enhanced after a few seconds
          mayHaveEnhanced: bestResult.source === "smry-fast",
        };
      }

      // All failed
      ctx.error("All sources failed", { error_type: "ALL_SOURCES_FAILED", status_code: 500 });
      set.status = 500;
      return { error: "Failed to fetch from all sources", type: "ALL_SOURCES_FAILED" };
    } catch (error) {
      ctx.error(error instanceof Error ? error : String(error), { error_type: "UNKNOWN_ERROR", status_code: 500 });
      set.status = 500;
      return { error: "An unexpected error occurred", type: "UNKNOWN_ERROR" };
    }
  },
  { query: t.Object({ url: t.String() }) }
).get(
  "/article/enhanced",
  async ({ query, request, set }) => {
    const clientIp = extractClientIp(request);
    const ctx = createRequestContext({
      method: "GET",
      path: "/api/article/enhanced",
      url: request.url,
      ip: clientIp,
    });
    ctx.set("endpoint", "/api/article/enhanced");

    try {
      const { url, currentLength, currentSource } = query;
      const initialLength = parseInt(currentLength, 10);
      ctx.merge({ url_param: url, current_length: initialLength, current_source: currentSource });

      // Check all sources for a longer article
      let bestArticle: { source: string; article: CachedArticle; cacheURL: string } | null = null;
      let bestLength = initialLength;

      for (const source of SOURCES) {
        // Skip the source we already have
        if (source === currentSource) continue;

        const cacheKey = `${source}:${url}`;
        try {
          const rawCachedArticle = await redis.get(cacheKey);
          const cachedArticle = await decompressAsync(rawCachedArticle);
          if (cachedArticle) {
            const validation = CachedArticleSchema.safeParse(cachedArticle);
            if (validation.success) {
              const article = validation.data;
              // Check if this article is significantly longer (>40% more content)
              if (article.length > bestLength * 1.4) {
                bestLength = article.length;
                bestArticle = {
                  source,
                  article,
                  cacheURL: getUrlWithSource(source, url),
                };
              }
            }
          }
        } catch {
          // Continue to next source on cache error
        }
      }

      // Return enhanced version if found
      if (bestArticle) {
        ctx.merge({ enhanced: true, enhanced_source: bestArticle.source, enhanced_length: bestArticle.article.length });
        ctx.success();
        return {
          enhanced: true,
          source: bestArticle.source,
          cacheURL: bestArticle.cacheURL,
          article: {
            title: bestArticle.article.title, byline: bestArticle.article.byline || null,
            dir: bestArticle.article.dir || getTextDirection(bestArticle.article.lang, bestArticle.article.textContent),
            lang: bestArticle.article.lang || "", content: bestArticle.article.content, textContent: bestArticle.article.textContent,
            length: bestArticle.article.length, siteName: bestArticle.article.siteName,
            publishedTime: bestArticle.article.publishedTime || null, image: bestArticle.article.image || null,
            htmlContent: bestArticle.article.htmlContent,
          },
        };
      }

      // No enhanced version found
      ctx.merge({ enhanced: false });
      ctx.success();
      return { enhanced: false };
    } catch (error) {
      ctx.error(error instanceof Error ? error : String(error), { error_type: "UNKNOWN_ERROR", status_code: 500 });
      set.status = 500;
      return { error: "An unexpected error occurred", type: "UNKNOWN_ERROR" };
    }
  },
  { query: t.Object({ url: t.String(), currentLength: t.String(), currentSource: t.String() }) }
);
