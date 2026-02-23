/**
 * Elysia API Server
 */

import { Elysia } from "elysia";
import { node } from "@elysiajs/node";
import { cors } from "@elysiajs/cors";
import { cron } from "@elysiajs/cron";
import { articleRoutes } from "./routes/article";
import { adminRoutes } from "./routes/admin";
import { chatRoutes } from "./routes/chat";
import { chatThreadsRoutes } from "./routes/chat-threads";
import { webhookRoutes } from "./routes/webhooks";
import { bypassDetectionRoutes } from "./routes/bypass-detection";
import { gravityRoutes } from "./routes/gravity";
import { highlightsRoutes } from "./routes/highlights";
import { premiumRoutes } from "./routes/premium";
import { startMemoryMonitor, getCurrentMemory } from "../lib/memory-monitor";
import { startCacheStatsLogger, getAllCacheStats } from "../lib/memory-tracker";
import { checkErrorRateAndAlert } from "../lib/alerting";
import { configureFetchLimiter } from "../lib/article-concurrency";
import { env } from "./env";

startMemoryMonitor();
startCacheStatsLogger();
configureFetchLimiter({
  maxConcurrent: env.MAX_CONCURRENT_ARTICLE_FETCHES,
  slotTimeout: env.ARTICLE_FETCH_SLOT_TIMEOUT_MS,
});

// eslint-disable-next-line unused-imports/no-unused-vars
const app = new Elysia({ adapter: node() })
  .use(cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
    exposeHeaders: ["X-Usage-Remaining", "X-Usage-Limit", "X-Is-Premium", "X-Model"],
  }))
  // Security headers to prevent clickjacking and other attacks
  .onBeforeHandle(({ set }) => {
    set.headers["X-Frame-Options"] = "SAMEORIGIN";
    set.headers["Content-Security-Policy"] = "frame-ancestors 'self'";
    set.headers["X-Content-Type-Options"] = "nosniff";
    set.headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
  })
  .use(
    cron({
      name: "error-rate-alerting",
      pattern: "*/5 * * * *", // Every 5 minutes
      run: checkErrorRateAndAlert,
    })
  )
  .get("/", () => ({
    service: "smry-api",
    status: "running",
    docs: "Use /api/* endpoints or /health for status",
  }))
  .get("/health", ({ set }) => {
    const memory = getCurrentMemory();
    const caches = getAllCacheStats();
    const UNHEALTHY_RSS_MB = 1024; // 1GB

    if (memory.rss_mb > UNHEALTHY_RSS_MB) {
      set.status = 503;
      return {
        status: "unhealthy",
        reason: `RSS ${memory.rss_mb}MB exceeds ${UNHEALTHY_RSS_MB}MB threshold`,
        timestamp: new Date().toISOString(),
        memory: {
          heapUsedMb: memory.heap_used_mb,
          heapTotalMb: memory.heap_total_mb,
          rssMb: memory.rss_mb,
        },
        caches,
      };
    }

    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      memory: {
        heapUsedMb: memory.heap_used_mb,
        heapTotalMb: memory.heap_total_mb,
        rssMb: memory.rss_mb,
      },
      caches,
    };
  })
  .use(articleRoutes)
  .use(adminRoutes)
  .use(chatRoutes)
  .use(chatThreadsRoutes)
  .use(webhookRoutes)
  .use(bypassDetectionRoutes)
  .use(gravityRoutes)
  .use(highlightsRoutes)
  .use(premiumRoutes)
  // Deprecated endpoint stubs — return 410 Gone to signal permanent removal.
  // Stops 404 floods from old client code, cached service workers, and crawlers.
  // NOTE: /api/context and /api/px are ACTIVE ad endpoints (in gravityRoutes) — do NOT stub them here.
  .get("/api/adtrack", ({ set }) => { set.status = 410; return { status: "gone" }; })
  .post("/api/adtrack", ({ set }) => { set.status = 410; return { status: "gone" }; })
  .get("/api/gravity-ad", ({ set }) => { set.status = 410; return { status: "gone" }; })
  .get("/api/summarize", ({ set }) => { set.status = 410; return { status: "gone" }; })
  .get("/api/jina", ({ set }) => { set.status = 410; return { status: "gone" }; })
  .onError(({ code, error, set, request }) => {
    // Don't log 404s for common browser requests (favicon, etc)
    if (code === "NOT_FOUND") {
      const url = new URL(request.url);
      // Also silence old/removed endpoints from stale browser caches
      const silentPaths = ["/favicon.ico", "/robots.txt", "/_next", "/__nextjs", "/api/adtrack", "/api/gravity-ad", "/api/summarize", "/api/jina"];
      const isSilent = silentPaths.some(p => url.pathname.startsWith(p));
      if (!isSilent) {
        console.warn(`[elysia] 404: ${url.pathname}`);
      }
      set.status = 404;
      return { error: "Not found", type: "NOT_FOUND" };
    }
    if (code === "VALIDATION") {
      console.error(`[elysia] Validation error:`, error.message);
      set.status = 422;
      return { error: error.message, type: "VALIDATION_ERROR" };
    }
    console.error(`[elysia] Error ${code}:`, error);
    set.status = 500;
    return { error: "Internal server error", type: "INTERNAL_ERROR" };
  })
  .listen(env.API_PORT);

console.log(`🦊 Elysia API server running at http://localhost:${env.API_PORT}`);

export type App = typeof app;
