import { describe, expect, it } from "bun:test";
import {
  isAppRoute,
  repairProtocol,
  buildProxyRedirectUrl,
  SMRY_PARAMS,
} from "./proxy-redirect";

const BASE_ORIGIN = "https://smry.ai";

describe("proxy redirect helpers", () => {
  describe("isAppRoute", () => {
    it("identifies root as app route", () => {
      expect(isAppRoute("/")).toBe(true);
    });

    it("identifies /proxy as app route", () => {
      expect(isAppRoute("/proxy")).toBe(true);
    });

    it("identifies /api routes as app routes", () => {
      expect(isAppRoute("/api")).toBe(true);
      expect(isAppRoute("/api/article")).toBe(true);
      expect(isAppRoute("/api/summary/status")).toBe(true);
    });

    it("identifies other app routes", () => {
      expect(isAppRoute("/pricing")).toBe(true);
      expect(isAppRoute("/history")).toBe(true);
      expect(isAppRoute("/feedback")).toBe(true);
    });

    it("does NOT identify /proxy.com as app route (domain that starts with 'proxy')", () => {
      expect(isAppRoute("/proxy.com")).toBe(false);
      expect(isAppRoute("/proxy.com/article")).toBe(false);
    });

    it("does NOT identify /pricing-deals.com as app route", () => {
      expect(isAppRoute("/pricing-deals.com")).toBe(false);
    });

    it("does NOT identify /api.example.com as app route", () => {
      expect(isAppRoute("/api.example.com")).toBe(false);
    });

    it("identifies URL slugs as NOT app routes", () => {
      expect(isAppRoute("/nytimes.com")).toBe(false);
      expect(isAppRoute("/https:/www.nytimes.com/article")).toBe(false);
      expect(isAppRoute("/www.example.com/path")).toBe(false);
    });
  });

  describe("repairProtocol", () => {
    it("repairs collapsed https:/ to https://", () => {
      expect(repairProtocol("https:/www.nytimes.com/article")).toBe(
        "https://www.nytimes.com/article"
      );
    });

    it("repairs collapsed http:/ to http://", () => {
      expect(repairProtocol("http:/example.com")).toBe("http://example.com");
    });

    it("leaves already correct URLs unchanged", () => {
      expect(repairProtocol("https://www.nytimes.com/article")).toBe(
        "https://www.nytimes.com/article"
      );
    });

    it("leaves bare domains unchanged", () => {
      expect(repairProtocol("nytimes.com")).toBe("nytimes.com");
      expect(repairProtocol("www.example.com/path")).toBe(
        "www.example.com/path"
      );
    });
  });

  describe("buildProxyRedirectUrl", () => {
    describe("app routes (should return null)", () => {
      it("returns null for root", () => {
        expect(buildProxyRedirectUrl("/", "", BASE_ORIGIN)).toBe(null);
      });

      it("returns null for /proxy", () => {
        expect(buildProxyRedirectUrl("/proxy", "", BASE_ORIGIN)).toBe(null);
      });

      it("returns null for /proxy with query params", () => {
        expect(
          buildProxyRedirectUrl("/proxy", "?url=https://example.com", BASE_ORIGIN)
        ).toBe(null);
      });

      it("returns null for /pricing", () => {
        expect(buildProxyRedirectUrl("/pricing", "", BASE_ORIGIN)).toBe(null);
      });

      it("returns null for /api/article", () => {
        expect(buildProxyRedirectUrl("/api/article", "", BASE_ORIGIN)).toBe(null);
      });

      it("returns null for empty slug", () => {
        expect(buildProxyRedirectUrl("/", "", BASE_ORIGIN)).toBe(null);
      });
    });

    describe("basic URLs without query params", () => {
      it("builds proxy URL for bare domain", () => {
        const result = buildProxyRedirectUrl("/nytimes.com", "", BASE_ORIGIN);
        expect(result).toBe(
          "https://smry.ai/proxy?url=https%3A%2F%2Fnytimes.com"
        );
      });

      it("builds proxy URL for bare domain with path", () => {
        const result = buildProxyRedirectUrl(
          "/www.nytimes.com/2025/article",
          "",
          BASE_ORIGIN
        );
        expect(result).toBe(
          "https://smry.ai/proxy?url=https%3A%2F%2Fwww.nytimes.com%2F2025%2Farticle"
        );
      });

      it("builds proxy URL for full https URL", () => {
        const result = buildProxyRedirectUrl(
          "/https://www.nytimes.com/article",
          "",
          BASE_ORIGIN
        );
        expect(result).toBe(
          "https://smry.ai/proxy?url=https%3A%2F%2Fwww.nytimes.com%2Farticle"
        );
      });

      it("builds proxy URL for collapsed protocol URL", () => {
        const result = buildProxyRedirectUrl(
          "/https:/www.nytimes.com/article",
          "",
          BASE_ORIGIN
        );
        expect(result).toBe(
          "https://smry.ai/proxy?url=https%3A%2F%2Fwww.nytimes.com%2Farticle"
        );
      });

      it("builds proxy URL for http URL", () => {
        const result = buildProxyRedirectUrl(
          "/http://example.com/page",
          "",
          BASE_ORIGIN
        );
        expect(result).toBe(
          "https://smry.ai/proxy?url=http%3A%2F%2Fexample.com%2Fpage"
        );
      });
    });

    describe("URLs with external query params (belong to the target URL)", () => {
      it("includes external query params in the url param", () => {
        // smry.ai/https://foo.com/article?x=1 → /proxy?url=https://foo.com/article?x=1
        const result = buildProxyRedirectUrl(
          "/https://foo.com/article",
          "?x=1",
          BASE_ORIGIN
        );
        expect(result).toBe(
          "https://smry.ai/proxy?url=https%3A%2F%2Ffoo.com%2Farticle%3Fx%3D1"
        );
      });

      it("includes multiple external query params", () => {
        // smry.ai/https://example.com/search?q=test&page=2
        const result = buildProxyRedirectUrl(
          "/https://example.com/search",
          "?q=test&page=2",
          BASE_ORIGIN
        );
        expect(result).toContain("url=https%3A%2F%2Fexample.com%2Fsearch%3F");
        expect(result).toContain("q%3Dtest");
        expect(result).toContain("page%3D2");
      });

      it("handles bare domain with query params", () => {
        // smry.ai/example.com?ref=social
        const result = buildProxyRedirectUrl(
          "/example.com",
          "?ref=social",
          BASE_ORIGIN
        );
        expect(result).toBe(
          "https://smry.ai/proxy?url=https%3A%2F%2Fexample.com%3Fref%3Dsocial"
        );
      });
    });

    describe("SMRY UI params (should be preserved separately)", () => {
      it("separates sidebar param from external URL", () => {
        // smry.ai/https://foo.com/article?sidebar=open
        const result = buildProxyRedirectUrl(
          "/https://foo.com/article",
          "?sidebar=open",
          BASE_ORIGIN
        );
        expect(result).toBe(
          "https://smry.ai/proxy?url=https%3A%2F%2Ffoo.com%2Farticle&sidebar=open"
        );
      });

      it("separates tab param from external URL", () => {
        const result = buildProxyRedirectUrl(
          "/https://foo.com/article",
          "?tab=summary",
          BASE_ORIGIN
        );
        expect(result).toBe(
          "https://smry.ai/proxy?url=https%3A%2F%2Ffoo.com%2Farticle&tab=summary"
        );
      });

      it("separates source param from external URL", () => {
        const result = buildProxyRedirectUrl(
          "/https://foo.com/article",
          "?source=jina.ai",
          BASE_ORIGIN
        );
        expect(result).toBe(
          "https://smry.ai/proxy?url=https%3A%2F%2Ffoo.com%2Farticle&source=jina.ai"
        );
      });
    });

    describe("mixed params (external + SMRY UI)", () => {
      it("correctly separates external and SMRY params", () => {
        // smry.ai/https://foo.com/article?x=1&sidebar=open
        // → /proxy?url=https://foo.com/article?x=1&sidebar=open
        const result = buildProxyRedirectUrl(
          "/https://foo.com/article",
          "?x=1&sidebar=open",
          BASE_ORIGIN
        );
        // The url param should contain x=1
        expect(result).toContain(
          "url=https%3A%2F%2Ffoo.com%2Farticle%3Fx%3D1"
        );
        // sidebar should be a separate top-level param
        expect(result).toContain("&sidebar=open");
      });

      it("handles multiple SMRY params with external params", () => {
        // smry.ai/https://foo.com?ref=twitter&sidebar=open&tab=summary
        const result = buildProxyRedirectUrl(
          "/https://foo.com",
          "?ref=twitter&sidebar=open&tab=summary",
          BASE_ORIGIN
        );
        // url should contain ref=twitter
        expect(result).toContain("url=https%3A%2F%2Ffoo.com%3Fref%3Dtwitter");
        // SMRY params should be separate
        expect(result).toContain("sidebar=open");
        expect(result).toContain("tab=summary");
      });

      it("handles complex real-world URL with mixed params", () => {
        // Real-world example: NYT article with tracking params + SMRY sidebar
        const result = buildProxyRedirectUrl(
          "/https://www.nytimes.com/2025/01/article",
          "?utm_source=twitter&utm_medium=social&sidebar=open",
          BASE_ORIGIN
        );
        // External tracking params should be in url
        expect(result).toContain("utm_source%3Dtwitter");
        expect(result).toContain("utm_medium%3Dsocial");
        // SMRY param should be separate
        expect(result).toContain("&sidebar=open");
      });
    });

    describe("edge cases", () => {
      it("handles percent-encoded URLs without double encoding", () => {
        const result = buildProxyRedirectUrl(
          "/https%3A%2F%2Fwww.nytimes.com%2Farticle",
          "",
          BASE_ORIGIN
        );
        // Should decode first, then re-encode properly
        expect(result).toBe(
          "https://smry.ai/proxy?url=https%3A%2F%2Fwww.nytimes.com%2Farticle"
        );
      });

      it("handles domains that look like app routes", () => {
        // /proxy.com should redirect, not be treated as /proxy
        const result = buildProxyRedirectUrl("/proxy.com", "", BASE_ORIGIN);
        expect(result).toBe(
          "https://smry.ai/proxy?url=https%3A%2F%2Fproxy.com"
        );
      });

      it("handles /api.example.com (not /api route)", () => {
        const result = buildProxyRedirectUrl(
          "/api.example.com",
          "",
          BASE_ORIGIN
        );
        expect(result).toBe(
          "https://smry.ai/proxy?url=https%3A%2F%2Fapi.example.com"
        );
      });

      it("handles URLs with fragments", () => {
        // Note: Fragments typically don't reach the server, but if they do...
        const result = buildProxyRedirectUrl(
          "/https://example.com/page#section",
          "",
          BASE_ORIGIN
        );
        expect(result).toContain("example.com");
      });

      it("handles URLs with ports", () => {
        const result = buildProxyRedirectUrl(
          "/https://localhost:3000/page",
          "",
          BASE_ORIGIN
        );
        expect(result).toContain("localhost%3A3000");
      });

      it("handles internationalized domain names", () => {
        const result = buildProxyRedirectUrl(
          "/https://例え.jp/article",
          "",
          BASE_ORIGIN
        );
        expect(result).toContain("proxy?url=");
      });
    });

    describe("SMRY_PARAMS constant", () => {
      it("includes expected params", () => {
        expect(SMRY_PARAMS).toContain("sidebar");
        expect(SMRY_PARAMS).toContain("tab");
        expect(SMRY_PARAMS).toContain("source");
      });
    });
  });
});
