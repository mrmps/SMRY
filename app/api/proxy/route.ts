import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import { z } from "zod";
import { parse } from "node-html-parser";
import { NodeHtmlMarkdown } from "node-html-markdown";
import showdown from "showdown";
import Showdown from "showdown";
import nlp from "compromise";
import { HttpsProxyAgent } from "https-proxy-agent";
import { Agent } from 'https';

interface CustomFetchOptions extends RequestInit {
  agent?: Agent;
}

function createErrorResponse(message: string, status: number, details = {}) {
  return new Response(JSON.stringify({ message, details }), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}



export function formatError(errorObj: any): string {
  // This function takes an error object and returns a string representation
  // You can customize this to extract the most relevant information
  if (typeof errorObj === "object" && errorObj !== null) {
    return errorObj.message || JSON.stringify(errorObj);
  } else {
    return "Unknown error";
  }
}

function wrapSentencesWithSpan(html: string): {
  html: string;
  spans: { text: string; className: string }[];
} {
  const dom = new JSDOM(html);
  const document = dom.window.document;
  let spanCount = 0;
  const spanArray: { text: string; className: string }[] = [];

  function processNode(node: Node) {
    if (node.nodeType === dom.window.Node.TEXT_NODE) {
      const textContent = node.textContent || "";
      const sentences = nlp(textContent).sentences().out("array");
      let currentIndex = 0;
      let newContent = "";

      sentences.forEach((sentence: string) => {
        const index = textContent.indexOf(sentence, currentIndex);
        const preText = textContent.substring(currentIndex, index);
        currentIndex = index + sentence.length;

        const className = `sentence-${spanCount++}`;
        newContent += `${preText}<span class="${className}">${sentence}</span>`;
        spanArray.push({ text: sentence, className });
      });

      newContent += textContent.substring(currentIndex); // Append any remaining text after the last sentence
      return newContent;
    } else if (node.nodeType === dom.window.Node.ELEMENT_NODE) {
      // Recursively process child nodes for element nodes
      Array.from(node.childNodes).forEach((child) => {
        const processedContent = processNode(child);
        if (child.nodeType === dom.window.Node.TEXT_NODE) {
          const spanWrapper = document.createElement("span");
          spanWrapper.innerHTML = processedContent ?? "";
          child.replaceWith(spanWrapper);
        }
      });
    }
  }

  processNode(document.body);

  return { html: dom.serialize(), spans: spanArray };
}

const KnownErrorSchema = z.object({
  message: z.string(),
  status: z.number(),
  error: z.string(),
  details: z.record(z.string()).optional(),
});

const UnknownErrorSchema = z.object({
  message: z.string(),
  error: z.string().optional(),
});

function safeError(error: unknown) {
  const knownErrorResult = KnownErrorSchema.safeParse(error);
  if (knownErrorResult.success) {
    return knownErrorResult.data;
  }

  const unknownErrorResult = UnknownErrorSchema.safeParse(error);
  if (unknownErrorResult.success) {
    return { ...unknownErrorResult.data, status: 500 };
  }

  console.error("Invalid error object:", error);
  return {
    message: "An unexpected error occurred.",
    status: 500,
    error: "Internal Server Error",
  };
}



export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  const origin = searchParams.get("origin") || undefined;

  if (!url) {
    return createErrorResponse("URL parameter is required.", 400);
  }

  const cleanUrl = url.replace(/^https?:\/+/, '');

// Add https:// prefix
  const finalUrl = `https://${cleanUrl}`;

  // let sources: string[] = [];
  // switch(origin) {
  //   case 'archive':
  //     sources = [`https://web.archive.org/web/2/${encodeURIComponent(url)}`];
  //     break;
  //   case 'google':
  //     sources = [`https://webcache.googleusercontent.com/search?q=cache:${encodeURIComponent(finalUrl)}`];
  //     break;
  //   case 'archive.is':
  //     // sources = [`http://archive.is/latest/${encodeURIComponent(url)}`];
  //     break;
  //   default:
  //     sources = [url];
  // }

  const sources = [
    `https://web.archive.org/web/2/${encodeURIComponent(url)}`,
    `https://webcache.googleusercontent.com/search?q=cache:${encodeURIComponent(finalUrl)}`,
    // `http://archive.is/latest/${encodeURIComponent(url)}`,
    url,
  ];

  

  try {
    const fetchPromises = sources.map((sourceUrl) =>
      fetchWithTimeout(sourceUrl)
    );
    const results = await Promise.allSettled(fetchPromises);

    const responses = results.map((result, index) => {
      if (result.status === "fulfilled") {
        const { url: responseUrl, html } = result.value;
        let source = determineSource(responseUrl);
        const doc = new JSDOM(html);
        const reader = new Readability(doc.window.document);
        const article = reader.parse();

        if (article && article.content) {
          return {
            source,
            cacheURL: sources[index],
            article,
            status: "success",
            contentLength: article.content.length,
          };
        } else {
          return {
            source,
            cacheURL: sources[index],
            error: "Article not found or processed.",
            status: "error",
            contentLength: 0,
          };
        }
      } else {
        return {
          source: determineSource(sources[index]),
          cacheURL: sources[index],
          error: formatError(result.reason),
          status: "error",
          contentLength: 0,
        };
      }
    });

    responses.sort((a, b) => b.contentLength - a.contentLength);

    return new Response(JSON.stringify(responses), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const err = safeError(error);
    return createErrorResponse(err.message, err.status, { sourceUrl: url });
  }
}

function determineSource(url: string) {
  if (url.includes("webcache.googleusercontent.com")) {
    return "Google Cache";
  } else if (url.includes("archive.org")) {
    return "Wayback Machine";
  }
    else if (url.includes("archive.is")) {
    return "Archive.Is";
  } else {
    return "Direct";
  }
}

async function fetchWithTimeout(url: string) {
  const timeout = 5000; // Timeout in milliseconds
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    // Prepare fetch options
    const options: CustomFetchOptions = {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3",
      },
    };

    if (url.includes("googlecache") || url.includes("archive.is")) {
      const proxyURL = process.env.PROXY_URL;

      if (!proxyURL) {
        throw new Error("no proxy url")
      }

      options.agent = new HttpsProxyAgent(proxyURL);
      options.headers = {
        "User-Agent": "Mozilla/5.0 (X11; U; Linux i686 (x86_64); en-US; rv:1.8.1.4) Gecko/20070515 Firefox/2.0.0.4",
      }
    }

    const response = await fetch(url, options);

    clearTimeout(id);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    const decoder = new TextDecoder("utf-8");
    const html = decoder.decode(buffer);

    // Parse the HTML
    const root = parse(html);

    // Update image sources
    root.querySelectorAll("img").forEach((img) => {
      // Fix 'src' attribute
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

      // Fix 'srcset' attribute
      const srcset = img.getAttribute("srcset");
      if (srcset) {
        const newSrcset = srcset
          .split(",")
          .map((srcEntry) => {
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

    // remove google cache header
    const cacheHeader = root.querySelector('#bN015htcoyT__google-cache-hdr');
    if (cacheHeader) {
      cacheHeader.remove();
    }

    // Update links
    root.querySelectorAll("a").forEach((a) => {
      const href = a.getAttribute("href");
      if (href && href.includes("web.archive.org/web/")) {
        // Log found Wayback Machine link

        // Determine if the original URL starts with http:// or https://
        let originalUrl;
        if (href.includes("/http://")) {
          originalUrl = href.split("/http://")[1];
          originalUrl = "http://" + originalUrl;
        } else if (href.includes("/https://")) {
          originalUrl = href.split("/https://")[1];
          originalUrl = "https://" + originalUrl;
        }

        if (originalUrl) {
          // Update the href attribute with the original URL
          a.setAttribute(
            "href",
            `${process.env.NEXT_PUBLIC_URL}/${new URL(
              originalUrl,
              url
            ).toString()}`
          );
        }
      } else if (href) {
        // Update the href attribute for other links
        a.setAttribute(
          "href",
          `${process.env.NEXT_PUBLIC_URL}/proxy?url=${new URL(
            href,
            url
          ).toString()}`
        );
      }
    });

    return { url, html: root.toString() };
  } catch (err) {
    clearTimeout(id);

    // Check for AbortError before transforming the error
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Request timed out");
    }

    const error = safeError(err);
    // Now, 'error' is the transformed error, so use its properties
    throw new Error(`Error fetching URL: ${error.message}`);
  }
}

interface WaybackResponse {
  archived_snapshots?: {
    [key: string]: any;
  };
}
function getArchiveUrl(responseJson: string): string | null {
  try {
    const parsedJson: WaybackResponse = JSON.parse(responseJson);
    if (
      parsedJson &&
      parsedJson.archived_snapshots &&
      parsedJson.archived_snapshots.closest &&
      parsedJson.archived_snapshots.closest.available
    ) {
      return parsedJson.archived_snapshots.closest.url; // Return the snapshot URL
    }
    return null; // No valid snapshot
  } catch (e) {
    console.error("Error parsing JSON for archive check:", e);
    return null;
  }
}

function isWaybackMachineResponse(url: string) {
  return url.includes("archive.org");
}