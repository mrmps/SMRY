import { NextRequest, NextResponse } from "next/server";
import { ArticleRequestSchema, ArticleResponseSchema, ErrorResponseSchema } from "@/types/api";
import { fetchArticleWithDiffbot } from "@/lib/api/diffbot";
import { redis } from "@/lib/redis";
import { compress, decompress } from "@/lib/redis-compression";
import { z } from "zod";
import { fromError } from "zod-validation-error";
import { AppError, createNetworkError, createParseError } from "@/lib/errors";
import { createLogger } from "@/lib/logger";
import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";

const logger = createLogger('api:article');

// Diffbot Article schema - validates the response from fetchArticleWithDiffbot
const DiffbotArticleSchema = z.object({
  title: z.string().min(1, "Article title cannot be empty"),
  html: z.string().min(1, "Article HTML content cannot be empty"),
  text: z.string().min(1, "Article text content cannot be empty"),
  siteName: z.string().min(1, "Site name cannot be empty"),
  htmlContent: z.string().optional(),
});

// Article schema for caching
const CachedArticleSchema = z.object({
  title: z.string(),
  content: z.string(),
  textContent: z.string(),
  length: z.number().int().positive(),
  siteName: z.string(),
  htmlContent: z.string().optional(),
});

type CachedArticle = z.infer<typeof CachedArticleSchema>;

type ArticleMetadata = {
  title: string;
  siteName: string;
  length: number;
};

/**
 * Get URL with source prefix
 */
function getUrlWithSource(source: string, url: string): string {
  switch (source) {
    case "wayback":
      return `https://web.archive.org/web/0/${url}`;
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
      };

      await Promise.all([
        redis.set(key, compress(article)),
        redis.set(metaKey, metadata)
      ]);
    };

    const rawCachedData = await redis.get(key);
    const cachedData = decompress(rawCachedData);

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

    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const parsed = reader.parse();

    if (!parsed || !parsed.content || !parsed.textContent) {
      logger.warn({ source: "smry-fast" }, 'Readability extraction failed');
      return {
        error: createParseError('Failed to extract article content with Readability', 'smry-fast'),
      };
    }

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
      htmlContent: originalHtml, // Original page HTML
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
  } catch (error) {
    logger.error({ source: "smry-fast", error }, 'Direct fetch exception');
    return {
      error: createNetworkError('Failed to fetch article directly', url, undefined, error),
    };
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

    const article: CachedArticle = {
      title: validatedArticle.title,
      content: validatedArticle.html,
      textContent: validatedArticle.text,
      length: validatedArticle.text.length,
      siteName: validatedArticle.siteName,
      htmlContent: validatedArticle.htmlContent,
    };

    logger.debug({ source, title: article.title, length: article.length }, 'Diffbot article parsed and validated');
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
      const debugSmryUrl = url ? buildSmryUrl(url, source ?? "smry-fast") : undefined;
      logger.error({ error: error.toString(), smryUrl: debugSmryUrl, url, source }, 'Validation error - Full URL for debugging');
      return NextResponse.json(
        ErrorResponseSchema.parse({
          error: error.toString(),
          type: "VALIDATION_ERROR",
        }),
        { status: 400 }
      );
    }

    const { url: validatedUrl, source: validatedSource } = validationResult.data;

    // Construct the full smry.ai URL for debugging
    const smryUrl = buildSmryUrl(validatedUrl, validatedSource);

    // Jina.ai is handled by a separate endpoint (/api/jina) for client-side fetching
    if (validatedSource === "jina.ai") {
      logger.warn({ source: validatedSource, smryUrl }, 'Jina.ai source not supported in this endpoint');
      return NextResponse.json(
        ErrorResponseSchema.parse({
          error: "Jina.ai source is handled client-side. Use /api/jina endpoint instead.",
          type: "VALIDATION_ERROR",
        }),
        { status: 400 }
      );
    }

    logger.info({ source: validatedSource, hostname: new URL(validatedUrl).hostname, smryUrl }, 'API Request');

    const urlWithSource = getUrlWithSource(validatedSource, validatedUrl);
    const cacheKey = `${validatedSource}:${validatedUrl}`;

    // Try to get from cache
    try {
      const rawCachedArticle = await redis.get(cacheKey);
      const cachedArticle = decompress(rawCachedArticle);

      if (cachedArticle) {
        // Validate cached data
        const cacheValidation = CachedArticleSchema.safeParse(cachedArticle);
        
        if (!cacheValidation.success) {
          const validationError = fromError(cacheValidation.error);
          logger.warn({ 
            cacheKey,
            validationError: validationError.toString(),
            receivedType: typeof cachedArticle,
            hasKeys: cachedArticle ? Object.keys(cachedArticle as any) : []
          }, 'Cache validation failed - will fetch fresh');
          // Continue to fetch fresh data instead of using invalid cache
        } else {
          const article = cacheValidation.data;

          if (article.length > 4000 && article.htmlContent) {
            logger.debug({ source: validatedSource, hostname: new URL(validatedUrl).hostname, length: article.length }, 'Cache hit');
            
            // Validate final response structure
            const response = ArticleResponseSchema.parse({
              source: validatedSource,
              cacheURL: urlWithSource,
              article: {
                title: article.title,
                byline: "",
                dir: "",
                lang: "",
                content: article.content,
                textContent: article.textContent,
                length: article.length,
                siteName: article.siteName,
                htmlContent: article.htmlContent,
              },
              status: "success",
            });

            return NextResponse.json(response);
          } else if (article.length > 4000 && !article.htmlContent) {
             logger.info({ source: validatedSource, hostname: new URL(validatedUrl).hostname }, 'Cache hit but missing HTML content - fetching fresh');
          }
        }
      }
    } catch (error) {
      const validationError = fromError(error);
      logger.warn({ 
        error: error instanceof Error ? error.message : String(error),
        validationError: validationError.toString()
      }, 'Cache read error');
      // Continue to fetch fresh data
    }

    // Fetch fresh data
    logger.info({ source: validatedSource, smryUrl }, 'Fetching fresh data');
    const result = await fetchArticle(urlWithSource, validatedSource);

    if ("error" in result) {
      const appError = result.error;
      logger.error({ 
        source: validatedSource, 
        errorType: appError.type, 
        message: appError.message, 
        hasDebugContext: !!appError.debugContext,
        smryUrl,
        urlWithSource,
      }, 'Fetch failed - Full URL for debugging');
      
      // Include cacheURL in error details so frontend can show the actual URL that was attempted
      const errorDetails = {
        ...appError,
        url: urlWithSource, // The actual URL that was attempted (with source prefix)
        smryUrl, // Full smry.ai URL for easy debugging
      };
      
      return NextResponse.json(
        ErrorResponseSchema.parse({
          error: appError.message,
          type: appError.type,
          details: errorDetails,
          debugContext: appError.debugContext,
        }),
        { status: 500 }
      );
    }

    const { article, cacheURL } = result;

    // Save to cache
    try {
      const savedArticle = await saveOrReturnLongerArticle(cacheKey, article);
      
      // Validate saved article
      const savedValidation = CachedArticleSchema.safeParse(savedArticle);
      
      if (!savedValidation.success) {
        const validationError = fromError(savedValidation.error);
        logger.error({ 
          cacheKey,
          validationError: validationError.toString() 
        }, 'Saved article validation failed');
        
        // Use original article if saved validation fails
        const response = ArticleResponseSchema.parse({
          source: validatedSource,
          cacheURL,
          article: {
            title: article.title,
            byline: "",
            dir: "",
            lang: "",
            content: article.content,
            textContent: article.textContent,
            length: article.length,
            siteName: article.siteName,
            htmlContent: article.htmlContent,
          },
          status: "success",
        });
        
        return NextResponse.json(response);
      }
      
      const validatedSavedArticle = savedValidation.data;
      
      const response = ArticleResponseSchema.parse({
        source: validatedSource,
        cacheURL,
        article: {
          title: validatedSavedArticle.title,
          byline: "",
          dir: "",
          lang: "",
          content: validatedSavedArticle.content,
          textContent: validatedSavedArticle.textContent,
          length: validatedSavedArticle.length,
          siteName: validatedSavedArticle.siteName,
          htmlContent: validatedSavedArticle.htmlContent,
        },
        status: "success",
      });

      logger.info({ source: validatedSource, title: validatedSavedArticle.title }, 'Success');
      return NextResponse.json(response);
    } catch (error) {
      const validationError = fromError(error);
      logger.warn({ 
        error: error instanceof Error ? error.message : String(error),
        validationError: validationError.toString()
      }, 'Cache save error');
      
      // Return article even if caching fails - validate it first
      const articleValidation = CachedArticleSchema.safeParse(article);
      
      if (!articleValidation.success) {
        const articleError = fromError(articleValidation.error);
        logger.error({ 
          validationError: articleError.toString() 
        }, 'Article validation failed in error handler');
        
        // Return error if we can't validate the article
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
          byline: "",
          dir: "",
          lang: "",
          content: validatedArticle.content,
          textContent: validatedArticle.textContent,
          length: validatedArticle.length,
          siteName: validatedArticle.siteName,
          htmlContent: validatedArticle.htmlContent,
        },
        status: "success",
      });

      return NextResponse.json(response);
    }
  } catch (error) {
    // Try to extract URL info for better debugging
    const searchParams = request.nextUrl.searchParams;
    const url = searchParams.get("url");
    const source = searchParams.get("source") || "smry-fast";
    const debugSmryUrl = url ? buildSmryUrl(url, source) : undefined;
    
    logger.error({ 
      error, 
      smryUrl: debugSmryUrl,
      url,
      source,
    }, 'Unexpected error in API route - Full URL for debugging');
    
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
