/**
 * Elysia API Server
 */

import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { cron } from "@elysiajs/cron";
import { articleRoutes } from "./routes/article";
import { adminRoutes } from "./routes/admin";
import { summaryRoutes } from "./routes/summary";
import { jinaRoutes } from "./routes/jina";
import { webhookRoutes } from "./routes/webhooks";
import { bypassDetectionRoutes } from "./routes/bypass-detection";
import { gravityRoutes } from "./routes/gravity";
import { adtrackRoutes } from "./routes/adtrack";
import { startMemoryMonitor, getCurrentMemory } from "../lib/memory-monitor";
import { checkErrorRateAndAlert } from "../lib/alerting";
import { env } from "./env";

startMemoryMonitor();

const app = new Elysia()
  .use(cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
    exposeHeaders: ["X-Usage-Remaining", "X-Usage-Limit", "X-Is-Premium", "X-Model"],
  }))
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
  .get("/health", () => {
    const memory = getCurrentMemory();
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      memory: {
        heapUsedMb: memory.heap_used_mb,
        heapTotalMb: memory.heap_total_mb,
        rssMb: memory.rss_mb,
      },
    };
  })
  .use(articleRoutes)
  .use(adminRoutes)
  .use(summaryRoutes)
  .use(jinaRoutes)
  .use(webhookRoutes)
  .use(bypassDetectionRoutes)
  .use(gravityRoutes)
  .use(adtrackRoutes)
  .onError(({ code, error, set, request }) => {
    // Don't log 404s for common browser requests (favicon, etc)
    if (code === "NOT_FOUND") {
      const url = new URL(request.url);
      const silentPaths = ["/favicon.ico", "/robots.txt", "/_next", "/__nextjs"];
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

console.log(`🦊 Elysia API server running at http://localhost:${app.server?.port}`);

export type App = typeof app;
