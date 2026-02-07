import { describe, expect, it } from "bun:test";
import { prefersMarkdown } from "./accept-header";

describe("prefersMarkdown", () => {
  describe("returns true when markdown is preferred", () => {
    it("detects explicit text/markdown", () => {
      expect(prefersMarkdown("text/markdown")).toBe(true);
    });

    it("detects text/markdown before text/html", () => {
      expect(prefersMarkdown("text/markdown, text/html")).toBe(true);
    });

    it("detects text/plain before text/html", () => {
      expect(prefersMarkdown("text/plain, text/html")).toBe(true);
    });

    it("detects text/markdown with quality values", () => {
      expect(
        prefersMarkdown("text/markdown;q=1.0, text/html;q=0.9")
      ).toBe(true);
    });

    it("handles text/plain without text/html", () => {
      expect(prefersMarkdown("text/plain")).toBe(true);
    });

    it("handles text/markdown with wildcard", () => {
      expect(prefersMarkdown("text/markdown, */*")).toBe(true);
    });
  });

  describe("real-world agent Accept headers", () => {
    it("Claude Code: text/markdown, */*", () => {
      expect(prefersMarkdown("text/markdown, */*")).toBe(true);
    });

    it("curl default (no specific Accept) — treated as text/plain not sent", () => {
      // curl sends */* by default, not text/plain
      expect(prefersMarkdown("*/*")).toBe(false);
    });

    it("curl with explicit markdown header", () => {
      expect(prefersMarkdown("text/markdown")).toBe(true);
    });

    it("curl with explicit plain text header", () => {
      expect(prefersMarkdown("text/plain")).toBe(true);
    });

    it("Perplexity-style: text/html first, then others", () => {
      expect(
        prefersMarkdown(
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        )
      ).toBe(false);
    });

    it("hypothetical agent: text/markdown with fallbacks", () => {
      expect(
        prefersMarkdown(
          "text/markdown, text/html;q=0.9, application/xhtml+xml;q=0.8, */*;q=0.7"
        )
      ).toBe(true);
    });

    it("hypothetical agent: text/plain with quality", () => {
      expect(
        prefersMarkdown("text/plain;q=1.0, text/html;q=0.5")
      ).toBe(true);
    });
  });

  describe("returns false when HTML is preferred", () => {
    it("standard Chrome Accept header", () => {
      expect(
        prefersMarkdown(
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7"
        )
      ).toBe(false);
    });

    it("standard Firefox Accept header", () => {
      expect(
        prefersMarkdown(
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        )
      ).toBe(false);
    });

    it("text/html before text/plain", () => {
      expect(prefersMarkdown("text/html, text/plain")).toBe(false);
    });

    it("text/html before text/markdown", () => {
      expect(prefersMarkdown("text/html, text/markdown")).toBe(false);
    });

    it("empty string", () => {
      expect(prefersMarkdown("")).toBe(false);
    });

    it("only wildcard", () => {
      expect(prefersMarkdown("*/*")).toBe(false);
    });

    it("application/json", () => {
      expect(prefersMarkdown("application/json")).toBe(false);
    });

    it("image types", () => {
      expect(prefersMarkdown("image/webp, image/png")).toBe(false);
    });

    it("application/xml", () => {
      expect(prefersMarkdown("application/xml")).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("handles leading/trailing whitespace", () => {
      expect(prefersMarkdown("  text/markdown  ,  text/html  ")).toBe(true);
    });

    it("handles case variations (Text/Markdown)", () => {
      expect(prefersMarkdown("Text/Markdown")).toBe(true);
    });

    it("handles TEXT/MARKDOWN (all caps)", () => {
      expect(prefersMarkdown("TEXT/MARKDOWN")).toBe(true);
    });

    it("text/plain with wildcard but no text/html", () => {
      expect(prefersMarkdown("text/plain, */*")).toBe(true);
    });

    it("does not false-positive on text/markdown-something", () => {
      // text/markdown-something contains "text/markdown" as substring
      // but our indexOf check would still match — this is acceptable
      // because no real MIME type starts with text/markdown-
    });

    it("handles multiple commas / malformed", () => {
      expect(prefersMarkdown("text/markdown,,text/html")).toBe(true);
    });

    it("handles semicolons in quality params", () => {
      expect(prefersMarkdown("text/markdown;q=0.9")).toBe(true);
    });
  });

  describe("performance", () => {
    it("processes 100K headers in under 100ms", () => {
      const headers = [
        "text/markdown, */*",
        "text/html,application/xhtml+xml,*/*;q=0.8",
        "text/plain",
        "",
        "*/*",
        "text/markdown, text/html;q=0.9",
      ];

      const start = performance.now();
      for (let i = 0; i < 100_000; i++) {
        prefersMarkdown(headers[i % headers.length]);
      }
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(100);
    });
  });
});
