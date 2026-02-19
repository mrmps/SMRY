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
import { startMemoryTrack, trackFetchResponse, logLargeAllocation } from "../../lib/memory-tracker";
import { acquireFetchSlot, releaseFetchSlot, FetchSlotTimeoutError } from "../../lib/article-concurrency";

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

const HTML_PREVIEW_LIMIT = 50 * 1024; // 50KB preview for bypass detection
const CONTENT_MAX_SIZE = 500 * 1024; // 500KB max for cleaned article HTML (content field)
const TEXT_CONTENT_MAX_SIZE = 200 * 1024; // 200KB max for plain text

/**
 * Build a response article object, stripping full htmlContent and adding a preview.
 * Full htmlContent stays in Redis cache — only the preview goes over the wire.
 */
function buildArticleResponse(article: CachedArticle) {
  return {
    title: article.title,
    byline: article.byline || null,
    dir: article.dir || getTextDirection(article.lang, article.textContent),
    lang: article.lang || "",
    // Cap content fields to prevent 6-8MB JSON responses (e.g. CNN pages)
    content: article.content.length > CONTENT_MAX_SIZE
      ? article.content.slice(0, CONTENT_MAX_SIZE)
      : article.content,
    textContent: article.textContent.length > TEXT_CONTENT_MAX_SIZE
      ? article.textContent.slice(0, TEXT_CONTENT_MAX_SIZE)
      : article.textContent,
    length: article.length,
    siteName: article.siteName,
    publishedTime: article.publishedTime || null,
    image: article.image || null,
    // Strip full htmlContent — available via /article/html on demand
    htmlContentPreview: article.htmlContent
      ? article.htmlContent.slice(0, HTML_PREVIEW_LIMIT)
      : undefined,
  };
}

// No truncation - we need the full HTML for the "original" view

/**
 * Cache htmlContent separately in Redis to avoid carrying 200KB-2MB through
 * the entire request lifecycle and compression pipeline.
 *
 * IMPORTANT: This runs as a detached promise. The caller passes the HTML string
 * and should NOT hold its own reference. This function guarantees the string is
 * released after completion (success or failure) via the finally block.
 */
async function cacheHtmlContentSeparately(source: string, url: string, htmlContent: string | undefined): Promise<void> {
  if (!htmlContent) return;
  let html: string | null = htmlContent;
  try {
    const htmlKey = `html:${source}:${url}`;
    const compressed = await compressAsync(html);
    html = null; // Release the 2MB string — compressed copy is much smaller
    await redis.set(htmlKey, compressed);
  } catch (err) {
    logger.warn({ source, url_host: (() => { try { return new URL(url).hostname; } catch { return "unknown"; } })(), error: String(err) }, "Failed to cache htmlContent separately");
  } finally {
    // Guarantee the large string is released even if compressAsync or redis.set throws
    html = null;
  }
}

async function saveOrReturnLongerArticle(key: string, newArticle: CachedArticle, existing?: CachedArticle | null): Promise<CachedArticle> {
  try {
    const validation = CachedArticleSchema.safeParse(newArticle);
    if (!validation.success) throw new Error("Invalid article");

    const validated = validation.data;

    const saveToCache = async (article: CachedArticle) => {
      const metaKey = `meta:${key}`;
      const metadata = { title: article.title, siteName: article.siteName, length: article.length, byline: article.byline, publishedTime: article.publishedTime, image: article.image };
      // Keep only the 50KB preview in main cache — full htmlContent is cached separately
      const articleForCache = {
        ...article,
        htmlContent: article.htmlContent?.slice(0, HTML_PREVIEW_LIMIT),
      };
      const compressed = await compressAsync(articleForCache);
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

async function fetchArticleWithSmryFast(url: string, externalSignal?: AbortSignal): Promise<{ article: CachedArticle; cacheURL: string } | { error: AppError }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout for direct fetch
  // Combine internal timeout with external cancellation signal
  const signal = externalSignal
    ? AbortSignal.any([controller.signal, externalSignal])
    : controller.signal;
  const hostname = (() => { try { return new URL(url).hostname; } catch { return "unknown"; } })();
  const memTracker = startMemoryTrack("article-fetch-smry-fast", { url_host: hostname });

  try {
    logger.info({ source: "smry-fast", hostname }, "Fetching article directly");
    const fetchStart = Date.now();

    const response = await fetch(url, {
      headers: {
        // Use a current browser UA — outdated UAs get blocked by sites like NYTimes
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
        // Google Referer bypasses metered paywalls (NYT, WaPo, etc. allow Google referral traffic)
        "Referer": "https://www.google.com/",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "cross-site",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1",
      },
      redirect: "follow",
      signal,
    });

    if (!response.ok) {
      logger.error({ source: "smry-fast", status: response.status }, "Direct fetch HTTP error");
      memTracker.end({ success: false, status: response.status });
      return { error: createNetworkError(`HTTP ${response.status} error when fetching article`, url, response.status) };
    }

    memTracker.checkpoint("response-received");
    let html = await safeText(response, 2 * 1024 * 1024); // 2MB cap — real articles are 200KB-2MB
    const htmlBytes = html?.length || 0;

    // Track fetch response for memory analysis
    trackFetchResponse(url, "smry-fast", response, htmlBytes, fetchStart);
    memTracker.addMetadata({ html_bytes: htmlBytes });

    if (!html) {
      memTracker.end({ success: false, reason: "empty_html" });
      return { error: createParseError("Received empty HTML content", "smry-fast") };
    }

    // Log large HTML allocations
    if (htmlBytes > 500_000) {
      logLargeAllocation("article-html-parse", htmlBytes, { url_host: hostname, source: "smry-fast" });
    }

    const { document } = parseHTML(html);
    const reader = new Readability(document);
    const parsed = reader.parse();

    if (!parsed || !parsed.content || !parsed.textContent) {
      return { error: createParseError("Failed to extract article content", "smry-fast") };
    }

    const htmlLang = document.documentElement.getAttribute("lang") || parsed.lang || null;
    const textDir = getTextDirection(htmlLang, parsed.textContent);

    let articleCandidate: CachedArticle | null = {
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

    // Release original HTML — it's now stored in articleCandidate.htmlContent
    html = "";

    const validation = CachedArticleSchema.safeParse(articleCandidate);
    // Release candidate — validation.data has its own copy
    articleCandidate = null;

    if (!validation.success) {
      memTracker.end({ success: false, reason: "validation_failed" });
      return { error: createParseError(`Invalid article: ${fromError(validation.error).toString()}`, "smry-fast") };
    }

    // Extract full HTML for separate Redis cache, then build response with 50KB preview only
    const fullHtml = validation.data.htmlContent;
    const article = {
      ...validation.data,
      htmlContent: validation.data.htmlContent?.slice(0, HTML_PREVIEW_LIMIT),
    };
    // Schedule Redis cache — cacheHtmlContentSeparately nulls the string in its finally block
    if (fullHtml) {
      cacheHtmlContentSeparately("smry-fast", url, fullHtml).catch(() => {});
    }

    memTracker.end({ success: true, article_length: article.length });
    return { article, cacheURL: url };
  } catch (error) {
    if (error instanceof ResponseTooLargeError) {
      memTracker.end({ success: false, reason: "response_too_large" });
      return { error: createNetworkError("Response too large", url, 413) };
    }
    if (error instanceof Error && error.name === "AbortError") {
      memTracker.end({ success: false, reason: "timeout" });
      return { error: createNetworkError("Request timed out", url, 408) };
    }
    memTracker.end({ success: false, reason: "fetch_error", error: String(error) });
    return { error: createNetworkError("Failed to fetch article directly", url) };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Direct Wayback Machine fetch — fetches the cached page from archive.org directly
 * instead of going through Diffbot. Archive.org doesn't block server-side requests,
 * so this reliably works for paywalled sites like NYTimes where Diffbot gets 403'd.
 */
async function fetchArticleWithWaybackDirect(url: string, externalSignal?: AbortSignal): Promise<{ article: CachedArticle; cacheURL: string } | { error: AppError }> {
  const waybackUrl = `https://web.archive.org/web/2/${url}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout for Wayback
  const signal = externalSignal
    ? AbortSignal.any([controller.signal, externalSignal])
    : controller.signal;
  const hostname = (() => { try { return new URL(url).hostname; } catch { return "unknown"; } })();
  const memTracker = startMemoryTrack("article-fetch-wayback-direct", { url_host: hostname });

  try {
    logger.info({ source: "wayback", hostname }, "Fetching article directly from Wayback Machine");

    const response = await fetch(waybackUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
      },
      redirect: "follow",
      signal,
    });

    if (!response.ok) {
      logger.error({ source: "wayback", status: response.status }, "Wayback direct fetch HTTP error");
      memTracker.end({ success: false, status: response.status });
      return { error: createNetworkError(`HTTP ${response.status} error from Wayback`, waybackUrl, response.status) };
    }

    memTracker.checkpoint("response-received");
    let html = await safeText(response, 2 * 1024 * 1024); // 2MB cap

    if (!html) {
      memTracker.end({ success: false, reason: "empty_html" });
      return { error: createParseError("Received empty HTML from Wayback", "wayback") };
    }

    const htmlBytes = html.length;
    if (htmlBytes > 500_000) {
      logLargeAllocation("wayback-html-parse", htmlBytes, { url_host: hostname, source: "wayback" });
    }

    // Remove Wayback Machine toolbar/banner injection
    html = html.replace(/<!-- BEGIN WAYBACK TOOLBAR INSERT -->[\s\S]*?<!-- END WAYBACK TOOLBAR INSERT -->/gi, "");

    const { document } = parseHTML(html);
    const reader = new Readability(document);
    const parsed = reader.parse();

    if (!parsed || !parsed.content || !parsed.textContent) {
      memTracker.end({ success: false, reason: "readability_failed" });
      return { error: createParseError("Failed to extract article content from Wayback", "wayback") };
    }

    const htmlLang = document.documentElement.getAttribute("lang") || parsed.lang || null;
    const textDir = getTextDirection(htmlLang, parsed.textContent);

    let articleCandidate: CachedArticle | null = {
      title: parsed.title || document.title || "Untitled",
      content: parsed.content,
      textContent: parsed.textContent,
      length: parsed.textContent.length,
      siteName: hostname,
      byline: parsed.byline,
      publishedTime: extractDateFromDom(document) || null,
      image: extractImageFromDom(document) || null,
      htmlContent: html,
      lang: htmlLang,
      dir: textDir,
    };

    html = "";

    const validation = CachedArticleSchema.safeParse(articleCandidate);
    articleCandidate = null;

    if (!validation.success) {
      memTracker.end({ success: false, reason: "validation_failed" });
      return { error: createParseError(`Invalid article from Wayback: ${fromError(validation.error).toString()}`, "wayback") };
    }

    const fullHtml = validation.data.htmlContent;
    const article = {
      ...validation.data,
      htmlContent: validation.data.htmlContent?.slice(0, HTML_PREVIEW_LIMIT),
    };
    if (fullHtml) {
      cacheHtmlContentSeparately("wayback", url, fullHtml).catch(() => {});
    }

    memTracker.end({ success: true, article_length: article.length });
    return { article, cacheURL: waybackUrl };
  } catch (error) {
    if (error instanceof ResponseTooLargeError) {
      memTracker.end({ success: false, reason: "response_too_large" });
      return { error: createNetworkError("Response too large", waybackUrl, 413) };
    }
    if (error instanceof Error && error.name === "AbortError") {
      memTracker.end({ success: false, reason: "timeout" });
      return { error: createNetworkError("Wayback request timed out", waybackUrl, 408) };
    }
    memTracker.end({ success: false, reason: "fetch_error", error: String(error) });
    return { error: createNetworkError("Failed to fetch article from Wayback", waybackUrl) };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchArticleWithDiffbotWrapper(urlWithSource: string, source: string, externalSignal?: AbortSignal): Promise<{ article: CachedArticle; cacheURL: string } | { error: AppError }> {
  const hostname = (() => { try { return new URL(urlWithSource).hostname; } catch { return "unknown"; } })();
  const memTracker = startMemoryTrack(`article-fetch-${source}`, { url_host: hostname, source });

  try {
    // Early exit if already aborted
    if (externalSignal?.aborted) {
      memTracker.end({ success: false, reason: "aborted_before_start" });
      return { error: createNetworkError("Request cancelled (race loser)", urlWithSource, 499) };
    }
    logger.info({ source, hostname }, "Fetching article with Diffbot");
    const diffbotResult = await fetchArticleWithDiffbot(urlWithSource, source, externalSignal);
    if (diffbotResult.isErr()) {
      memTracker.end({ success: false, reason: "diffbot_error", error: diffbotResult.error.message });
      return { error: diffbotResult.error };
    }

    memTracker.checkpoint("diffbot-response-received");
    const validation = DiffbotArticleSchema.safeParse(diffbotResult.value);
    if (!validation.success) {
      memTracker.end({ success: false, reason: "validation_failed" });
      return { error: createParseError(`Invalid Diffbot response`, source) };
    }

    const va = validation.data;
    const textDir = getTextDirection(va.lang, va.text);

    // Cache full htmlContent separately, then keep only a 50KB preview for bypass detection
    // Extract base URL from wayback format for consistent cache keys
    const originalUrl = source === "wayback"
      ? (urlWithSource.match(/web\.archive\.org\/web\/[^/]+\/(.+)/)?.[1] || urlWithSource)
      : urlWithSource;
    const fullHtml = va.htmlContent;
    if (fullHtml) {
      cacheHtmlContentSeparately(source, originalUrl, fullHtml).catch(() => {});
    }

    const article: CachedArticle = {
      title: va.title, content: va.html, textContent: va.text, length: va.text.length,
      siteName: va.siteName, byline: va.byline, publishedTime: va.publishedTime,
      image: va.image, htmlContent: va.htmlContent?.slice(0, HTML_PREVIEW_LIMIT), lang: va.lang, dir: textDir,
    };

    memTracker.end({ success: true, article_length: article.length });
    return { article, cacheURL: urlWithSource };
  } catch (error) {
    memTracker.end({ success: false, reason: "exception", error: String(error) });
    return { error: createParseError("Failed to parse article", source) };
  }
}

async function fetchArticle(urlWithSource: string, source: string): Promise<{ article: CachedArticle; cacheURL: string } | { error: AppError }> {
  switch (source) {
    case "smry-fast": return fetchArticleWithSmryFast(urlWithSource);
    case "smry-slow": return fetchArticleWithDiffbotWrapper(urlWithSource, source);
    case "wayback": {
      // Extract original URL from wayback format for direct fetch
      const originalUrl = urlWithSource.match(/web\.archive\.org\/web\/[^/]+\/(.+)/)?.[1] || urlWithSource;
      return fetchArticleWithWaybackDirect(originalUrl);
    }
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
            // Cache hit if article has good content (htmlContent is now cached separately)
            if (article.length > 4000) {
              cacheStatus = "hit";
              ctx.merge({ cache_hit: true, article_length: article.length, status_code: 200 });
              ctx.success();
              return {
                source, cacheURL: urlWithSource,
                article: buildArticleResponse(article),
                status: "success",
              };
            }
          }
        }
      } catch { cacheStatus = "error"; }

      ctx.set("cache_status", cacheStatus);

      try {
        await acquireFetchSlot();
      } catch (err) {
        if (err instanceof FetchSlotTimeoutError) {
          ctx.error("Fetch slot timeout", { error_type: "OVERLOADED", status_code: 503 });
          set.status = 503;
          set.headers["retry-after"] = "2";
          return { error: "Server is busy, please retry", type: "OVERLOADED" };
        }
        throw err;
      }

      try {
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
            article: buildArticleResponse(savedArticle),
            status: "success",
          };
        } catch {
          ctx.merge({ cache_save_error: true, article_length: article.length, status_code: 200 });
          ctx.success();

          return {
            source, cacheURL,
            article: buildArticleResponse(article),
            status: "success",
          };
        }
      } finally {
        releaseFetchSlot();
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
              // Cache hit if article has good content (htmlContent is now cached separately)
              if (article.length > 4000) {
                ctx.merge({ cache_hit: true, cache_source: source, article_length: article.length, status_code: 200 });
                ctx.success();
                return {
                  source,
                  cacheURL: getUrlWithSource(source, url),
                  article: buildArticleResponse(article),
                  status: "success",
                };
              }
            }
          }
        } catch {
          // Continue to next source on cache error
        }
      }

      // Acquire a concurrency slot before starting the race
      try {
        await acquireFetchSlot();
      } catch (err) {
        if (err instanceof FetchSlotTimeoutError) {
          ctx.error("Fetch slot timeout", { error_type: "OVERLOADED", status_code: 503 });
          set.status = 503;
          set.headers["retry-after"] = "2";
          return { error: "Server is busy, please retry", type: "OVERLOADED" };
        }
        throw err;
      }

      // OPTIMIZED: "First success wins" pattern with abort cancellation
      // Returns immediately when first source succeeds, aborts losers to free memory
      const fetchStart = Date.now();

      type FetchResult = { source: typeof SOURCES[number]; article: CachedArticle; cacheURL: string };

      // Create abort controllers for each source so losers can be cancelled
      const abortControllers = {
        "smry-fast": new AbortController(),
        "smry-slow": new AbortController(),
        "wayback": new AbortController(),
      };

      const fetchPromises: Promise<FetchResult | null>[] = [
        fetchArticleWithSmryFast(url, abortControllers["smry-fast"].signal).then(r => "article" in r ? { source: "smry-fast" as const, ...r } : null),
        fetchArticleWithDiffbotWrapper(url, "smry-slow", abortControllers["smry-slow"].signal).then(r => "article" in r ? { source: "smry-slow" as const, ...r } : null),
        // Use direct Wayback fetch instead of Diffbot — archive.org doesn't block direct requests,
        // whereas Diffbot's crawlers get 403'd by archive.org for paywalled sites like NYTimes
        fetchArticleWithWaybackDirect(url, abortControllers["wayback"].signal).then(r => "article" in r ? { source: "wayback" as const, ...r } : null),
      ];

      // Track cached sources to prevent duplicate writes
      const cachedSources = new Set<string>();

      const cacheResult = (result: FetchResult) => {
        if (cachedSources.has(result.source)) return; // Already cached
        cachedSources.add(result.source);
        const cacheKey = `${result.source}:${url}`;
        // Direct compress + save — skip decompression comparison during race
        // to avoid doubling memory. Each source gets its own cache key anyway.
        const metaKey = `meta:${cacheKey}`;
        const metadata = { title: result.article.title, siteName: result.article.siteName, length: result.article.length, byline: result.article.byline, publishedTime: result.article.publishedTime, image: result.article.image };
        // htmlContent is already truncated to 50KB preview by the fetch functions
        // Full htmlContent was cached separately via cacheHtmlContentSeparately in the fetchers
        compressAsync({ ...result.article, htmlContent: undefined })
          .then(compressed => Promise.all([redis.set(cacheKey, compressed), redis.set(metaKey, metadata)]))
          .catch(() => {});
      };

      // Helper: race for first quality result, abort losers immediately on winner
      const raceForFirstSuccess = async (): Promise<FetchResult | null> => {
        return new Promise((resolve) => {
          let resolved = false;
          let completedCount = 0;
          const results: (FetchResult | null)[] = [];
          let winningSource: string | null = null;

          const abortLosers = (winnerSource: string) => {
            for (const [source, controller] of Object.entries(abortControllers)) {
              if (source !== winnerSource) {
                controller.abort();
              }
            }
            logger.info({ winning_source: winnerSource }, "Aborted losers immediately after winner found");
          };

          fetchPromises.forEach((promise, index) => {
            promise.then((result) => {
              completedCount++;

              // If race already resolved, cache this late result then release reference
              if (resolved && result) {
                cacheResult(result);
                return;
              }

              results[index] = result;

              // If we have a quality result and haven't resolved yet, resolve immediately
              if (!resolved && result && result.article.length > 500) {
                resolved = true;
                winningSource = result.source;
                ctx.set("fetch_ms", Date.now() - fetchStart);
                ctx.set("winning_source", result.source);

                // Cache winner immediately
                cacheResult(result);

                // Abort losers immediately to free memory — no grace period.
                // The /article/enhanced endpoint fetches independently if needed.
                abortLosers(result.source);

                logger.info({ winning_source: result.source }, "Race winner found, losers aborted immediately");

                resolve(result);

                // Null out results array references to allow GC of large article objects
                for (let i = 0; i < results.length; i++) {
                  if (i !== index) results[i] = null;
                }
              }

              // If all completed and we still haven't resolved, use best available or null
              if (!resolved && completedCount === fetchPromises.length) {
                resolved = true;
                ctx.set("fetch_ms", Date.now() - fetchStart);

                // Cache all successful results
                results.forEach((r) => {
                  if (r && r.source !== winningSource) cacheResult(r);
                });

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

      try {
        const bestResult = await raceForFirstSuccess();

        // Return best result
        if (bestResult) {
          ctx.merge({ cache_hit: false, result_source: bestResult.source, article_length: bestResult.article.length, status_code: 200 });
          ctx.success();
          return {
            source: bestResult.source,
            cacheURL: bestResult.cacheURL,
            article: buildArticleResponse(bestResult.article),
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
      } finally {
        releaseFetchSlot();
      }
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
          article: buildArticleResponse(bestArticle.article),
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
).get(
  "/article/html",
  async ({ query, set }) => {
    try {
      const { url, source } = query;

      // Check separate html cache key first (new format)
      const htmlKey = `html:${source}:${url}`;
      const rawHtml = await redis.get(htmlKey);
      const htmlContent = await decompressAsync(rawHtml);
      if (htmlContent && typeof htmlContent === "string") {
        return { htmlContent };
      }

      // Fall back to main cache key (legacy entries that still have htmlContent inline)
      const cacheKey = `${source}:${url}`;
      const rawCached = await redis.get(cacheKey);
      const cached = await decompressAsync(rawCached);

      if (!cached || typeof cached !== "object" || !("htmlContent" in cached) || !cached.htmlContent) {
        set.status = 404;
        return { error: "HTML content not found in cache" };
      }

      return { htmlContent: (cached as CachedArticle).htmlContent };
    } catch {
      set.status = 500;
      return { error: "Failed to retrieve HTML content" };
    }
  },
  { query: t.Object({ url: t.String(), source: t.String() }) }
);
