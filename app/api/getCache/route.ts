import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import { z } from "zod";
import { parse} from "node-html-parser";
import { NodeHtmlMarkdown } from 'node-html-markdown';
import showdown from 'showdown';
import Showdown from "showdown";
import nlp from "compromise";

// export const runtime = "edge"; doesn't work for some reason


// function wrapSentencesWithSpan(html: string) {
//   const dom = new JSDOM(html);
//   const document = dom.window.document;
//   const paragraphs = document.querySelectorAll('p');
//   let spanCount = 0;

//   paragraphs.forEach(p => {
//       const newContent = Array.from(p.childNodes).map(node => {
//           if (node.nodeType === dom.window.Node.TEXT_NODE) {
//               // Use compromise for sentence splitting
//               const sentences = nlp(node.textContent || '').sentences().out('array');
//               return sentences.map((sentence: any) => {
//                   const className = `sentence-${spanCount++}`;
//                   return `<span class="${className}">${sentence}</span>`;
//               }).join('');
//           } else if (node instanceof dom.window.Element) {
//               // Now safely access outerHTML
//               return node.outerHTML;
//           }
//           return '';
//       }).join('');

//       p.innerHTML = newContent;
//   });

//   return dom.serialize();
// }

// function wrapSentencesWithSpan(html: string) {
//   const dom = new JSDOM(html);
//   const document = dom.window.document;
//   let spanCount = 0;

//   function processNode(node: Node) {
//       if (node.nodeType === dom.window.Node.TEXT_NODE) {
//           // Use compromise for sentence splitting on text nodes
//           const sentences = nlp(node.textContent || '').sentences().out('array');
//           return sentences.map((sentence: string) => {
//               const className = `sentence-${spanCount++}`;
//               return `<span class="${className}">${sentence}</span>`;
//           }).join(' '); // Add a space between spans to maintain spacing
//       } else if (node.nodeType === dom.window.Node.ELEMENT_NODE) {
//           // Recursively process child nodes for element nodes
//           Array.from(node.childNodes).forEach(child => {
//               const processedContent = processNode(child);
//               if (child.nodeType === dom.window.Node.TEXT_NODE) {
//                   const spanWrapper = document.createElement('span');
//                   spanWrapper.innerHTML = processedContent;
//                   child.replaceWith(spanWrapper);
//               }
//           });
//       }
//   }

//   processNode(document.body);

//   return dom.serialize();
// }

// function wrapSentencesWithSpan(html: string) {
//   const dom = new JSDOM(html);
//   const document = dom.window.document;
//   let spanCount = 0;

//   function processNode(node: Node) {
//       if (node.nodeType === dom.window.Node.TEXT_NODE) {
//           const textContent = node.textContent || '';
//           const sentences = nlp(textContent).sentences().out('array');
//           let currentIndex = 0;
//           let newContent = '';

//           sentences.forEach((sentence: string) => {
//               const index = textContent.indexOf(sentence, currentIndex);
//               const preText = textContent.substring(currentIndex, index);
//               currentIndex = index + sentence.length;

//               const className = `sentence-${spanCount++}`;
//               newContent += `${preText}<span class="${className}">${sentence}</span>`;
//           });

//           newContent += textContent.substring(currentIndex); // Append any remaining text after the last sentence
//           return newContent;
//       } else if (node.nodeType === dom.window.Node.ELEMENT_NODE) {
//           // Recursively process child nodes for element nodes
//           Array.from(node.childNodes).forEach(child => {
//               const processedContent = processNode(child);
//               if (child.nodeType === dom.window.Node.TEXT_NODE) {
//                   const spanWrapper = document.createElement('span');
//                   spanWrapper.innerHTML = processedContent ?? ""
//                   child.replaceWith(spanWrapper);
//               }
//           });
//       }
//   }

//   processNode(document.body);

//   return dom.serialize();
// }

function wrapSentencesWithSpan(html: string): { html: string, spans: { text: string, className: string }[] } {
  const dom = new JSDOM(html);
  const document = dom.window.document;
  let spanCount = 0;
  const spanArray: { text: string, className: string }[] = [];

  function processNode(node: Node) {
      if (node.nodeType === dom.window.Node.TEXT_NODE) {
          const textContent = node.textContent || '';
          const sentences = nlp(textContent).sentences().out('array');
          let currentIndex = 0;
          let newContent = '';

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
          Array.from(node.childNodes).forEach(child => {
              const processedContent = processNode(child);
              if (child.nodeType === dom.window.Node.TEXT_NODE) {
                  const spanWrapper = document.createElement('span');
                  spanWrapper.innerHTML = processedContent ?? "";
                  child.replaceWith(spanWrapper);
              }
          });
      }
  }

  processNode(document.body);

  return { html: dom.serialize(), spans: spanArray };
}


// function wrapSentencesWithSpan(html: string) {
//   const dom = new JSDOM(html);
//   const document = dom.window.document;
//   let spanCount = 0;

//   function processNode(node: Node) {
//       if (node.nodeType === dom.window.Node.TEXT_NODE) {
//           // Extract sentences along with preceding whitespace
//           const sentences = [];
//           const regex = /(\s*)([^.!?]+[.!?]*)/g;
//           let match;
//           while ((match = regex.exec(node.textContent || '')) !== null) {
//               sentences.push({
//                   whitespace: match[1],
//                   text: match[2]
//               });
//           }

//           // Wrap sentences and preserve whitespace
//           return sentences.map(({ whitespace, text }) => {
//               const className = `sentence-${spanCount++}`;
//               return `${whitespace}<span class="${className}">${text}</span>`;
//           }).join('');
//       } else if (node.nodeType === dom.window.Node.ELEMENT_NODE) {
//           // Recursively process child nodes for element nodes
//           Array.from(node.childNodes).forEach(child => {
//               const processedContent = processNode(child);
//               if (child.nodeType === dom.window.Node.TEXT_NODE) {
//                   const spanWrapper = document.createElement('span');
//                   spanWrapper.innerHTML = processedContent;
//                   child.replaceWith(spanWrapper);
//               }
//           });
//       }
//   }

//   processNode(document.body);

//   return dom.serialize();
// }

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

  if (!url) {
    return new Response(
      JSON.stringify({ message: "URL parameter is required." }),
      { headers: { "Content-Type": "application/json" }, status: 400 }
    );
  }

  //   const googleCacheUrl = `http://webcache.googleusercontent.com/search?q=cache:${encodeURIComponent(
  //     url
  //   )}`;
  // const waybackUrl = `http://archive.org/wayback/available?url=${encodeURIComponent(
  //   url
  // )}`;
  //   const archiveIsUrl = `https://archive.is/latest/${encodeURIComponent(url)}`;
  const sources = [
    `http://archive.org/wayback/available?url=${encodeURIComponent(url)}`,
    `http://webcache.googleusercontent.com/search?q=cache:${encodeURIComponent(
      url
    )}`,
    url,

    // `https://archive.is/latest/${encodeURIComponent(url)}`,
    // Other URLs can be added here
  ];

  const dummy = {
    title: "Sample Page",
    byline: null,
    dir: "ltr",
    lang: "en",
    content: "<p>This is some sample content.</p>",
    textContent: "This is some sample content.",
    length: 1200,
    excerpt: "Sample excerpt from the page content.",
    siteName: "Example Site",
    source: url,
    sourceURL: "",
  };

  try {
    const responses = await Promise.allSettled(sources.map(fetchWithTimeout));
    console.log(sources);
    console.log("responses", responses);

    for (const sourceUrl of sources) {
      console.log("trying", sourceUrl)
      try {
        const response = await fetchWithTimeout(sourceUrl);
        let { url, html } = response;
        let source = determineSource(url);
  
        if (isWaybackMachineResponse(url)) {
          const archiveUrl = getArchiveUrl(html);
          if (archiveUrl) {
            const archiveResponse = await fetchWithTimeout(archiveUrl);
            html = archiveResponse.html;
            source = "Wayback Machine";
          } else {
            continue;
          }
        }
  
        const doc = new JSDOM(html);
        const reader = new Readability(doc.window.document);
        const article = reader.parse();
  
        if (article) {
          const markdown = NodeHtmlMarkdown.translate(article.content);
          const converter = new showdown.Converter()
          const flattenedHTML = converter.makeHtml(markdown);
          const { html, spans } = wrapSentencesWithSpan(flattenedHTML);
          
          return new Response(
            JSON.stringify({ ...article, source, sourceURL: url, flattenedHTML: html, spans: spans }),
            {
              headers: { "Content-Type": "application/json" },
              status: 200,
            }
          );
        }
      } catch (error) {
        console.error(`Error fetching from ${sourceUrl}:`, error);
      }
    }
  
    return new Response(
      JSON.stringify({ dummy }),
      {
        headers: { "Content-Type": "application/json" },
        status: 500,
      }
    );
  
  } catch (error) {
    const err = safeError(error);
    return new Response(JSON.stringify(err), {
      headers: { "Content-Type": "application/json" },
      status: err.status,
    });
  }
}

function determineSource(url: string) {
  if (url.includes("webcache.googleusercontent.com")) {
    return "Google Cache";
  } else if (url.includes("archive.org")) {
    return "Wayback Machine Original";
  } else {
    return "Direct Fetch";
  }
}

async function fetchWithTimeout(url:string) {
  const timeout = 5000; // Timeout in milliseconds
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3",
      },
    });
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
    root.querySelectorAll('img').forEach(img => {
      // Fix 'src' attribute
      const src = img.getAttribute('src');
      if (src && src.startsWith('/')) {
        img.setAttribute('src', new URL(src, url).toString());
      }
      if (src && src.includes('web.archive.org/web/')) {
        const originalUrl = src.split('im_/')[1];
        if (originalUrl) {
          img.setAttribute('src', originalUrl);
        }
      }
    
      // Fix 'srcset' attribute
      const srcset = img.getAttribute('srcset');
      if (srcset) {
        const newSrcset = srcset.split(',').map(srcEntry => {
          let [src, descriptor] = srcEntry.trim().split(' ');
          if (src && src.startsWith('/')) {
            src = new URL(src, url).toString();
          }
          if (src && src.includes('web.archive.org/web/')) {
            const originalUrl = src.split('im_/')[1];
            if (originalUrl) {
              src = originalUrl;
            }
          }
          return descriptor ? `${src} ${descriptor}` : src;
        }).join(', ');
    
        img.setAttribute('srcset', newSrcset);
      }
    });
    
    
    // Update links
    root.querySelectorAll('a').forEach(a => {
      const href = a.getAttribute('href');
      if (href && href.includes('web.archive.org/web/')) {
        // Log found Wayback Machine link
    
        // Determine if the original URL starts with http:// or https://
        let originalUrl;
        if (href.includes('/http://')) {
          originalUrl = href.split('/http://')[1];
          originalUrl = "http://" + originalUrl;
        } else if (href.includes('/https://')) {
          originalUrl = href.split('/https://')[1];
          originalUrl = "https://" + originalUrl;
        }
    
        if (originalUrl) {
          // Update the href attribute with the original URL
          a.setAttribute('href', `${process.env.NEXT_PUBLIC_URL}/${new URL(originalUrl, url).toString()}`);
        }
      } else if (href) {
        // Update the href attribute for other links
        a.setAttribute('href', `${process.env.NEXT_PUBLIC_URL}/proxy?url=${new URL(href, url).toString()}`);
      }
    });
    
    return { url, html: root.toString() };
  } catch (error) {
    clearTimeout(id);
    throw error;
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


// async function fetchPageWithHeadlessBrowser(url:string) {
//   const browser = await puppeteer.launch();
//   const page = await browser.newPage();
//   await page.goto(url, { waitUntil: 'networkidle0' }); // Waits until the network is idle (no more than 2 network connections for at least 500 ms).
//   const html = await page.content(); // Retrieves the HTML content of the page.
//   await browser.close();

//   return { url, html};
// }


// import { JSDOM } from "jsdom";
// import { Readability } from "@mozilla/readability";
// import { z } from "zod";
// // import logger from "@/lib/logger";

//   export const runtime = "edge"

// // Define a schema for known errors
// const KnownErrorSchema = z.object({
//   message: z.string(),
//   status: z.number(),
//   error: z.string(),
//   details: z.record(z.string()).optional(),
// });

// // Define a schema for unknown errors
// const UnknownErrorSchema = z.object({
//   message: z.string(),
//   error: z.string().optional(),
// });

// // The helper function that validates and formats the error response
// function safeError(error: unknown) {
//   // Check if it is a known error
//   const knownErrorResult = KnownErrorSchema.safeParse(error);
//   if (knownErrorResult.success) {
//     return knownErrorResult.data;
//   }

//   // If not a known error, check if it is an unknown error with a message
//   const unknownErrorResult = UnknownErrorSchema.safeParse(error);
//   if (unknownErrorResult.success) {
//     return {
//       ...unknownErrorResult.data,
//       status: 500, // default to 500 if status is not known
//       error: "Internal Server Error",
//     };
//   }

//   // If validation fails, log the original error for internal tracking
//   console.error("Invalid error object:", error);
//   // Return a generic error to the client
//   return {
//     message: "An unexpected error occurred.",
//     status: 500,
//     error: "Internal Server Error",
//   };
// }

// export async function GET(request: Request) {
//   const { searchParams } = new URL(request.url);
//   const url = searchParams.get("url");

//   if (!url) {
//     return new Response(
//       JSON.stringify({ message: "URL parameter is required." }),
//       {
//         headers: { "Content-Type": "application/json" },
//         status: 400,
//       }
//     );
//   }

//   const dummy = {
//     title: "Sample Page",
//     byline: null,
//     dir: "ltr",
//     lang: "en",
//     content: "<p>This is some sample content.</p>",
//     textContent: "This is some sample content.",
//     length: 1200,
//     excerpt: "Sample excerpt from the page content.",
//     siteName: "Example Site",
//     source: url,
//     sourceURL: "",
//   };

//   const googleCacheUrl = `http://webcache.googleusercontent.com/search?q=cache:${encodeURIComponent(
//     url
//   )}`;
//   const waybackUrl = `http://archive.org/wayback/available?url=${encodeURIComponent(
//     url
//   )}`;
//   const archiveIsUrl = `https://archive.is/latest/${encodeURIComponent(url)}`;

//   try {
//     console.log("starting fetch")
//     const responses = await Promise.allSettled([
//       fetchWithEncoding(googleCacheUrl),
//       fetchWithEncoding(waybackUrl),
//       fetchWithEncoding(url),
//       // fetchWithEncoding(archiveIsUrl),
//     ]);
//     for (const response of responses) {
//       if (response.status === "fulfilled") {
//         let { url, html } = response.value;
//         // logger.info({ url, html }, `url + html`);
//         console.log({url, html},`url + html`)

//         let sourceURL = url;
//         let source = determineSource(url);
//         // logger.info({ source }, `source`);
//          console.log({ source }, `source`);

//         if (isWaybackMachineResponse(url)) {
//           const archiveUrl = getArchiveUrl(html);
//           if (archiveUrl) {
//             const archiveResponse = await fetchWithEncoding(archiveUrl);
//             html = archiveResponse.html;
//             sourceURL = archiveUrl; // Update source URL to the actual archive URL
//             source = "Wayback Machine"; // Explicitly set the source to Wayback Machine
//           } else {
//             continue; // Skip if no valid archive
//           }
//         }

//         const doc = new JSDOM(html);
//         const reader = new Readability(doc.window.document);
//         const article = reader.parse();

//         if (article) {
//           return new Response(
//             JSON.stringify({ ...article, source, sourceURL }),
//             {
//               headers: { "Content-Type": "application/json" },
//               status: 200,
//             }
//           );
//         }
//       }
//     }

//     // Fallback to dummy response if all requests fail
//     return new Response(JSON.stringify({ ...dummy }), {
//       headers: { "Content-Type": "application/json" },
//       status: 200,
//     });
//   } catch (error) {
//     const err = safeError(error);
//     return new Response(JSON.stringify({ ...dummy }), {
//       headers: { "Content-Type": "application/json" },
//       status: err.status,
//     });
//   }
// }


// function determineSource(url: string): string {
//   if (url.includes("webcache.googleusercontent.com")) {
//     return "Google Cache";
//   } else if (url.includes("archive.org")) {
//     return "Wayback Machine Original";
//   } else {
//     return "Direct Fetch";
//   }
// }

// async function fetchWithEncoding(url: string) {
//   const googlebotUserAgent =
//     "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

//   const response = await fetch(url, {
//     headers: {
//       "User-Agent": googlebotUserAgent,
//     },
//   });

//   if (!response.ok) {
//     throw new Error(`HTTP error! status: ${response.status}`);
//   }

//   const buffer = await response.arrayBuffer();
//   const decoder = new TextDecoder("utf-8"); // Assuming UTF-8 encoding
//   const html = decoder.decode(buffer);
//   return { url, html }; // Return both URL and HTML
// }



// function isArchiveIsResponse(url: string) {
//   return url.includes("archive.is");
// }

// function parseArchiveIsResponse(htmlResponse: string) {
//   const parser = new DOMParser();
//   const doc = parser.parseFromString(htmlResponse, "text/html");
//   const snapshotElements = doc.querySelectorAll(".THUMBS-BLOCK a");

//   const snapshots = Array.from(snapshotElements).map((el) => {
//     // Type assertion to HTMLAnchorElement
//     const anchorEl = el as HTMLAnchorElement;
//     return {
//       url: anchorEl.href, // Now 'href' is valid
//       timestamp: anchorEl.querySelector("div")?.textContent?.trim() || "",
//     };
//   });

//   return snapshots;
// }

// function findLatestSnapshot(snapshots: any[]) {
//   return snapshots.sort((a, b) => {
//     // Convert timestamps to Date objects
//     const dateA = new Date(a.timestamp);
//     const dateB = new Date(b.timestamp);

//     // Convert Date objects to timestamps (number format) for subtraction
//     return dateB.getTime() - dateA.getTime();
//   })[0];
// }
