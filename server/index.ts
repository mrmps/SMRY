/**
 * Elysia API Server
 */

import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { articleRoutes } from "./routes/article";
import { adminRoutes } from "./routes/admin";
import { summaryRoutes } from "./routes/summary";
import { jinaRoutes } from "./routes/jina";
import { startMemoryMonitor, getCurrentMemory } from "../lib/memory-monitor";

startMemoryMonitor();

const app = new Elysia()
  .use(cors({ origin: process.env.CORS_ORIGIN || true, credentials: true }))
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
  .onError(({ code, error, set }) => {
    console.error(`[elysia] Error ${code}:`, error);
    if (code === "VALIDATION") {
      set.status = 422;
      return { error: error.message, type: "VALIDATION_ERROR" };
    }
    if (code === "NOT_FOUND") {
      set.status = 404;
      return { error: "Not found", type: "NOT_FOUND" };
    }
    set.status = 500;
    return { error: "Internal server error", type: "INTERNAL_ERROR" };
  })
  .listen(process.env.API_PORT || 3001);

console.log(`🦊 Elysia API server running at http://localhost:${app.server?.port}`);

export type App = typeof app;
export default app;
