import { describe, expect, it } from "bun:test";
import {
  stripLocalePrefix,
  getMarkdownRewritePath,
  buildMarkdownRewriteUrl,
  LLM_DISCOVERY_HEADERS,
} from "./middleware";
import { locales } from "@/i18n/routing";

describe("stripLocalePrefix", () => {
  describe("default locale (en) — no prefix to strip", () => {
    it("returns / unchanged", () => {
      expect(stripLocalePrefix("/")).toBe("/");
    });

    it("returns /pricing unchanged", () => {
      expect(stripLocalePrefix("/pricing")).toBe("/pricing");
    });

    it("returns /guide unchanged", () => {
      expect(stripLocalePrefix("/guide")).toBe("/guide");
    });

    it("returns /hard-paywalls unchanged", () => {
      expect(stripLocalePrefix("/hard-paywalls")).toBe("/hard-paywalls");
    });

    it("returns /changelog unchanged", () => {
      expect(stripLocalePrefix("/changelog")).toBe("/changelog");
    });
  });

  describe("non-default locales — strips prefix", () => {
    const nonDefaultLocales = locales.filter((l) => l !== "en");

    for (const locale of nonDefaultLocales) {
      it(`strips /${locale} → /`, () => {
        expect(stripLocalePrefix(`/${locale}`)).toBe("/");
      });

      it(`strips /${locale}/pricing → /pricing`, () => {
        expect(stripLocalePrefix(`/${locale}/pricing`)).toBe("/pricing");
      });

      it(`strips /${locale}/guide → /guide`, () => {
        expect(stripLocalePrefix(`/${locale}/guide`)).toBe("/guide");
      });

      it(`strips /${locale}/hard-paywalls → /hard-paywalls`, () => {
        expect(stripLocalePrefix(`/${locale}/hard-paywalls`)).toBe(
          "/hard-paywalls"
        );
      });

      it(`strips /${locale}/changelog → /changelog`, () => {
        expect(stripLocalePrefix(`/${locale}/changelog`)).toBe("/changelog");
      });
    }
  });

  describe("edge cases", () => {
    it("does not strip partial locale matches", () => {
      // /de-something should NOT be treated as locale /de
      expect(stripLocalePrefix("/de-something")).toBe("/de-something");
    });

    it("does not strip /en prefix (default locale is never prefixed)", () => {
      expect(stripLocalePrefix("/en")).toBe("/en");
      expect(stripLocalePrefix("/en/pricing")).toBe("/en/pricing");
    });

    it("handles /proxy path unchanged", () => {
      expect(stripLocalePrefix("/proxy")).toBe("/proxy");
    });

    it("handles deeply nested paths", () => {
      expect(stripLocalePrefix("/de/some/deep/path")).toBe("/some/deep/path");
    });

    it("handles paths with query-like segments", () => {
      expect(stripLocalePrefix("/pt/pricing")).toBe("/pricing");
    });
  });
});

describe("getMarkdownRewritePath", () => {
  const MD_ACCEPT = "text/markdown";
  const HTML_ACCEPT =
    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";
  const CLAUDE_ACCEPT = "text/markdown, */*";
  const PLAIN_ACCEPT = "text/plain";

  describe("eligible routes with markdown Accept header", () => {
    it("returns / for homepage", () => {
      expect(getMarkdownRewritePath("/", MD_ACCEPT)).toBe("/");
    });

    it("returns /pricing for pricing page", () => {
      expect(getMarkdownRewritePath("/pricing", MD_ACCEPT)).toBe("/pricing");
    });

    it("returns /guide for guide page", () => {
      expect(getMarkdownRewritePath("/guide", MD_ACCEPT)).toBe("/guide");
    });

    it("returns /hard-paywalls for hard-paywalls page", () => {
      expect(getMarkdownRewritePath("/hard-paywalls", MD_ACCEPT)).toBe(
        "/hard-paywalls"
      );
    });

    it("returns /changelog for changelog page", () => {
      expect(getMarkdownRewritePath("/changelog", MD_ACCEPT)).toBe(
        "/changelog"
      );
    });
  });

  describe("locale-prefixed eligible routes", () => {
    const nonDefaultLocales = locales.filter((l) => l !== "en");

    for (const locale of nonDefaultLocales) {
      it(`handles /${locale}/ → /`, () => {
        expect(getMarkdownRewritePath(`/${locale}`, MD_ACCEPT)).toBe("/");
      });

      it(`handles /${locale}/pricing → /pricing`, () => {
        expect(getMarkdownRewritePath(`/${locale}/pricing`, MD_ACCEPT)).toBe(
          "/pricing"
        );
      });
    }
  });

  describe("different Accept headers", () => {
    it("works with Claude Code style header (text/markdown, */*)", () => {
      expect(getMarkdownRewritePath("/", CLAUDE_ACCEPT)).toBe("/");
    });

    it("works with text/plain header", () => {
      expect(getMarkdownRewritePath("/", PLAIN_ACCEPT)).toBe("/");
    });

    it("returns null for standard browser Accept header", () => {
      expect(getMarkdownRewritePath("/", HTML_ACCEPT)).toBeNull();
    });

    it("returns null for empty Accept header", () => {
      expect(getMarkdownRewritePath("/", "")).toBeNull();
    });
  });

  describe("excluded routes — should NEVER return a path", () => {
    it("returns null for /proxy (even with markdown Accept)", () => {
      expect(getMarkdownRewritePath("/proxy", MD_ACCEPT)).toBeNull();
    });

    it("returns null for /proxy with query params", () => {
      expect(
        getMarkdownRewritePath("/proxy?url=nytimes.com", MD_ACCEPT)
      ).toBeNull();
    });

    it("returns null for /history", () => {
      expect(getMarkdownRewritePath("/history", MD_ACCEPT)).toBeNull();
    });

    it("returns null for /chat", () => {
      expect(getMarkdownRewritePath("/chat", MD_ACCEPT)).toBeNull();
    });

    it("returns null for /chat/some-id", () => {
      expect(getMarkdownRewritePath("/chat/abc123", MD_ACCEPT)).toBeNull();
    });

    it("returns null for /admin", () => {
      expect(getMarkdownRewritePath("/admin", MD_ACCEPT)).toBeNull();
    });

    it("returns null for /api/article", () => {
      expect(getMarkdownRewritePath("/api/article", MD_ACCEPT)).toBeNull();
    });

    it("returns null for unknown routes", () => {
      expect(getMarkdownRewritePath("/unknown", MD_ACCEPT)).toBeNull();
    });

    it("returns null for URL slugs (e.g., /nytimes.com/article)", () => {
      expect(
        getMarkdownRewritePath("/nytimes.com/article", MD_ACCEPT)
      ).toBeNull();
    });

    it("returns null for locale-prefixed proxy", () => {
      expect(getMarkdownRewritePath("/de/proxy", MD_ACCEPT)).toBeNull();
    });

    it("returns null for locale-prefixed history", () => {
      expect(getMarkdownRewritePath("/pt/history", MD_ACCEPT)).toBeNull();
    });
  });
});

describe("buildMarkdownRewriteUrl", () => {
  const ORIGIN = "https://smry.ai";

  it("builds URL for homepage", () => {
    const url = buildMarkdownRewriteUrl("/", ORIGIN);
    expect(url).toBe("https://smry.ai/api/llm?page=%2F");
  });

  it("builds URL for pricing", () => {
    const url = buildMarkdownRewriteUrl("/pricing", ORIGIN);
    expect(url).toBe("https://smry.ai/api/llm?page=%2Fpricing");
  });

  it("builds URL for guide", () => {
    const url = buildMarkdownRewriteUrl("/guide", ORIGIN);
    expect(url).toBe("https://smry.ai/api/llm?page=%2Fguide");
  });

  it("properly encodes the page parameter", () => {
    const url = buildMarkdownRewriteUrl("/hard-paywalls", ORIGIN);
    expect(url).toContain("page=%2Fhard-paywalls");
  });

  it("works with different origins", () => {
    const url = buildMarkdownRewriteUrl("/pricing", "http://localhost:3000");
    expect(url).toBe("http://localhost:3000/api/llm?page=%2Fpricing");
  });
});

describe("LLM_DISCOVERY_HEADERS", () => {
  it("includes Link header with llms.txt rel", () => {
    expect(LLM_DISCOVERY_HEADERS["Link"]).toContain("llms.txt");
    expect(LLM_DISCOVERY_HEADERS["Link"]).toContain('rel="llms-txt"');
  });

  it("includes X-Llms-Txt header", () => {
    expect(LLM_DISCOVERY_HEADERS["X-Llms-Txt"]).toBe(
      "https://smry.ai/llms.txt"
    );
  });

  it("Link header uses proper format", () => {
    expect(LLM_DISCOVERY_HEADERS["Link"]).toMatch(
      /^<https:\/\/smry\.ai\/llms\.txt>; rel="llms-txt"$/
    );
  });
});
