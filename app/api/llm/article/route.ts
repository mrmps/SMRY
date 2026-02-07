import { NextRequest, NextResponse } from "next/server";

const BASE_URL = "https://smry.ai";

/**
 * Elysia backend URL. Uses the same env var as next.config.mjs rewrites
 * so this route can call the backend directly without looping through Next.js.
 */
const INTERNAL_API_URL = (
  process.env.INTERNAL_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:3001"
).replace(/\/+$/, "");

export async function GET(request: NextRequest) {
  // The article URL comes from searchParams when called directly, or from the
  // x-llm-article-url header when the middleware rewrites a URL slug request
  // (rewrite targets' searchParams aren't visible to route handlers).
  const articleUrl =
    request.nextUrl.searchParams.get("url") ||
    request.headers.get("x-llm-article-url");

  if (!articleUrl) {
    return new NextResponse("Missing url parameter", { status: 400 });
  }

  try {
    const apiUrl = `${INTERNAL_API_URL}/api/article/auto?url=${encodeURIComponent(articleUrl)}`;
    const response = await fetch(apiUrl);

    if (!response.ok) {
      let errorMessage = response.statusText;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch {
        // Use statusText
      }
      return new NextResponse(`Error: ${errorMessage}`, { status: response.status });
    }

    const data = await response.json();

    if (data.status !== "success" || !data.article) {
      return new NextResponse("Article not found", { status: 404 });
    }

    const markdown = buildArticleMarkdown(data.article, articleUrl);

    const accept = request.headers.get("accept") || "";
    const contentType = accept.includes("text/markdown")
      ? "text/markdown; charset=utf-8"
      : "text/plain; charset=utf-8";

    return new NextResponse(markdown, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, s-maxage=3600, max-age=300",
        "X-Llms-Txt": `${BASE_URL}/llms.txt`,
        Link: `<${BASE_URL}/llms.txt>; rel="llms-txt"`,
        "X-Robots-Tag": "noindex, nofollow",
        Vary: "Accept",
      },
    });
  } catch {
    return new NextResponse("Failed to fetch article", { status: 502 });
  }
}

interface Article {
  title?: string;
  byline?: string | null;
  publishedTime?: string | null;
  siteName?: string;
  textContent?: string;
}

function buildArticleMarkdown(article: Article, url: string): string {
  const parts: string[] = [];

  if (article.title) {
    parts.push(`# ${article.title}\n`);
  }

  const meta: string[] = [];
  if (article.byline) meta.push(`**By:** ${article.byline}`);
  if (article.publishedTime) meta.push(`**Published:** ${article.publishedTime}`);
  if (article.siteName) meta.push(`**Source:** [${article.siteName}](${url})`);
  else meta.push(`**Source:** ${url}`);

  if (meta.length > 0) {
    parts.push(meta.join("  \n") + "\n");
  }

  parts.push("---\n");

  if (article.textContent) {
    parts.push(article.textContent);
  }

  return parts.join("\n");
}
