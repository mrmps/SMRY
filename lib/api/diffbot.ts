import { ResultAsync, errAsync } from "neverthrow";
import {
  AppError,
  createDiffbotError,
  DebugContext,
  DebugStep,
} from "@/lib/errors/types";
import { createLogger } from "@/lib/logger";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import { z } from "zod";
import { fromError } from "zod-validation-error";

const logger = createLogger('lib:diffbot');

// Zod schemas for Diffbot API responses
const DiffbotStatsSchema = z.object({
  fetchTime: z.number().optional(),
  confidence: z.number().optional(),
}).optional();

const DiffbotArticleObjectSchema = z.object({
  title: z.string().optional(),
  text: z.string().optional(),
  html: z.string().optional(),
  dom: z.string().optional(),
  author: z.string().optional(),
  date: z.string().optional(),
  url: z.string().optional(),
  pageUrl: z.string().optional(),
  authorUrl: z.string().optional(),
  siteName: z.string().optional(),
  humanLanguage: z.string().optional(),
  images: z.array(z.any()).optional(),
  media: z.array(z.any()).optional(),
  tags: z.array(z.any()).optional(),
  categories: z.array(z.any()).optional(),
  authors: z.array(z.any()).optional(),
  stats: DiffbotStatsSchema,
}).passthrough(); // Allow additional fields

const DiffbotRequestSchema = z.object({
  pageUrl: z.string(),
  api: z.string(),
  version: z.number(),
  options: z.array(z.string()).optional(),
}).passthrough();

const DiffbotArticleResponseSchema = z.object({
  // Old API format (direct properties)
  title: z.string().optional(),
  text: z.string().optional(),
  html: z.string().optional(),
  dom: z.string().optional(),
  author: z.string().optional(),
  date: z.string().optional(),
  url: z.string().optional(),
  media: z.array(z.any()).optional(),
  stats: DiffbotStatsSchema,
  
  // New API format (objects array)
  request: DiffbotRequestSchema.optional(),
  objects: z.array(DiffbotArticleObjectSchema).optional(),
  
  // Error response
  errorCode: z.number().optional(),
  error: z.string().optional(),
}).passthrough(); // Allow additional fields

// Schema for the article we extract and return
const DiffbotArticleSchema = z.object({
  title: z.string().min(1, "Article title cannot be empty"),
  html: z.string().min(1, "Article HTML content cannot be empty"),
  text: z.string().min(100, "Article text must be at least 100 characters"),
  siteName: z.string().min(1, "Site name cannot be empty"),
  byline: z.string().optional().nullable(),
  publishedTime: z.string().optional().nullable(),
  image: z.string().nullable().optional(),
  htmlContent: z.string().optional(), // Original page HTML (full DOM)
});

// Schema for Readability parsed article
const ReadabilityArticleSchema = z.object({
  title: z.string(),
  content: z.string(),
  textContent: z.string(),
  siteName: z.string().optional().nullable(),
  byline: z.string().optional().nullable(),
  publishedTime: z.string().optional().nullable(),
  excerpt: z.string().optional().nullable(),
}).passthrough();

/**
 * Helper to create a debug context
 */
function createDebugContext(url: string, source: string): DebugContext {
  return {
    timestamp: new Date().toISOString(),
    url,
    source,
    steps: [],
  };
}

/**
 * Helper to add a debug step
 */
function addDebugStep(
  context: DebugContext,
  step: string,
  status: DebugStep['status'],
  message: string,
  data?: DebugStep['data']
): void {
  context.steps.push({
    step,
    timestamp: new Date().toISOString(),
    status,
    message,
    data,
  });
}


/**
 * Structured article data from Diffbot
 */
export interface DiffbotArticle {
  title: string;
  html: string;
  text: string;
  siteName: string;
  byline?: string | null;
  publishedTime?: string | null;
  image?: string | null;
  htmlContent?: string; // Original page HTML (full DOM)
}

/**
 * Manually extract image from DOM
 */
export function extractImageFromDom(doc: Document): string | undefined {
  const imageSelectors = [
    'meta[property="og:image"]',
    'meta[name="og:image"]',
    'meta[name="twitter:image"]',
    'meta[property="twitter:image"]',
    'link[rel="image_src"]',
  ];

  for (const selector of imageSelectors) {
    const element = doc.querySelector(selector);
    if (element) {
      const image = element.getAttribute('content') || element.getAttribute('href');
      if (image) return image;
    }
  }
  return undefined;
}

/**
 * Manually extract date from DOM if Readability fails
 */
export function extractDateFromDom(doc: Document): string | undefined {
  // Try common meta tags
  const dateSelectors = [
    'meta[property="article:published_time"]',
    'meta[name="article:published_time"]',
    'meta[property="og:published_time"]',
    'meta[name="og:published_time"]',
    'meta[name="date"]',
    'meta[name="pubdate"]',
    'meta[name="sailthru.date"]',
    'meta[name="dc.date"]',
    'meta[name="dc.date.issued"]',
    'meta[name="citation_date"]',
    'meta[name="citation_publication_date"]',
    'time[datetime]',
    'time[pubdate]',
  ];

  for (const selector of dateSelectors) {
    const element = doc.querySelector(selector);
    if (element) {
      const date = element.getAttribute('content') || element.getAttribute('datetime') || element.getAttribute('value');
      if (date) return date;
    }
  }

  // Try LD-JSON
  const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
  for (const script of Array.from(scripts)) {
    try {
      const json = JSON.parse(script.textContent || '{}');
      if (json.datePublished) return json.datePublished;
      if (json.dateCreated) return json.dateCreated;
      
      // Handle graph format
      if (json['@graph'] && Array.isArray(json['@graph'])) {
        for (const item of json['@graph']) {
          if (item.datePublished) return item.datePublished;
          if (item.dateCreated) return item.dateCreated;
        }
      }
    } catch {
      // Ignore JSON parse errors
    }
  }

  return undefined;
}

/**
 * Extract article from HTML/DOM using Mozilla Readability
 */
function extractWithReadability(html: string, url: string, debugContext: DebugContext): DiffbotArticle | null {
  logger.info({ hostname: new URL(url).hostname, htmlLength: html.length }, 'Attempting Readability extraction on Diffbot DOM');
  addDebugStep(debugContext, 'readability_fallback', 'info', 'Diffbot did not fully extract article, trying Readability on DOM', {
    domLength: html.length,
  });
  
  try {
    // Extract original URL from Wayback URL if present
    let baseUrl = url;
    if (url.includes('web.archive.org')) {
      const match = url.match(/web\.archive\.org\/web\/\d+\/(.+)/);
      if (match) {
        // Decode the URL in case it's URL-encoded
        baseUrl = decodeURIComponent(match[1]);
        logger.debug({ originalUrl: url, extractedUrl: baseUrl }, 'Extracted original URL from Wayback');
      }
    }
    
    // Suppress CSS parsing errors
    const { VirtualConsole } = require('jsdom');
    const virtualConsole = new VirtualConsole();
    virtualConsole.on("error", () => {}); // Suppress errors
    
    const dom = new JSDOM(html, { url: baseUrl, virtualConsole });
    const doc = dom.window.document;
    
    // Try to find the main article container first
    // This helps with pages that have complex layouts (like Google Blogger)
    const contentSelectors = [
      '[id^="docs-internal-guid-"]', // Google Docs embedded content
      '.post-body',
      '.post-content',
      '.entry-content',
      'article .content',
      '[role="article"]',
    ];
    
    for (const selector of contentSelectors) {
      const container = doc.querySelector(selector);
      if (container && container.textContent && container.textContent.length > 500) {
        logger.debug({ selector, contentLength: container.textContent.length }, 'Found article container');
        
        // Create a clean document with just the article content
        const cleanDoc = new JSDOM(`
          <!DOCTYPE html>
          <html><head><title>${doc.title || 'Article'}</title></head>
          <body><article>${container.innerHTML}</article></body></html>
        `, { url: baseUrl, virtualConsole }).window.document;
        
        const reader = new Readability(cleanDoc);
        const article = reader.parse();
        
        if (article && article.textContent && article.textContent.length > 500) {
          // Validate Readability result
          const validationResult = ReadabilityArticleSchema.safeParse(article);
          
          if (!validationResult.success) {
            const validationError = fromError(validationResult.error);
            logger.warn({ 
              url, 
              validationError: validationError.toString() 
            }, 'Readability result validation failed (targeted)');
            continue; // Try next selector
          }
          
          const validatedArticle = validationResult.data;
          
          logger.info({ 
            hostname: new URL(url).hostname,
            title: validatedArticle.title,
            textLength: validatedArticle.textContent.length,
            method: 'targeted-container'
          }, 'Successfully extracted article using targeted container');
          
          addDebugStep(debugContext, 'readability_extraction', 'success', 'Readability extraction succeeded (targeted)', {
            selector,
            extractedTitle: validatedArticle.title,
            extractedTextLength: validatedArticle.textContent.length,
            extractedHtmlLength: validatedArticle.content.length,
          });
          
          const result: DiffbotArticle = {
            title: validatedArticle.title || doc.title || 'Untitled',
            html: validatedArticle.content,
            text: validatedArticle.textContent,
            siteName: validatedArticle.siteName || new URL(url).hostname,
            byline: validatedArticle.byline,
            publishedTime: validatedArticle.publishedTime || extractDateFromDom(doc),
            htmlContent: html, // Store the original DOM HTML used for extraction
            image: extractImageFromDom(doc),
          };
          
          // Final validation before returning
          const finalValidation = DiffbotArticleSchema.safeParse(result);
          if (!finalValidation.success) {
            const finalError = fromError(finalValidation.error);
            logger.warn({ url, finalError: finalError.toString() }, 'Final article validation failed (targeted)');
            continue; // Try next selector
          }
          
          return finalValidation.data;
        }
      }
    }
    
    // Fallback to standard Readability on full document
    logger.debug({}, 'Using standard Readability on full document');
    const reader = new Readability(doc);
    const article = reader.parse();
    
    if (article && article.textContent && article.textContent.length > 100) {
      // Validate Readability result
      const validationResult = ReadabilityArticleSchema.safeParse(article);
      
      if (!validationResult.success) {
        const validationError = fromError(validationResult.error);
        logger.warn({ 
          url, 
          validationError: validationError.toString() 
        }, 'Readability result validation failed');
        addDebugStep(debugContext, 'readability_validation', 'warning', 'Readability result validation failed', {
          validationError: validationError.toString(),
        });
        return null;
      }
      
      const validatedArticle = validationResult.data;
      
      logger.info({ 
        hostname: new URL(url).hostname,
        title: validatedArticle.title,
        textLength: validatedArticle.textContent.length,
      }, 'Successfully extracted article with Readability fallback');
      
      addDebugStep(debugContext, 'readability_extraction', 'success', 'Readability extraction succeeded', {
        extractedTitle: validatedArticle.title,
        extractedTextLength: validatedArticle.textContent.length,
        extractedHtmlLength: validatedArticle.content.length,
      });
      
      const result: DiffbotArticle = {
        title: validatedArticle.title || 'Untitled',
        html: validatedArticle.content,
        text: validatedArticle.textContent,
        siteName: validatedArticle.siteName || new URL(url).hostname,
        byline: validatedArticle.byline,
        publishedTime: validatedArticle.publishedTime || extractDateFromDom(doc),
            htmlContent: html, // Store the original DOM HTML used for extraction
            image: extractImageFromDom(doc),
          };
      
      // Final validation before returning
      const finalValidation = DiffbotArticleSchema.safeParse(result);
      if (!finalValidation.success) {
        const finalError = fromError(finalValidation.error);
        logger.warn({ url, finalError: finalError.toString() }, 'Final article validation failed');
        addDebugStep(debugContext, 'final_validation', 'warning', 'Final article validation failed', {
          validationError: finalError.toString(),
        });
        return null;
      }
      
      return finalValidation.data;
    }
    
    addDebugStep(debugContext, 'readability_extraction', 'warning', 'Readability returned insufficient content');
    return null;
  } catch (error) {
    logger.warn({ url, error }, 'Readability extraction failed');
    addDebugStep(debugContext, 'readability_extraction', 'error', 'Readability extraction failed', {
      errorDetails: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Fetch structured article data using Diffbot API (no fallback)
 * Returns title, html, text, and siteName with comprehensive debug information
 */
export function fetchArticleWithDiffbot(url: string, source: string = 'smry-slow'): ResultAsync<DiffbotArticle, AppError> {
  const debugContext = createDebugContext(url, source);
  
  if (!process.env.DIFFBOT_API_KEY) {
    logger.error({ hostname: new URL(url).hostname }, 'No Diffbot API key configured');
    addDebugStep(debugContext, 'init', 'error', 'No Diffbot API key configured');
    
    return errAsync(
      createDiffbotError(
        'No Diffbot API key configured in environment variables',
        url,
        undefined,
        debugContext
      )
    );
  }
  
  logger.info({ hostname: new URL(url).hostname }, 'Attempting Diffbot article extraction');
  addDebugStep(debugContext, 'init', 'info', 'Starting Diffbot extraction');

  return ResultAsync.fromPromise(
    new Promise<DiffbotArticle>(async (resolve, reject) => {
      try {
        // Use REST API directly to support fields parameter
        const apiUrl = new URL('https://api.diffbot.com/v3/article');
        apiUrl.searchParams.set('token', process.env.DIFFBOT_API_KEY!);
        apiUrl.searchParams.set('url', url);
        apiUrl.searchParams.set('fields', 'title,text,html,siteName,dom'); // Request both article data AND raw DOM
        
        addDebugStep(debugContext, 'diffbot_request', 'info', 'Requesting article with DOM field for fallback', {
          requestedFields: 'title,text,html,siteName,dom',
        });

        const response = await fetch(apiUrl.toString());
        
        if (!response.ok) {
          const errorText = await response.text();
          logger.error({ status: response.status, errorText }, 'Diffbot HTTP error');
          addDebugStep(debugContext, 'diffbot_api', 'error', `HTTP ${response.status} error`);
          reject(new Error(`Diffbot HTTP error: ${response.status}`));
          return;
        }

        const rawData = await response.json();
        
        // Validate Diffbot API response structure
        const responseValidation = DiffbotArticleResponseSchema.safeParse(rawData);
        
        if (!responseValidation.success) {
          const validationError = fromError(responseValidation.error);
          logger.error({ 
            url, 
            validationError: validationError.toString(),
            receivedKeys: rawData ? Object.keys(rawData) : []
          }, 'Diffbot API response validation failed');
          
          addDebugStep(debugContext, 'response_validation', 'error', 'Diffbot API response validation failed', {
            validationError: validationError.toString(),
            receivedKeys: rawData ? Object.keys(rawData) : []
          });
          
          reject(new Error(`Invalid Diffbot API response structure: ${validationError.toString()}`));
          return;
        }
        
        const data = responseValidation.data;

        // Handle error responses
        if (data.errorCode || data.error) {
          const errorMsg = data.error || `Diffbot error code: ${data.errorCode}`;
          logger.error({ 
            hostname: new URL(url).hostname,
            errorCode: data.errorCode,
            errorMessage: data.error
          }, 'Diffbot returned error response');
          
          addDebugStep(debugContext, 'diffbot_api', 'error', 'Diffbot returned error response', {
            errorCode: data.errorCode,
            errorMessage: data.error,
          });
          
          reject(new Error(errorMsg));
          return;
        }

        // Capture the full Diffbot response for debugging
        addDebugStep(debugContext, 'diffbot_response', 'info', 'Received Diffbot API response', {
          diffbotResponse: {
            hasObjects: !!data?.objects,
            objectsLength: data?.objects?.length || 0,
            hasHtml: !!data?.html,
            hasText: !!data?.text,
            hasTitle: !!data?.title,
            hasDom: !!(data?.objects?.[0]?.dom || (data as any)?.dom),
            responseKeys: data ? Object.keys(data) : [],
          },
        });

        // Extract data from response
        let articleData: DiffbotArticle | null = null;
        let domForFallback: string | null = null;

        // Try new API format first (objects array)
        if (data?.objects && Array.isArray(data.objects) && data.objects.length > 0) {
          const obj = data.objects[0];
          
          // Store DOM for potential fallback - this is the full page HTML
          domForFallback = obj.dom || null;
          
          // Check if we have complete article data with substantial content
          // Diffbot should return html when it recognizes the article structure
          if (obj.html && obj.text && obj.title && obj.text.length > 100) {
            let extractedDate = obj.date;
            let extractedImage = null;

            if (obj.images && obj.images.length > 0) {
                 const img = obj.images.find((i: any) => i.url && i.primary) || obj.images.find((i: any) => i.url);
                 if (img) extractedImage = img.url;
            }
            
            // If no date/image from Diffbot, try to extract from DOM if available
            if ((!extractedDate || !extractedImage) && (obj.dom || domForFallback)) {
               try {
                 const domToUse = (obj.dom || domForFallback) as string;
                 const { VirtualConsole } = require('jsdom');
                 const virtualConsole = new VirtualConsole();
                 virtualConsole.on("error", () => {}); 
                 const doc = new JSDOM(domToUse, { virtualConsole }).window.document;
                 if (!extractedDate) extractedDate = extractDateFromDom(doc);
                 if (!extractedImage) extractedImage = extractImageFromDom(doc);
               } catch {
                 // Ignore errors
               }
            }

            const completeArticle: DiffbotArticle = {
              title: obj.title,
              html: obj.html,
              text: obj.text,
              siteName: obj.siteName || new URL(url).hostname,
              byline: obj.author || (obj.authors && obj.authors.length > 0 ? obj.authors.map((a: any) => a.name).join(', ') : null),
              publishedTime: extractedDate,
              image: extractedImage,
              htmlContent: obj.dom || domForFallback || undefined, // Original page HTML (full DOM)
            };
            
            // Validate the extracted article
            const articleValidation = DiffbotArticleSchema.safeParse(completeArticle);
            
            if (!articleValidation.success) {
              const validationError = fromError(articleValidation.error);
              logger.warn({ 
                url, 
                validationError: validationError.toString(),
                articleData: {
                  titleLength: completeArticle.title.length,
                  htmlLength: completeArticle.html.length,
                  textLength: completeArticle.text.length,
                }
              }, 'Diffbot article validation failed');
              
              addDebugStep(debugContext, 'article_validation', 'warning', 'Article validation failed, will try fallback', {
                validationError: validationError.toString(),
              });
              // Don't return, let it fall through to Readability fallback
            } else {
              const validatedArticle = articleValidation.data;
              logger.info({ title: validatedArticle.title, length: validatedArticle.text.length }, 'Diffbot successfully extracted article');
              addDebugStep(debugContext, 'diffbot_extraction', 'success', 'Diffbot extracted article successfully', {
                extractedTitle: validatedArticle.title,
                extractedTextLength: validatedArticle.text.length,
                extractedHtmlLength: validatedArticle.html.length,
              });
              resolve(validatedArticle);
              return;
            }
          }
          
          // Incomplete article data - use Readability on DOM
          logger.warn({ 
            hostname: new URL(url).hostname,
            hasHtml: !!obj.html,
            hasText: !!obj.text,
            textLength: obj.text?.length || 0,
            hasTitle: !!obj.title,
            hasDom: !!obj.dom,
            domLength: obj.dom?.length || 0,
          }, 'Diffbot article extraction incomplete, will use Readability on DOM');
          addDebugStep(debugContext, 'diffbot_extraction', 'warning', 'Diffbot article extraction incomplete, using Readability fallback', {
            hasHtml: !!obj.html,
            hasText: !!obj.text,
            textLength: obj.text?.length || 0,
            hasTitle: !!obj.title,
            hasDom: !!obj.dom,
            domLength: obj.dom?.length || 0,
            availableFields: Object.keys(obj),
          });
        }
        // Try old API format
        else if (data?.html && data?.text && data?.title) {
          const dom = (data as any).dom || domForFallback;
          let extractedDate = data.date;
          let extractedImage = null;
          if (data.media && data.media.length > 0) {
              const img = data.media.find((m: any) => m.type === 'image' && m.link);
              if (img) extractedImage = img.link;
          }
          
          // If no date/image from Diffbot, try to extract from DOM
          if ((!extractedDate || !extractedImage) && dom) {
             try {
               const { VirtualConsole } = require('jsdom');
               const virtualConsole = new VirtualConsole();
               virtualConsole.on("error", () => {}); 
               const doc = new JSDOM(dom, { virtualConsole }).window.document;
               if (!extractedDate) extractedDate = extractDateFromDom(doc);
               if (!extractedImage) extractedImage = extractImageFromDom(doc);
             } catch {
               // Ignore errors during extra DOM parsing
             }
          }

          articleData = {
            title: data.title,
            html: data.html,
            text: data.text,
            siteName: new URL(url).hostname,
            byline: data.author,
            publishedTime: extractedDate,
            image: extractedImage,
            htmlContent: dom, // Original page HTML (full DOM)
          };
          
          // Validate the extracted article
          const articleValidation = DiffbotArticleSchema.safeParse(articleData);
          
          if (!articleValidation.success) {
            const validationError = fromError(articleValidation.error);
            logger.warn({ 
              url, 
              validationError: validationError.toString(),
              articleData: {
                titleLength: articleData.title.length,
                htmlLength: articleData.html.length,
                textLength: articleData.text.length,
              }
            }, 'Diffbot article validation failed (old format)');
            
            addDebugStep(debugContext, 'article_validation', 'warning', 'Article validation failed (old format), will try fallback', {
              validationError: validationError.toString(),
            });
            // Don't resolve, let it fall through to check for DOM fallback
          } else {
            const validatedArticle = articleValidation.data;
            logger.info({ title: validatedArticle.title, length: validatedArticle.text.length }, 'Diffbot successfully extracted article (old format)');
            addDebugStep(debugContext, 'diffbot_extraction', 'success', 'Diffbot extracted article (old format)', {
              extractedTitle: validatedArticle.title,
              extractedTextLength: validatedArticle.text.length,
              extractedHtmlLength: validatedArticle.html.length,
            });
            resolve(validatedArticle);
            return;
          }
        } else {
          // Store DOM for potential fallback
          domForFallback = (data as any)?.dom || null;
          
          logger.warn({ 
            hostname: new URL(url).hostname,
            hasObjects: !!data?.objects,
            objectsLength: data?.objects?.length || 0,
            hasDom: !!domForFallback,
          }, 'Diffbot response structure unexpected, will try Readability fallback');
          addDebugStep(debugContext, 'diffbot_extraction', 'warning', 'Diffbot response structure unexpected');
        }

        // Fallback to Readability if we have DOM
        if (domForFallback) {
          logger.info({ hostname: new URL(url).hostname, domLength: domForFallback.length }, 'Using Readability fallback on DOM');
          addDebugStep(debugContext, 'readability_attempt', 'info', 'Attempting Readability extraction on DOM', {
            domLength: domForFallback.length,
          });
          
          const readabilityResult = extractWithReadability(domForFallback, url, debugContext);
          if (readabilityResult) {
            // Validate Readability result
            const readabilityValidation = DiffbotArticleSchema.safeParse(readabilityResult);
            
            if (!readabilityValidation.success) {
              const validationError = fromError(readabilityValidation.error);
              logger.warn({ 
                url, 
                validationError: validationError.toString(),
                resultData: {
                  titleLength: readabilityResult.title.length,
                  htmlLength: readabilityResult.html.length,
                  textLength: readabilityResult.text.length,
                }
              }, 'Readability result validation failed in main function');
              
              addDebugStep(debugContext, 'readability_final_validation', 'warning', 'Readability result validation failed', {
                validationError: validationError.toString(),
              });
            } else {
              const validatedResult = readabilityValidation.data;
              logger.info({ 
                hostname: new URL(url).hostname,
                title: validatedResult.title,
                textLength: validatedResult.text.length,
              }, 'Successfully extracted article using Readability fallback');
              resolve(validatedResult);
              return;
            }
          }
        } else {
          logger.warn({ hostname: new URL(url).hostname }, 'No DOM available for Readability fallback');
          addDebugStep(debugContext, 'readability_attempt', 'warning', 'No DOM available for Readability fallback');
        }

        // No article data and no fallback succeeded
        logger.error({ hostname: new URL(url).hostname, hadDom: !!domForFallback }, 'All extraction methods failed');
        addDebugStep(debugContext, 'final_error', 'error', 'All extraction methods failed', {
          hadDiffbotArticle: !!articleData,
          hadDom: !!domForFallback,
        });
        reject(new Error(`Could not extract article content for URL: ${url}`));

      } catch (error) {
        logger.error({ url, error }, 'Exception during Diffbot request');
        addDebugStep(debugContext, 'diffbot_exception', 'error', 'Exception during request', {
          errorDetails: error instanceof Error ? error.message : String(error),
        });
        reject(error);
      }
    }),
    (error) => {
      const errorMsg = error instanceof Error ? error.message : String(error);
      
      // Check for specific error patterns
      if (errorMsg.toLowerCase().includes('rate limit') || errorMsg.includes('429')) {
        return createDiffbotError(`Rate limit exceeded`, url, error, debugContext);
      } else if (errorMsg.toLowerCase().includes('timeout')) {
        return createDiffbotError(`Request timeout`, url, error, debugContext);
      } else if (errorMsg.toLowerCase().includes('unauthorized') || errorMsg.includes('401')) {
        return createDiffbotError(`API authentication failed`, url, error, debugContext);
      } else if (errorMsg.toLowerCase().includes('incomplete')) {
        return createDiffbotError(`Incomplete article data returned`, url, error, debugContext);
      } else if (errorMsg.includes('404') || errorMsg.toLowerCase().includes('could not download page')) {
        return createDiffbotError(`Page not found or could not be accessed (404)`, url, error, debugContext);
      } else if (errorMsg.includes('403')) {
        return createDiffbotError(`Access forbidden (403)`, url, error, debugContext);
      } else if (errorMsg.includes('500') || errorMsg.includes('502') || errorMsg.includes('503')) {
        return createDiffbotError(`Server error while fetching page`, url, error, debugContext);
      } else {
        return createDiffbotError(`${errorMsg.substring(0, 150)}`, url, error, debugContext);
      }
    }
  );
}

