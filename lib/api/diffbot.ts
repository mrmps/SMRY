import { parse } from "node-html-parser";
import { HttpsProxyAgent } from "https-proxy-agent";
import { Agent } from "https";
import { Diffbot, DiffbotArticleResponse } from "diffbot";
import { ResultAsync, errAsync } from "neverthrow";
import {
  AppError,
  createDiffbotError,
  createNetworkError,
  createProxyError,
  createRateLimitError,
} from "@/lib/errors/types";
import { createLogger } from "@/lib/logger";

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
 * Structured article data from Diffbot
 */
export interface DiffbotArticle {
  title: string;
  html: string;
  text: string;
  siteName: string;
}

/**
 * Fetch structured article data using Diffbot API
 * Returns title, html, text, and siteName
 */
export function fetchArticleWithDiffbot(url: string): ResultAsync<DiffbotArticle, AppError> {
  if (!process.env.DIFFBOT_API_KEY) {
    logger.warn('No Diffbot API key configured - skipping Diffbot extraction');
    return errAsync(
      createDiffbotError("No Diffbot API key configured in environment variables", url)
    );
  }
  
  logger.info({ hostname: new URL(url).hostname }, 'Attempting Diffbot article extraction');

  return ResultAsync.fromPromise(
    new Promise<DiffbotArticle>((resolve, reject) => {
      try {
        const diffbot = new Diffbot(process.env.DIFFBOT_API_KEY!);

        diffbot.article(
          { uri: url, html: true },
          (err: Error | null, response: DiffbotArticleResponse) => {
            if (err) {
              const errorMsg = err.message || String(err);
              if (errorMsg.toLowerCase().includes('rate limit') || errorMsg.includes('429')) {
                logger.warn({ hostname: new URL(url).hostname }, 'Diffbot rate limit exceeded');
              } else {
                logger.warn({ hostname: new URL(url).hostname, errorMsg }, 'Diffbot API error');
              }
              reject(err);
              return;
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
            }

            if (!articleData) {
              logger.warn({ hostname: new URL(url).hostname }, 'Diffbot returned incomplete article data');
              reject(new Error(`Diffbot API returned incomplete article data for URL: ${url}`));
              return;
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

