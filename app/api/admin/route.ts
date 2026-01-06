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
  error_severity: string;
  error_count: number;
  latest_timestamp: string;
  // Upstream error context - which service actually failed
  upstream_hostname: string;
  upstream_status_code: number;
}

interface UpstreamBreakdown {
  upstream_hostname: string;
  upstream_status_code: number;
  error_count: number;
  affected_hostnames: number;
  sample_error_type: string;
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
  event_time: string;
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
  event_time: string;
  url: string;
  hostname: string;
  source: string;
  outcome: string;
  duration_ms: number;
  error_type: string;
  cache_hit: number;
}

interface EndpointStats {
  endpoint: string;
  total_requests: number;
  success_count: number;
  error_count: number;
  success_rate: number;
  avg_duration_ms: number;
  total_input_tokens: number;
  total_output_tokens: number;
}

interface HourlyEndpointTraffic {
  hour: string;
  endpoint: string;
  request_count: number;
  success_count: number;
  error_count: number;
}

interface UniversallyBrokenHostname {
  hostname: string;
  total_requests: number;
  sources_tried: number;
  sources_list: string;
  overall_success_rate: number;
  sample_url: string;
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

    // Always filter out empty hostnames
    conditions.push(`hostname != ''`);

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

    return conditions.join(" AND ");
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
      upstreamBreakdown,
      healthMetrics,
      realtimePopular,
      requestEvents,
      liveRequests,
      endpointStats,
      hourlyEndpointTraffic,
      universallyBroken,
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

      // 2. Which sources work for which sites (show all with at least 1 request)
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
        ORDER BY hostname, request_count DESC
      `),

      // 3. Hourly traffic pattern (filter empty hostnames for consistency)
      queryClickhouse<HourlyTraffic>(`
        SELECT
          formatDateTime(toStartOfHour(timestamp), '%Y-%m-%d %H:00') AS hour,
          count() AS request_count,
          countIf(outcome = 'success') AS success_count,
          countIf(outcome = 'error') AS error_count
        FROM request_events
        WHERE timestamp > now() - INTERVAL ${hours} HOUR
          AND hostname != ''
        GROUP BY hour
        ORDER BY hour
      `),

      // 4. Error breakdown by hostname and type - WITH ERROR MESSAGES AND UPSTREAM CONTEXT
      queryClickhouse<ErrorBreakdown>(`
        SELECT
          hostname,
          error_type,
          any(error_message) AS error_message,
          '' AS error_severity,
          count() AS error_count,
          formatDateTime(max(timestamp), '%Y-%m-%d %H:%i:%S') AS latest_timestamp,
          any(upstream_hostname) AS upstream_hostname,
          any(upstream_status_code) AS upstream_status_code
        FROM request_events
        WHERE timestamp > now() - INTERVAL ${hours} HOUR
          AND outcome = 'error'
          AND error_type != ''
        GROUP BY hostname, error_type
        ORDER BY error_count DESC
        LIMIT 100
      `),

      // 4b. Upstream service breakdown - which external services are causing errors
      queryClickhouse<UpstreamBreakdown>(`
        SELECT
          upstream_hostname,
          upstream_status_code,
          count() AS error_count,
          uniq(hostname) AS affected_hostnames,
          any(error_type) AS sample_error_type
        FROM request_events
        WHERE timestamp > now() - INTERVAL ${hours} HOUR
          AND outcome = 'error'
          AND upstream_hostname != ''
        GROUP BY upstream_hostname, upstream_status_code
        ORDER BY error_count DESC
        LIMIT 50
      `),

      // 5. Overall health metrics (filter empty hostnames to match other queries)
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
          AND hostname != ''
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
      // Note: ClickHouse uses %i for minutes, not %M (which is month name)
      queryClickhouse<RequestEvent>(`
        SELECT
          request_id,
          formatDateTime(timestamp, '%Y-%m-%d %H:%i:%S') AS event_time,
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
        WHERE ${buildWhereClause()}
        ORDER BY timestamp DESC
        LIMIT 200
      `),

      // 8. Live requests (last 60 seconds for live feed - also applies filters)
      // Note: ClickHouse uses %i for minutes, not %M (which is month name)
      queryClickhouse<LiveRequest>(`
        SELECT
          request_id,
          formatDateTime(timestamp, '%H:%i:%S') AS event_time,
          url,
          hostname,
          source,
          outcome,
          duration_ms,
          error_type,
          cache_hit
        FROM request_events
        WHERE ${buildWhereClause({ timeInterval: "60 SECOND" })}
        ORDER BY timestamp DESC
        LIMIT 50
      `),

      // 9. Endpoint statistics (article, summary, jina)
      queryClickhouse<EndpointStats>(`
        SELECT
          endpoint,
          count() AS total_requests,
          countIf(outcome = 'success') AS success_count,
          countIf(outcome = 'error') AS error_count,
          round(countIf(outcome = 'success') / count() * 100, 2) AS success_rate,
          round(avg(duration_ms)) AS avg_duration_ms,
          sum(input_tokens) AS total_input_tokens,
          sum(output_tokens) AS total_output_tokens
        FROM request_events
        WHERE timestamp > now() - INTERVAL ${hours} HOUR
          AND endpoint != ''
        GROUP BY endpoint
        ORDER BY total_requests DESC
      `),

      // 10. Hourly traffic by endpoint (for trends)
      queryClickhouse<HourlyEndpointTraffic>(`
        SELECT
          formatDateTime(toStartOfHour(timestamp), '%Y-%m-%d %H:00') AS hour,
          endpoint,
          count() AS request_count,
          countIf(outcome = 'success') AS success_count,
          countIf(outcome = 'error') AS error_count
        FROM request_events
        WHERE timestamp > now() - INTERVAL ${hours} HOUR
          AND endpoint != ''
        GROUP BY hour, endpoint
        ORDER BY hour, endpoint
      `),

      // 11. Universally broken hostnames - sites where ALL sources fail
      // Shows hostnames with 0% success rate across multiple sources
      queryClickhouse<UniversallyBrokenHostname>(`
        SELECT
          hostname,
          count() AS total_requests,
          uniq(source) AS sources_tried,
          arrayStringConcat(groupArray(DISTINCT source), ', ') AS sources_list,
          round(countIf(outcome = 'success') / count() * 100, 2) AS overall_success_rate,
          any(url) AS sample_url
        FROM request_events
        WHERE timestamp > now() - INTERVAL ${hours} HOUR
          AND hostname != ''
          AND source != ''
        GROUP BY hostname
        HAVING
          sources_tried >= 2
          AND overall_success_rate = 0
          AND total_requests >= 3
        ORDER BY total_requests DESC
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
      upstreamBreakdown,
      realtimePopular,
      requestEvents,
      liveRequests,
      endpointStats,
      hourlyEndpointTraffic,
      universallyBroken,
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
