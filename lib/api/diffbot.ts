import { parse } from "node-html-parser";
import { HttpsProxyAgent } from "https-proxy-agent";
import { Agent } from "https";
import { Diffbot, DiffbotArticleResponse } from "diffbot";
import { ResultAsync, errAsync, okAsync } from "neverthrow";
import {
  AppError,
  createDiffbotError,
  createNetworkError,
  createProxyError,
  createRateLimitError,
} from "@/lib/errors/types";
import { createLogger } from "@/lib/logger";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";

const logger = createLogger('lib:diffbot');

interface CustomFetchOptions extends RequestInit {
  agent?: Agent;
}

/**
 * Get fetch options including proxy configuration if needed
 */
async function getFetchOptions(url: string): Promise<CustomFetchOptions> {
  const options: CustomFetchOptions = {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3",
    },
  };

  if (url.includes("web.archive")) {
    const proxyURL = process.env.PROXY_URL;

    if (!proxyURL) {
      throw createProxyError("No proxy URL configured in environment variables", url);
    }

    options.agent = new HttpsProxyAgent(proxyURL);
  }

  return options;
}

/**
 * Fetch HTML content from a URL with proper error handling
 */
async function fetchHtmlContent(
  url: string,
  options: CustomFetchOptions
): Promise<string> {
  let response;
  try {
    response = await fetch(url, options);
  } catch (error) {
    const hostname = new URL(url).hostname;
    logger.error({ hostname, error: error instanceof Error ? error.message : String(error) }, 'Network fetch failed');
    throw createNetworkError(`Failed to fetch from URL`, url, undefined, error);
  }

  if (!response.ok) {
    // Handle specific HTTP status codes
    if (response.status === 429) {
      logger.warn({ url }, 'Rate limited (429), will use fallback if available');
      const retryAfter = response.headers.get("retry-after");
      throw createRateLimitError(url, retryAfter ? parseInt(retryAfter) : undefined);
    } else if (response.status === 403) {
      // 403 is expected for many sites (NYTimes, etc.) - they block direct access
      logger.warn({ hostname: new URL(url).hostname }, 'Access forbidden (403), this is expected - will use fallback methods');
      throw createNetworkError(
        `HTTP error! status: ${response.status}`,
        url,
        response.status
      );
    } else if (response.status === 404) {
      logger.warn({ url }, 'Page not found (404)');
      throw createNetworkError(
        `HTTP error! status: ${response.status}`,
        url,
        response.status
      );
    } else {
      // 500+ errors and other unexpected status codes
      logger.error({ status: response.status, url }, 'HTTP error');
      throw createNetworkError(
        `HTTP error! status: ${response.status}`,
        url,
        response.status
      );
    }
  }

  const buffer = await response.arrayBuffer();
  const decoder = new TextDecoder("utf-8");
  return decoder.decode(buffer);
}

/**
 * Fetch content using Diffbot API with proper error handling (HTML only)
 */
function fetchWithDiffbot(url: string): ResultAsync<string, AppError> {
  if (!process.env.DIFFBOT_API_KEY) {
    logger.warn('No Diffbot API key configured - skipping Diffbot extraction');
    return errAsync(
      createDiffbotError("No Diffbot API key configured in environment variables", url)
    );
  }
  
  logger.info({ hostname: new URL(url).hostname }, 'Attempting Diffbot extraction');

  return ResultAsync.fromPromise(
    new Promise<string>((resolve, reject) => {
      try {
        const diffbot = new Diffbot(process.env.DIFFBOT_API_KEY!);

        // Old diffbot API uses callbacks and 'uri' instead of 'url'
        diffbot.article(
          { uri: url, html: true },
          (err: Error | null, response: DiffbotArticleResponse) => {
            if (err) {
              // Check if it's a rate limit error
              const errorMsg = err.message || String(err);
              if (errorMsg.toLowerCase().includes('rate limit') || errorMsg.includes('429')) {
                logger.warn({ hostname: new URL(url).hostname }, 'Diffbot rate limit exceeded');
              } else {
                logger.warn({ hostname: new URL(url).hostname, errorMsg }, 'Diffbot API error');
              }
              reject(err);
              return;
            }

            // The old diffbot package returns the newer API format with objects array
            let htmlContent: string | undefined;

            // Try new API format first (objects array)
            if (
              response?.objects &&
              Array.isArray(response.objects) &&
              response.objects.length > 0
            ) {
              htmlContent = response.objects[0].html;
            }
            // Fallback to old API format (html directly on response)
            else if (response?.html) {
              htmlContent = response.html;
            }

            // Check if HTML content exists
            if (!htmlContent) {
              logger.warn({ hostname: new URL(url).hostname }, 'Diffbot returned article data but no HTML (will use direct fetch fallback)');
              reject(new Error(`Diffbot API returned no HTML content for URL: ${url}`));
              return;
            }

            logger.debug({ length: htmlContent.length }, 'Diffbot successfully extracted HTML');
            resolve(htmlContent);
          }
        );
      } catch (error) {
        logger.error({ url, error }, 'Failed to initialize Diffbot');
        reject(error);
      }
    }),
    (error) => {
      // Extract meaningful error message
      const errorMsg = error instanceof Error ? error.message : String(error);
      
      // Check for specific error types
      if (errorMsg.toLowerCase().includes('rate limit') || errorMsg.includes('429')) {
        return createDiffbotError(`Rate limit exceeded`, url, error);
      } else if (errorMsg.toLowerCase().includes('timeout')) {
        return createDiffbotError(`Request timeout`, url, error);
      } else if (errorMsg.toLowerCase().includes('unauthorized') || errorMsg.includes('401')) {
        return createDiffbotError(`API authentication failed`, url, error);
      } else if (errorMsg.toLowerCase().includes('no html content')) {
        return createDiffbotError(`No HTML content returned`, url, error);
      } else {
        return createDiffbotError(`API error: ${errorMsg.substring(0, 100)}`, url, error);
      }
    }
  );
}

/**
 * Check if page is JavaScript-rendered (SPA/CSR)
 */
function isJavaScriptRenderedPage(html: string, doc: Document): boolean {
  const bodyText = doc.body?.textContent?.trim() || '';
  
  // Common indicators of JS-rendered pages
  const jsIndicators = [
    'You need to enable JavaScript',
    'Please enable JavaScript',
    'JavaScript is required',
    'This app requires JavaScript',
    'Enable JavaScript to run this app',
  ];
  
  // Check if body is nearly empty or only contains JS warnings
  if (bodyText.length < 100) {
    return jsIndicators.some(indicator => 
      bodyText.includes(indicator)
    );
  }
  
  // Check for React/Vue/Angular root divs with no content
  const rootSelectors = ['#root', '#app', '[data-reactroot]', '[data-server-rendered]'];
  for (const selector of rootSelectors) {
    const root = doc.querySelector(selector);
    if (root && root.children.length === 0) {
      return true;
    }
  }
  
  return false;
}

/**
 * Extract content using custom logic when Readability fails
 */
function extractWithCustomLogic(doc: Document, url: string): DiffbotArticle | null {
  // Remove unwanted elements
  const unwantedSelectors = [
    'script', 'style', 'nav', 'header', 'footer', 
    'aside', '.ad', '.advertisement', '#comments', '.sidebar'
  ];
  
  unwantedSelectors.forEach(selector => {
    doc.querySelectorAll(selector).forEach(el => el.remove());
  });
  
  // Try to find main content
  const contentSelectors = [
    'article',
    'main',
    '[role="main"]',
    '#main-content',
    '.main-content',
    '#content',
    '.content',
    '.post-content',
    '.entry-content',
  ];
  
  let contentElement = null;
  for (const selector of contentSelectors) {
    const elem = doc.querySelector(selector);
    if (elem && elem.textContent && elem.textContent.length > 200) {
      contentElement = elem;
      break;
    }
  }
  
  // Fall back to body if nothing better found
  if (!contentElement || contentElement.textContent!.length < 200) {
    contentElement = doc.body;
  }
  
  if (!contentElement) {
    return null;
  }
  
  const title = doc.querySelector('title')?.textContent || 
                doc.querySelector('h1')?.textContent || 
                doc.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
                new URL(url).hostname;
  
  const text = contentElement.textContent?.replace(/\s+/g, ' ').trim() || '';
  
  // If content is too short, it's likely not real content
  if (text.length < 100) {
    return null;
  }
  
  const htmlContent = contentElement.innerHTML;
  const siteName = doc.querySelector('meta[property="og:site_name"]')?.getAttribute('content') ||
                   new URL(url).hostname;
  
  return {
    title: title.trim(),
    html: htmlContent,
    text: text,
    siteName: siteName,
  };
}

/**
 * Fallback: Extract article content from raw HTML using Mozilla Readability
 * with custom extraction as secondary fallback
 */
async function extractArticleFromHtml(
  url: string
): Promise<DiffbotArticle> {
  logger.info({ hostname: new URL(url).hostname }, 'Falling back to raw HTML extraction with Readability');
  
  const options = await getFetchOptions(url);
  const html = await fetchHtmlContent(url, options);
  
  // Parse with JSDOM
  const dom = new JSDOM(html, { url });
  const doc = dom.window.document;
  
  // Check if page is JavaScript-rendered
  if (isJavaScriptRenderedPage(html, doc)) {
    logger.warn({ hostname: new URL(url).hostname }, 'Page appears to be JavaScript-rendered (SPA/CSR) - cannot extract without browser');
    throw new Error('This page requires JavaScript to render content. Please use the "jina.ai" tab which can handle JavaScript-rendered pages.');
  }
  
  // Try Mozilla Readability first
  const reader = new Readability(doc);
  const article = reader.parse();
  
  if (article && article.textContent.length > 100) {
    logger.info({ 
      hostname: new URL(url).hostname,
      title: article.title,
      textLength: article.textContent.length,
      method: 'readability'
    }, 'Successfully extracted article with Readability');
    
    return {
      title: article.title || 'Untitled',
      html: article.content,
      text: article.textContent,
      siteName: article.siteName || new URL(url).hostname,
    };
  }
  
  // Try custom extraction as secondary fallback
  logger.info({ hostname: new URL(url).hostname }, 'Readability failed, trying custom extraction');
  const customResult = extractWithCustomLogic(doc, url);
  
  if (customResult) {
    logger.info({ 
      hostname: new URL(url).hostname,
      title: customResult.title,
      textLength: customResult.text.length,
      method: 'custom'
    }, 'Successfully extracted article with custom logic');
    
    return customResult;
  }
  
  throw new Error('Failed to extract article content from HTML. The page may be JavaScript-rendered or have insufficient content.');
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
 * Fetch structured article data using Diffbot API with fallback to raw HTML extraction
 * Returns title, html, text, and siteName
 */
export function fetchArticleWithDiffbot(url: string): ResultAsync<DiffbotArticle, AppError> {
  if (!process.env.DIFFBOT_API_KEY) {
    logger.warn({ hostname: new URL(url).hostname }, 'No Diffbot API key - using raw HTML fallback');
    // If no API key, go straight to fallback
    return ResultAsync.fromPromise(
      extractArticleFromHtml(url),
      (error) => createDiffbotError(
        `Fallback extraction failed: ${error instanceof Error ? error.message : String(error)}`,
        url,
        error
      )
    );
  }
  
  logger.info({ hostname: new URL(url).hostname }, 'Attempting Diffbot article extraction');

  // Try Diffbot first, then fallback to raw HTML extraction if it fails
  return ResultAsync.fromPromise(
    new Promise<DiffbotArticle>(async (resolve, reject) => {
      try {
        const diffbot = new Diffbot(process.env.DIFFBOT_API_KEY!);

        diffbot.article(
          { uri: url, html: true },
          async (err: Error | null, response: DiffbotArticleResponse) => {
            if (err) {
              const errorMsg = err.message || String(err);
              if (errorMsg.toLowerCase().includes('rate limit') || errorMsg.includes('429')) {
                logger.warn({ hostname: new URL(url).hostname }, 'Diffbot rate limit exceeded - trying fallback');
              } else {
                logger.warn({ hostname: new URL(url).hostname, errorMsg }, 'Diffbot API error - trying fallback');
              }
              
              // Try fallback extraction
              try {
                const fallbackArticle = await extractArticleFromHtml(url);
                resolve(fallbackArticle);
                return;
              } catch (fallbackError) {
                logger.error({ hostname: new URL(url).hostname, error: fallbackError }, 'Both Diffbot and fallback extraction failed');
                reject(err); // Reject with original Diffbot error
                return;
              }
            }

            // Extract data from response
            let articleData: DiffbotArticle | null = null;

            // Try new API format first (objects array)
            if (
              response?.objects &&
              Array.isArray(response.objects) &&
              response.objects.length > 0
            ) {
              const obj = response.objects[0];
              if (obj.html && obj.text && obj.title) {
                articleData = {
                  title: obj.title,
                  html: obj.html,
                  text: obj.text,
                  siteName: obj.siteName || new URL(url).hostname,
                };
              } else {
                // Log what fields are missing
                logger.warn({ 
                  hostname: new URL(url).hostname,
                  hasHtml: !!obj.html,
                  hasText: !!obj.text,
                  hasTitle: !!obj.title,
                  objectKeys: Object.keys(obj).join(', ')
                }, 'Diffbot response missing required fields (objects format)');
              }
            }
            // Fallback to old API format
            else if (response?.html && response?.text && response?.title) {
              articleData = {
                title: response.title,
                html: response.html,
                text: response.text,
                siteName: new URL(url).hostname,
              };
            } else {
              // Log what we got
              logger.warn({ 
                hostname: new URL(url).hostname,
                hasObjects: !!response?.objects,
                objectsLength: response?.objects?.length || 0,
                hasHtml: !!response?.html,
                hasText: !!response?.text,
                hasTitle: !!response?.title,
                responseKeys: response ? Object.keys(response).join(', ') : 'no response'
              }, 'Diffbot response structure unexpected');
            }

            if (!articleData) {
              logger.warn({ hostname: new URL(url).hostname }, 'Diffbot returned incomplete article data - trying fallback');
              
              // Try fallback extraction
              try {
                const fallbackArticle = await extractArticleFromHtml(url);
                resolve(fallbackArticle);
                return;
              } catch (fallbackError) {
                logger.error({ hostname: new URL(url).hostname, error: fallbackError }, 'Both Diffbot and fallback extraction failed');
                reject(new Error(`Diffbot API returned incomplete article data for URL: ${url}`));
                return;
              }
            }

            logger.debug({ title: articleData.title, length: articleData.text.length }, 'Diffbot successfully extracted article');
            resolve(articleData);
          }
        );
      } catch (error) {
        logger.error({ url, error }, 'Failed to initialize Diffbot');
        reject(error);
      }
    }),
    (error) => {
      const errorMsg = error instanceof Error ? error.message : String(error);
      
      if (errorMsg.toLowerCase().includes('rate limit') || errorMsg.includes('429')) {
        return createDiffbotError(`Rate limit exceeded`, url, error);
      } else if (errorMsg.toLowerCase().includes('timeout')) {
        return createDiffbotError(`Request timeout`, url, error);
      } else if (errorMsg.toLowerCase().includes('unauthorized') || errorMsg.includes('401')) {
        return createDiffbotError(`API authentication failed`, url, error);
      } else if (errorMsg.toLowerCase().includes('incomplete')) {
        return createDiffbotError(`Incomplete article data returned`, url, error);
      } else {
        return createDiffbotError(`API error: ${errorMsg.substring(0, 100)}`, url, error);
      }
    }
  );
}

