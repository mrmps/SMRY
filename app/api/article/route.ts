import { NextRequest, NextResponse } from "next/server";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import { getUrlWithSource } from "@/lib/get-url-with-source";
import { kv } from "@vercel/kv";
import showdown from "showdown";
import { Ratelimit } from "@upstash/ratelimit";

const converter = new showdown.Converter();

type Source = "direct" | "wayback" | "archive" | "jina.ai";

const ArticleSchema = {
  title: "",
  content: "",
  textContent: "",
  length: 0,
  siteName: "",
};

type Article = typeof ArticleSchema;

type ResponseItem = {
  source: string;
  article?: {
    title: string;
    content: string;
    textContent: string;
    length: number;
    siteName: string;
    byline: string | null;
    dir: string | null;
    lang: string | null;
  };
  status?: string;
  error?: string;
  cacheURL: string;
};

// Fetch article using the given URL and source
const fetchArticle = async (
  urlWithSource: string,
  source: Source
): Promise<ResponseItem | null> => {
  try {
    const response = await fetchWithTimeout(urlWithSource);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const markdownToHtml = (markdown: string) => {
      return converter.makeHtml(markdown);
    };

    if (source === "jina.ai") {
      const markdown = await response.text();
      const lines = markdown.split("\n");

      // Extract title, URL source, and main content based on consistent line positions
      const title = lines[0].replace("Title: ", "").trim();
      const urlSource = lines[2].replace("URL Source: ", "").trim();
      const mainContent = lines.slice(4).join("\n").trim(); // Everything after the 4th line

      // Convert markdown to HTML
      const contentHtml = markdownToHtml(mainContent);

      return {
        source,
        cacheURL: urlWithSource,
        article: {
          title: title,
          content: contentHtml,
          textContent: mainContent,
          length: mainContent.length,
          siteName: new URL(urlSource).hostname,
          byline: "", // Placeholder, as byline is unlikely to be extracted from markdown
          dir: "", // Directionality, keep as empty if not applicable
          lang: "", // Language, keep as empty if not known
        },
      };
    }

    const html = await response.text();
    const doc = new JSDOM(html).window.document;

    // Prepend archive.is to all image URLs if source is 'archive'
    if (source === "archive") {
      const images = doc.querySelectorAll("img");
      images.forEach((img: HTMLImageElement) => {
        let src = img.getAttribute("src");
        if (src && !src.startsWith("http")) {
          src = `http://archive.is${src}`;
          img.setAttribute("src", src);
        }
      });
    }

    const reader = new Readability(doc);
    const articleData = reader.parse();

    if (articleData) {
      return {
        source,
        cacheURL: urlWithSource,
        article: {
          title: articleData.title,
          content: articleData.content,
          textContent: articleData.textContent,
          length: articleData.textContent.length,
          siteName: new URL(urlWithSource).hostname,
          byline: articleData.byline,
          dir: articleData.dir,
          lang: articleData.lang,
        },
      };
    }
  } catch (err) {
    console.error(err);
    return null;
  }

  return null;
};

// Helper function to save or return the longer article
const saveOrReturnLongerArticle = async (
  cacheKey: string,
  article: Article
): Promise<Article> => {
  try {
    const cachedArticleJson = await kv.get(cacheKey);
    if (cachedArticleJson) {
      const cachedArticle = cachedArticleJson as unknown as Article;
      // Return the longer article
      if (cachedArticle.length > article.length) {
        return cachedArticle;
      }
    }
    
    // Save the new article to cache
    await kv.set(cacheKey, article);
    return article;
  } catch (err) {
    console.error(err);
    return article;
  }
};

// API route handler
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  const sourceParam = request.nextUrl.searchParams.get("source") || "direct";
  const source = sourceParam as Source;

  if (!url) {
    return NextResponse.json(
      { error: "URL parameter is required" },
      { status: 400 }
    );
  }

  try {
    // Rate limiting: 35 requests per minute
    const ratelimit = new Ratelimit({
      redis: kv,
      limiter: Ratelimit.slidingWindow(35, "1 m"),
    });

    // Use IP or a default identifier for rate limiting
    const identifier = request.ip || "anonymous";
    const { success, limit, reset, remaining } = await ratelimit.limit(`ratelimit_article_${identifier}`);

    if (!success) {
      return NextResponse.json(
        { 
          error: "Rate limit exceeded. Please try again later.",
          limit,
          remaining,
          reset
        },
        { 
          status: 429,
          headers: {
            "X-RateLimit-Limit": limit.toString(),
            "X-RateLimit-Remaining": remaining.toString(),
            "X-RateLimit-Reset": reset.toString()
          }
        }
      );
    }

    const urlWithSource = getUrlWithSource(source, url);
    const cacheKey = `${source}:${url}`;

    // Check cache first
    let cachedArticleJson = await kv.get(cacheKey);
    if (cachedArticleJson) {
      const article = cachedArticleJson as unknown as Article;

      if (article.length > 4000) {
        // If the cached article is substantial, return it immediately
        return NextResponse.json({
          source,
          cacheURL: urlWithSource,
          article: {
            ...article,
            byline: "", 
            dir: "", 
            lang: "", 
          },
          status: "success",
        });
      }
    }

    // Fetch fresh article data
    const article = await fetchArticle(urlWithSource, source);

    if (!article || !article.article) {
      return NextResponse.json(
        {
          source,
          article: undefined,
          status: "404",
          error: "Article data is not available.",
          cacheURL: urlWithSource
        },
        { status: 404 }
      );
    }

    // Save to cache and return longer version
    const longerArticle = await saveOrReturnLongerArticle(cacheKey, {
      title: article.article.title || "",
      content: article.article.content || "",
      textContent: article.article.textContent || "",
      length: article.article.length || 0,
      siteName: article.article.siteName || "",
    });

    return NextResponse.json({
      source,
      cacheURL: urlWithSource,
      article: {
        ...longerArticle,
        byline: "", 
        dir: "", 
        lang: "", 
      },
      status: "success",
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to fetch article" },
      { status: 500 }
    );
  }
} 