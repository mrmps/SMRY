import { describe, expect, it } from "bun:test";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const PUBLIC_DIR = resolve(import.meta.dir, "../public");

/** Extract all markdown links [text](url) from content */
function extractLinks(md: string): { text: string; url: string }[] {
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const links: { text: string; url: string }[] = [];
  let match;
  while ((match = linkRegex.exec(md)) !== null) {
    links.push({ text: match[1], url: match[2] });
  }
  return links;
}

/** Extract all bare URLs from content */
function extractBareUrls(md: string): string[] {
  const urlRegex = /https?:\/\/[^\s)>\]]+/g;
  return md.match(urlRegex) || [];
}

describe("public/llms.txt", () => {
  const filePath = resolve(PUBLIC_DIR, "llms.txt");

  it("file exists", () => {
    expect(existsSync(filePath)).toBe(true);
  });

  describe("content", () => {
    const content = readFileSync(filePath, "utf-8");

    it("starts with a heading containing SMRY", () => {
      expect(content).toMatch(/^#\s.*SMRY/m);
    });

    it("contains a description of the product", () => {
      expect(content.toLowerCase()).toContain("paywall");
      expect(content.toLowerCase()).toContain("article");
    });

    it("links to all main pages", () => {
      expect(content).toContain("smry.ai/pricing");
      expect(content).toContain("smry.ai/guide");
      expect(content).toContain("smry.ai/hard-paywalls");
      expect(content).toContain("smry.ai/changelog");
    });

    it("links to llms-full.txt", () => {
      expect(content).toContain("llms-full.txt");
    });

    it("includes quick start usage example", () => {
      expect(content).toContain("smry.ai/");
    });

    it("includes pricing summary", () => {
      expect(content.toLowerCase()).toContain("free");
      expect(content.toLowerCase()).toContain("pro");
    });

    it("links to GitHub", () => {
      expect(content).toContain("github.com");
    });

    it("is under 2000 characters (concise index)", () => {
      expect(content.length).toBeLessThan(2000);
    });

    it("is at least 300 characters (non-trivial)", () => {
      expect(content.length).toBeGreaterThan(300);
    });

    it("all URLs use https://", () => {
      const urls = extractBareUrls(content);
      for (const url of urls) {
        expect(url.startsWith("https://")).toBe(true);
      }
    });

    it("does not contain HTML", () => {
      expect(content).not.toMatch(/<[a-z][^>]*>/i);
    });
  });
});

describe("public/llms-full.txt", () => {
  const filePath = resolve(PUBLIC_DIR, "llms-full.txt");

  it("file exists", () => {
    expect(existsSync(filePath)).toBe(true);
  });

  describe("content", () => {
    const content = readFileSync(filePath, "utf-8");

    it("starts with a heading", () => {
      expect(content).toMatch(/^#\s/m);
    });

    it("is substantially longer than llms.txt", () => {
      const llmsTxt = readFileSync(resolve(PUBLIC_DIR, "llms.txt"), "utf-8");
      expect(content.length).toBeGreaterThan(llmsTxt.length * 2);
    });

    it("contains all major sections", () => {
      const sections = [
        "what is smry",
        "how it works",
        "features",
        "pricing",
        "faq",
      ];
      const lower = content.toLowerCase();
      for (const section of sections) {
        expect(lower).toContain(section);
      }
    });

    it("explains the 3 source strategy", () => {
      expect(content.toLowerCase()).toContain("direct");
      expect(content.toLowerCase()).toContain("proxy");
      expect(content.toLowerCase()).toContain("wayback");
    });

    it("includes FAQ section with questions", () => {
      expect(content).toContain("###");
      expect(content.toLowerCase()).toContain("how does paywall bypass work");
    });

    it("includes statistics", () => {
      expect(content).toContain("300,000");
      expect(content).toContain("2.4M");
      expect(content).toContain("76%");
    });

    it("lists supported publications", () => {
      expect(content).toContain("New York Times");
      expect(content).toContain("Wall Street Journal");
      expect(content).toContain("Bloomberg");
    });

    it("explains content negotiation", () => {
      expect(content.toLowerCase()).toContain("content negotiation");
      expect(content).toContain("Accept: text/markdown");
    });

    it("includes both pricing tiers with details", () => {
      expect(content.toLowerCase()).toContain("free plan");
      expect(content.toLowerCase()).toContain("pro plan");
      expect(content).toContain("$");
    });

    it("includes links section", () => {
      expect(content).toContain("smry.ai");
      expect(content).toContain("github.com");
    });

    it("all links are valid URLs", () => {
      const links = extractLinks(content);
      for (const link of links) {
        expect(
          link.url.startsWith("https://") || link.url.startsWith("/")
        ).toBe(true);
      }
    });

    it("does not contain HTML tags", () => {
      expect(content).not.toMatch(/<(?!code)[a-z][^>]*>/i);
    });

    it("does not contain JavaScript", () => {
      expect(content).not.toContain("<script");
      expect(content).not.toContain("className=");
    });

    it("is under 10,000 characters (token-efficient)", () => {
      expect(content.length).toBeLessThan(10000);
    });

    it("is at least 2,000 characters (comprehensive)", () => {
      expect(content.length).toBeGreaterThan(2000);
    });
  });
});

describe("static file consistency", () => {
  const llmsTxt = readFileSync(resolve(PUBLIC_DIR, "llms.txt"), "utf-8");
  const llmsFullTxt = readFileSync(
    resolve(PUBLIC_DIR, "llms-full.txt"),
    "utf-8"
  );

  it("both files mention the same brand name", () => {
    expect(llmsTxt).toContain("SMRY");
    expect(llmsFullTxt).toContain("SMRY");
  });

  it("both files reference smry.ai", () => {
    expect(llmsTxt).toContain("smry.ai");
    expect(llmsFullTxt).toContain("smry.ai");
  });

  it("llms.txt references llms-full.txt for more details", () => {
    expect(llmsTxt).toContain("llms-full.txt");
  });

  it("both files agree on key stats (300K readers)", () => {
    expect(llmsTxt).toContain("300,000");
    expect(llmsFullTxt).toContain("300,000");
  });
});
