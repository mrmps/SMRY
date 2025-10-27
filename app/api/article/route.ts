import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { fromError } from 'zod-validation-error';
import { kv } from '@vercel/kv';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import showdown from 'showdown';
import { Source } from '@/lib/data';
import { fetchWithTimeout } from '@/lib/fetch-with-timeout';
import { Result, ok, err } from 'neverthrow';
import {
  AppError,
  createNetworkError,
  createParseError,
  createValidationError,
  getErrorMessage,
  getErrorTitle,
} from '@/lib/errors';

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
    case "direct":
    default:
      return url;
  }
};

/**
 * Save or return longer article with Result error handling
 */
async function saveOrReturnLongerArticle(
  key: string,
  newArticle: Article
): Promise<Result<Article, AppError>> {
  try {
    const existingArticleString = await kv.get(key);

    const existingArticle = existingArticleString
      ? ArticleSchema.parse(existingArticleString)
      : null;

    if (!existingArticle || newArticle.length > existingArticle.length) {
      await kv.set(key, JSON.stringify(newArticle));
      return ok(newArticle);
    } else {
      return ok(existingArticle);
    }
  } catch (error) {
    const validationError = fromError(error);
    console.error('Cache validation error:', validationError.toString());
    return err(
      createValidationError('Failed to validate cached article', 'article', error)
    );
  }
}

/**
 * Fetch article with Result error handling
 */
const fetchArticle = async (
  urlWithSource: string,
  source: Source
): Promise<Result<ResponseItem, AppError>> => {
  const responseResult = await fetchWithTimeout(urlWithSource);

  if (responseResult.isErr()) {
    return err(responseResult.error);
  }

  const response = responseResult.value;

  if (!response.ok) {
    return err(
      createNetworkError(
        `HTTP error! status: ${response.status}`,
        urlWithSource,
        response.status
      )
    );
  }

  try {
    const markdownToHtml = (markdown: string) => {
      return converter.makeHtml(markdown);
    };

    if (source === "jina.ai") {
      const markdown = await response.text();
      const lines = markdown.split("\n");

      const title = lines[0].replace("Title: ", "").trim();
      const urlSource = lines[2].replace("URL Source: ", "").trim();
      const mainContent = lines.slice(4).join("\n").trim();

      const contentHtml = markdownToHtml(mainContent);

      return ok({
        source,
        cacheURL: urlWithSource,
        article: {
          title: title,
          content: contentHtml,
          textContent: mainContent,
          length: mainContent.length,
          siteName: new URL(urlSource).hostname,
          byline: "",
          dir: "",
          lang: "",
        },
        status: "success",
      });
    }

    const html = await response.text();
    const doc = new JSDOM(html).window.document;

    const reader = new Readability(doc);
    const articleData = reader.parse();

    if (articleData) {
      return ok({
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
      });
    }

    return err(
      createParseError("Failed to parse article content", source)
    );
  } catch (error) {
    console.error('Article parsing error:', error);
    return err(createParseError("Failed to parse article", source, error));
  }
};

/**
 * API route handler with comprehensive error handling
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const url = searchParams.get('url');
    const source = searchParams.get('source') as Source;

    if (!url || !source) {
      return NextResponse.json(
        {
          error: 'Missing url or source parameter',
          errorType: 'VALIDATION_ERROR',
          message: 'Both url and source parameters are required',
        },
        { status: 400 }
      );
    }

    const urlWithSource = getUrlWithSource(source, url);
    const cacheKey = `${source}:${url}`;

    // Check cache first
    let cachedArticleJson: string | null = null;
    try {
      cachedArticleJson = await kv.get(cacheKey);
    } catch (err) {
      console.warn('Cache read error:', err);
      // Continue without cache
    }

    if (cachedArticleJson) {
      try {
        const article = ArticleSchema.parse(cachedArticleJson);

        if (article.length > 500) {
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
      } catch (err) {
        console.warn('Cache parse error:', err);
        // Continue to fetch fresh data
      }
    }

    // Fetch new content
    const result = await fetchArticle(urlWithSource, source);

    if (result.isErr()) {
      const error = result.error;
      return NextResponse.json(
        {
          source,
          article: undefined,
          status: "error",
          error: getErrorMessage(error),
          errorType: error.type,
          errorTitle: getErrorTitle(error),
          cacheURL: urlWithSource,
          // Include additional error details for debugging
          errorDetails: {
            type: error.type,
            ...(error.type === 'NETWORK_ERROR' && { statusCode: error.statusCode }),
            ...(error.type === 'TIMEOUT_ERROR' && { timeoutMs: error.timeoutMs }),
            ...(error.type === 'RATE_LIMIT_ERROR' && { retryAfter: error.retryAfter }),
          },
        },
        {
          status:
            error.type === 'RATE_LIMIT_ERROR' ? 429 :
            error.type === 'NETWORK_ERROR' && error.statusCode ? error.statusCode :
            error.type === 'VALIDATION_ERROR' ? 400 :
            500
        }
      );
    }

    const article = result.value;

    if (!article.article) {
      return NextResponse.json({
        source,
        article: undefined,
        status: "error",
        error: "Failed to fetch article",
        errorType: "UNKNOWN_ERROR",
        cacheURL: urlWithSource,
      }, { status: 500 });
    }

    // Save to cache
    const saveResult = await saveOrReturnLongerArticle(cacheKey, {
      title: article.article.title || "",
      content: article.article.content || "",
      textContent: article.article.textContent || "",
      length: article.article.length || 0,
      siteName: article.article.siteName || "",
    });

    if (saveResult.isErr()) {
      // Log cache error but still return the article
      console.warn('Failed to cache article:', saveResult.error);
    }

    const longerArticle = saveResult.isOk() ? saveResult.value : {
      title: article.article.title || "",
      content: article.article.content || "",
      textContent: article.article.textContent || "",
      length: article.article.length || 0,
      siteName: article.article.siteName || "",
    };

    return NextResponse.json({
      source,
      cacheURL: urlWithSource,
      article: {
        ...longerArticle,
        byline: article.article.byline || "",
        dir: article.article.dir || "",
        lang: article.article.lang || "",
      },
      status: "success",
    });

  } catch (error) {
    console.error('API Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      {
        error: errorMessage,
        errorType: 'UNKNOWN_ERROR',
        source: request.nextUrl.searchParams.get('source') || 'unknown',
        article: undefined,
        status: "error",
        cacheURL: ""
      },
      { status: 500 }
    );
  }
}

