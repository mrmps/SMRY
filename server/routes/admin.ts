/**
 * Admin Route - GET /api/admin
 * Full analytics dashboard with 12 queries
 * Protected by ADMIN_SECRET token
 */

import { Elysia, t } from "elysia";
import { timingSafeEqual } from "crypto";
import { queryClickhouse, getBufferStats } from "../../lib/clickhouse";
import { env } from "../env";

/**
 * Timing-safe comparison to prevent timing attacks
 */
function verifyAdminSecret(provided: string): boolean {
  const expected = env.ADMIN_SECRET;
  if (provided.length !== expected.length) {
    // Still do a comparison to maintain constant time
    timingSafeEqual(Buffer.from(expected), Buffer.from(expected));
    return false;
  }
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

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

interface SourceErrorRateTimeSeries {
  time_bucket: string;
  source: string;
  total_requests: number;
  error_count: number;
  error_rate: number;
}

// =============================================================================
// Ad Analytics Types
// =============================================================================

interface AdHealthMetrics {
  total_requests: number;
  filled_count: number;
  no_fill_count: number;
  premium_count: number;
  error_count: number;
  timeout_count: number;
  fill_rate: number;
  avg_duration_ms: number;
  unique_sessions: number;
  unique_brands: number;
}

interface AdStatusBreakdown {
  status: string;
  count: number;
  percentage: number;
  avg_duration_ms: number;
}

interface AdHostnameStats {
  hostname: string;
  total_requests: number;
  filled_count: number;
  fill_rate: number;
  top_brand: string;
}

interface AdDeviceStats {
  device_type: string;
  os: string;
  browser: string;
  total_requests: number;
  filled_count: number;
  fill_rate: number;
}

interface AdBrandStats {
  brand_name: string;
  impressions: number;
  unique_hostnames: number;
  unique_sessions: number;
  avg_article_length: number;
}

interface AdHourlyTraffic {
  hour: string;
  total_requests: number;
  filled_count: number;
  no_fill_count: number;
  fill_rate: number;
}

interface AdErrorBreakdown {
  status: string;
  gravity_status_code: number;
  error_message: string;
  count: number;
  latest_timestamp: string;
}

interface AdRecentEvent {
  event_id: string;
  event_time: string;
  hostname: string;
  article_title: string;
  status: string;
  brand_name: string;
  duration_ms: number;
  device_type: string;
}

// New CTR and funnel analytics types
interface AdCTRByBrand {
  brand_name: string;
  impressions: number;
  clicks: number;
  ctr: number;
}

interface AdHourlyFunnel {
  hour: string;
  requests: number;
  impressions: number;
  clicks: number;
  dismissals: number;
}

interface AdDismissRateByDevice {
  device_type: string;
  impressions: number;
  dismissals: number;
  dismiss_rate: number;
}

// Enhanced granular ad analytics types (some reserved for future use)
interface _AdRevenueMetrics {
  total_impressions: number;
  total_clicks: number;
  estimated_revenue: number;
  avg_cpm: number;
  avg_cpc: number;
}

interface AdPerformanceByHour {
  hour_of_day: number;
  impressions: number;
  clicks: number;
  ctr: number;
  fill_rate: number;
}

interface AdPerformanceByDay {
  day_of_week: number;
  day_name: string;
  impressions: number;
  clicks: number;
  ctr: number;
}

interface AdBrandPerformance {
  brand_name: string;
  impressions: number;
  clicks: number;
  dismissals: number;
  ctr: number;
  dismiss_rate: number;
  avg_time_to_click_ms: number;
  unique_sessions: number;
}

interface AdDeviceBreakdown {
  device_type: string;
  impressions: number;
  clicks: number;
  dismissals: number;
  ctr: number;
  dismiss_rate: number;
  fill_rate: number;
}

interface AdBrowserStats {
  browser: string;
  impressions: number;
  clicks: number;
  ctr: number;
}

interface AdOSStats {
  os: string;
  impressions: number;
  clicks: number;
  ctr: number;
}

interface AdHostnamePerformance {
  hostname: string;
  requests: number;
  impressions: number;
  clicks: number;
  ctr: number;
  fill_rate: number;
  top_brand: string;
}

interface AdContentCorrelation {
  article_length_bucket: string;
  impressions: number;
  clicks: number;
  ctr: number;
}

interface AdSessionDepth {
  session_ad_count: number;
  session_count: number;
  total_impressions: number;
  total_clicks: number;
  avg_ctr: number;
}

interface _AdTimezone {
  timezone: string;
  impressions: number;
  clicks: number;
  ctr: number;
}

interface AdConversionFunnel {
  stage: string;
  count: number;
  rate_from_previous: number;
}

// Bot detection - identify filled requests without device info (likely bots/curl)
interface AdBotDetection {
  category: string;
  filled_count: number;
  impression_count: number;
  impression_rate: number;
  unique_sessions: number;
}

// CTR by hour of day with device breakdown
interface AdCTRByHourDevice {
  hour_of_day: number;
  device_type: string;
  impressions: number;
  clicks: number;
  ctr: number;
  fill_rate: number;
}

// Filled vs Impression gap analysis
interface AdFilledImpressionGap {
  device_type: string;
  browser: string;
  filled_count: number;
  impression_count: number;
  gap_count: number;
  impression_rate: number;
}

export const adminRoutes = new Elysia({ prefix: "/api" }).get(
  "/admin",
  async ({ query, set, headers }) => {
    // Auth check - require Bearer token
    const authHeader = headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token || !verifyAdminSecret(token)) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    // Parse time range - support granular periods
    const timeRange = query.range || "24h";
    const timeRangeMinutes: Record<string, number> = {
      "5m": 5,
      "30m": 30,
      "1h": 60,
      "6h": 360,
      "12h": 720,
      "24h": 1440,
      "7d": 10080,
    };
    const minutes = timeRangeMinutes[timeRange] || 1440;
    const hours = Math.ceil(minutes / 60);

    // Ad-specific filters
    const adDeviceFilter = query.adDevice || ""; // "mobile", "tablet", "desktop"

    // Parse filters
    const hostnameFilter = query.hostname || "";
    const sourceFilter = query.source || "";
    const outcomeFilter = query.outcome || "";
    const urlSearch = query.urlSearch || "";

    // Build WHERE clause for filtered queries
    const buildWhereClause = (options: {
      timeInterval?: string;
      includeFilters?: boolean;
    } = {}): string => {
      const { timeInterval = `${hours} HOUR`, includeFilters = true } = options;
      const conditions: string[] = [];

      // Always include time filter
      conditions.push(`timestamp > now() - INTERVAL ${timeInterval}`);

      // Always filter out empty hostnames
      conditions.push(`hostname != ''`);

      if (includeFilters) {
        // Escape backslashes first, then single quotes (order matters for SQL injection prevention)
        const escapeForClickhouse = (str: string) => str.replace(/\\/g, "\\\\").replace(/'/g, "''");
        // For LIKE patterns, also escape % and _ wildcards (after backslash escaping)
        const escapeForClickhouseLike = (str: string) =>
          escapeForClickhouse(str).replace(/%/g, "\\%").replace(/_/g, "\\_");
        if (hostnameFilter) {
          conditions.push(`hostname = '${escapeForClickhouse(hostnameFilter)}'`);
        }
        if (sourceFilter) {
          conditions.push(`source = '${escapeForClickhouse(sourceFilter)}'`);
        }
        if (outcomeFilter) {
          conditions.push(`outcome = '${escapeForClickhouse(outcomeFilter)}'`);
        }
        if (urlSearch) {
          conditions.push(`url LIKE '%${escapeForClickhouseLike(urlSearch)}%'`);
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
        sourceErrorRateTimeSeries,
        // Ad analytics
        adHealthMetrics,
        adStatusBreakdown,
        adHostnameStats,
        adDeviceStats,
        adBrandStats,
        adHourlyTraffic,
        adErrorBreakdown,
        adRecentEvents,
        // CTR and funnel analytics
        adCTRByBrand,
        adHourlyFunnel,
        adDismissRateByDevice,
        // Enhanced granular ad analytics
        adPerformanceByHour,
        adPerformanceByDay,
        adBrandPerformance,
        adDeviceBreakdown,
        adBrowserStats,
        adOSStats,
        adHostnamePerformance,
        adContentCorrelation,
        adSessionDepth,
        adConversionFunnel,
        adBotDetection,
        adCTRByHourDevice,
        adFilledImpressionGap,
      ] = await Promise.all([
        // 1. Which sites consistently error (top 200 by volume)
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
          LIMIT 200
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

        // 3. Hourly traffic pattern
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

        // 4. Error breakdown by hostname and type with error messages and upstream context
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

        // 9. Endpoint statistics (article, summary)
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

        // 12. Source error rates over time - for observability/regression detection
        queryClickhouse<SourceErrorRateTimeSeries>(`
          SELECT
            formatDateTime(toStartOfFifteenMinutes(timestamp), '%Y-%m-%d %H:%i') AS time_bucket,
            source,
            count() AS total_requests,
            countIf(outcome = 'error') AS error_count,
            round(countIf(outcome = 'error') / count() * 100, 2) AS error_rate
          FROM request_events
          WHERE timestamp > now() - INTERVAL ${hours} HOUR
            AND hostname != ''
            AND source != ''
          GROUP BY time_bucket, source
          ORDER BY time_bucket, source
        `),

        // =============================================================================
        // Ad Analytics Queries (from ad_events table)
        // =============================================================================

        // 13. Ad health metrics - overall fill rate and performance (minute-based + device filter)
        queryClickhouse<AdHealthMetrics>(`
          SELECT
            count() AS total_requests,
            countIf(status = 'filled') AS filled_count,
            countIf(status = 'no_fill') AS no_fill_count,
            countIf(status = 'premium_user') AS premium_count,
            countIf(status = 'error' OR status = 'gravity_error') AS error_count,
            countIf(status = 'timeout') AS timeout_count,
            round(countIf(status = 'filled') / countIf(status != 'premium_user') * 100, 2) AS fill_rate,
            round(avg(duration_ms)) AS avg_duration_ms,
            uniq(session_id) AS unique_sessions,
            uniqIf(brand_name, brand_name != '') AS unique_brands
          FROM ad_events
          WHERE timestamp > now() - INTERVAL ${minutes} MINUTE
            AND event_type = 'request'
            ${adDeviceFilter ? `AND device_type = '${adDeviceFilter}'` : ''}
        `).catch(() => [] as AdHealthMetrics[]),

        // 14. Ad status breakdown - only count request events
        queryClickhouse<AdStatusBreakdown>(`
          SELECT
            status,
            count() AS count,
            round(count() / (SELECT count() FROM ad_events WHERE timestamp > now() - INTERVAL ${hours} HOUR AND event_type = 'request') * 100, 2) AS percentage,
            round(avg(duration_ms)) AS avg_duration_ms
          FROM ad_events
          WHERE timestamp > now() - INTERVAL ${hours} HOUR
            AND event_type = 'request'
          GROUP BY status
          ORDER BY count DESC
        `).catch(() => [] as AdStatusBreakdown[]),

        // 15. Ad fill rate by hostname - only count request events
        queryClickhouse<AdHostnameStats>(`
          SELECT
            hostname,
            count() AS total_requests,
            countIf(status = 'filled') AS filled_count,
            round(countIf(status = 'filled') / countIf(status != 'premium_user') * 100, 2) AS fill_rate,
            anyIf(brand_name, brand_name != '') AS top_brand
          FROM ad_events
          WHERE timestamp > now() - INTERVAL ${hours} HOUR
            AND hostname != ''
            AND event_type = 'request'
          GROUP BY hostname
          HAVING countIf(status != 'premium_user') > 0
          ORDER BY total_requests DESC
          LIMIT 100
        `).catch(() => [] as AdHostnameStats[]),

        // 16. Ad fill rate by device/browser/OS - only count request events
        queryClickhouse<AdDeviceStats>(`
          SELECT
            device_type,
            os,
            browser,
            count() AS total_requests,
            countIf(status = 'filled') AS filled_count,
            round(countIf(status = 'filled') / countIf(status != 'premium_user') * 100, 2) AS fill_rate
          FROM ad_events
          WHERE timestamp > now() - INTERVAL ${hours} HOUR
            AND device_type != ''
            AND event_type = 'request'
          GROUP BY device_type, os, browser
          HAVING countIf(status != 'premium_user') > 0
          ORDER BY total_requests DESC
          LIMIT 50
        `).catch(() => [] as AdDeviceStats[]),

        // 17. Top brands by impressions
        queryClickhouse<AdBrandStats>(`
          SELECT
            brand_name,
            count() AS impressions,
            uniq(hostname) AS unique_hostnames,
            uniq(session_id) AS unique_sessions,
            round(avg(article_content_length)) AS avg_article_length
          FROM ad_events
          WHERE timestamp > now() - INTERVAL ${hours} HOUR
            AND status = 'filled'
            AND brand_name != ''
          GROUP BY brand_name
          ORDER BY impressions DESC
          LIMIT 50
        `).catch(() => [] as AdBrandStats[]),

        // 18. Hourly ad traffic - only count request events
        queryClickhouse<AdHourlyTraffic>(`
          SELECT
            formatDateTime(toStartOfHour(timestamp), '%Y-%m-%d %H:00') AS hour,
            count() AS total_requests,
            countIf(status = 'filled') AS filled_count,
            countIf(status = 'no_fill') AS no_fill_count,
            round(countIf(status = 'filled') / countIf(status != 'premium_user') * 100, 2) AS fill_rate
          FROM ad_events
          WHERE timestamp > now() - INTERVAL ${hours} HOUR
            AND event_type = 'request'
          GROUP BY hour
          ORDER BY hour
        `).catch(() => [] as AdHourlyTraffic[]),

        // 19. Ad error breakdown
        queryClickhouse<AdErrorBreakdown>(`
          SELECT
            status,
            gravity_status_code,
            any(error_message) AS error_message,
            count() AS count,
            formatDateTime(max(timestamp), '%Y-%m-%d %H:%i:%S') AS latest_timestamp
          FROM ad_events
          WHERE timestamp > now() - INTERVAL ${hours} HOUR
            AND status IN ('error', 'gravity_error', 'timeout')
          GROUP BY status, gravity_status_code
          ORDER BY count DESC
          LIMIT 50
        `).catch(() => [] as AdErrorBreakdown[]),

        // 20. Recent ad events (for live debugging)
        queryClickhouse<AdRecentEvent>(`
          SELECT
            event_id,
            formatDateTime(timestamp, '%Y-%m-%d %H:%i:%S') AS event_time,
            hostname,
            article_title,
            status,
            brand_name,
            duration_ms,
            device_type
          FROM ad_events
          WHERE timestamp > now() - INTERVAL 1 HOUR
          ORDER BY timestamp DESC
          LIMIT 100
        `).catch(() => [] as AdRecentEvent[]),

        // 21. CTR by Brand - click-through rate for each advertiser (minute-based + device filter)
        queryClickhouse<AdCTRByBrand>(`
          SELECT
            brand_name,
            countIf(event_type = 'impression') AS impressions,
            countIf(event_type = 'click') AS clicks,
            round(countIf(event_type = 'click') / countIf(event_type = 'impression') * 100, 2) AS ctr
          FROM ad_events
          WHERE timestamp > now() - INTERVAL ${minutes} MINUTE
            AND event_type IN ('impression', 'click')
            AND brand_name != ''
            ${adDeviceFilter ? `AND device_type = '${adDeviceFilter}'` : ''}
          GROUP BY brand_name
          HAVING impressions > 0
          ORDER BY impressions DESC
          LIMIT 50
        `).catch(() => [] as AdCTRByBrand[]),

        // 22. Funnel by time bucket - adapts granularity based on time range
        // <1h: 5-minute buckets, <6h: 15-minute buckets, <24h: hourly, else: daily
        queryClickhouse<AdHourlyFunnel>(`
          SELECT
            ${minutes <= 60
              ? `formatDateTime(toStartOfFiveMinutes(timestamp), '%Y-%m-%d %H:%i') AS hour`
              : minutes <= 360
                ? `formatDateTime(toStartOfFifteenMinutes(timestamp), '%Y-%m-%d %H:%i') AS hour`
                : minutes <= 1440
                  ? `formatDateTime(toStartOfHour(timestamp), '%Y-%m-%d %H:00') AS hour`
                  : `formatDateTime(toStartOfDay(timestamp), '%Y-%m-%d') AS hour`
            },
            countIf(event_type = 'request' AND status = 'filled') AS requests,
            countIf(event_type = 'impression') AS impressions,
            countIf(event_type = 'click') AS clicks,
            countIf(event_type = 'dismiss') AS dismissals
          FROM ad_events
          WHERE timestamp > now() - INTERVAL ${minutes} MINUTE
            ${adDeviceFilter ? `AND device_type = '${adDeviceFilter}'` : ''}
          GROUP BY hour
          ORDER BY hour
        `).catch(() => [] as AdHourlyFunnel[]),

        // 23. Dismiss Rate by Device - see which devices dismiss ads most
        queryClickhouse<AdDismissRateByDevice>(`
          SELECT
            device_type,
            countIf(event_type = 'impression') AS impressions,
            countIf(event_type = 'dismiss') AS dismissals,
            round(countIf(event_type = 'dismiss') / countIf(event_type = 'impression') * 100, 2) AS dismiss_rate
          FROM ad_events
          WHERE timestamp > now() - INTERVAL ${hours} HOUR
            AND device_type != ''
          GROUP BY device_type
          HAVING impressions > 0
          ORDER BY impressions DESC
        `).catch(() => [] as AdDismissRateByDevice[]),

        // =============================================================================
        // Enhanced Granular Ad Analytics
        // =============================================================================

        // 24. Performance by Hour of Day - identify best performing hours
        queryClickhouse<AdPerformanceByHour>(`
          SELECT
            toHour(timestamp) AS hour_of_day,
            countIf(event_type = 'impression') AS impressions,
            countIf(event_type = 'click') AS clicks,
            round(countIf(event_type = 'click') / countIf(event_type = 'impression') * 100, 2) AS ctr,
            round(countIf(event_type = 'request' AND status = 'filled') /
                  countIf(event_type = 'request' AND status != 'premium_user') * 100, 2) AS fill_rate
          FROM ad_events
          WHERE timestamp > now() - INTERVAL ${hours} HOUR
          GROUP BY hour_of_day
          HAVING countIf(event_type = 'impression') > 0
          ORDER BY hour_of_day
        `).catch(() => [] as AdPerformanceByHour[]),

        // 25. Performance by Day of Week
        queryClickhouse<AdPerformanceByDay>(`
          SELECT
            toDayOfWeek(timestamp) AS day_of_week,
            CASE toDayOfWeek(timestamp)
              WHEN 1 THEN 'Monday'
              WHEN 2 THEN 'Tuesday'
              WHEN 3 THEN 'Wednesday'
              WHEN 4 THEN 'Thursday'
              WHEN 5 THEN 'Friday'
              WHEN 6 THEN 'Saturday'
              WHEN 7 THEN 'Sunday'
            END AS day_name,
            countIf(event_type = 'impression') AS impressions,
            countIf(event_type = 'click') AS clicks,
            round(countIf(event_type = 'click') / countIf(event_type = 'impression') * 100, 2) AS ctr
          FROM ad_events
          WHERE timestamp > now() - INTERVAL ${hours} HOUR
          GROUP BY day_of_week, day_name
          HAVING countIf(event_type = 'impression') > 0
          ORDER BY day_of_week
        `).catch(() => [] as AdPerformanceByDay[]),

        // 26. Enhanced Brand Performance with engagement metrics
        queryClickhouse<AdBrandPerformance>(`
          SELECT
            brand_name,
            countIf(event_type = 'impression') AS impressions,
            countIf(event_type = 'click') AS clicks,
            countIf(event_type = 'dismiss') AS dismissals,
            round(countIf(event_type = 'click') / countIf(event_type = 'impression') * 100, 2) AS ctr,
            round(countIf(event_type = 'dismiss') / countIf(event_type = 'impression') * 100, 2) AS dismiss_rate,
            round(avgIf(duration_ms, event_type = 'click' AND duration_ms > 0)) AS avg_time_to_click_ms,
            uniq(session_id) AS unique_sessions
          FROM ad_events
          WHERE timestamp > now() - INTERVAL ${hours} HOUR
            AND brand_name != ''
          GROUP BY brand_name
          HAVING countIf(event_type = 'impression') > 0
          ORDER BY impressions DESC
          LIMIT 25
        `).catch(() => [] as AdBrandPerformance[]),

        // 27. Detailed Device Breakdown (uses minute-based time + device filter)
        queryClickhouse<AdDeviceBreakdown>(`
          SELECT
            device_type,
            countIf(event_type = 'impression') AS impressions,
            countIf(event_type = 'click') AS clicks,
            countIf(event_type = 'dismiss') AS dismissals,
            round(countIf(event_type = 'click') / countIf(event_type = 'impression') * 100, 2) AS ctr,
            round(countIf(event_type = 'dismiss') / countIf(event_type = 'impression') * 100, 2) AS dismiss_rate,
            round(countIf(event_type = 'request' AND status = 'filled') /
                  countIf(event_type = 'request' AND status != 'premium_user') * 100, 2) AS fill_rate
          FROM ad_events
          WHERE timestamp > now() - INTERVAL ${minutes} MINUTE
            AND device_type != ''
            ${adDeviceFilter ? `AND device_type = '${adDeviceFilter}'` : ''}
          GROUP BY device_type
          HAVING countIf(event_type = 'impression') > 0
          ORDER BY impressions DESC
        `).catch(() => [] as AdDeviceBreakdown[]),

        // 28. Browser Performance
        queryClickhouse<AdBrowserStats>(`
          SELECT
            browser,
            countIf(event_type = 'impression') AS impressions,
            countIf(event_type = 'click') AS clicks,
            round(countIf(event_type = 'click') / countIf(event_type = 'impression') * 100, 2) AS ctr
          FROM ad_events
          WHERE timestamp > now() - INTERVAL ${hours} HOUR
            AND browser != ''
          GROUP BY browser
          HAVING countIf(event_type = 'impression') > 0
          ORDER BY impressions DESC
          LIMIT 10
        `).catch(() => [] as AdBrowserStats[]),

        // 29. OS Performance
        queryClickhouse<AdOSStats>(`
          SELECT
            os,
            countIf(event_type = 'impression') AS impressions,
            countIf(event_type = 'click') AS clicks,
            round(countIf(event_type = 'click') / countIf(event_type = 'impression') * 100, 2) AS ctr
          FROM ad_events
          WHERE timestamp > now() - INTERVAL ${hours} HOUR
            AND os != ''
          GROUP BY os
          HAVING countIf(event_type = 'impression') > 0
          ORDER BY impressions DESC
          LIMIT 10
        `).catch(() => [] as AdOSStats[]),

        // 30. Hostname Performance with full funnel
        queryClickhouse<AdHostnamePerformance>(`
          SELECT
            hostname,
            countIf(event_type = 'request') AS requests,
            countIf(event_type = 'impression') AS impressions,
            countIf(event_type = 'click') AS clicks,
            round(if(countIf(event_type = 'impression') > 0, countIf(event_type = 'click') / countIf(event_type = 'impression') * 100, 0), 2) AS ctr,
            round(if(countIf(event_type = 'request' AND status != 'premium_user') > 0, countIf(event_type = 'request' AND status = 'filled') /
                  countIf(event_type = 'request' AND status != 'premium_user') * 100, 0), 2) AS fill_rate,
            anyIf(brand_name, brand_name != '' AND event_type = 'impression') AS top_brand
          FROM ad_events
          WHERE timestamp > now() - INTERVAL ${hours} HOUR
            AND hostname != ''
          GROUP BY hostname
          HAVING countIf(event_type = 'request') > 0
          ORDER BY requests DESC
          LIMIT 50
        `).catch(() => [] as AdHostnamePerformance[]),

        // 31. Content Length Correlation - do longer articles perform better?
        queryClickhouse<AdContentCorrelation>(`
          SELECT
            CASE
              WHEN article_content_length < 500 THEN '< 500 chars'
              WHEN article_content_length < 1500 THEN '500-1.5k chars'
              WHEN article_content_length < 3000 THEN '1.5k-3k chars'
              WHEN article_content_length < 5000 THEN '3k-5k chars'
              ELSE '5k+ chars'
            END AS article_length_bucket,
            countIf(event_type = 'impression') AS impressions,
            countIf(event_type = 'click') AS clicks,
            round(countIf(event_type = 'click') / countIf(event_type = 'impression') * 100, 2) AS ctr
          FROM ad_events
          WHERE timestamp > now() - INTERVAL ${hours} HOUR
            AND article_content_length > 0
          GROUP BY article_length_bucket
          HAVING countIf(event_type = 'impression') > 0
          ORDER BY
            CASE article_length_bucket
              WHEN '< 500 chars' THEN 1
              WHEN '500-1.5k chars' THEN 2
              WHEN '1.5k-3k chars' THEN 3
              WHEN '3k-5k chars' THEN 4
              ELSE 5
            END
        `).catch(() => [] as AdContentCorrelation[]),

        // 32. Session Depth Analysis - do users who see more ads click more?
        queryClickhouse<AdSessionDepth>(`
          SELECT
            session_ad_count,
            count() AS session_count,
            sum(impressions) AS total_impressions,
            sum(clicks) AS total_clicks,
            round(if(sum(impressions) > 0, sum(clicks) / sum(impressions) * 100, 0), 2) AS avg_ctr
          FROM (
            SELECT
              session_id,
              countIf(event_type = 'impression') AS session_ad_count,
              countIf(event_type = 'impression') AS impressions,
              countIf(event_type = 'click') AS clicks
            FROM ad_events
            WHERE timestamp > now() - INTERVAL ${hours} HOUR
              AND session_id != ''
            GROUP BY session_id
            HAVING session_ad_count > 0
          )
          GROUP BY session_ad_count
          HAVING session_ad_count <= 10
          ORDER BY session_ad_count
        `).catch(() => [] as AdSessionDepth[]),

        // 33. Conversion Funnel Summary
        queryClickhouse<AdConversionFunnel>(`
          SELECT
            stage,
            count,
            round(if(first_value(count) OVER (ORDER BY stage_order) > 0, count / first_value(count) OVER (ORDER BY stage_order) * 100, 0), 2) AS rate_from_previous
          FROM (
            SELECT 'Requests' AS stage, 1 AS stage_order, countIf(event_type = 'request') AS count
            FROM ad_events WHERE timestamp > now() - INTERVAL ${hours} HOUR
            UNION ALL
            SELECT 'Filled' AS stage, 2 AS stage_order, countIf(event_type = 'request' AND status = 'filled') AS count
            FROM ad_events WHERE timestamp > now() - INTERVAL ${hours} HOUR
            UNION ALL
            SELECT 'Impressions' AS stage, 3 AS stage_order, countIf(event_type = 'impression') AS count
            FROM ad_events WHERE timestamp > now() - INTERVAL ${hours} HOUR
            UNION ALL
            SELECT 'Clicks' AS stage, 4 AS stage_order, countIf(event_type = 'click') AS count
            FROM ad_events WHERE timestamp > now() - INTERVAL ${hours} HOUR
          )
          ORDER BY stage_order
        `).catch(() => [] as AdConversionFunnel[]),

        // 34. Bot Detection - identify filled requests without device info (likely bots/curl)
        queryClickhouse<AdBotDetection>(`
          SELECT
            CASE
              WHEN device_type = '' OR browser = '' THEN 'No Device Info (Likely Bot)'
              ELSE 'Has Device Info (Real User)'
            END as category,
            countIf(event_type = 'request' AND status = 'filled') AS filled_count,
            countIf(event_type = 'impression') AS impression_count,
            round(if(countIf(event_type = 'request' AND status = 'filled') > 0,
              countIf(event_type = 'impression') / countIf(event_type = 'request' AND status = 'filled') * 100, 0), 1) AS impression_rate,
            uniq(session_id) AS unique_sessions
          FROM ad_events
          WHERE timestamp > now() - INTERVAL ${hours} HOUR
          GROUP BY category
          ORDER BY filled_count DESC
        `).catch(() => [] as AdBotDetection[]),

        // 35. CTR by Hour of Day with Device Breakdown
        queryClickhouse<AdCTRByHourDevice>(`
          SELECT
            toHour(timestamp) AS hour_of_day,
            if(device_type = '', 'unknown', device_type) AS device_type,
            countIf(event_type = 'impression') AS impressions,
            countIf(event_type = 'click') AS clicks,
            round(if(countIf(event_type = 'impression') > 0,
              countIf(event_type = 'click') / countIf(event_type = 'impression') * 100, 0), 2) AS ctr,
            round(if(countIf(event_type = 'request' AND status != 'premium_user') > 0,
              countIf(event_type = 'request' AND status = 'filled') /
              countIf(event_type = 'request' AND status != 'premium_user') * 100, 0), 2) AS fill_rate
          FROM ad_events
          WHERE timestamp > now() - INTERVAL ${hours} HOUR
            ${adDeviceFilter ? `AND device_type = '${adDeviceFilter}'` : ''}
          GROUP BY hour_of_day, device_type
          HAVING countIf(event_type = 'impression') > 0
          ORDER BY hour_of_day, device_type
        `).catch(() => [] as AdCTRByHourDevice[]),

        // 36. Filled vs Impression Gap Analysis - identify where impressions are lost
        queryClickhouse<AdFilledImpressionGap>(`
          SELECT
            if(device_type = '', 'unknown', device_type) AS device_type,
            if(browser = '', 'unknown', browser) AS browser,
            countIf(event_type = 'request' AND status = 'filled') AS filled_count,
            countIf(event_type = 'impression') AS impression_count,
            countIf(event_type = 'request' AND status = 'filled') - countIf(event_type = 'impression') AS gap_count,
            round(if(countIf(event_type = 'request' AND status = 'filled') > 0,
              countIf(event_type = 'impression') / countIf(event_type = 'request' AND status = 'filled') * 100, 0), 1) AS impression_rate
          FROM ad_events
          WHERE timestamp > now() - INTERVAL ${hours} HOUR
          GROUP BY device_type, browser
          HAVING countIf(event_type = 'request' AND status = 'filled') > 0
          ORDER BY gap_count DESC
          LIMIT 20
        `).catch(() => [] as AdFilledImpressionGap[]),
      ]);

      // Get buffer stats for monitoring
      const bufferStats = getBufferStats();

      // Get list of unique sources for filter dropdown
      const sources = Array.from(new Set(requestEvents.map(e => e.source).filter(Boolean)));
      const hostnames = Array.from(new Set(requestEvents.map(e => e.hostname).filter(Boolean))).slice(0, 50);

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
        sourceErrorRateTimeSeries,
        // Ad analytics
        adHealth: adHealthMetrics[0] || {
          total_requests: 0,
          filled_count: 0,
          no_fill_count: 0,
          premium_count: 0,
          error_count: 0,
          timeout_count: 0,
          fill_rate: 0,
          avg_duration_ms: 0,
          unique_sessions: 0,
          unique_brands: 0,
        },
        adStatusBreakdown,
        adHostnameStats,
        adDeviceStats,
        adBrandStats,
        adHourlyTraffic,
        adErrorBreakdown,
        adRecentEvents,
        // CTR and funnel analytics
        adCTRByBrand,
        adHourlyFunnel,
        adDismissRateByDevice,
        // Enhanced granular ad analytics
        adPerformanceByHour,
        adPerformanceByDay,
        adBrandPerformance,
        adDeviceBreakdown,
        adBrowserStats,
        adOSStats,
        adHostnamePerformance,
        adContentCorrelation,
        adSessionDepth,
        adConversionFunnel,
        // Bot detection and gap analysis
        adBotDetection,
        adCTRByHourDevice,
        adFilledImpressionGap,
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
      range: t.Optional(t.Union([
        t.Literal("5m"),
        t.Literal("30m"),
        t.Literal("1h"),
        t.Literal("6h"),
        t.Literal("12h"),
        t.Literal("24h"),
        t.Literal("7d"),
      ])),
      hostname: t.Optional(t.String()),
      source: t.Optional(t.String()),
      outcome: t.Optional(t.String()),
      urlSearch: t.Optional(t.String()),
      adDevice: t.Optional(t.Union([
        t.Literal("mobile"),
        t.Literal("tablet"),
        t.Literal("desktop"),
      ])),
    }),
  }
);
