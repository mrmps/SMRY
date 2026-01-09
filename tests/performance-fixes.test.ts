/**
 * Tests for performance fixes
 *
 * Run with: bun test
 */

import { describe, test, expect } from "bun:test";
import { createHash } from "crypto";

// Test the SHA256 cache key generation pattern used in summary route
describe("SHA256 cache key generation", () => {
  test("generates consistent hashes for same content", () => {
    const content = "This is some article content for testing";
    const hash1 = createHash('sha256').update(content).digest('hex').substring(0, 32);
    const hash2 = createHash('sha256').update(content).digest('hex').substring(0, 32);

    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(32);
  });

  test("generates different hashes for different content", () => {
    const content1 = "Article content version 1";
    const content2 = "Article content version 2";

    const hash1 = createHash('sha256').update(content1).digest('hex').substring(0, 32);
    const hash2 = createHash('sha256').update(content2).digest('hex').substring(0, 32);

    expect(hash1).not.toBe(hash2);
  });

  test("handles unicode content correctly", () => {
    const unicodeContent = "这是中文内容 مرحبا שלום 🎉";
    const hash = createHash('sha256').update(unicodeContent).digest('hex').substring(0, 32);

    expect(hash.length).toBe(32);
    expect(/^[a-f0-9]+$/.test(hash)).toBe(true);
  });

  test("handles very long content", () => {
    const longContent = "a".repeat(100000);
    const hash = createHash('sha256').update(longContent).digest('hex').substring(0, 32);

    expect(hash.length).toBe(32);
  });
});

// Test HTML stripping patterns (matching the regex patterns in lib/db.ts)
describe("HTML stripping regex patterns", () => {
  // These patterns match what's in lib/db.ts
  const STRIP_PATTERNS = {
    tagsWithContent: /<(script|style|svg|noscript|iframe)\b[^>]*>[\s\S]*?<\/\1>/gi,
    imgTags: /<img\b[^>]*\/?>/gi,
    comments: /<!--[\s\S]*?-->/g,
    unwantedAttrs: /\s+(style|data-[\w-]+|on\w+)\s*=\s*["'][^"']*["']/gi,
    whitespace: /\s+/g,
    // Remove null bytes, lone surrogates, and control characters
    // eslint-disable-next-line no-control-regex
    invalidUtf8: /[\x00\uD800-\uDFFF\x01-\x08\x0B\x0C\x0E-\x1F]/g,
  };

  function stripHtml(html: string): string {
    return html
      .replace(STRIP_PATTERNS.invalidUtf8, "") // Remove null bytes, lone surrogates, control chars
      .replace(STRIP_PATTERNS.tagsWithContent, "")
      .replace(STRIP_PATTERNS.imgTags, "")
      .replace(STRIP_PATTERNS.comments, "")
      .replace(STRIP_PATTERNS.unwantedAttrs, "")
      .replace(STRIP_PATTERNS.whitespace, " ")
      .trim();
  }

  test("removes script tags with content", () => {
    const html = '<div>Hello</div><script>alert("xss")</script><p>World</p>';
    const result = stripHtml(html);

    expect(result).not.toContain("script");
    expect(result).not.toContain("alert");
    expect(result).toContain("Hello");
    expect(result).toContain("World");
  });

  test("removes style tags with content", () => {
    const html = '<style>.foo { color: red; }</style><div>Content</div>';
    const result = stripHtml(html);

    expect(result).not.toContain("style");
    expect(result).not.toContain("color");
    expect(result).toContain("Content");
  });

  test("removes svg tags with content", () => {
    const html = '<div>Before</div><svg><path d="M0 0"/></svg><div>After</div>';
    const result = stripHtml(html);

    expect(result).not.toContain("svg");
    expect(result).not.toContain("path");
    expect(result).toContain("Before");
    expect(result).toContain("After");
  });

  test("removes noscript and iframe tags", () => {
    const html = '<noscript>Enable JS</noscript><iframe src="x"></iframe><p>Text</p>';
    const result = stripHtml(html);

    expect(result).not.toContain("noscript");
    expect(result).not.toContain("iframe");
    expect(result).toContain("Text");
  });

  test("removes img tags", () => {
    const html = '<p>Before <img src="test.jpg" alt="test"/> After</p>';
    const result = stripHtml(html);

    expect(result).not.toContain("img");
    expect(result).toContain("Before");
    expect(result).toContain("After");
  });

  test("removes HTML comments", () => {
    const html = '<div>Visible</div><!-- This is a comment --><p>Also visible</p>';
    const result = stripHtml(html);

    expect(result).not.toContain("<!--");
    expect(result).not.toContain("comment");
    expect(result).toContain("Visible");
    expect(result).toContain("Also visible");
  });

  test("removes style, data-*, and event handler attributes", () => {
    const html = '<div style="color: red" data-id="123" onclick="bad()">Content</div>';
    const result = stripHtml(html);

    expect(result).not.toContain('style=');
    expect(result).not.toContain('data-id');
    expect(result).not.toContain('onclick');
    expect(result).toContain("Content");
  });

  test("collapses multiple whitespace", () => {
    const html = '<p>Hello    \n\n   World</p>';
    const result = stripHtml(html);

    expect(result).not.toContain("    ");
    expect(result).not.toContain("\n");
  });

  test("removes null bytes (0x00)", () => {
    const html = '<p>Hello\x00World</p>';
    const result = stripHtml(html);

    expect(result).not.toContain('\x00');
    expect(result).toContain("Hello");
    expect(result).toContain("World");
  });

  test("removes lone surrogate characters", () => {
    // Lone surrogates are invalid in UTF-8 (U+D800-U+DFFF when not paired)
    const html = '<p>Hello\uD800World\uDFFFEnd</p>';
    const result = stripHtml(html);

    expect(result).not.toMatch(/[\uD800-\uDFFF]/);
    expect(result).toContain("Hello");
    expect(result).toContain("World");
    expect(result).toContain("End");
  });

  test("removes control characters except newline, tab, carriage return", () => {
    // Control chars 0x01-0x08, 0x0B, 0x0C, 0x0E-0x1F should be removed
    // But \n (0x0A), \t (0x09), \r (0x0D) should be preserved (then collapsed to space)
    const html = '<p>A\x01B\x02C\tD\nE</p>';
    const result = stripHtml(html);

    expect(result).not.toContain('\x01');
    expect(result).not.toContain('\x02');
    expect(result).toContain("A");
    expect(result).toContain("B");
    expect(result).toContain("C");
    expect(result).toContain("D");
    expect(result).toContain("E");
  });

  test("handles complex real-world HTML", () => {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>.foo { color: red; }</style>
        <script>console.log('test');</script>
      </head>
      <body>
        <div style="margin: 10px" data-tracking="abc" onclick="track()">
          <p>Article content here</p>
          <img src="photo.jpg" />
          <!-- Comment to remove -->
          <svg><circle cx="50" cy="50" r="40"/></svg>
          <iframe src="ad.html"></iframe>
          <noscript>Enable JavaScript</noscript>
        </div>
      </body>
      </html>
    `;
    const result = stripHtml(html);

    expect(result).toContain("Article content here");
    expect(result).not.toContain("script");
    expect(result).not.toContain("style=");
    expect(result).not.toContain("onclick");
    expect(result).not.toContain("data-tracking");
    expect(result).not.toContain("svg");
    expect(result).not.toContain("iframe");
    expect(result).not.toContain("noscript");
    expect(result).not.toContain("<!--");
  });

  test("performance: handles large HTML efficiently", () => {
    // Generate ~500KB of HTML
    const largeHtml = `
      <html>
      <head><style>body { margin: 0; }</style></head>
      <body>
      ${Array(5000).fill('<p style="color: red" data-id="x" onclick="bad()">Paragraph content here with some text.</p>').join('\n')}
      </body>
      </html>
    `;

    const start = performance.now();
    const result = stripHtml(largeHtml);
    const elapsed = performance.now() - start;

    // Should complete in under 100ms even for large content
    expect(elapsed).toBeLessThan(100);
    expect(result).toContain("Paragraph content");
    expect(result).not.toContain('style=');

    console.log(`Large HTML strip time: ${elapsed.toFixed(2)}ms`);
  });
});

// Test HTML content truncation (matching the pattern in article/route.ts)
describe("HTML content truncation", () => {
  const MAX_HTML_CONTENT_SIZE = 50 * 1024; // 50KB

  interface CachedArticle {
    title: string;
    content: string;
    textContent: string;
    length: number;
    siteName: string;
    htmlContent?: string;
  }

  function truncateHtmlContent(article: CachedArticle): CachedArticle {
    if (article.htmlContent && article.htmlContent.length > MAX_HTML_CONTENT_SIZE) {
      return {
        ...article,
        htmlContent: article.htmlContent.substring(0, MAX_HTML_CONTENT_SIZE),
      };
    }
    return article;
  }

  test("does not truncate small HTML content", () => {
    const article: CachedArticle = {
      title: "Test",
      content: "<p>Content</p>",
      textContent: "Content",
      length: 7,
      siteName: "test.com",
      htmlContent: "<html><body>Small content</body></html>",
    };

    const result = truncateHtmlContent(article);
    expect(result.htmlContent).toBe(article.htmlContent);
  });

  test("truncates large HTML content to 50KB", () => {
    const largeHtml = "x".repeat(100 * 1024); // 100KB
    const article: CachedArticle = {
      title: "Test",
      content: "<p>Content</p>",
      textContent: "Content",
      length: 7,
      siteName: "test.com",
      htmlContent: largeHtml,
    };

    const result = truncateHtmlContent(article);
    expect(result.htmlContent?.length).toBe(MAX_HTML_CONTENT_SIZE);
  });

  test("handles articles without htmlContent", () => {
    const article: CachedArticle = {
      title: "Test",
      content: "<p>Content</p>",
      textContent: "Content",
      length: 7,
      siteName: "test.com",
    };

    const result = truncateHtmlContent(article);
    expect(result.htmlContent).toBeUndefined();
  });

  test("preserves other article properties when truncating", () => {
    const largeHtml = "x".repeat(100 * 1024);
    const article: CachedArticle = {
      title: "My Title",
      content: "<p>My Content</p>",
      textContent: "My Content",
      length: 10,
      siteName: "example.com",
      htmlContent: largeHtml,
    };

    const result = truncateHtmlContent(article);
    expect(result.title).toBe("My Title");
    expect(result.content).toBe("<p>My Content</p>");
    expect(result.textContent).toBe("My Content");
    expect(result.length).toBe(10);
    expect(result.siteName).toBe("example.com");
  });
});

// Test that parallel operations complete faster
describe("Parallel operation patterns", () => {
  // Simulate async operations with delays
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  test("parallel Promise.all is faster than sequential awaits", async () => {
    const ops = [
      () => delay(50).then(() => "a"),
      () => delay(50).then(() => "b"),
      () => delay(50).then(() => "c"),
    ];

    // Sequential
    const seqStart = performance.now();
    const seqResults = [];
    for (const op of ops) {
      seqResults.push(await op());
    }
    const seqTime = performance.now() - seqStart;

    // Parallel
    const parStart = performance.now();
    const parResults = await Promise.all(ops.map(op => op()));
    const parTime = performance.now() - parStart;

    expect(seqResults).toEqual(["a", "b", "c"]);
    expect(parResults).toEqual(["a", "b", "c"]);

    // Parallel should be significantly faster (at least 2x)
    expect(parTime).toBeLessThan(seqTime * 0.7);

    console.log(`Sequential: ${seqTime.toFixed(0)}ms, Parallel: ${parTime.toFixed(0)}ms`);
  });
});
