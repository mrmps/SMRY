/**
 * Elysia API Server Tests
 *
 * These tests verify that all API routes are correctly configured and functional.
 * They use Elysia's .handle() method to test routes directly without network calls.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Elysia } from "elysia";
import { articleRoutes } from "./routes/article";
import { adminRoutes } from "./routes/admin";

// Create test app with all routes
const createTestApp = () => {
  return new Elysia()
    .use(articleRoutes)
    .use(adminRoutes)
    .get("/health", () => ({
      status: "ok",
      timestamp: new Date().toISOString(),
    }));
};

describe("Elysia API Server", () => {
  let app: ReturnType<typeof createTestApp>;

  beforeAll(() => {
    app = createTestApp();
  });

  describe("Health Check", () => {
    it("should return ok status", async () => {
      const response = await app.handle(new Request("http://localhost/health"));
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.status).toBe("ok");
      expect(body.timestamp).toBeDefined();
    });
  });

  describe("Article Route - GET /api/article", () => {
    it("should reject requests without url parameter", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/article?source=smry-fast")
      );
      expect(response.status).toBe(422); // Validation error
    });

    it("should reject requests without source parameter", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/article?url=https://example.com")
      );
      expect(response.status).toBe(422); // Validation error
    });

    it("should reject invalid source parameter", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/article?url=https://example.com&source=invalid")
      );
      expect(response.status).toBe(422); // Validation error
    });

    it("should accept valid smry-fast source", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/article?url=https://httpbin.org/html&source=smry-fast")
      );
      // May return 200 or 500 depending on external service - just verify route is hit
      expect([200, 500]).toContain(response.status);
    });

    it("should accept valid smry-slow source", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/article?url=https://example.com&source=smry-slow")
      );
      // Just verify route accepts the source
      expect([200, 500]).toContain(response.status);
    });

    it("should accept valid wayback source", async () => {
      // Note: Wayback Machine can be slow, so we just verify the route accepts the parameter
      const response = await app.handle(
        new Request("http://localhost/api/article?url=https://example.com&source=wayback")
      );
      // Just verify route accepts the source (may timeout with 500)
      expect([200, 500]).toContain(response.status);
    }, { timeout: 15000 });

    it("should block hard paywall sites", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/article?url=https://www.barrons.com/article&source=smry-fast")
      );
      expect(response.status).toBe(403);

      const body = await response.json();
      expect(body.type).toBe("PAYWALL_ERROR");
    });
  });

  describe("Admin Route - GET /api/admin", () => {
    it("should return analytics data with default time range", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/admin")
      );

      // May return 200 or 500 depending on ClickHouse availability
      expect([200, 500]).toContain(response.status);

      if (response.status === 200) {
        const body = await response.json();
        expect(body.timeRange).toBe("24h");
        expect(body.generatedAt).toBeDefined();
        expect(body.bufferStats).toBeDefined();
        expect(body.filters).toBeDefined();
        expect(body.health).toBeDefined();
      }
    });

    it("should accept 1h time range", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/admin?range=1h")
      );
      expect([200, 500]).toContain(response.status);

      if (response.status === 200) {
        const body = await response.json();
        expect(body.timeRange).toBe("1h");
      }
    });

    it("should accept 7d time range", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/admin?range=7d")
      );
      expect([200, 500]).toContain(response.status);

      if (response.status === 200) {
        const body = await response.json();
        expect(body.timeRange).toBe("7d");
      }
    });

    it("should accept filter parameters", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/admin?hostname=example.com&source=smry-fast&outcome=success")
      );
      expect([200, 500]).toContain(response.status);

      if (response.status === 200) {
        const body = await response.json();
        expect(body.filters.hostname).toBe("example.com");
        expect(body.filters.source).toBe("smry-fast");
        expect(body.filters.outcome).toBe("success");
        expect(body.filters.hasFilters).toBe(true);
      }
    });

    it("should accept URL search parameter", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/admin?urlSearch=test")
      );
      expect([200, 500]).toContain(response.status);

      if (response.status === 200) {
        const body = await response.json();
        expect(body.filters.urlSearch).toBe("test");
        expect(body.filters.hasFilters).toBe(true);
      }
    });

    it("should return all analytics sections", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/admin")
      );

      if (response.status === 200) {
        const body = await response.json();

        // Verify all expected sections exist
        expect(body.hostnameStats).toBeDefined();
        expect(body.sourceEffectiveness).toBeDefined();
        expect(body.hourlyTraffic).toBeDefined();
        expect(body.errorBreakdown).toBeDefined();
        expect(body.upstreamBreakdown).toBeDefined();
        expect(body.realtimePopular).toBeDefined();
        expect(body.requestEvents).toBeDefined();
        expect(body.liveRequests).toBeDefined();
        expect(body.endpointStats).toBeDefined();
        expect(body.hourlyEndpointTraffic).toBeDefined();
        expect(body.universallyBroken).toBeDefined();
        expect(body.sourceErrorRateTimeSeries).toBeDefined();
      }
    });
  });

  describe("Route Registration", () => {
    it("should register all expected routes", () => {
      // Get registered routes from the app
      const routes = app.routes;

      // Check article route
      const articleRoute = routes.find(
        (r) => r.path === "/api/article" && r.method === "GET"
      );
      expect(articleRoute).toBeDefined();

      // Check admin route
      const adminRoute = routes.find(
        (r) => r.path === "/api/admin" && r.method === "GET"
      );
      expect(adminRoute).toBeDefined();

      // Check health route
      const healthRoute = routes.find(
        (r) => r.path === "/health" && r.method === "GET"
      );
      expect(healthRoute).toBeDefined();
    });
  });

  describe("Error Handling", () => {
    it("should return 404 for unknown routes", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/unknown")
      );
      expect(response.status).toBe(404);
    });
  });
});

describe("Article Route Integration", () => {
  let app: ReturnType<typeof createTestApp>;

  beforeAll(() => {
    app = createTestApp();
  });

  it("should successfully fetch article from httpbin.org", async () => {
    const response = await app.handle(
      new Request("http://localhost/api/article?url=https://httpbin.org/html&source=smry-fast")
    );

    // This is a real integration test - httpbin.org should return HTML
    if (response.status === 200) {
      const body = await response.json();
      expect(body.status).toBe("success");
      expect(body.article).toBeDefined();
      expect(body.article.title).toBeDefined();
      expect(body.article.content).toBeDefined();
      expect(body.article.textContent).toBeDefined();
      expect(body.article.length).toBeGreaterThan(0);
      expect(body.article.htmlContentPreview).toBeDefined(); // Preview for bypass detection
      expect(body.article.htmlContent).toBeUndefined(); // Full HTML no longer in response
    }
  });

  it("should return article with htmlContentPreview for bypass detection", async () => {
    const response = await app.handle(
      new Request("http://localhost/api/article?url=https://httpbin.org/html&source=smry-fast")
    );

    if (response.status === 200) {
      const body = await response.json();
      // Bypass detection uses htmlContentPreview (50KB max)
      expect(body.article.htmlContentPreview).toBeDefined();
      expect(typeof body.article.htmlContentPreview).toBe("string");
      expect(body.article.htmlContentPreview.length).toBeGreaterThan(0);
      // Full htmlContent should NOT be in response (lazy-loaded via /article/html)
      expect(body.article.htmlContent).toBeUndefined();
    }
  });
});

describe("HTML Content for Original View", () => {
  let app: ReturnType<typeof createTestApp>;

  beforeAll(() => {
    app = createTestApp();
  });

  it("should return htmlContentPreview instead of full htmlContent", async () => {
    const response = await app.handle(
      new Request("http://localhost/api/article?url=https://httpbin.org/html&source=smry-fast")
    );

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.status).toBe("success");
    expect(body.article).toBeDefined();
    // Full htmlContent should NOT be in response
    expect(body.article.htmlContent).toBeUndefined();
    // Preview should be present
    expect(body.article.htmlContentPreview).toBeDefined();
    expect(typeof body.article.htmlContentPreview).toBe("string");
    expect(body.article.htmlContentPreview.length).toBeGreaterThan(0);
    // Preview should contain HTML structure
    expect(body.article.htmlContentPreview).toContain("<html");
  });

  it("should return full htmlContent via /article/html endpoint", async () => {
    // First, fetch article to populate cache
    await app.handle(
      new Request("http://localhost/api/article?url=https://httpbin.org/html&source=smry-fast")
    );

    // Then fetch full HTML via lazy-load endpoint
    const response = await app.handle(
      new Request("http://localhost/api/article/html?url=https://httpbin.org/html&source=smry-fast")
    );

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.htmlContent).toBeDefined();
    expect(body.htmlContent).toContain("<body");
    expect(body.htmlContent).toContain("</body>");
    expect(body.htmlContent).toContain("</html>");
  });

  it("should include htmlContentPreview in cache hit response", async () => {
    // First request to populate cache
    await app.handle(
      new Request("http://localhost/api/article?url=https://httpbin.org/html&source=smry-fast")
    );

    // Second request should hit cache and include preview
    const response = await app.handle(
      new Request("http://localhost/api/article?url=https://httpbin.org/html&source=smry-fast")
    );

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.article).toBeDefined();
    expect(body.article.htmlContent).toBeUndefined();
    expect(body.article.htmlContentPreview).toBeDefined();
    expect(body.article.htmlContentPreview.length).toBeGreaterThan(0);
  });
});

