import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { fromError } from 'zod-validation-error';
import { kv } from '@vercel/kv';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import showdown from 'showdown';
import { Source } from '@/lib/data';

const converter = new showdown.Converter();

const ArticleSchema = z.object({
  title: z.string(),
  content: z.string(),
  textContent: z.string(),
  length: z.number().int().positive(),
  siteName: z.string(),
});

type Article = z.infer<typeof ArticleSchema>;

export interface ResponseItem {
  source: Source;
  article?: {
    title: string;
    content: string;
    textContent: string;
    length: number;
    siteName: string;
    byline: string;
    dir: string;
    lang: string;
  };
  status?: string;
  error?: string;
  cacheURL: string;
}

const getUrlWithSource = (source: Source, url: string): string => {
  switch (source) {
    case "jina.ai":
      return `https://r.jina.ai/${url}`;
    case "wayback":
      return `https://web.archive.org/web/2/${encodeURIComponent(url)}`;
    case "archive":
      return `http://archive.is/latest/${encodeURIComponent(url)}`;
    case "direct":
    default:
      return url;
  }
};

const fetchWithTimeout = async (url: string, timeout = 30000): Promise<Response> => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
};

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
        status: "success",
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
          byline: articleData.byline || "",
          dir: articleData.dir || "",
          lang: articleData.lang || "",
        },
        status: "success",
      };
    }
  } catch (err) {
    console.error(err);
    return null;
  }

  return null;
};

async function saveOrReturnLongerArticle(
  key: string,
  newArticle: Article
): Promise<Article> {
  try {
    const existingArticleString = await kv.get(key);

    const existingArticle = existingArticleString
      ? ArticleSchema.parse(existingArticleString)
      : null;

    if (!existingArticle || newArticle.length > existingArticle.length) {
      await kv.set(key, JSON.stringify(newArticle));
      return newArticle;
    } else {
      return existingArticle;
    }
  } catch (err) {
    const validationError = fromError(err);
    console.log(validationError.toString());
    throw validationError;
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const url = searchParams.get('url');
    const source = searchParams.get('source') as Source;

    if (!url || !source) {
      return NextResponse.json(
        { error: 'Missing url or source parameter' },
        { status: 400 }
      );
    }

    const urlWithSource = getUrlWithSource(source, url);
    const cacheKey = `${source}:${url}`;

    // Check cache first
    let cachedArticleJson: string | null = null;
    cachedArticleJson = await kv.get(cacheKey);

    if (cachedArticleJson) {
      const article = ArticleSchema.parse(cachedArticleJson);

      if (article.length > 500) { // Lower threshold for cached content
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

    // Fetch new content
    const result = await fetchArticle(urlWithSource, source);
    
    if (!result || !result.article) {
      return NextResponse.json({
        source,
        article: undefined,
        status: "error",
        error: "Failed to fetch article",
        cacheURL: urlWithSource,
      });
    }

    // Save to cache
    const longerArticle = await saveOrReturnLongerArticle(cacheKey, {
      title: result.article.title || "",
      content: result.article.content || "",
      textContent: result.article.textContent || "",
      length: result.article.length || 0,
      siteName: result.article.siteName || "",
    });

    return NextResponse.json({
      source,
      cacheURL: urlWithSource,
      article: {
        ...longerArticle,
        byline: result.article.byline || "",
        dir: result.article.dir || "",
        lang: result.article.lang || "",
      },
      status: "success",
    });

  } catch (error) {
    console.error('API Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json(
      { 
        error: errorMessage,
        source: request.nextUrl.searchParams.get('source') || 'unknown',
        article: undefined,
        status: "error",
        cacheURL: ""
      },
      { status: 500 }
    );
  }
} 