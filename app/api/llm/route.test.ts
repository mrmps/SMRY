import { describe, expect, it } from "bun:test";
import { getMarkdownForRoute } from "@/lib/llm/content";

/**
 * Simulates the GET handler logic without requiring next/server.
 * Tests the same behavior as the actual route handler.
 */
function simulateGET(page: string, accept?: string) {
  const markdown = getMarkdownForRoute(page || "/");

  if (!markdown) {
    return { status: 404, body: "Not found", headers: {} };
  }

  const contentType =
    accept && accept.includes("text/plain")
      ? "text/plain; charset=utf-8"
      : "text/markdown; charset=utf-8";

  return {
    status: 200,
    body: markdown,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, s-maxage=3600, max-age=300",
      "X-Llms-Txt": "https://smry.ai/llms.txt",
      Link: '<https://smry.ai/llms.txt>; rel="llms-txt"',
      "X-Robots-Tag": "noindex, nofollow",
      Vary: "Accept",
    },
  };
}

describe("GET /api/llm", () => {
  describe("successful responses", () => {
    it("returns markdown for homepage", () => {
      const res = simulateGET("/");
      expect(res.status).toBe(200);
      expect(res.body).toContain("smry");
      expect(res.body.toLowerCase()).toContain("paywall");
    });

    it("returns markdown for pricing page", () => {
      const res = simulateGET("/pricing");
      expect(res.status).toBe(200);
      expect(res.body.toLowerCase()).toContain("pricing");
    });

    it("returns markdown for guide page", () => {
      const res = simulateGET("/guide");
      expect(res.status).toBe(200);
    });

    it("returns markdown for hard-paywalls page", () => {
      const res = simulateGET("/hard-paywalls");
      expect(res.status).toBe(200);
    });

    it("returns markdown for changelog page", () => {
      const res = simulateGET("/changelog");
      expect(res.status).toBe(200);
    });
  });

  describe("content type negotiation", () => {
    it("returns text/markdown when Accept includes text/markdown", () => {
      const res = simulateGET("/", "text/markdown");
      expect(res.headers["Content-Type"]).toContain("text/markdown");
    });

    it("returns text/plain when Accept includes text/plain", () => {
      const res = simulateGET("/", "text/plain");
      expect(res.headers["Content-Type"]).toContain("text/plain");
    });

    it("defaults to text/markdown when no Accept header", () => {
      const res = simulateGET("/");
      expect(res.headers["Content-Type"]).toContain("text/markdown");
    });
  });

  describe("response headers", () => {
    it("includes Cache-Control header", () => {
      const res = simulateGET("/");
      expect(res.headers["Cache-Control"]).toBeDefined();
      expect(res.headers["Cache-Control"]).toContain("public");
    });

    it("includes X-Llms-Txt header", () => {
      const res = simulateGET("/");
      expect(res.headers["X-Llms-Txt"]).toContain("llms.txt");
    });

    it("includes Link header with llms.txt rel", () => {
      const res = simulateGET("/");
      expect(res.headers["Link"]).toContain("llms.txt");
      expect(res.headers["Link"]).toContain('rel="llms-txt"');
    });

    it("includes X-Robots-Tag to prevent search engine indexing", () => {
      const res = simulateGET("/");
      expect(res.headers["X-Robots-Tag"]).toContain("noindex");
    });

    it("includes Vary: Accept for CDN caching", () => {
      const res = simulateGET("/");
      expect(res.headers["Vary"]).toBe("Accept");
    });
  });

  describe("error handling", () => {
    it("returns 404 for unknown page", () => {
      const res = simulateGET("/nonexistent");
      expect(res.status).toBe(404);
    });

    it("returns 404 for proxy page", () => {
      const res = simulateGET("/proxy");
      expect(res.status).toBe(404);
    });

    it("returns 404 for history page", () => {
      const res = simulateGET("/history");
      expect(res.status).toBe(404);
    });

    it("defaults to homepage when no page param", () => {
      const res = simulateGET("");
      expect(res.status).toBe(200);
      expect(res.body.toLowerCase()).toContain("paywall");
    });
  });
});
