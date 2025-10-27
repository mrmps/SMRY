import { parse } from "node-html-parser";
import { HttpsProxyAgent } from "https-proxy-agent";
import { Agent } from "https";
import { safeError } from "./safe-error";
import { Diffbot, DiffbotArticleResponse } from "diffbot";

interface CustomFetchOptions extends RequestInit {
  agent?: Agent;
}

async function getFetchOptions(url: string): Promise<CustomFetchOptions> {
  const options: CustomFetchOptions = {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3",
    },
  };

  if (url.includes("archive.is") || url.includes("web.archive")) {
    const proxyURL = process.env.PROXY_URL;

    if (!proxyURL) {
      throw new Error("No proxy URL configured in environment variables");
    }

    options.agent = new HttpsProxyAgent(proxyURL);
    // options.headers = {
    //   "User-Agent":
    //     "Mozilla/5.0 (X11; U; Linux i686 (x86_64); en-US; rv:1.8.1.4) Gecko/20070515 Firefox/2.0.0.4",
    // };
  }

  return options;
}

async function fetchHtmlContent(url: string, options: CustomFetchOptions): Promise<string> {
  let response;
  try {
    response = await fetch(url, options);
  } catch (error) {
    console.error(`Failed to fetch from URL: ${url}. Error: ${error}`);
    throw new Error(`Failed to fetch from URL: ${url}. Error: ${error}`);
  }

  if (!response.ok) {
    // Log rate limit errors as warnings since we have fallbacks
    if (response.status === 429) {
      console.warn(`Rate limited (429) for URL: ${url}. Will use fallback if available.`);
    } else {
      console.error(`HTTP error! status: ${response.status} for URL: ${url}`);
    }
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const buffer = await response.arrayBuffer();
  const decoder = new TextDecoder("utf-8");
  return decoder.decode(buffer);
}

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
        a.setAttribute("href", `${process.env.NEXT_PUBLIC_URL}/${new URL(originalUrl, url).toString()}`);
      }
    }
  });
}

async function fetchWithDiffbot(url: string): Promise<string> {
  if (!process.env.DIFFBOT_API_KEY) {
    throw new Error("No Diffbot API key configured in environment variables");
  }

  return new Promise((resolve, reject) => {
    try {
      const diffbot = new Diffbot(process.env.DIFFBOT_API_KEY!);
      
      // Old diffbot API uses callbacks and 'uri' instead of 'url'
      diffbot.article({ uri: url, html: true }, (err: Error | null, response: DiffbotArticleResponse) => {
        if (err) {
          console.error(`Diffbot API error for URL: ${url}`, err);
          reject(err);
          return;
        }
        
        // The old diffbot package returns the newer API format with objects array
        let htmlContent: string | undefined;
        
        // Try new API format first (objects array)
        if (response?.objects && Array.isArray(response.objects) && response.objects.length > 0) {
          htmlContent = response.objects[0].html;
        } 
        // Fallback to old API format (html directly on response)
        else if (response?.html) {
          htmlContent = response.html;
        }
        
        // Check if HTML content exists
        if (!htmlContent) {
          console.error(`Diffbot returned no HTML content:`, JSON.stringify(response, null, 2));
          reject(new Error(`Diffbot API returned no HTML content for URL: ${url}`));
          return;
        }
        
        resolve(htmlContent);
      });
    } catch (error) {
      console.error(`Failed to initialize Diffbot for URL: ${url}. Error:`, error);
      reject(error);
    }
  });
}

export async function fetchWithTimeout(url: string) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 14000); // 14 seconds timeout

  try {
    const response = await fetchWithTimeoutHelper(url, { signal: controller.signal });
    return response;
  } catch (err) {
    const error = safeError(err);
    return new Response(`Error fetching URL: ${error.message}`, { status: 500 });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchWithTimeoutHelper(url: string, options: any) {
  try {
    const fetchOptions = await getFetchOptions(url);
    let html: string;
    if (url.includes("archive.is") || url.includes("web.archive.org")) {
      const fetchWithDiffbotPromise = fetchWithDiffbot(url);
      const fetchWithoutDiffbotPromise = fetchHtmlContent(url, fetchOptions);

      try {
        const [diffbotResult, noDiffbotResult] = await Promise.allSettled([fetchWithDiffbotPromise, fetchWithoutDiffbotPromise])
          .then(results => results.map(result => result.status === "fulfilled" ? result.value : null));

        const bothResultsNull = !diffbotResult && !noDiffbotResult;
        if (bothResultsNull) {
          throw new Error("Both diffbot and no diffbot results were null");
        }

        if (diffbotResult && noDiffbotResult) {
          html = diffbotResult.length > noDiffbotResult.length ? diffbotResult : noDiffbotResult;
          console.log(`Using ${diffbotResult.length > noDiffbotResult.length ? 'Diffbot' : 'direct'} result (longer content)`);
        } else {
          // TypeScript now knows at least one is non-null from the check above
          html = (diffbotResult || noDiffbotResult) as string;
          console.log(`Using ${diffbotResult ? 'Diffbot' : 'direct'} result (only available option)`);
        }
      } catch (error) {
        console.warn(`Both primary methods failed, falling back to direct fetch: ${error}`);
        html = await fetchHtmlContent(url, fetchOptions);
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
    const error = safeError(err);
    throw new Error(`Error fetching URL: ${error.message}`);
  }
}