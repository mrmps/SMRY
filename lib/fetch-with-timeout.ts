import { parse } from "node-html-parser";
import { HttpsProxyAgent } from "https-proxy-agent";
import { Agent } from "https";
import { safeError } from "./safe-error";

interface CustomFetchOptions extends RequestInit {
  agent?: Agent;
}

export async function fetchWithTimeout(url: string) {

  try {
    // Prepare fetch options
    const options: CustomFetchOptions = {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3",
      },
    };

    if (url.includes("archive.is") || url.includes("web.archive")) { //TODO this is clunky. is a proxy really necessary for all requests?
      const proxyURL = process.env.PROXY_URL;

      if (!proxyURL) {
        throw new Error("no proxy url");
      }

      options.agent = new HttpsProxyAgent(proxyURL);
      options.headers = {
        "User-Agent":
          "Mozilla/5.0 (X11; U; Linux i686 (x86_64); en-US; rv:1.8.1.4) Gecko/20070515 Firefox/2.0.0.4",
      };
    }

    let response;
    try {
      response = await fetch(url, options);
    } catch (error) {
      console.error(`Failed to fetch from URL: ${url}. Error: ${error}`);
      throw new Error(`Failed to fetch from URL: ${url}. Error: ${error}`);
    }

    if (!response.ok) {
      console.error(`HTTP error! status: ${response.status} for URL: ${url}`);
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
    const cacheHeader = root.querySelector("#bN015htcoyT__google-cache-hdr");
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
        // this should only be activated if the page is completely loaded and not parsed
      // } else if (href) {
      //   // Update the href attribute for other links
      //   a.setAttribute(
      //     "href",
      //     `${process.env.NEXT_PUBLIC_URL}/proxy?url=${new URL(
      //       href,
      //       url
      //     ).toString()}`
      //   );
      }
    });

    return new Response(root.toString(), {
      headers: { "Content-Type": "application/json" },
      status: response.status,
    });
  } catch (err) {

    const error = safeError(err);
    // Now, 'error' is the transformed error, so use its properties
    throw new Error(`Error fetching URL: ${error.message}`);
  }
}

