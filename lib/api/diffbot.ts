import { Diffbot, DiffbotArticleResponse } from "diffbot";
import { ResultAsync, errAsync, okAsync } from "neverthrow";
import {
  AppError,
  createDiffbotError,
  DebugContext,
  DebugStep,
} from "@/lib/errors/types";
import { createLogger } from "@/lib/logger";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";

const logger = createLogger('lib:diffbot');

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
          logger.info({ 
            hostname: new URL(url).hostname,
            title: article.title,
            textLength: article.textContent.length,
            method: 'targeted-container'
          }, 'Successfully extracted article using targeted container');
          
          addDebugStep(debugContext, 'readability_extraction', 'success', 'Readability extraction succeeded (targeted)', {
            selector,
            extractedTitle: article.title,
            extractedTextLength: article.textContent.length,
            extractedHtmlLength: article.content.length,
          });
          
          return {
            title: article.title || doc.title || 'Untitled',
            html: article.content,
            text: article.textContent,
            siteName: article.siteName || new URL(url).hostname,
          };
        }
      }
    }
    
    // Fallback to standard Readability on full document
    logger.debug({}, 'Using standard Readability on full document');
    const reader = new Readability(doc);
    const article = reader.parse();
    
    if (article && article.textContent && article.textContent.length > 100) {
      logger.info({ 
        hostname: new URL(url).hostname,
        title: article.title,
        textLength: article.textContent.length,
      }, 'Successfully extracted article with Readability fallback');
      
      addDebugStep(debugContext, 'readability_extraction', 'success', 'Readability extraction succeeded', {
        extractedTitle: article.title,
        extractedTextLength: article.textContent.length,
        extractedHtmlLength: article.content.length,
      });
      
      return {
        title: article.title || 'Untitled',
        html: article.content,
        text: article.textContent,
        siteName: article.siteName || new URL(url).hostname,
      };
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
export function fetchArticleWithDiffbot(url: string, source: string = 'direct'): ResultAsync<DiffbotArticle, AppError> {
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

        const data: DiffbotArticleResponse = await response.json();

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
            const completeArticle: DiffbotArticle = {
              title: obj.title,
              html: obj.html,
              text: obj.text,
              siteName: obj.siteName || new URL(url).hostname,
            };
            logger.info({ title: completeArticle.title, length: completeArticle.text.length }, 'Diffbot successfully extracted article');
            addDebugStep(debugContext, 'diffbot_extraction', 'success', 'Diffbot extracted article successfully', {
              extractedTitle: completeArticle.title,
              extractedTextLength: completeArticle.text.length,
              extractedHtmlLength: completeArticle.html.length,
            });
            resolve(completeArticle);
            return;
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
          articleData = {
            title: data.title,
            html: data.html,
            text: data.text,
            siteName: new URL(url).hostname,
          };
          logger.info({ title: articleData.title, length: articleData.text.length }, 'Diffbot successfully extracted article (old format)');
          addDebugStep(debugContext, 'diffbot_extraction', 'success', 'Diffbot extracted article (old format)', {
            extractedTitle: articleData.title,
            extractedTextLength: articleData.text.length,
            extractedHtmlLength: articleData.html.length,
          });
          resolve(articleData);
          return;
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
            logger.info({ 
              hostname: new URL(url).hostname,
              title: readabilityResult.title,
              textLength: readabilityResult.text.length,
            }, 'Successfully extracted article using Readability fallback');
            resolve(readabilityResult);
            return;
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

