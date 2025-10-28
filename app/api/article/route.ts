import { NextRequest, NextResponse } from "next/server";
import { ArticleRequestSchema, ArticleResponseSchema, ErrorResponseSchema } from "@/types/api";
import { fetchArticleWithDiffbot } from "@/lib/api/diffbot";
import { kv } from "@vercel/kv";
import { z } from "zod";
import { fromError } from "zod-validation-error";
import { AppError, createParseError } from "@/lib/errors";
import { createLogger } from "@/lib/logger";

const logger = createLogger('api:article');

// Diffbot Article schema - validates the response from fetchArticleWithDiffbot
const DiffbotArticleSchema = z.object({
  title: z.string().min(1, "Article title cannot be empty"),
  html: z.string().min(1, "Article HTML content cannot be empty"),
  text: z.string().min(1, "Article text content cannot be empty"),
  siteName: z.string().min(1, "Site name cannot be empty"),
});

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
    
    const existingArticleString = await kv.get(key);

    if (existingArticleString) {
      const existingValidation = CachedArticleSchema.safeParse(existingArticleString);
      
      if (!existingValidation.success) {
        const validationError = fromError(existingValidation.error);
        logger.warn({ 
          key,
          validationError: validationError.toString() 
        }, 'Existing cache validation failed - replacing with new article');
        
        // Save new article since existing is invalid
        await kv.set(key, JSON.stringify(validatedNewArticle));
        logger.debug({ key, length: validatedNewArticle.length }, 'Cached article (replaced invalid)');
        return validatedNewArticle;
      }
      
      const existingArticle = existingValidation.data;

      if (validatedNewArticle.length > existingArticle.length) {
        await kv.set(key, JSON.stringify(validatedNewArticle));
        logger.debug({ key, newLength: validatedNewArticle.length, oldLength: existingArticle.length }, 'Cached longer article');
        return validatedNewArticle;
      } else {
        logger.debug({ key, length: existingArticle.length }, 'Using existing cached article');
        return existingArticle;
      }
    } else {
      // No existing article, save the new one
      await kv.set(key, JSON.stringify(validatedNewArticle));
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

/**
 * Fetch and parse article using Diffbot (for direct and wayback sources)
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
      const debugSmryUrl = url ? `https://smry.ai/${url}${source && source !== 'direct' ? `?source=${source}` : ''}` : undefined;
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
    const smryUrl = `https://smry.ai/${validatedUrl}${validatedSource !== 'direct' ? `?source=${validatedSource}` : ''}`;

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
      const cachedArticleJson = await kv.get(cacheKey);

      if (cachedArticleJson) {
        // Validate cached data
        const cacheValidation = CachedArticleSchema.safeParse(cachedArticleJson);
        
        if (!cacheValidation.success) {
          const validationError = fromError(cacheValidation.error);
          logger.warn({ 
            cacheKey,
            validationError: validationError.toString(),
            receivedType: typeof cachedArticleJson,
            hasKeys: cachedArticleJson ? Object.keys(cachedArticleJson as any) : []
          }, 'Cache validation failed - will fetch fresh');
          // Continue to fetch fresh data instead of using invalid cache
        } else {
          const article = cacheValidation.data;

          if (article.length > 4000) {
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
              },
              status: "success",
            });

            return NextResponse.json(response);
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
        },
        status: "success",
      });

      return NextResponse.json(response);
    }
  } catch (error) {
    // Try to extract URL info for better debugging
    const searchParams = request.nextUrl.searchParams;
    const url = searchParams.get("url");
    const source = searchParams.get("source") || "direct";
    const debugSmryUrl = url ? `https://smry.ai/${url}${source !== 'direct' ? `?source=${source}` : ''}` : undefined;
    
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

