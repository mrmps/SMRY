import { Readability } from "@mozilla/readability";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { safeError } from "@/lib/safe-error";
import jsdom from 'jsdom';
import { getUrlWithSource } from "@/lib/get-url-with-source";

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

  const urlWithSource = getUrlWithSource(source, url);

  try {
    const response = await fetchWithTimeout(urlWithSource);

    if (!response.ok) {
      //   throw new Error(`HTTP error! status: ${response.status}`);
      console.log(`HTTP error! status: ${response.status} url: ${urlWithSource} statusText: ${JSON.stringify(response.statusText)}`); 

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

    const html = await response.text();
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
