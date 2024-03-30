import { Readability } from "@mozilla/readability";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { safeError } from "@/lib/safe-error";
import { JSDOM } from "jsdom";
import { getUrlWithSource } from "@/lib/get-url-with-source";
import { kv } from "@vercel/kv";
import { z } from 'zod';

const ArticleSchema = z.object({
  title: z.string(),
  content: z.string(),
  textContent: z.string(),
  length: z.number(),
  siteName: z.string(),
});

type Article = z.infer<typeof ArticleSchema>;

function createErrorResponse(message: string, status: number, details = {}) {
  return new Response(JSON.stringify({ message, details }), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

async function saveToRedisIfLonger(key: string, newArticle: Article): Promise<void> {
  try {
      const existingArticle = await kv.get(key) as string | undefined;

      const existingArticleJson = existingArticle ? ArticleSchema.parse(existingArticle) : null;

      // log both lengths
      console.log(`Existing content length: ${existingArticleJson?.length || 0}`);
      console.log(`New content length: ${newArticle.length}`);  

      if (!existingArticleJson || newArticle.length > existingArticleJson?.length) {
          await kv.set(key, newArticle); // Storing the new article as a stringified JSON under the field
      } else {
          console.log(`Existing content for key '${key}' is longer or equal; no update needed.`);
      }
  } catch (error) {
      console.error(`Error accessing Redis for key '${key}'`, error);
  }
}



async function fetchArticle(urlWithSource: string, source: string): Promise<Article | null> {
  if (source === "archive") {
    // Fetch and process archive source
    return fetchArchive(urlWithSource);
  } else {
    // Process other sources
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
      `https://api.diffbot.com/v3/article?url=${encodeURIComponent(urlWithSource)}&timeout=60000&token=${process.env.DIFFBOT_API_KEY}`,
      options
  );
  const jsonResponse = await response.json();

  if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
  }

  const firstObject = jsonResponse.objects[0];
  const dom = new JSDOM(firstObject.html);
  const document = dom.window.document;

  // Select the figure element containing the specific a element and remove it
  const figures = document.querySelectorAll('figure');
  let found = false;  // Flag to check if the matching figure is found and removed
  figures.forEach(figure => {
      if (!found && figure.querySelector('a[href="https://archive.is/o/qEVRl/https://www.economist.com/1843/"]')) {
          figure.remove();
          found = true;  // Set the flag to true after removing the matching figure
      }
  });
  

  const content = document.body.innerHTML; // Get the modified HTML content

  return ArticleSchema.parse({
      title: firstObject.title || '',
      content: content, // Use the modified content
      textContent: firstObject.text || '',
      length: content.length, // Update the length based on the modified content
      siteName: new URL(urlWithSource).hostname,
  });
}

async function fetchNonArchive(urlWithSource: string, source: string): Promise<Article | null> {
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

  const urlWithSource = getUrlWithSource(source, url);

  try {
    if (source === 'direct') {
      const cachedArticleJson = await kv.get(url); // Assuming this returns a JSON string
      console.log("Found article in cache:", cachedArticleJson);

      if (cachedArticleJson) {
        const article = ArticleSchema.parse(cachedArticleJson);

        const responseObj = {
          source, 
          cacheUrl: url,
          article: article,
          status: "success",
          contentLength: article.content.length || 0,
        };

        return new Response(JSON.stringify(responseObj), {
          headers: { "Content-Type": "application/json" },
          status: 200,
        });
      }
    }

    const article = await fetchArticle(urlWithSource, source);
    if (!article) {
      return createErrorResponse("Failed to parse article content.", 500);
    }

    const parsedArticle = ArticleSchema.parse(article);

    await saveToRedisIfLonger(url, parsedArticle);

    return new Response(
      JSON.stringify({
        source,
        cacheURL: urlWithSource,
        article: parsedArticle,
        status: "success",
        contentLength: article.length,
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const err = safeError(error);
    return createErrorResponse(err.message, err.status || 500, { sourceUrl: url });
  }
}