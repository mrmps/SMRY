import { Readability } from "@mozilla/readability";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { safeError } from "@/lib/safe-error";
import { JSDOM } from "jsdom";
import { getUrlWithSource } from "@/lib/get-url-with-source";
import { kv } from "@vercel/kv";
import { z } from "zod";
import { createErrorResponse } from "@/lib/create-error-response";

const ArticleSchema = z.object({
  title: z.string(),
  content: z.string(),
  textContent: z.string(),
  length: z.number(),
  siteName: z.string(),
});

type Article = z.infer<typeof ArticleSchema>;



async function saveOrReturnLongerArticle(
  key: string,
  newArticle: Article
): Promise<Article> {
  try {
    const existingArticleString = await kv.get(key);
    const existingArticle = existingArticleString ? ArticleSchema.parse(existingArticleString) : null;

    if (!existingArticle || newArticle.length > existingArticle.length) {
      await kv.set(key, JSON.stringify(newArticle));
      return newArticle;
    } else {
      return existingArticle;
    }
  } catch (error) {
    console.error(`Error accessing Redis for key '${key}'`, error);
    throw new Error(`Failed to save or return longer article for key '${key}': ${error}`);
  }
}

async function fetchArticle(
  urlWithSource: string,
  source: string
): Promise<Article | null> {
  if (source === "archive") {
    return fetchArchive(urlWithSource);
  } else {
    return fetchNonArchive(urlWithSource, source);
  }
}

async function fetchArchive(urlWithSource: string): Promise<Article | null> {
  const options = {
    method: "GET",
    headers: { accept: "application/json" },
  };

  if (!process.env.DIFFBOT_API_KEY) {
    throw new Error("DIFFBOT_API_KEY is not set");
  }

  const response = await fetch(
    `https://api.diffbot.com/v3/article?url=${encodeURIComponent(
      urlWithSource
    )}&timeout=60000&token=${process.env.DIFFBOT_API_KEY}`,
    options
  );
  const jsonResponse = await response.json();

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  if (!jsonResponse.objects || jsonResponse.objects.length === 0) {
    throw new Error("No objects found in the jsonResponse");
  }
  const firstObject = jsonResponse.objects[0];
  const dom = new JSDOM(firstObject.html);
  const document = dom.window.document;

  const figures = document.querySelectorAll("figure");
  let found = false;
  figures.forEach((figure) => {
    if (
      !found 
      // &&
      // figure.querySelector(
      //   'a[href="https://archive.is/o/qEVRl/https://www.economist.com/1843/"]'
      // )
    ) {
      figure.remove();
      found = true;
    }
  });

  const content = document.body.innerHTML;

  return ArticleSchema.parse({
    title: firstObject.title || "",
    content: content,
    textContent: firstObject.text || "",
    length: content.length,
    siteName: new URL(urlWithSource).hostname,
  });
}

async function fetchNonArchive(
  urlWithSource: string,
  source: string
): Promise<Article | null> {
  const response = await fetchWithTimeout(urlWithSource);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const html = await response.text();
  const doc = new JSDOM(html).window.document;
  const reader = new Readability(doc);
  const articleData = reader.parse();

  if (articleData) {
    return ArticleSchema.parse({
      title: articleData.title,
      content: articleData.content,
      textContent: articleData.textContent,
      length: articleData.textContent.length,
      siteName: new URL(urlWithSource).hostname,
    });
  }

  return null;
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

  if (url.includes("orlandosentinel.com")) {
    return createErrorResponse("Sorry, the Orlando Sentinel is no longer available on smry.ai.", 403);
  }

  const cacheKey = `${source}:${url}`;
  const urlWithSource = getUrlWithSource(source, url);

  try {
    let cachedArticleJson: string | null = null;
    if (source !== "direct") {
      cachedArticleJson = await kv.get(cacheKey);
      if (cachedArticleJson) {
        const article = ArticleSchema.parse(cachedArticleJson);

        if (article.length > 4000) {
          return new Response(
            JSON.stringify({
              source,
              cacheURL: urlWithSource,
              article,
              status: "success",
              contentLength: article.length,
            }),
            {
              headers: { "Content-Type": "application/json" },
              status: 200,
            }
          );
        }
      }
    }

    let article = await fetchArticle(urlWithSource, source);
    if (!article) {
      console.error(`Failed to fetch article for ${url}`);
      return createErrorResponse("Failed to parse article content.", 500);
    }

    const longerArticle = await saveOrReturnLongerArticle(cacheKey, article);

    return new Response(
      JSON.stringify({
        source,
        cacheURL: urlWithSource,
        article: longerArticle,
        status: "success",
        contentLength: longerArticle.length,
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const err = safeError(error);
    console.error(err);
    return createErrorResponse(err.message, err.status || 500, {
      sourceUrl: url,
    });
  }
}