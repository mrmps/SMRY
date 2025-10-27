import { parse } from "node-html-parser";
import { HttpsProxyAgent } from "https-proxy-agent";
import { Agent } from "https";
import { Diffbot, DiffbotArticleResponse } from "diffbot";
import { ResultAsync, errAsync, okAsync } from "neverthrow";
import {
  AppError,
  createDiffbotError,
  createNetworkError,
  createParseError,
  createProxyError,
  createRateLimitError,
  createTimeoutError,
  createUnknownError,
} from "./errors";

// Development-only logger
const devLog = (...args: any[]) => {
  if (process.env.NODE_ENV === "development") {
    console.log(...args);
  }
};

const devWarn = (...args: any[]) => {
  if (process.env.NODE_ENV === "development") {
    console.warn(...args);
  }
};

const devError = (...args: any[]) => {
  if (process.env.NODE_ENV === "development") {
    console.error(...args);
  }
};

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
    devError(`❌ Network fetch failed for ${hostname}:`, error instanceof Error ? error.message : String(error));
    throw createNetworkError(`Failed to fetch from URL`, url, undefined, error);
  }

  if (!response.ok) {
    // Handle specific HTTP status codes
    if (response.status === 429) {
      devWarn(`⚠️  Rate limited (429) for URL: ${url}. Will use fallback if available.`);
      const retryAfter = response.headers.get("retry-after");
      throw createRateLimitError(url, retryAfter ? parseInt(retryAfter) : undefined);
    } else if (response.status === 403) {
      // 403 is expected for many sites (NYTimes, etc.) - they block direct access
      devWarn(`⚠️  Access forbidden (403) for: ${new URL(url).hostname}. This is expected - will use fallback methods.`);
      throw createNetworkError(
        `HTTP error! status: ${response.status}`,
        url,
        response.status
      );
    } else if (response.status === 404) {
      devWarn(`⚠️  Page not found (404) for URL: ${url}`);
      throw createNetworkError(
        `HTTP error! status: ${response.status}`,
        url,
        response.status
      );
    } else {
      // 500+ errors and other unexpected status codes
      devError(`❌ HTTP error! status: ${response.status} for URL: ${url}`);
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
 * Fix relative image sources to absolute URLs
 */
function fixImageSources(root: any, url: string) {
  root.querySelectorAll("img").forEach((img: any) => {
    const src = img.getAttribute("src");
    if (src && src.startsWith("/")) {
      img.setAttribute("src", new URL(src, url).toString());
    }
    if (src && src.includes("web.archive.org/web/")) {
      const originalUrl = src.split("im_/")[1];
      if (originalUrl) {
        img.setAttribute("src", originalUrl);
      }
    }

    const srcset = img.getAttribute("srcset");
    if (srcset) {
      const newSrcset = srcset
        .split(",")
        .map((srcEntry: string) => {
          let [src, descriptor] = srcEntry.trim().split(" ");
          if (src && src.startsWith("/")) {
            src = new URL(src, url).toString();
          }
          if (src && src.includes("web.archive.org/web/")) {
            const originalUrl = src.split("im_/")[1];
            if (originalUrl) {
              src = originalUrl;
            }
          }
          return descriptor ? `${src} ${descriptor}` : src;
        })
        .join(", ");

      img.setAttribute("srcset", newSrcset);
    }
  });
}

/**
 * Fix archive.org links to point to our proxy
 */
function fixLinks(root: any, url: string) {
  root.querySelectorAll("a").forEach((a: any) => {
    const href = a.getAttribute("href");
    if (href && href.includes("web.archive.org/web/")) {
      let originalUrl;
      if (href.includes("/http://")) {
        originalUrl = href.split("/http://")[1];
        originalUrl = "http://" + originalUrl;
      } else if (href.includes("/https://")) {
        originalUrl = href.split("/https://")[1];
        originalUrl = "https://" + originalUrl;
      }

      if (originalUrl) {
        a.setAttribute(
          "href",
          `${process.env.NEXT_PUBLIC_URL}/${new URL(originalUrl, url).toString()}`
        );
      }
    }
  });
}

/**
 * Fetch content using Diffbot API with proper error handling
 */
function fetchWithDiffbot(url: string): ResultAsync<string, AppError> {
  if (!process.env.DIFFBOT_API_KEY) {
    devWarn(`⚠️  No Diffbot API key configured - skipping Diffbot extraction`);
    return errAsync(
      createDiffbotError("No Diffbot API key configured in environment variables", url)
    );
  }
  
  devLog(`🔄 Attempting Diffbot extraction for ${new URL(url).hostname}...`);

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
                devWarn(`⚠️  Diffbot rate limit exceeded for ${new URL(url).hostname}`);
              } else {
                devWarn(`⚠️  Diffbot API error for ${new URL(url).hostname}:`, errorMsg);
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
              devWarn(
                `⚠️  Diffbot returned article data but no HTML for ${new URL(url).hostname} (will use direct fetch fallback)`
              );
              reject(new Error(`Diffbot API returned no HTML content for URL: ${url}`));
              return;
            }

            devLog(`✓ Diffbot successfully extracted HTML (${htmlContent.length.toLocaleString()} chars)`);
            resolve(htmlContent);
          }
        );
      } catch (error) {
        devError(`Failed to initialize Diffbot for URL: ${url}. Error:`, error);
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
 * Main fetch function with timeout and error handling using ResultAsync
 */
export function fetchWithTimeout(url: string): ResultAsync<Response, AppError> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 14000); // 14 seconds timeout

  return ResultAsync.fromPromise(
    fetchWithTimeoutHelper(url, { signal: controller.signal }),
    (error) => {
      if (error instanceof Error && error.name === "AbortError") {
        return createTimeoutError(url, 14000);
      }
      // If it's already an AppError, return it as is
      if (isAppError(error)) {
        return error as AppError;
      }
      return createUnknownError(error);
    }
  ).andThen((response) => {
    clearTimeout(timeoutId);
    return okAsync(response);
  });
}

/**
 * Helper function that does the actual fetching logic
 */
async function fetchWithTimeoutHelper(url: string, options: any): Promise<Response> {
  try {
    const fetchOptions = await getFetchOptions(url);

    let html: string;

    if (url.includes("web.archive.org")) {
      const diffbotResult = await fetchWithDiffbot(url);
      const noDiffbotResult = await ResultAsync.fromPromise(
        fetchHtmlContent(url, fetchOptions),
        (error) => {
          if (isAppError(error)) {
            return error as AppError;
          }
          return createNetworkError("Failed to fetch HTML", url, undefined, error);
        }
      );

      // Combine results and choose the best one
      const results = await Promise.allSettled([
        diffbotResult.match(
          (value) => value,
          (error) => {
            devWarn(`⚠️  Diffbot fetch failed: ${error.message}`);
            return null;
          }
        ),
        noDiffbotResult.match(
          (value) => value,
          (error) => {
            devWarn(`⚠️  Direct fetch failed: ${error.message}`);
            return null;
          }
        ),
      ]);

      const diffbotHtml = results[0].status === "fulfilled" ? results[0].value : null;
      const directHtml = results[1].status === "fulfilled" ? results[1].value : null;

      const bothResultsNull = !diffbotHtml && !directHtml;
      if (bothResultsNull) {
        // Get the actual errors for better error messages
        const diffbotError = await diffbotResult.mapErr(e => e.message).match(
          () => "succeeded",
          (msg) => msg
        );
        const directError = await noDiffbotResult.mapErr(e => e.message).match(
          () => "succeeded", 
          (msg) => msg
        );
        
        throw createNetworkError(
          `Failed to fetch content. Diffbot: ${diffbotError}. Direct: ${directError}`,
          url,
          undefined,
          "All fetch methods exhausted"
        );
      }

      if (diffbotHtml && directHtml) {
        const useDiffbot = diffbotHtml.length > directHtml.length;
        html = useDiffbot ? diffbotHtml : directHtml;
        devLog(
          `✓ Both methods succeeded for ${new URL(url).hostname}: Using ${useDiffbot ? "Diffbot" : "direct"} (${html.length.toLocaleString()} chars vs ${useDiffbot ? directHtml.length.toLocaleString() : diffbotHtml.length.toLocaleString()} chars)`
        );
      } else {
        // TypeScript now knows at least one is non-null from the check above
        html = (diffbotHtml || directHtml) as string;
        const method = diffbotHtml ? "Diffbot" : "direct";
        devLog(`✓ Using ${method} for ${new URL(url).hostname} (${html.length.toLocaleString()} chars)`);
      }
    } else {
      html = await fetchHtmlContent(url, fetchOptions);
    }

    const root = parse(html);
    fixImageSources(root, url);
    fixLinks(root, url);

    const cacheHeader = root.querySelector("#bN015htcoyT__google-cache-hdr");
    if (cacheHeader) {
      cacheHeader.remove();
    }

    return new Response(root.toString(), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    // Re-throw AppErrors as is
    if (isAppError(err)) {
      throw err;
    }
    // Wrap unknown errors
    throw createUnknownError(err);
  }
}

/**
 * Type guard to check if an error is an AppError
 */
function isAppError(error: unknown): error is AppError {
  return (
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    typeof (error as any).type === "string" &&
    [
      "NETWORK_ERROR",
      "PROXY_ERROR",
      "DIFFBOT_ERROR",
      "PARSE_ERROR",
      "TIMEOUT_ERROR",
      "RATE_LIMIT_ERROR",
      "CACHE_ERROR",
      "VALIDATION_ERROR",
      "UNKNOWN_ERROR",
    ].includes((error as any).type)
  );
}
