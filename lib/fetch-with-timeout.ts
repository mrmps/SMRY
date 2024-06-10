import { parse } from "node-html-parser";
import { HttpsProxyAgent } from "https-proxy-agent";
import { Agent } from "https";
import { safeError } from "./safe-error";

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
    console.error(`HTTP error! status: ${response.status} for URL: ${url}`);
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

async function fetchWithDiffbot(url: string) {
  if (!process.env.DIFFBOT_API_KEY) {
    throw new Error("No Diffbot API key configured in environment variables");
  }

  //https://api.diffbot.com/v3/analyze?url=https%3A%2F%2Farchive.is%2Flatest%2Fhttps%3A%2Fwww.nytimes.com%2F2024%2F06%2F05%2Fnyregion%2Fcongestion-pricing-supporters.html&token=7fb6f2086d9ec3a851721e3df2300ebe
  const diffbotURL = `https://api.diffbot.com/v3/article?url=${url}&token=${process.env.DIFFBOT_API_KEY}`;

  try {
    const response = await fetch(diffbotURL);
    const data = await response.json();
    const htmlContent = data.objects[0].html;
    return htmlContent;
  } catch (error) {
    console.error(`Failed to fetch from diffbot URL: ${diffbotURL}. Error: ${error}, Diffbot URL: ${diffbotURL}`);
    throw new Error(`Failed to fetch from diffbot URL: ${diffbotURL}. Error: ${error} Diffbot URL: ${diffbotURL}`);
  }
}

export async function fetchWithTimeout(url: string) {
  try {
    const options = await getFetchOptions(url);
    let html;
    if (url.includes("archive.is") || url.includes("web.archive.org")) {
      const fetchWithDiffbotPromise = fetchWithDiffbot(url);
      const fetchWithoutDiffbotPromise = fetchHtmlContent(url, options);

      try {
        const [diffbotResult, noDiffbotResult] = await Promise.allSettled([fetchWithDiffbotPromise, fetchWithoutDiffbotPromise])
          .then(results => results.map(result => result.status === "fulfilled" ? result.value : null));

        const bothResultsNull = !diffbotResult && !noDiffbotResult;
        if (bothResultsNull) {
          throw new Error("Both diffbot and no diffbot results were null");
        }

        if (diffbotResult && noDiffbotResult) {
          html = diffbotResult.length > noDiffbotResult.length ? diffbotResult : noDiffbotResult;
        } else {
          html = diffbotResult || noDiffbotResult;
        }
      } catch (error) {
        html = await fetchHtmlContent(url, options);
      }
    } else {
      html = await fetchHtmlContent(url, options);
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


// import { parse } from "node-html-parser";
// import { HttpsProxyAgent } from "https-proxy-agent";
// import { Agent } from "https";
// import { safeError } from "./safe-error";

// interface CustomFetchOptions extends RequestInit {
//   agent?: Agent;
// }

// export async function fetchWithTimeout(url: string) {

//   try {
//     // Prepare fetch options
//     const options: CustomFetchOptions = {
//       headers: {
//         "User-Agent":
//           "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3",
//       },
//     };

//     if (url.includes("archive.is") || url.includes("web.archive")) { //TODO this is clunky. is a proxy really necessary for all requests?
//       const proxyURL = process.env.PROXY_URL;

//       if (!proxyURL) {
//         throw new Error("no proxy url");
//       }

//       options.agent = new HttpsProxyAgent(proxyURL);
//       options.headers = {
//         "User-Agent":
//           "Mozilla/5.0 (X11; U; Linux i686 (x86_64); en-US; rv:1.8.1.4) Gecko/20070515 Firefox/2.0.0.4",
//       };
//     }

//     let response;
//     try {
//       response = await fetch(url, options);
//     } catch (error) {
//       console.error(`Failed to fetch from URL: ${url}. Error: ${error}`);
//       throw new Error(`Failed to fetch from URL: ${url}. Error: ${error}`);
//     }

//     if (!response.ok) {
//       console.error(`HTTP error! status: ${response.status} for URL: ${url}`);
//       throw new Error(`HTTP error! status: ${response.status}`);
//     }

//     const buffer = await response.arrayBuffer();
//     const decoder = new TextDecoder("utf-8");
//     const html = decoder.decode(buffer);

//     // Parse the HTML
//     const root = parse(html);

//     // Update image sources
//     root.querySelectorAll("img").forEach((img) => {
//       // Fix 'src' attribute
//       const src = img.getAttribute("src");
//       if (src && src.startsWith("/")) {
//         img.setAttribute("src", new URL(src, url).toString());
//       }
//       if (src && src.includes("web.archive.org/web/")) {
//         const originalUrl = src.split("im_/")[1];
//         if (originalUrl) {
//           img.setAttribute("src", originalUrl);
//         }
//       }

//       // Fix 'srcset' attribute
//       const srcset = img.getAttribute("srcset");
//       if (srcset) {
//         const newSrcset = srcset
//           .split(",")
//           .map((srcEntry) => {
//             let [src, descriptor] = srcEntry.trim().split(" ");
//             if (src && src.startsWith("/")) {
//               src = new URL(src, url).toString();
//             }
//             if (src && src.includes("web.archive.org/web/")) {
//               const originalUrl = src.split("im_/")[1];
//               if (originalUrl) {
//                 src = originalUrl;
//               }
//             }
//             return descriptor ? `${src} ${descriptor}` : src;
//           })
//           .join(", ");

//         img.setAttribute("srcset", newSrcset);
//       }
//     });

//     // remove google cache header
//     const cacheHeader = root.querySelector("#bN015htcoyT__google-cache-hdr");
//     if (cacheHeader) {
//       cacheHeader.remove();
//     }

//     // Update links
//     root.querySelectorAll("a").forEach((a) => {
//       const href = a.getAttribute("href");
//       if (href && href.includes("web.archive.org/web/")) {
//         // Log found Wayback Machine link

//         // Determine if the original URL starts with http:// or https://
//         let originalUrl;
//         if (href.includes("/http://")) {
//           originalUrl = href.split("/http://")[1];
//           originalUrl = "http://" + originalUrl;
//         } else if (href.includes("/https://")) {
//           originalUrl = href.split("/https://")[1];
//           originalUrl = "https://" + originalUrl;
//         }

//         if (originalUrl) {
//           // Update the href attribute with the original URL
//           a.setAttribute(
//             "href",
//             `${process.env.NEXT_PUBLIC_URL}/${new URL(
//               originalUrl,
//               url
//             ).toString()}`
//           );
//         }
//         // this should only be activated if the page is completely loaded and not parsed
//       // } else if (href) {
//       //   // Update the href attribute for other links
//       //   a.setAttribute(
//       //     "href",
//       //     `${process.env.NEXT_PUBLIC_URL}/proxy?url=${new URL(
//       //       href,
//       //       url
//       //     ).toString()}`
//       //   );
//       }
//     });

//     return new Response(root.toString(), {
//       headers: { "Content-Type": "application/json" },
//       status: response.status,
//     });
//   } catch (err) {

//     const error = safeError(err);
//     // Now, 'error' is the transformed error, so use its properties
//     throw new Error(`Error fetching URL: ${error.message}`);
//   }
// }

