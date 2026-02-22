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
import { ttsRoutes } from "./routes/tts";
import { startMemoryMonitor, getCurrentMemory } from "../lib/memory-monitor";
import { startCacheStatsLogger, getAllCacheStats } from "../lib/memory-tracker";
import { checkErrorRateAndAlert } from "../lib/alerting";
import { configureFetchLimiter } from "../lib/article-concurrency";
import { configureTTSLimiter, getTTSSlotStats } from "../lib/tts-concurrency";
import { env } from "./env";

startMemoryMonitor();
startCacheStatsLogger();
configureFetchLimiter({
  maxConcurrent: env.MAX_CONCURRENT_ARTICLE_FETCHES,
  slotTimeout: env.ARTICLE_FETCH_SLOT_TIMEOUT_MS,
});
configureTTSLimiter({
  maxConcurrent: env.MAX_CONCURRENT_TTS ?? 20,
  maxPerUser: env.MAX_TTS_PER_USER ?? 2,
  slotTimeout: env.TTS_SLOT_TIMEOUT_MS ?? 15_000,
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
    set.headers["X-Frame-Options"] = "DENY";
    set.headers["Content-Security-Policy"] = "frame-ancestors 'none'";
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
      tts: getTTSSlotStats(),
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
  .use(ttsRoutes)
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
