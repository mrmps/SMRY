import { NextRequest, NextResponse } from "next/server";
import { ArticleRequestSchema, ArticleResponseSchema, ErrorResponseSchema } from "@/types/api";
import { fetchArticleWithDiffbot, extractDateFromDom, extractImageFromDom } from "@/lib/api/diffbot";
import { redis } from "@/lib/redis";
import { compressAsync, decompressAsync } from "@/lib/redis-compression";
import { z } from "zod";
import { fromError } from "zod-validation-error";
import { AppError, createNetworkError, createParseError } from "@/lib/errors";
import { isHardPaywall, getHardPaywallInfo } from "@/lib/hard-paywalls";
import { createLogger } from "@/lib/logger";
import { Readability } from "@mozilla/readability";
import { JSDOM, VirtualConsole } from "jsdom";
import { createRequestContext, extractRequestInfo, extractClientIp } from "@/lib/request-context";
import { getTextDirection } from "@/lib/rtl";
import { storeArticleHtml } from "@/lib/db";

/**
 * Create a fresh VirtualConsole for each JSDOM instance.
 * This prevents memory accumulation from a shared singleton.
 */
function createVirtualConsole(): VirtualConsole {
  const vc = new VirtualConsole();
  vc.on("error", () => {
    // Intentionally ignore CSS parsing errors
  });
  return vc;
}

// Logger for internal helper functions (debug level)
const logger = createLogger("api:article");

// Diffbot Article schema - validates the response from fetchArticleWithDiffbot
const DiffbotArticleSchema = z.object({
  title: z.string().min(1, "Article title cannot be empty"),
  html: z.string().min(1, "Article HTML content cannot be empty"),
  text: z.string().min(1, "Article text content cannot be empty"),
  siteName: z.string().min(1, "Site name cannot be empty"),
  byline: z.string().optional().nullable(),
  publishedTime: z.string().optional().nullable(),
  image: z.string().nullable().optional(),
  htmlContent: z.string().optional(),
  lang: z.string().optional().nullable(),
});

// Article schema for caching
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
  dir: z.enum(['rtl', 'ltr']).optional().nullable(),
});

type CachedArticle = z.infer<typeof CachedArticleSchema>;

type ArticleMetadata = {
  title: string;
  siteName: string;
  length: number;
  byline?: string | null;
  publishedTime?: string | null;
  image?: string | null;
};

/**
 * Get URL with source prefix
 */
function getUrlWithSource(source: string, url: string): string {
  switch (source) {
    case "wayback":
      return `https://web.archive.org/web/2/${url}`;
    case "smry-fast":
    case "smry-slow":
    default:
      return url;
  }
}

function buildSmryUrl(url: string, source?: string | null): string {
  if (!source || source === "smry-fast") {
    return `https://smry.ai/${url}`;
  }

  return `https://smry.ai/${url}?source=${source}`;
}

/**
 * Save or return longer article
 */
async function saveOrReturnLongerArticle(
  key: string,
  newArticle: CachedArticle
): Promise<CachedArticle> {
  try {
    // Validate incoming article first
    const incomingValidation = CachedArticleSchema.safeParse(newArticle);
    
    if (!incomingValidation.success) {
      const validationError = fromError(incomingValidation.error);
      logger.error({ 
        key, 
        validationError: validationError.toString(),
        articleData: {
          hasTitle: !!newArticle.title,
          hasContent: !!newArticle.content,
          hasTextContent: !!newArticle.textContent,
          length: newArticle.length,
        }
      }, 'Incoming article validation failed');
      throw new Error(`Invalid article data: ${validationError.toString()}`);
    }
    
    const validatedNewArticle = incomingValidation.data;
    
    // Helper to save both compressed article and metadata
    const saveToCache = async (article: CachedArticle) => {
      const metaKey = `meta:${key}`;

      const metadata: ArticleMetadata = {
        title: article.title,
        siteName: article.siteName,
        length: article.length,
        byline: article.byline,
        publishedTime: article.publishedTime,
        image: article.image,
      };

      const compressedArticle = await compressAsync(article);
      await Promise.all([
        redis.set(key, compressedArticle),
        redis.set(metaKey, metadata)
      ]);
    };

    const rawCachedData = await redis.get(key);
    const cachedData = await decompressAsync(rawCachedData);

    if (cachedData) {
      const existingValidation = CachedArticleSchema.safeParse(cachedData);
      
      if (!existingValidation.success) {
        const validationError = fromError(existingValidation.error);
        logger.warn({ 
          key,
          validationError: validationError.toString() 
        }, 'Existing cache validation failed - replacing with new article');
        
        // Save new article since existing is invalid
        await saveToCache(validatedNewArticle);
        logger.debug({ key, length: validatedNewArticle.length }, 'Cached article (replaced invalid)');
        return validatedNewArticle;
      }
      
      const existingArticle = existingValidation.data;

      // Prioritize HTML content: if existing is missing HTML but new one has it, update cache
      if (!existingArticle.htmlContent && validatedNewArticle.htmlContent) {
        await saveToCache(validatedNewArticle);
        logger.debug({ key, length: validatedNewArticle.length }, 'Cached article (replaced missing HTML)');
        return validatedNewArticle;
      }

      if (validatedNewArticle.length > existingArticle.length) {
        await saveToCache(validatedNewArticle);
        logger.debug({ key, newLength: validatedNewArticle.length, oldLength: existingArticle.length }, 'Cached longer article');
        return validatedNewArticle;
      } else {
        logger.debug({ key, length: existingArticle.length }, 'Using existing cached article');
        return existingArticle;
      }
    } else {
      // No existing article, save the new one
      await saveToCache(validatedNewArticle);
      logger.debug({ key, length: validatedNewArticle.length }, 'Cached article (new)');
      return validatedNewArticle;
    }
  } catch (error) {
    const validationError = fromError(error);
    logger.warn({ error: validationError.toString() }, 'Cache operation error');
    // Return the new article even if caching fails
    return newArticle;
  }
}

async function fetchArticleWithSmryFast(
  url: string
): Promise<{ article: CachedArticle; cacheURL: string } | { error: AppError }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

  try {
    logger.info({ source: "smry-fast", hostname: new URL(url).hostname }, 'Fetching article directly');

    const response = await fetch(url, {
      headers: {
        "User-Agent": "smry.ai bot/1.0 (+https://smry.ai)",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      cache: "no-store",
      redirect: "follow",
      signal: controller.signal,
    });

    if (!response.ok) {
      logger.error({ source: "smry-fast", status: response.status }, 'Direct fetch HTTP error');
      return {
        error: createNetworkError(
          `HTTP ${response.status} error when fetching article`,
          url,
          response.status
        ),
      };
    }

    const html = await response.text();

    if (!html) {
      logger.warn({ source: "smry-fast", htmlLength: 0 }, 'Received empty HTML content');
      return {
        error: createParseError('Received empty HTML content', 'smry-fast'),
      };
    }

    // Store original HTML before Readability parsing
    const originalHtml = html;

    const dom = new JSDOM(html, { url, virtualConsole: createVirtualConsole() });
    try {
      const reader = new Readability(dom.window.document);
      const parsed = reader.parse();

      if (!parsed || !parsed.content || !parsed.textContent) {
        logger.warn({ source: "smry-fast" }, 'Readability extraction failed');
        return {
          error: createParseError('Failed to extract article content with Readability', 'smry-fast'),
        };
      }

      // Extract language from HTML
      const htmlLang = dom.window.document.documentElement.getAttribute('lang') ||
                       dom.window.document.documentElement.getAttribute('xml:lang') ||
                       parsed.lang || // Readability may extract this
                       null;

      // Detect text direction based on language or content analysis
      const textDir = getTextDirection(htmlLang, parsed.textContent);

      const articleCandidate: CachedArticle = {
        title: parsed.title || dom.window.document.title || 'Untitled',
        content: parsed.content,
        textContent: parsed.textContent,
        length: parsed.textContent.length,
        siteName: (() => {
          try {
            return new URL(url).hostname;
          } catch {
            return parsed.siteName || 'unknown';
          }
        })(),
        byline: parsed.byline,
        publishedTime: extractDateFromDom(dom.window.document) || null,
        image: extractImageFromDom(dom.window.document) || null,
        htmlContent: originalHtml, // Original page HTML
        lang: htmlLang,
        dir: textDir,
      };

      const validationResult = CachedArticleSchema.safeParse(articleCandidate);

      if (!validationResult.success) {
        const validationError = fromError(validationResult.error);
        logger.error({ source: "smry-fast", validationError: validationError.toString() }, 'Readability article validation failed');
        return {
          error: createParseError(
            `Invalid Readability article: ${validationError.toString()}`,
            'smry-fast',
            validationError
          ),
        };
      }

      const validatedArticle = validationResult.data;
      logger.debug({ source: "smry-fast", title: validatedArticle.title, length: validatedArticle.length }, 'Direct article parsed and validated');

      return {
        article: validatedArticle,
        cacheURL: url,
      };
    } finally {
      // IMPORTANT: Close JSDOM window to prevent memory leaks
      // See docs/MEMORY_LEAK_FIX.md for details
      dom.window.close();
    }
  } catch (error) {
    // Handle timeout/abort errors specifically
    if (error instanceof Error && error.name === 'AbortError') {
      logger.error({ source: "smry-fast", url }, 'Request timed out after 30s');
      return {
        error: createNetworkError('Request timed out', url, 408, error),
      };
    }
    logger.error({ source: "smry-fast", error }, 'Direct fetch exception');
    return {
      error: createNetworkError('Failed to fetch article directly', url, undefined, error),
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetch and parse article using Diffbot (for smry-slow and wayback sources)
 */
async function fetchArticleWithDiffbotWrapper(
  urlWithSource: string,
  source: string
): Promise<{ article: CachedArticle; cacheURL: string } | { error: AppError }> {
  try {
    logger.info({ source, hostname: new URL(urlWithSource).hostname }, 'Fetching article with Diffbot');
    
    // Pass source parameter to enable debug tracking
    const diffbotResult = await fetchArticleWithDiffbot(urlWithSource, source);

    if (diffbotResult.isErr()) {
      const error = diffbotResult.error;
      logger.error({ source, errorType: error.type, message: error.message, hasDebugContext: !!error.debugContext }, 'Diffbot fetch failed');
      return { error };
    }

    const diffbotArticle = diffbotResult.value;

    // Validate Diffbot response with Zod
    const validationResult = DiffbotArticleSchema.safeParse(diffbotArticle);
    
    if (!validationResult.success) {
      const validationError = fromError(validationResult.error);
      logger.error({ 
        source, 
        validationError: validationError.toString(),
        receivedData: {
          hasTitle: !!diffbotArticle.title,
          hasHtml: !!diffbotArticle.html,
          hasText: !!diffbotArticle.text,
          hasSiteName: !!diffbotArticle.siteName,
          titleLength: diffbotArticle.title?.length || 0,
          htmlLength: diffbotArticle.html?.length || 0,
          textLength: diffbotArticle.text?.length || 0,
        }
      }, 'Diffbot response validation failed');
      
      return { 
        error: createParseError(
          `Invalid Diffbot response: ${validationError.toString()}`, 
          source, 
          validationError
        )
      };
    }

    const validatedArticle = validationResult.data;

    // Detect text direction based on language or content analysis
    const textDir = getTextDirection(validatedArticle.lang, validatedArticle.text);

    const article: CachedArticle = {
      title: validatedArticle.title,
      content: validatedArticle.html,
      textContent: validatedArticle.text,
      length: validatedArticle.text.length,
      siteName: validatedArticle.siteName,
      byline: validatedArticle.byline,
      publishedTime: validatedArticle.publishedTime,
      image: validatedArticle.image,
      htmlContent: validatedArticle.htmlContent,
      lang: validatedArticle.lang,
      dir: textDir,
    };

    logger.debug({ source, title: article.title, length: article.length, lang: article.lang, dir: article.dir }, 'Diffbot article parsed and validated');
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
  switch (source) {
    case "smry-fast":
      return fetchArticleWithSmryFast(urlWithSource);
    case "smry-slow":
    case "wayback":
      return fetchArticleWithDiffbotWrapper(urlWithSource, source);
    default:
      return {
        error: createParseError(`Unsupported source: ${source}`, source),
      };
  }
}

/**
 * GET /api/article?url=...&source=...
 *
 * Uses wide event pattern - one canonical log line per request with all context.
 */
export async function GET(request: NextRequest) {
  // Initialize wide event context
  const ctx = createRequestContext({
    ...extractRequestInfo(request),
    ip: extractClientIp(request),
  });
  ctx.set("endpoint", "/api/article");

  try {
    // Parse and validate query parameters
    const searchParams = request.nextUrl.searchParams;
    const url = searchParams.get("url");
    const source = searchParams.get("source");

    ctx.merge({ url_param: url, source_param: source });

    const validationResult = ArticleRequestSchema.safeParse({ url, source });

    if (!validationResult.success) {
      const error = fromError(validationResult.error);
      ctx.error(error.toString(), {
        error_type: "VALIDATION_ERROR",
        status_code: 400,
      });
      return NextResponse.json(
        ErrorResponseSchema.parse({
          error: error.toString(),
          type: "VALIDATION_ERROR",
        }),
        { status: 400 }
      );
    }

    const { url: validatedUrl, source: validatedSource } = validationResult.data;
    const hostname = new URL(validatedUrl).hostname;

    // Add validated params to context
    ctx.merge({
      source: validatedSource,
      hostname,
      url: validatedUrl,
    });

    // Check for hard paywalls - return early with clear error
    if (isHardPaywall(hostname)) {
      const paywallInfo = getHardPaywallInfo(hostname);
      const siteName = paywallInfo?.name || hostname;

      ctx.error(`Hard paywall site: ${siteName}`, {
        error_type: "PAYWALL_ERROR",
        status_code: 403,
      });

      return NextResponse.json(
        {
          error: `${siteName} uses a hard paywall that cannot be bypassed. This site requires a paid subscription to access their content.`,
          type: "PAYWALL_ERROR",
          hostname,
          siteName,
          learnMoreUrl: "/hard-paywalls",
        },
        { status: 403 }
      );
    }

    // Jina.ai is handled by a separate endpoint
    if (validatedSource === "jina.ai") {
      ctx.error("Jina.ai source not supported", {
        error_type: "VALIDATION_ERROR",
        status_code: 400,
      });
      return NextResponse.json(
        ErrorResponseSchema.parse({
          error: "Jina.ai source is handled client-side. Use /api/jina endpoint instead.",
          type: "VALIDATION_ERROR",
        }),
        { status: 400 }
      );
    }

    const urlWithSource = getUrlWithSource(validatedSource, validatedUrl);
    const cacheKey = `${validatedSource}:${validatedUrl}`;

    // Try to get from cache
    let cacheHit = false;
    let cacheStatus: "hit" | "miss" | "invalid" | "error" = "miss";

    try {
      const cacheStart = Date.now();
      const rawCachedArticle = await redis.get(cacheKey);
      const cacheLookupMs = Date.now() - cacheStart;
      ctx.set("cache_lookup_ms", cacheLookupMs);

      const cachedArticle = await decompressAsync(rawCachedArticle);

      if (cachedArticle) {
        const cacheValidation = CachedArticleSchema.safeParse(cachedArticle);

        if (!cacheValidation.success) {
          cacheStatus = "invalid";
        } else {
          const article = cacheValidation.data;

          if (article.length > 4000 && article.htmlContent) {
            cacheHit = true;
            cacheStatus = "hit";
            ctx.merge({
              cache_hit: true,
              article_length: article.length,
              article_title: article.title,
              status_code: 200,
            });

            const response = ArticleResponseSchema.parse({
              source: validatedSource,
              cacheURL: urlWithSource,
              article: {
                title: article.title,
                byline: article.byline || null,
                dir: article.dir || getTextDirection(article.lang, article.textContent),
                lang: article.lang || "",
                content: article.content,
                textContent: article.textContent,
                length: article.length,
                siteName: article.siteName,
                publishedTime: article.publishedTime || null,
                image: article.image || null,
                htmlContent: article.htmlContent,
              },
              status: "success",
            });

            ctx.success();
            return NextResponse.json(response);
          } else if (article.length > 4000 && !article.htmlContent) {
            cacheStatus = "miss"; // Valid but missing HTML, need to refetch
          }
        }
      }
    } catch {
      cacheStatus = "error";
    }

    ctx.set("cache_status", cacheStatus);

    // Fetch fresh data
    const fetchStart = Date.now();
    const result = await fetchArticle(urlWithSource, validatedSource);
    const fetchMs = Date.now() - fetchStart;
    ctx.set("fetch_ms", fetchMs);

    if ("error" in result) {
      const appError = result.error;
      // Include upstream context if available (tells us which host/service actually failed)
      const upstream = "upstream" in appError ? appError.upstream : undefined;
      ctx.error(appError.message, {
        error_type: appError.type,
        status_code: 500,
        ...(upstream && {
          upstream_hostname: upstream.hostname,
          upstream_status_code: upstream.statusCode,
          upstream_error_code: upstream.errorCode,
          upstream_message: upstream.message,
        }),
      });

      return NextResponse.json(
        ErrorResponseSchema.parse({
          error: appError.message,
          type: appError.type,
          details: { url: urlWithSource },
          debugContext: appError.debugContext,
        }),
        { status: 500 }
      );
    }

    const { article, cacheURL } = result;

    // Store HTML for training (fire and forget)
    if (article.htmlContent) {
      storeArticleHtml(validatedUrl, article.htmlContent);
    }

    // Save to cache
    try {
      const cacheStart = Date.now();
      const savedArticle = await saveOrReturnLongerArticle(cacheKey, article);
      ctx.set("cache_save_ms", Date.now() - cacheStart);

      const savedValidation = CachedArticleSchema.safeParse(savedArticle);

      if (!savedValidation.success) {
        ctx.set("cache_save_valid", false);
        // Use original article
        const response = ArticleResponseSchema.parse({
          source: validatedSource,
          cacheURL,
          article: {
            title: article.title,
            byline: article.byline || null,
            dir: article.dir || getTextDirection(article.lang, article.textContent),
            lang: article.lang || "",
            content: article.content,
            textContent: article.textContent,
            length: article.length,
            siteName: article.siteName,
            publishedTime: article.publishedTime || null,
            htmlContent: article.htmlContent,
          },
          status: "success",
        });

        ctx.merge({
          cache_hit: false,
          article_length: article.length,
          article_title: article.title,
          status_code: 200,
        });
        ctx.success();
        return NextResponse.json(response);
      }

      const validatedSavedArticle = savedValidation.data;

      const response = ArticleResponseSchema.parse({
        source: validatedSource,
        cacheURL,
        article: {
          title: validatedSavedArticle.title,
          byline: validatedSavedArticle.byline || null,
          dir: validatedSavedArticle.dir || getTextDirection(validatedSavedArticle.lang, validatedSavedArticle.textContent),
          lang: validatedSavedArticle.lang || "",
          content: validatedSavedArticle.content,
          textContent: validatedSavedArticle.textContent,
          length: validatedSavedArticle.length,
          siteName: validatedSavedArticle.siteName,
          publishedTime: validatedSavedArticle.publishedTime || null,
          htmlContent: validatedSavedArticle.htmlContent,
        },
        status: "success",
      });

      ctx.merge({
        cache_hit: false,
        article_length: validatedSavedArticle.length,
        article_title: validatedSavedArticle.title,
        status_code: 200,
      });
      ctx.success();
      return NextResponse.json(response);

    } catch (error) {
      // Return article even if caching fails
      const articleValidation = CachedArticleSchema.safeParse(article);

      if (!articleValidation.success) {
        const articleError = fromError(articleValidation.error);
        ctx.error(articleError.toString(), {
          error_type: "VALIDATION_ERROR",
          status_code: 500,
        });

        return NextResponse.json(
          ErrorResponseSchema.parse({
            error: `Article validation failed: ${articleError.toString()}`,
            type: "VALIDATION_ERROR",
          }),
          { status: 500 }
        );
      }

      const validatedArticle = articleValidation.data;

      const response = ArticleResponseSchema.parse({
        source: validatedSource,
        cacheURL,
        article: {
          title: validatedArticle.title,
          byline: validatedArticle.byline || null,
          dir: validatedArticle.dir || getTextDirection(validatedArticle.lang, validatedArticle.textContent),
          lang: validatedArticle.lang || "",
          content: validatedArticle.content,
          textContent: validatedArticle.textContent,
          length: validatedArticle.length,
          siteName: validatedArticle.siteName,
          publishedTime: validatedArticle.publishedTime || null,
          image: validatedArticle.image || null,
          htmlContent: validatedArticle.htmlContent,
        },
        status: "success",
      });

      ctx.merge({
        cache_hit: false,
        cache_save_error: true,
        article_length: validatedArticle.length,
        article_title: validatedArticle.title,
        status_code: 200,
      });
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
