import { describe, expect, it } from "bun:test";
import { STATIC_FILE_REGEX, STATIC_EXTENSIONS } from "../proxy";

/**
 * Test the proxy matcher regex pattern.
 * This regex is used in proxy.ts to determine which paths the middleware should handle.
 * 
 * The negative lookahead pattern excludes:
 * - _next/* (Next.js internals)
 * - Root-level static files (e.g., /favicon.ico, /robots.txt)
 * 
 * It should NOT exclude:
 * - Domains (e.g., /example.com, /api.example.com)
 * - URLs with paths (e.g., /nytimes.com/article.html)
 */

/**
 * Simulates whether a path would be EXCLUDED by the middleware matcher.
 * Returns true if the path looks like a static file (should be excluded).
 */
function isStaticFileMatch(path: string): boolean {
  // Remove leading slash for testing
  const pathWithoutSlash = path.startsWith("/") ? path.substring(1) : path;
  
  // Check if it starts with _next
  if (pathWithoutSlash.startsWith("_next")) {
    return true;
  }
  
  // Check if it matches the static file pattern
  return STATIC_FILE_REGEX.test(pathWithoutSlash);
}

describe("proxy matcher regex", () => {
  describe("STATIC_EXTENSIONS constant", () => {
    it("includes expected extensions", () => {
      expect(STATIC_EXTENSIONS).toContain("html?");
      expect(STATIC_EXTENSIONS).toContain("css");
      expect(STATIC_EXTENSIONS).toContain("js(?!on)");
      expect(STATIC_EXTENSIONS).toContain("png");
      expect(STATIC_EXTENSIONS).toContain("ico");
      expect(STATIC_EXTENSIONS).toContain("txt");
      expect(STATIC_EXTENSIONS).toContain("xml");
    });
  });

  describe("static files that SHOULD be excluded", () => {
    const staticFiles = [
      "/favicon.ico",
      "/robots.txt",
      "/sitemap.xml",
      "/og-image.png",
      "/logo.svg",
      "/style.css",
      "/script.js",
      "/app.js",
      "/index.html",
      "/page.htm",
      "/photo.jpg",
      "/photo.jpeg",
      "/image.webp",
      "/image.gif",
      "/font.woff",
      "/font.woff2",
      "/font.ttf",
      "/data.csv",
      "/document.doc",
      "/document.docx",
      "/spreadsheet.xlsx",
      "/archive.zip",
      "/manifest.webmanifest",
    ];

    staticFiles.forEach((file) => {
      it(`excludes ${file}`, () => {
        expect(isStaticFileMatch(file)).toBe(true);
      });
    });
  });

  describe("static files with query params/fragments", () => {
    it("excludes /script.js?v=123", () => {
      expect(isStaticFileMatch("/script.js?v=123")).toBe(true);
    });

    it("excludes /style.css?cache=bust", () => {
      expect(isStaticFileMatch("/style.css?cache=bust")).toBe(true);
    });

    it("excludes /page.html#section", () => {
      expect(isStaticFileMatch("/page.html#section")).toBe(true);
    });
  });

  describe("Next.js internals that SHOULD be excluded", () => {
    const nextFiles = [
      "/_next/static/chunks/main.js",
      "/_next/image?url=...",
      "/_next/data/build-id/page.json",
    ];

    nextFiles.forEach((file) => {
      it(`excludes ${file}`, () => {
        expect(isStaticFileMatch(file)).toBe(true);
      });
    });
  });

  describe("domains that should NOT be excluded (go to middleware)", () => {
    const domains = [
      "/example.com",
      "/api.example.com",
      "/nytimes.com",
      "/proxy.com",
      "/test.io",
      "/site.org",
      "/my-site.net",
      "/sub.domain.co.uk",
      // TLDs that might look like extensions but aren't
      "/example.co",
      "/site.tv",
      "/app.ai",
      "/tool.dev",
    ];

    domains.forEach((domain) => {
      it(`allows ${domain} through middleware`, () => {
        expect(isStaticFileMatch(domain)).toBe(false);
      });
    });
  });

  describe("URLs with paths should NOT be excluded (have slashes)", () => {
    const urlsWithPaths = [
      "/https://example.com/page.html",
      "/https:/example.com/style.css",
      "/nytimes.com/2025/article.html",
      "/example.com/images/photo.png",
      "/site.org/assets/script.js",
      "/domain.com/path/to/file.txt",
    ];

    urlsWithPaths.forEach((url) => {
      it(`allows ${url} through middleware (has path segments)`, () => {
        // These have slashes after the domain, so [^/]+ won't match the whole thing
        expect(isStaticFileMatch(url)).toBe(false);
      });
    });
  });

  describe("edge cases", () => {
    it("does NOT exclude /data.json (json is explicitly allowed)", () => {
      // js(?!on) means match js but NOT json
      expect(isStaticFileMatch("/data.json")).toBe(false);
    });

    it("does NOT exclude paths without extensions", () => {
      expect(isStaticFileMatch("/example")).toBe(false);
      expect(isStaticFileMatch("/proxy")).toBe(false);
      expect(isStaticFileMatch("/api")).toBe(false);
    });

    it("handles files with multiple dots correctly", () => {
      // /file.name.png - has a dot before extension, could be confused with domain
      // But .png IS a static extension, so should be excluded
      expect(isStaticFileMatch("/file.name.png")).toBe(true);
      
      // /domain.example.com - ends in .com which is NOT a static extension
      expect(isStaticFileMatch("/domain.example.com")).toBe(false);
    });

    it("handles uppercase extensions", () => {
      expect(isStaticFileMatch("/IMAGE.PNG")).toBe(true);
      expect(isStaticFileMatch("/STYLE.CSS")).toBe(true);
    });

    it("allows domains with query params through", () => {
      expect(isStaticFileMatch("/example.com?ref=test")).toBe(false);
    });
  });
});
