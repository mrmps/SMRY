import { NextRequest, NextResponse } from "next/server";
import { queryClickhouse, getBufferStats } from "@/lib/clickhouse";

// Dashboard data types
interface HostnameStats {
  hostname: string;
  total_requests: number;
  success_rate: number;
  error_count: number;
  avg_duration_ms: number;
}

interface SourceEffectiveness {
  hostname: string;
  source: string;
  success_rate: number;
  request_count: number;
}

interface HourlyTraffic {
  hour: string;
  request_count: number;
  success_count: number;
  error_count: number;
}

interface ErrorBreakdown {
  hostname: string;
  error_type: string;
  error_message: string;
  error_count: number;
  latest_timestamp: string;
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

interface PopularPage {
  url: string;
  hostname: string;
  count: number;
}

interface RequestEvent {
  request_id: string;
  timestamp: string;
  url: string;
  hostname: string;
  source: string;
  outcome: string;
  status_code: number;
  error_type: string;
  error_message: string;
  duration_ms: number;
  fetch_ms: number;
  cache_lookup_ms: number;
  cache_save_ms: number;
  cache_hit: number;
  cache_status: string;
  article_length: number;
  article_title: string;
}

interface LiveRequest {
  request_id: string;
  timestamp: string;
  url: string;
  hostname: string;
  source: string;
  outcome: string;
  duration_ms: number;
  error_type: string;
  cache_hit: number;
}

export async function GET(request: NextRequest) {
  // Parse time range
  const timeRange = request.nextUrl.searchParams.get("range") || "24h";
  const hours = timeRange === "7d" ? 168 : timeRange === "1h" ? 1 : 24;

  // Parse filters
  const hostnameFilter = request.nextUrl.searchParams.get("hostname") || "";
  const sourceFilter = request.nextUrl.searchParams.get("source") || "";
  const outcomeFilter = request.nextUrl.searchParams.get("outcome") || "";
  const urlSearch = request.nextUrl.searchParams.get("urlSearch") || "";

  // Build WHERE clause for filtered queries
  const buildWhereClause = (options: {
    timeInterval?: string;
    includeFilters?: boolean;
  } = {}) => {
    const { timeInterval = `${hours} HOUR`, includeFilters = true } = options;
    const conditions: string[] = [];

    // Always include time filter
    conditions.push(`timestamp > now() - INTERVAL ${timeInterval}`);

    if (includeFilters) {
      if (hostnameFilter) {
        conditions.push(`hostname = '${hostnameFilter.replace(/'/g, "''")}'`);
      }
      if (sourceFilter) {
        conditions.push(`source = '${sourceFilter.replace(/'/g, "''")}'`);
      }
      if (outcomeFilter) {
        conditions.push(`outcome = '${outcomeFilter.replace(/'/g, "''")}'`);
      }
      if (urlSearch) {
        conditions.push(`url LIKE '%${urlSearch.replace(/'/g, "''").replace(/%/g, "\\%")}%'`);
      }
    }

    return `WHERE ${conditions.join(" AND ")}`;
  };

  // Check if any filters are active
  const hasFilters = !!(hostnameFilter || sourceFilter || outcomeFilter || urlSearch);

  try {
    // Run all queries in parallel for performance
    const [
      hostnameStats,
      sourceEffectiveness,
      hourlyTraffic,
      errorBreakdown,
      healthMetrics,
      realtimePopular,
      requestEvents,
      liveRequests,
    ] = await Promise.all([
      // 1. Which sites consistently error (top 50 by volume)
      queryClickhouse<HostnameStats>(`
        SELECT
          hostname,
          count() AS total_requests,
          round(countIf(outcome = 'success') / count() * 100, 2) AS success_rate,
          countIf(outcome = 'error') AS error_count,
          round(avg(duration_ms)) AS avg_duration_ms
        FROM request_events
        WHERE timestamp > now() - INTERVAL ${hours} HOUR
          AND hostname != ''
        GROUP BY hostname
        ORDER BY total_requests DESC
        LIMIT 50
      `),

      // 2. Which sources work for which sites (min 3 requests for significance - reduced from 5)
      queryClickhouse<SourceEffectiveness>(`
        SELECT
          hostname,
          source,
          round(countIf(outcome = 'success') / count() * 100, 2) AS success_rate,
          count() AS request_count
        FROM request_events
        WHERE timestamp > now() - INTERVAL ${hours} HOUR
          AND hostname != ''
          AND source != ''
        GROUP BY hostname, source
        HAVING request_count >= 3
        ORDER BY hostname, success_rate DESC
      `),

      // 3. Hourly traffic pattern
      queryClickhouse<HourlyTraffic>(`
        SELECT
          formatDateTime(toStartOfHour(timestamp), '%Y-%m-%d %H:00') AS hour,
          count() AS request_count,
          countIf(outcome = 'success') AS success_count,
          countIf(outcome = 'error') AS error_count
        FROM request_events
        WHERE timestamp > now() - INTERVAL ${hours} HOUR
        GROUP BY hour
        ORDER BY hour
      `),

      // 4. Error breakdown by hostname and type - NOW WITH ERROR MESSAGES
      queryClickhouse<ErrorBreakdown>(`
        SELECT
          hostname,
          error_type,
          any(error_message) AS error_message,
          count() AS error_count,
          max(timestamp) AS latest_timestamp
        FROM request_events
        WHERE timestamp > now() - INTERVAL ${hours} HOUR
          AND outcome = 'error'
          AND error_type != ''
        GROUP BY hostname, error_type
        ORDER BY error_count DESC
        LIMIT 100
      `),

      // 5. Overall health metrics
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
        WHERE timestamp > now() - INTERVAL ${hours} HOUR
      `),

      // 6. Real-time popular pages (last 5 minutes)
      queryClickhouse<PopularPage>(`
        SELECT
          url,
          hostname,
          count() AS count
        FROM request_events
        WHERE timestamp > now() - INTERVAL 5 MINUTE
          AND url != ''
        GROUP BY url, hostname
        ORDER BY count DESC
        LIMIT 20
      `),

      // 7. Request explorer - individual requests for debugging (applies filters)
      queryClickhouse<RequestEvent>(`
        SELECT
          request_id,
          formatDateTime(timestamp, '%Y-%m-%d %H:%M:%S') AS timestamp,
          url,
          hostname,
          source,
          outcome,
          status_code,
          error_type,
          error_message,
          duration_ms,
          fetch_ms,
          cache_lookup_ms,
          cache_save_ms,
          cache_hit,
          cache_status,
          article_length,
          article_title
        FROM request_events
        ${buildWhereClause({ includeFilters: true })}
          AND hostname != ''
        ORDER BY timestamp DESC
        LIMIT 200
      `),

      // 8. Live requests (last 60 seconds for live feed - also applies filters)
      queryClickhouse<LiveRequest>(`
        SELECT
          request_id,
          formatDateTime(timestamp, '%H:%M:%S') AS timestamp,
          url,
          hostname,
          source,
          outcome,
          duration_ms,
          error_type,
          cache_hit
        FROM request_events
        ${buildWhereClause({ timeInterval: '60 SECOND', includeFilters: true })}
          AND hostname != ''
        ORDER BY timestamp DESC
        LIMIT 50
      `),
    ]);

    // Get buffer stats for monitoring
    const bufferStats = getBufferStats();

    // Get list of unique sources for filter dropdown
    const sources = Array.from(new Set(requestEvents.map(e => e.source).filter(Boolean)));
    const hostnames = Array.from(new Set(requestEvents.map(e => e.hostname).filter(Boolean))).slice(0, 50);

    return NextResponse.json({
      timeRange,
      generatedAt: new Date().toISOString(),
      bufferStats,
      filters: {
        hostname: hostnameFilter,
        source: sourceFilter,
        outcome: outcomeFilter,
        urlSearch,
        hasFilters,
        availableSources: sources,
        availableHostnames: hostnames,
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
      sourceEffectiveness,
      hourlyTraffic,
      errorBreakdown,
      realtimePopular,
      requestEvents,
      liveRequests,
    });
  } catch (error) {
    console.error("[analytics] Query error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch analytics",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
