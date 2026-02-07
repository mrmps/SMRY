import { describe, expect, it } from "bun:test";
import { getMarkdownForRoute, LLM_ELIGIBLE_ROUTES } from "./content";

// --- Helpers ---

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

/** Extract all headings from markdown */
function extractHeadings(md: string): { level: number; text: string }[] {
  const headingRegex = /^(#{1,6})\s+(.+)$/gm;
  const headings: { level: number; text: string }[] = [];
  let match;
  while ((match = headingRegex.exec(md)) !== null) {
    headings.push({ level: match[1].length, text: match[2] });
  }
  return headings;
}

// --- Tests ---

describe("getMarkdownForRoute", () => {
  describe("returns content for all eligible routes", () => {
    for (const route of LLM_ELIGIBLE_ROUTES) {
      it(`returns non-null content for ${route}`, () => {
        const md = getMarkdownForRoute(route);
        expect(md).not.toBeNull();
        expect(typeof md).toBe("string");
        expect(md!.length).toBeGreaterThan(100);
      });
    }
  });

  describe("returns null for excluded routes", () => {
    const excludedRoutes = [
      "/proxy",
      "/history",
      "/chat",
      "/chat/abc123",
      "/admin",
      "/api/article",
      "/api/summary",
      "/does-not-exist",
      "/feedback",
      "/auth/redirect",
      "",
    ];

    for (const route of excludedRoutes) {
      it(`returns null for ${route || "(empty string)"}`, () => {
        expect(getMarkdownForRoute(route)).toBeNull();
      });
    }
  });
});

describe("content quality — homepage /", () => {
  const md = getMarkdownForRoute("/")!;

  it("describes what SMRY is", () => {
    expect(md.toLowerCase()).toContain("paywall");
    expect(md.toLowerCase()).toContain("bypass");
    expect(md.toLowerCase()).toContain("article");
  });

  it("mentions the brand name", () => {
    expect(md).toContain("SMRY");
    expect(md).toContain("smry.ai");
  });

  it("includes reader count stat", () => {
    expect(md).toContain("300,000");
  });

  it("explains the 3-source parallel fetching", () => {
    expect(md.toLowerCase()).toContain("direct");
    expect(md.toLowerCase()).toContain("proxy");
    expect(md.toLowerCase()).toContain("wayback");
  });

  it("mentions AI summaries", () => {
    expect(md.toLowerCase()).toContain("summary");
  });

  it("includes quick start / usage instructions", () => {
    expect(md).toContain("smry.ai/");
  });

  it("mentions it's free / no signup", () => {
    expect(md.toLowerCase()).toContain("free");
    expect(md.toLowerCase()).toContain("no account");
  });
});

describe("content quality — /pricing", () => {
  const md = getMarkdownForRoute("/pricing")!;

  it("describes free plan", () => {
    expect(md.toLowerCase()).toContain("free");
    expect(md).toContain("20");
  });

  it("describes pro plan", () => {
    expect(md.toLowerCase()).toContain("pro");
    expect(md.toLowerCase()).toContain("unlimited");
  });

  it("mentions pricing", () => {
    expect(md).toContain("$");
  });

  it("mentions trial / guarantee", () => {
    expect(md.toLowerCase()).toContain("trial");
  });

  it("includes value comparison", () => {
    expect(md).toContain("NYT");
    expect(md).toContain("WSJ");
    expect(md).toContain("Bloomberg");
  });
});

describe("content quality — /guide", () => {
  const md = getMarkdownForRoute("/guide")!;

  it("explains soft vs hard paywalls", () => {
    expect(md.toLowerCase()).toContain("soft paywall");
    expect(md.toLowerCase()).toContain("hard paywall");
  });

  it("explains how to use SMRY", () => {
    expect(md).toContain("smry.ai/");
  });

  it("lists supported publications", () => {
    expect(md).toContain("New York Times");
    expect(md).toContain("Wall Street Journal");
  });

  it("mentions rate limits", () => {
    expect(md).toContain("20");
  });
});

describe("content quality — /hard-paywalls", () => {
  const md = getMarkdownForRoute("/hard-paywalls")!;

  it("explains what a hard paywall is", () => {
    expect(md.toLowerCase()).toContain("hard paywall");
    expect(md.toLowerCase()).toContain("authentication");
  });

  it("includes comparison table", () => {
    expect(md).toContain("|");
    expect(md.toLowerCase()).toContain("soft paywall");
  });

  it("explains why bypass is impossible", () => {
    expect(md.toLowerCase()).toContain("cannot");
  });

  it("provides alternatives", () => {
    expect(md.toLowerCase()).toContain("archive");
  });
});

describe("content quality — /changelog", () => {
  const md = getMarkdownForRoute("/changelog")!;

  it("includes dates", () => {
    expect(md).toMatch(/\d{4}/); // contains a year
  });

  it("lists features", () => {
    expect(md.toLowerCase()).toContain("chat");
    expect(md.toLowerCase()).toContain("summaries");
  });

  it("has multiple changelog entries", () => {
    const h2Count = (md.match(/^## /gm) || []).length;
    expect(h2Count).toBeGreaterThan(3);
  });
});

describe("structural quality — all pages", () => {
  for (const route of LLM_ELIGIBLE_ROUTES) {
    describe(`${route}`, () => {
      const md = getMarkdownForRoute(route)!;

      it("starts with llms.txt blockquote reference", () => {
        expect(md.trimStart().startsWith(">")).toBe(true);
        expect(md).toContain("llms.txt");
      });

      it("has at least one H1 heading", () => {
        const headings = extractHeadings(md);
        const h1s = headings.filter((h) => h.level === 1);
        expect(h1s.length).toBeGreaterThanOrEqual(1);
      });

      it("has at least one H2 heading (sections)", () => {
        const headings = extractHeadings(md);
        const h2s = headings.filter((h) => h.level === 2);
        expect(h2s.length).toBeGreaterThanOrEqual(1);
      });

      it("contains at least one link", () => {
        const links = extractLinks(md);
        expect(links.length).toBeGreaterThanOrEqual(1);
      });

      it("all links have valid URLs (https:// or relative)", () => {
        const links = extractLinks(md);
        for (const link of links) {
          expect(
            link.url.startsWith("https://") || link.url.startsWith("/")
          ).toBe(true);
        }
      });

      it("contains smry.ai in at least one link", () => {
        const links = extractLinks(md);
        const smryLinks = links.filter((l) => l.url.includes("smry.ai"));
        expect(smryLinks.length).toBeGreaterThanOrEqual(1);
      });

      it("does not contain HTML tags", () => {
        // Markdown content should be pure markdown, no embedded HTML
        expect(md).not.toMatch(/<(?!code)[a-z][^>]*>/i);
      });

      it("does not contain JavaScript or CSS", () => {
        expect(md).not.toContain("<script");
        expect(md).not.toContain("<style");
        expect(md).not.toContain("className=");
      });

      it("is under 10,000 characters (token-efficient)", () => {
        expect(md.length).toBeLessThan(10000);
      });

      it("is at least 200 characters (non-trivial content)", () => {
        expect(md.length).toBeGreaterThan(200);
      });
    });
  }
});

describe("performance", () => {
  it("generates all pages in under 1ms total", () => {
    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      for (const route of LLM_ELIGIBLE_ROUTES) {
        getMarkdownForRoute(route);
      }
    }
    const elapsed = performance.now() - start;
    const perCall = elapsed / (100 * LLM_ELIGIBLE_ROUTES.length);
    // Each call should be well under 1ms (these are just string returns)
    expect(perCall).toBeLessThan(1);
  });

  it("returns null for unknown routes in under 0.01ms", () => {
    const start = performance.now();
    for (let i = 0; i < 10000; i++) {
      getMarkdownForRoute("/nonexistent");
    }
    const elapsed = performance.now() - start;
    const perCall = elapsed / 10000;
    expect(perCall).toBeLessThan(0.01);
  });
});

describe("LLM_ELIGIBLE_ROUTES", () => {
  it("includes all static marketing pages", () => {
    expect(LLM_ELIGIBLE_ROUTES).toContain("/");
    expect(LLM_ELIGIBLE_ROUTES).toContain("/pricing");
    expect(LLM_ELIGIBLE_ROUTES).toContain("/guide");
    expect(LLM_ELIGIBLE_ROUTES).toContain("/hard-paywalls");
    expect(LLM_ELIGIBLE_ROUTES).toContain("/changelog");
  });

  it("does not include dynamic routes", () => {
    expect(LLM_ELIGIBLE_ROUTES).not.toContain("/proxy");
    expect(LLM_ELIGIBLE_ROUTES).not.toContain("/history");
    expect(LLM_ELIGIBLE_ROUTES).not.toContain("/chat");
    expect(LLM_ELIGIBLE_ROUTES).not.toContain("/admin");
  });

  it("has exactly 5 routes", () => {
    expect(LLM_ELIGIBLE_ROUTES.length).toBe(5);
  });

  it("every route has a corresponding getMarkdownForRoute implementation", () => {
    for (const route of LLM_ELIGIBLE_ROUTES) {
      expect(getMarkdownForRoute(route)).not.toBeNull();
    }
  });
});
