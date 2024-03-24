import { Readability } from "@mozilla/readability";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { safeError } from "@/lib/safe-error";
import jsdom from "jsdom";
import { getUrlWithSource } from "@/lib/get-url-with-source";
import { parse } from "node-html-parser";

function createErrorResponse(message: string, status: number, details = {}) {
  return new Response(JSON.stringify({ message, details }), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}


async function extractSiteContent(html: string) { //TODO make this work
  console.log("Starting to extract site content...");

  // Parse the HTML string into a DOM object
  console.log("Parsing HTML string into a DOM object...");
  const root = parse(html);
  console.log(root);
  console.log("HTML string parsed successfully.");

  // Select the element that contains the main site content
  // You can adjust the selector based on the actual class or id used in the HTML
  console.log("Selecting the element that contains the main site content...");
  const contentElement = root.querySelector('body');

  if (contentElement) {
      console.log("Element containing the main site content found.");

      // Serialize the content element back to a string
      console.log("Serializing the content element back to a string...");
      const siteContentHtml = contentElement.outerHTML;
      console.log("Content element serialized successfully.");

      return siteContentHtml;
  } else {
      console.log("Element containing the main site content not found.");
      return 'Site content not found';
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  const source = searchParams.get("source");

  if (!url) {
    return createErrorResponse("URL parameter is required.", 400);
  }
  if (!source) {
    return createErrorResponse("Source parameter is required.", 400);
  }

  const urlWithSource = getUrlWithSource(source, url);

  try {
    let html: string;

    console.log("fetching: " + source + " " + urlWithSource);

    if (source === "archive") {
      const options = {
        method: "GET",
        headers: { accept: "application/json" },
      };

      console.log('archive url', `https://api.diffbot.com/v3/article?url=${encodeURIComponent(urlWithSource)}&timeout=60000&token=7fb6f2086d9ec3a851721e3df2300ebe`)

      if (!process.env.DIFFBOT_API_KEY) {
        throw new Error("DIFFBOT_API_KEY is not set");
      }

      const reponse = await fetch(
        `https://api.diffbot.com/v3/article?url=${encodeURIComponent(urlWithSource)}&timeout=60000&token=${process.env.DIFFBOT_API_KEY}`,
        options
      )
        .then((response) => response.json())

      //   (property) article: {
      //     title: string;
      //     content: string;
      //     textContent: string;
      //     length: number;
      //     excerpt: string;
      //     byline: string;
      //     dir: string;
      //     siteName: string;
      //     lang: string;
      // } | null

      let firstObject = reponse.objects[0]

      console.log(firstObject, "firstObject");

      const article = {
        title: firstObject?.title || '',
        content: firstObject?.html || '',
        textContent: firstObject?.text || '',
        length: firstObject?.text.length || 0,
        siteName: url.split("/")[2],
      }

      console.log(article, "article");

      return new Response(
        JSON.stringify({
          source,
          cacheURL: urlWithSource,
          article: article,
          status: "success",
          contentLength: firstObject?.text.length || 0,
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 200,
        }
      )

      // html = uncleanedHtml as string ? await extractSiteContent(uncleanedHtml) : '';

      // console.log("cleaned html: " + html);

    } else {
      const response = await fetchWithTimeout(urlWithSource);
      html = response.ok ? await response.text() : '';
      if (!response.ok) {
        //   throw new Error(`HTTP error! status: ${response.status}`);
        console.log(
          `HTTP error! status: ${
            response.status
          } url: ${urlWithSource} statusText: ${JSON.stringify(
            response.statusText
          )}`
        );
  
        return new Response(
          JSON.stringify({
            url: url,
            cacheURL: urlWithSource,
            error: `HTTP error! status: ${response.status}`,
            status: "error",
            contentLength: 0,
          }),
          {
            headers: { "Content-Type": "application/json" },
            status: response.status,
          }
        );
      }
    }

  

  
    const { JSDOM } = jsdom;
    const virtualConsole = new jsdom.VirtualConsole();
    virtualConsole.on("error", () => {
      // No-op to skip console errors.
    });
    const doc = new JSDOM(html, { virtualConsole });

    const reader = new Readability(doc.window.document);
    const article = reader.parse();

    const resp = {
      source,
      cacheURL: urlWithSource,
      article,
      status: "success",
      contentLength: article?.content.length || 0,
    };

    return new Response(JSON.stringify(resp), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const err = safeError(error);
    return createErrorResponse(err.message, err.status, { sourceUrl: url });
  }
}
