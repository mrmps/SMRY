/**
 * Tests for LLM article markdown content negotiation.
 *
 * Verifies that article URLs return markdown when Accept: text/markdown is sent,
 * covering both URL patterns:
 * - /proxy?url=https://example.com (explicit proxy)
 * - /https://example.com (URL slug)
 */

import { describe, test, expect } from "bun:test";
import { prefersMarkdown } from "../lib/llm/accept-header";
import {
  getMarkdownRewritePath,
  getArticleMarkdownUrl,
  buildArticleMarkdownRewriteUrl,
  stripLocalePrefix,
} from "../lib/llm/middleware";

// ---------------------------------------------------------------------------
// Accept header parsing
// ---------------------------------------------------------------------------

describe("prefersMarkdown", () => {
  test("returns true for text/markdown", () => {
    expect(prefersMarkdown("text/markdown")).toBe(true);
  });

  test("returns true for text/plain", () => {
    expect(prefersMarkdown("text/plain")).toBe(true);
  });

  test("returns true for text/markdown with higher quality than html", () => {
    expect(prefersMarkdown("text/markdown;q=1.0, text/html;q=0.9")).toBe(true);
  });

  test("returns false for empty string", () => {
    expect(prefersMarkdown("")).toBe(false);
  });

  test("returns false for standard browser Accept", () => {
    expect(
      prefersMarkdown(
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      )
    ).toBe(false);
  });

  test("returns false when html has higher quality", () => {
    expect(prefersMarkdown("text/html;q=1.0, text/markdown;q=0.5")).toBe(false);
  });

  test("tiebreak: earlier type wins when quality is equal", () => {
    expect(prefersMarkdown("text/markdown, text/html")).toBe(true);
    expect(prefersMarkdown("text/html, text/markdown")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Static page markdown routing
// ---------------------------------------------------------------------------

describe("getMarkdownRewritePath", () => {
  test("returns path for eligible static routes with markdown accept", () => {
    expect(getMarkdownRewritePath("/", "text/markdown")).toBe("/");
    expect(getMarkdownRewritePath("/pricing", "text/markdown")).toBe("/pricing");
    expect(getMarkdownRewritePath("/guide", "text/markdown")).toBe("/guide");
  });

  test("returns null for non-eligible routes", () => {
    expect(getMarkdownRewritePath("/proxy", "text/markdown")).toBeNull();
    expect(getMarkdownRewritePath("/history", "text/markdown")).toBeNull();
    expect(getMarkdownRewritePath("/chat", "text/markdown")).toBeNull();
  });

  test("returns null when html is preferred", () => {
    expect(getMarkdownRewritePath("/", "text/html")).toBeNull();
    expect(
      getMarkdownRewritePath(
        "/pricing",
        "text/html,application/xhtml+xml"
      )
    ).toBeNull();
  });

  test("handles locale-prefixed paths", () => {
    expect(getMarkdownRewritePath("/de/pricing", "text/markdown")).toBe(
      "/pricing"
    );
    expect(getMarkdownRewritePath("/pt", "text/markdown")).toBe("/");
  });
});

// ---------------------------------------------------------------------------
// Article markdown routing (the new functionality)
// ---------------------------------------------------------------------------

describe("getArticleMarkdownUrl", () => {
  const MARKDOWN_ACCEPT = "text/markdown";
  const HTML_ACCEPT = "text/html,application/xhtml+xml";

  describe("via /proxy?url=...", () => {
    test("returns article URL when markdown is preferred", () => {
      const result = getArticleMarkdownUrl(
        "/proxy",
        MARKDOWN_ACCEPT,
        "https://www.theatlantic.com/technology/archive/2017/11/the-big-unanswered-questions-about-paywalls/547091",
        null
      );
      expect(result).toBe(
        "https://www.theatlantic.com/technology/archive/2017/11/the-big-unanswered-questions-about-paywalls/547091"
      );
    });

    test("returns null when html is preferred", () => {
      const result = getArticleMarkdownUrl(
        "/proxy",
        HTML_ACCEPT,
        "https://www.theatlantic.com/article",
        null
      );
      expect(result).toBeNull();
    });

    test("returns null when url param is missing", () => {
      const result = getArticleMarkdownUrl(
        "/proxy",
        MARKDOWN_ACCEPT,
        null,
        null
      );
      expect(result).toBeNull();
    });

    test("handles locale-prefixed /proxy path", () => {
      const result = getArticleMarkdownUrl(
        "/de/proxy",
        MARKDOWN_ACCEPT,
        "https://www.nytimes.com/article",
        null
      );
      expect(result).toBe("https://www.nytimes.com/article");
    });
  });

  describe("via URL slug (/<url>)", () => {
    test("returns article URL extracted from proxy redirect", () => {
      const proxyRedirect =
        "https://smry.ai/proxy?url=https%3A%2F%2Fwww.theatlantic.com%2Ftechnology%2Farchive%2F2017%2F11%2Fthe-big-unanswered-questions-about-paywalls%2F547091";
      const result = getArticleMarkdownUrl(
        "/https://www.theatlantic.com/technology/archive/2017/11/the-big-unanswered-questions-about-paywalls/547091",
        MARKDOWN_ACCEPT,
        null,
        proxyRedirect
      );
      expect(result).toBe(
        "https://www.theatlantic.com/technology/archive/2017/11/the-big-unanswered-questions-about-paywalls/547091"
      );
    });

    test("returns null when html is preferred even with proxy redirect", () => {
      const proxyRedirect =
        "https://smry.ai/proxy?url=https%3A%2F%2Fexample.com%2Farticle";
      const result = getArticleMarkdownUrl(
        "/example.com/article",
        HTML_ACCEPT,
        null,
        proxyRedirect
      );
      expect(result).toBeNull();
    });

    test("returns null when proxy redirect is null (app routes)", () => {
      const result = getArticleMarkdownUrl(
        "/pricing",
        MARKDOWN_ACCEPT,
        null,
        null
      );
      expect(result).toBeNull();
    });
  });

  describe("text/plain accept header", () => {
    test("returns article URL for text/plain", () => {
      const result = getArticleMarkdownUrl(
        "/proxy",
        "text/plain",
        "https://example.com/article",
        null
      );
      expect(result).toBe("https://example.com/article");
    });
  });
});

// ---------------------------------------------------------------------------
// URL building
// ---------------------------------------------------------------------------

describe("buildArticleMarkdownRewriteUrl", () => {
  test("builds correct rewrite URL with encoded article URL", () => {
    const result = buildArticleMarkdownRewriteUrl(
      "https://www.theatlantic.com/technology/archive/2017/11/the-big-unanswered-questions-about-paywalls/547091",
      "https://smry.ai"
    );
    expect(result).toBe(
      "https://smry.ai/api/llm/article?url=https%3A%2F%2Fwww.theatlantic.com%2Ftechnology%2Farchive%2F2017%2F11%2Fthe-big-unanswered-questions-about-paywalls%2F547091"
    );
  });

  test("handles URLs with query parameters", () => {
    const result = buildArticleMarkdownRewriteUrl(
      "https://example.com/article?ref=123",
      "https://smry.ai"
    );
    expect(result).toContain("url=");
    expect(result).toContain(encodeURIComponent("https://example.com/article?ref=123"));
  });
});

// ---------------------------------------------------------------------------
// stripLocalePrefix
// ---------------------------------------------------------------------------

describe("stripLocalePrefix", () => {
  test("strips non-default locale prefix", () => {
    expect(stripLocalePrefix("/de/pricing")).toBe("/pricing");
    expect(stripLocalePrefix("/pt/guide")).toBe("/guide");
    expect(stripLocalePrefix("/zh/hard-paywalls")).toBe("/hard-paywalls");
  });

  test("returns / for bare locale paths", () => {
    expect(stripLocalePrefix("/de")).toBe("/");
    expect(stripLocalePrefix("/pt")).toBe("/");
  });

  test("does not strip default locale (en) or non-locale paths", () => {
    expect(stripLocalePrefix("/pricing")).toBe("/pricing");
    expect(stripLocalePrefix("/")).toBe("/");
    expect(stripLocalePrefix("/proxy")).toBe("/proxy");
  });

  test("handles URL slugs (not locale prefixed)", () => {
    expect(
      stripLocalePrefix(
        "/https://www.theatlantic.com/technology/article"
      )
    ).toBe("/https://www.theatlantic.com/technology/article");
  });
});

// ---------------------------------------------------------------------------
// End-to-end middleware flow simulation
// ---------------------------------------------------------------------------

describe("end-to-end: article markdown content negotiation flow", () => {
  /**
   * Simulates what the proxy.ts middleware does for article requests
   * with Accept: text/markdown.
   */
  function simulateMiddlewareFlow(
    pathname: string,
    accept: string,
    urlSearchParam: string | null,
    proxyRedirectUrl: string | null
  ): { type: "static-markdown"; path: string } | { type: "article-markdown"; url: string } | { type: "proxy-redirect" } | { type: "normal" } {
    // Step 1: Check static page markdown
    const markdownPath = getMarkdownRewritePath(pathname, accept);
    if (markdownPath !== null) {
      return { type: "static-markdown", path: markdownPath };
    }

    // Step 2: Check article markdown
    const articleUrl = getArticleMarkdownUrl(
      pathname,
      accept,
      urlSearchParam,
      proxyRedirectUrl
    );
    if (articleUrl !== null) {
      return { type: "article-markdown", url: articleUrl };
    }

    // Step 3: Normal proxy redirect
    if (proxyRedirectUrl) {
      return { type: "proxy-redirect" };
    }

    return { type: "normal" };
  }

  test("curl -H 'Accept: text/markdown' smry.ai/https://theatlantic.com/article → article markdown", () => {
    const result = simulateMiddlewareFlow(
      "/https://www.theatlantic.com/technology/archive/2017/11/the-big-unanswered-questions-about-paywalls/547091",
      "text/markdown",
      null,
      "https://smry.ai/proxy?url=https%3A%2F%2Fwww.theatlantic.com%2Ftechnology%2Farchive%2F2017%2F11%2Fthe-big-unanswered-questions-about-paywalls%2F547091"
    );
    expect(result.type).toBe("article-markdown");
    if (result.type === "article-markdown") {
      expect(result.url).toBe(
        "https://www.theatlantic.com/technology/archive/2017/11/the-big-unanswered-questions-about-paywalls/547091"
      );
    }
  });

  test("curl -H 'Accept: text/markdown' smry.ai/proxy?url=https://theatlantic.com/article → article markdown", () => {
    const result = simulateMiddlewareFlow(
      "/proxy",
      "text/markdown",
      "https://www.theatlantic.com/technology/archive/2017/11/the-big-unanswered-questions-about-paywalls/547091",
      null
    );
    expect(result.type).toBe("article-markdown");
    if (result.type === "article-markdown") {
      expect(result.url).toBe(
        "https://www.theatlantic.com/technology/archive/2017/11/the-big-unanswered-questions-about-paywalls/547091"
      );
    }
  });

  test("browser request to /proxy?url=... → normal (no markdown)", () => {
    const result = simulateMiddlewareFlow(
      "/proxy",
      "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "https://www.theatlantic.com/article",
      null
    );
    expect(result.type).toBe("normal");
  });

  test("browser request to /<url-slug> → proxy redirect (no markdown)", () => {
    const result = simulateMiddlewareFlow(
      "/nytimes.com/article",
      "text/html,application/xhtml+xml",
      null,
      "https://smry.ai/proxy?url=https%3A%2F%2Fnytimes.com%2Farticle"
    );
    expect(result.type).toBe("proxy-redirect");
  });

  test("static page with markdown accept → static markdown (not article)", () => {
    const result = simulateMiddlewareFlow("/pricing", "text/markdown", null, null);
    expect(result.type).toBe("static-markdown");
    if (result.type === "static-markdown") {
      expect(result.path).toBe("/pricing");
    }
  });

  test("text/plain with article URL → article markdown", () => {
    const result = simulateMiddlewareFlow(
      "/proxy",
      "text/plain",
      "https://example.com/some-article",
      null
    );
    expect(result.type).toBe("article-markdown");
  });

  test("text/markdown with quality preference → article markdown", () => {
    const result = simulateMiddlewareFlow(
      "/proxy",
      "text/markdown;q=1.0, text/html;q=0.5",
      "https://example.com/some-article",
      null
    );
    expect(result.type).toBe("article-markdown");
  });

  test("text/html preferred over text/markdown → normal", () => {
    const result = simulateMiddlewareFlow(
      "/proxy",
      "text/html;q=1.0, text/markdown;q=0.5",
      "https://example.com/some-article",
      null
    );
    expect(result.type).toBe("normal");
  });
});
