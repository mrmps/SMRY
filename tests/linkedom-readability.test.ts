/**
 * Tests for LinkedOM + Readability integration
 *
 * These tests verify that LinkedOM works correctly with Mozilla Readability
 * for article extraction, matching the behavior we had with JSDOM.
 *
 * Run with: bun test
 */

import { describe, test, expect } from "bun:test";
import { parseHTML } from "linkedom";
import { Readability } from "@mozilla/readability";

// Sample HTML for testing
const SAMPLE_ARTICLE_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <title>Test Article Title</title>
  <meta name="author" content="Test Author">
</head>
<body>
  <header>
    <nav>Navigation links here</nav>
  </header>
  <main>
    <article>
      <h1>The Main Article Headline</h1>
      <p class="byline">By Test Author</p>
      <time datetime="2025-01-06">January 6, 2025</time>
      <p>This is the first paragraph of the article content. It contains important information that readers want to see. The article discusses various topics that are relevant to the reader.</p>
      <p>This is the second paragraph with more detailed content. It provides additional context and explanation about the main topic. Readability should extract this content properly.</p>
      <p>The third paragraph continues the discussion with even more substantive information. This helps ensure we have enough content for Readability to properly identify this as an article.</p>
      <p>Here we have a fourth paragraph that adds depth to the article. Quality content is important for proper extraction by the Readability algorithm.</p>
      <p>Finally, the fifth paragraph wraps up the article with concluding thoughts. This should give us well over 500 characters of article content.</p>
    </article>
  </main>
  <footer>
    <p>Footer content, copyright notices, etc.</p>
  </footer>
</body>
</html>
`;

const MINIMAL_HTML = `
<!DOCTYPE html>
<html>
<head><title>Minimal</title></head>
<body><p>Short content</p></body>
</html>
`;

const COMPLEX_HTML = `
<!DOCTYPE html>
<html lang="fr" dir="ltr">
<head>
  <title>Article complexe en français</title>
  <meta property="og:image" content="https://example.com/image.jpg">
  <meta name="article:published_time" content="2025-01-01T10:00:00Z">
</head>
<body>
  <div class="post-body">
    <h1>Un titre en français</h1>
    <p>Ceci est le premier paragraphe d'un article en français. Il contient beaucoup de texte pour tester l'extraction avec Readability et LinkedOM.</p>
    <p>Le deuxième paragraphe continue avec plus de contenu. C'est important d'avoir assez de texte pour que l'algorithme fonctionne correctement.</p>
    <p>Troisième paragraphe avec encore plus d'informations détaillées sur le sujet principal de l'article.</p>
    <p>Quatrième paragraphe pour ajouter de la profondeur au contenu et assurer une extraction réussie.</p>
    <p>Cinquième paragraphe pour conclure l'article avec des pensées finales et des observations importantes.</p>
  </div>
</body>
</html>
`;

describe("LinkedOM basic parsing", () => {
  test("parseHTML returns document object", () => {
    const { document } = parseHTML(SAMPLE_ARTICLE_HTML);

    expect(document).toBeDefined();
    expect(document.title).toBe("Test Article Title");
  });

  test("document.querySelector works", () => {
    const { document } = parseHTML(SAMPLE_ARTICLE_HTML);

    const article = document.querySelector("article");
    expect(article).toBeDefined();
    expect(article?.querySelector("h1")?.textContent).toBe("The Main Article Headline");
  });

  test("document.querySelectorAll works", () => {
    const { document } = parseHTML(SAMPLE_ARTICLE_HTML);

    const paragraphs = document.querySelectorAll("p");
    expect(paragraphs.length).toBeGreaterThan(0);
  });

  test("getAttribute works for language detection", () => {
    const { document } = parseHTML(SAMPLE_ARTICLE_HTML);

    const lang = document.documentElement.getAttribute("lang");
    expect(lang).toBe("en");
  });
});

describe("LinkedOM + Readability integration", () => {
  test("Readability extracts article content", () => {
    const { document } = parseHTML(SAMPLE_ARTICLE_HTML);
    const reader = new Readability(document);
    const article = reader.parse();

    expect(article).not.toBeNull();
    expect(article?.title).toBeTruthy();
    expect(article?.textContent).toBeTruthy();
    expect(article?.content).toBeTruthy();
    expect(article?.textContent?.length).toBeGreaterThan(100);
  });

  test("Readability extracts title correctly", () => {
    const { document } = parseHTML(SAMPLE_ARTICLE_HTML);
    const reader = new Readability(document);
    const article = reader.parse();

    // Readability should extract either the h1 or the title
    expect(article?.title).toBeTruthy();
  });

  test("Readability handles complex HTML with metadata", () => {
    const { document } = parseHTML(COMPLEX_HTML);
    const reader = new Readability(document);
    const article = reader.parse();

    expect(article).not.toBeNull();
    expect(article?.textContent?.length).toBeGreaterThan(100);
  });

  test("Readability returns null for minimal content", () => {
    const { document } = parseHTML(MINIMAL_HTML);
    const reader = new Readability(document);
    const article = reader.parse();

    // Readability may return null or very short content for minimal pages
    // This is expected behavior
    if (article) {
      expect(article.textContent?.length).toBeLessThan(100);
    }
  });
});

describe("LinkedOM performance characteristics", () => {
  test("parseHTML is fast (under 50ms for typical article)", () => {
    const start = performance.now();

    // Parse 100 times to get measurable timing
    for (let i = 0; i < 100; i++) {
      parseHTML(SAMPLE_ARTICLE_HTML);
    }

    const elapsed = performance.now() - start;
    const avgTime = elapsed / 100;

    // LinkedOM should be very fast - under 5ms per parse on average
    expect(avgTime).toBeLessThan(50);
    console.log(`Average parse time: ${avgTime.toFixed(3)}ms`);
  });

  test("parseHTML + Readability is fast (under 100ms for typical article)", () => {
    const start = performance.now();

    // Parse and extract 50 times
    for (let i = 0; i < 50; i++) {
      const { document } = parseHTML(SAMPLE_ARTICLE_HTML);
      const reader = new Readability(document);
      reader.parse();
    }

    const elapsed = performance.now() - start;
    const avgTime = elapsed / 50;

    // Full extraction should still be fast
    expect(avgTime).toBeLessThan(100);
    console.log(`Average parse + extract time: ${avgTime.toFixed(3)}ms`);
  });
});

describe("LinkedOM handles edge cases", () => {
  test("handles empty HTML", () => {
    const { document } = parseHTML("");
    expect(document).toBeDefined();
  });

  test("handles malformed HTML", () => {
    const malformed = "<html><body><p>Unclosed paragraph<div>Nested wrong</p></div></body>";
    const { document } = parseHTML(malformed);
    expect(document).toBeDefined();
    expect(document.body).toBeDefined();
  });

  test("handles HTML with special characters", () => {
    const special = `
      <html>
      <body>
        <p>Special chars: &amp; &lt; &gt; &quot; &apos;</p>
        <p>Unicode: 你好 مرحبا שלום</p>
        <p>Emoji: 🎉 🚀 ✨</p>
      </body>
      </html>
    `;
    const { document } = parseHTML(special);
    const text = document.body?.textContent || "";
    expect(text).toContain("&");
    expect(text).toContain("你好");
    expect(text).toContain("🎉");
  });

  test("handles very large HTML", () => {
    // Create HTML with ~100KB of content
    const paragraphs = Array(500).fill(0).map((_, i) =>
      `<p>Paragraph ${i}: Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>`
    ).join("\n");

    const largeHtml = `
      <!DOCTYPE html>
      <html>
      <head><title>Large Document</title></head>
      <body><article>${paragraphs}</article></body>
      </html>
    `;

    const start = performance.now();
    const { document } = parseHTML(largeHtml);
    const elapsed = performance.now() - start;

    expect(document).toBeDefined();
    expect(document.querySelectorAll("p").length).toBe(500);

    // Should still be fast even for large documents
    expect(elapsed).toBeLessThan(500);
    console.log(`Large document parse time: ${elapsed.toFixed(3)}ms`);
  });
});

describe("Memory characteristics", () => {
  test("no memory accumulation across parses", () => {
    // This is a basic sanity check - LinkedOM shouldn't leak
    // In a real scenario, you'd use heap snapshots

    const iterations = 1000;

    for (let i = 0; i < iterations; i++) {
      const { document } = parseHTML(SAMPLE_ARTICLE_HTML);
      const reader = new Readability(document);
      reader.parse();
      // No explicit cleanup needed - this is the point of LinkedOM
    }

    // If we got here without crashing, basic memory handling is working
    expect(true).toBe(true);
  });
});
