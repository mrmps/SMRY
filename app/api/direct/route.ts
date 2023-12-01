import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { safeError } from "@/lib/safe-error";

function createErrorResponse(message: string, status: number, details = {}) {
  return new Response(JSON.stringify({ message, details }), {
    headers: { "Content-Type": "application/json" },
    status,
  });
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

  let urlWithSource;
  switch (source) {
    case "direct":
      urlWithSource = url;
      break;
    case "wayback":
      urlWithSource = `https://web.archive.org/web/2/${encodeURIComponent(
        url
      )}`;
      break;
    case "google":
      const cleanUrl = url.replace(/^https?:\/+/, "");
      const finalUrl = `https://${cleanUrl}`;
      urlWithSource = `https://webcache.googleusercontent.com/search?q=cache:${encodeURIComponent(
        finalUrl
      )}`;
      break;
    default:
      return createErrorResponse("Invalid source parameter.", 400);
  }

  try {
    const response = await fetchWithTimeout(urlWithSource);

    if (!response.ok) {
      //   throw new Error(`HTTP error! status: ${response.status}`);

      return new Response(JSON.stringify({
        url: urlWithSource,
        cacheURL: url,
        error: `HTTP error! status: ${response.status}`,
        status: "error",
        contentLength: 0,
      }), {
        headers: { "Content-Type": "application/json" },
        status: response.status,
      });
    }

    const html = await response.text();
    const doc = new JSDOM(html);
    const reader = new Readability(doc.window.document);
    const article = reader.parse();

    // // if source is 'wayback', then await a timeout of 10s
    // if (source === 'wayback') {
    //   await new Promise(resolve => setTimeout(resolve, 10000));
    // }

    const resp = {
      source,
      cacheURL: url,
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
