/**
 * Admin Route - GET /api/admin
 */

import { Elysia, t } from "elysia";
import { queryClickhouse, getBufferStats } from "../../lib/clickhouse";

interface HostnameStats {
  hostname: string;
  total_requests: number;
  success_rate: number;
  error_count: number;
  avg_duration_ms: number;
}

interface HealthMetrics {
  total_requests_24h: number;
  success_rate_24h: number;
  cache_hit_rate_24h: number;
  avg_duration_ms_24h: number;
  p95_duration_ms_24h: number;
  avg_heap_mb: number;
  unique_hostnames_24h: number;
}

export const adminRoutes = new Elysia({ prefix: "/api" }).get(
  "/admin",
  async ({ query, set }) => {
    const timeRange = query.range || "24h";
    const hours = timeRange === "7d" ? 168 : timeRange === "1h" ? 1 : 24;

    const hostnameFilter = query.hostname || "";
    const sourceFilter = query.source || "";
    const outcomeFilter = query.outcome || "";
    const urlSearch = query.urlSearch || "";

    const hasFilters = !!(hostnameFilter || sourceFilter || outcomeFilter || urlSearch);

    try {
      const [hostnameStats, healthMetrics] = await Promise.all([
        queryClickhouse<HostnameStats>(`
          SELECT
            hostname,
            count() AS total_requests,
            round(countIf(outcome = 'success') / count() * 100, 2) AS success_rate,
            countIf(outcome = 'error') AS error_count,
            round(avg(duration_ms)) AS avg_duration_ms
          FROM request_events
          WHERE timestamp > now() - INTERVAL ${hours} HOUR AND hostname != ''
          GROUP BY hostname
          ORDER BY total_requests DESC
          LIMIT 200
        `),
        queryClickhouse<HealthMetrics>(`
          SELECT
            count() AS total_requests_24h,
            round(countIf(outcome = 'success') / count() * 100, 2) AS success_rate_24h,
            round(countIf(cache_hit = 1) / count() * 100, 2) AS cache_hit_rate_24h,
            round(avg(duration_ms)) AS avg_duration_ms_24h,
            round(quantile(0.95)(duration_ms)) AS p95_duration_ms_24h,
            round(avg(heap_used_mb)) AS avg_heap_mb,
            uniq(hostname) AS unique_hostnames_24h
          FROM request_events
          WHERE timestamp > now() - INTERVAL ${hours} HOUR AND hostname != ''
        `),
      ]);

      const bufferStats = getBufferStats();

      return {
        timeRange,
        generatedAt: new Date().toISOString(),
        bufferStats,
        filters: {
          hostname: hostnameFilter,
          source: sourceFilter,
          outcome: outcomeFilter,
          urlSearch,
          hasFilters,
        },
        health: healthMetrics[0] || {
          total_requests_24h: 0,
          success_rate_24h: 0,
          cache_hit_rate_24h: 0,
          avg_duration_ms_24h: 0,
          p95_duration_ms_24h: 0,
          avg_heap_mb: 0,
          unique_hostnames_24h: 0,
        },
        hostnameStats,
      };
    } catch (error) {
      console.error("[analytics] Query error:", error);
      set.status = 500;
      return {
        error: "Failed to fetch analytics",
        details: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
  {
    query: t.Object({
      range: t.Optional(t.Union([t.Literal("1h"), t.Literal("24h"), t.Literal("7d")])),
      hostname: t.Optional(t.String()),
      source: t.Optional(t.String()),
      outcome: t.Optional(t.String()),
      urlSearch: t.Optional(t.String()),
    }),
  }
);
