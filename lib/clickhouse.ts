import { createClient, ClickHouseClient } from "@clickhouse/client";

/**
 * Clickhouse Analytics Client
 *
 * Memory-safe implementation following the same patterns as:
 * - redis.ts (module-level singleton)
 * - summary/route.ts rate limiters (singleton to prevent memory leaks)
 *
 * Key memory safeguards:
 * 1. Module-level singleton client (not per-request)
 * 2. Bounded event buffer (max 500 events)
 * 3. Automatic flush every 5 seconds
 * 4. Fire-and-forget writes (non-blocking)
 * 5. Graceful degradation when Clickhouse not configured
 */

// Module-level singleton - created once at module load
let client: ClickHouseClient | null = null;

function getClient(): ClickHouseClient | null {
  // Skip if Clickhouse not configured
  if (!process.env.CLICKHOUSE_URL) {
    return null;
  }

  if (!client) {
    client = createClient({
      url: process.env.CLICKHOUSE_URL,
      username: process.env.CLICKHOUSE_USER || "default",
      password: process.env.CLICKHOUSE_PASSWORD,
      database: process.env.CLICKHOUSE_DATABASE || "smry_analytics",
      request_timeout: 30_000,
      compression: {
        request: true,
        response: true,
      },
      // Keep-alive to reduce connection overhead
      keep_alive: {
        enabled: true,
      },
    });
  }
  return client;
}

// Analytics event type matching our Clickhouse schema
export interface AnalyticsEvent {
  request_id: string;
  timestamp: string;
  method: string;
  endpoint: string;
  path: string;
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
  summary_length: number;
  input_tokens: number;
  output_tokens: number;
  is_premium: number;
  client_ip: string;
  user_agent: string;
  heap_used_mb: number;
  heap_total_mb: number;
  rss_mb: number;
  env: string;
  version: string;
}

// MEMORY SAFETY: Bounded buffer with strict max size
const MAX_BUFFER_SIZE = 500;
const BATCH_SIZE = 50;
const FLUSH_INTERVAL_MS = 5000;

const eventBuffer: AnalyticsEvent[] = [];
let flushTimer: NodeJS.Timeout | null = null;
let isInitialized = false;
let schemaMigrated = false;

/**
 * Auto-migrate schema on first use
 * Creates database and table if they don't exist
 */
async function ensureSchema(): Promise<void> {
  if (schemaMigrated) return;

  const clickhouse = getClient();
  if (!clickhouse) return;

  try {
    // Create database if not exists
    await clickhouse.command({
      query: `CREATE DATABASE IF NOT EXISTS ${process.env.CLICKHOUSE_DATABASE || "smry_analytics"}`,
    });

    // Create main events table
    await clickhouse.command({
      query: `
        CREATE TABLE IF NOT EXISTS request_events
        (
            request_id String,
            timestamp DateTime64(3) DEFAULT now64(3),
            method LowCardinality(String),
            endpoint LowCardinality(String),
            path String,
            url String,
            hostname LowCardinality(String),
            source LowCardinality(String),
            outcome LowCardinality(String),
            status_code UInt16,
            error_type LowCardinality(String) DEFAULT '',
            error_message String DEFAULT '',
            duration_ms UInt32,
            fetch_ms UInt32 DEFAULT 0,
            cache_lookup_ms UInt32 DEFAULT 0,
            cache_save_ms UInt32 DEFAULT 0,
            cache_hit UInt8 DEFAULT 0,
            cache_status LowCardinality(String) DEFAULT '',
            article_length UInt32 DEFAULT 0,
            article_title String DEFAULT '',
            summary_length UInt32 DEFAULT 0,
            input_tokens UInt32 DEFAULT 0,
            output_tokens UInt32 DEFAULT 0,
            is_premium UInt8 DEFAULT 0,
            client_ip String DEFAULT '',
            user_agent String DEFAULT '',
            heap_used_mb UInt16 DEFAULT 0,
            heap_total_mb UInt16 DEFAULT 0,
            rss_mb UInt16 DEFAULT 0,
            env LowCardinality(String) DEFAULT 'production',
            version String DEFAULT ''
        )
        ENGINE = MergeTree()
        PARTITION BY toYYYYMM(timestamp)
        ORDER BY (hostname, source, timestamp, request_id)
        TTL toDateTime(timestamp) + INTERVAL 90 DAY
        SETTINGS index_granularity = 8192
      `,
    });

    schemaMigrated = true;
    console.log("[clickhouse] Schema migration complete");
  } catch (error) {
    // Log but don't throw - will retry on next flush
    console.error(
      "[clickhouse] Schema migration failed:",
      error instanceof Error ? error.message : error
    );
  }
}

/**
 * Flush events to Clickhouse
 * Non-blocking, errors are logged but never thrown
 */
async function flushEvents(): Promise<void> {
  if (eventBuffer.length === 0) return;

  const clickhouse = getClient();
  if (!clickhouse) return;

  // Ensure schema exists before first insert
  await ensureSchema();

  // Splice out events atomically to prevent duplicates
  const events = eventBuffer.splice(0, eventBuffer.length);

  try {
    await clickhouse.insert({
      table: "request_events",
      values: events,
      format: "JSONEachRow",
    });
  } catch (error) {
    // Log but NEVER throw - analytics must never break the app
    console.error(
      "[clickhouse] Flush failed:",
      error instanceof Error ? error.message : error
    );
    // Don't push events back - prevents infinite memory growth on persistent errors
  }
}

/**
 * Schedule a flush if not already scheduled
 */
function scheduleFlush(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(async () => {
    flushTimer = null;
    await flushEvents();
  }, FLUSH_INTERVAL_MS);
  // Unref the timer so it doesn't keep the process alive
  flushTimer.unref();
}

/**
 * Track an analytics event
 *
 * Memory-safe guarantees:
 * - Non-blocking (fire-and-forget)
 * - Bounded buffer (drops oldest events if full)
 * - No promise rejection
 */
export function trackEvent(event: Partial<AnalyticsEvent>): void {
  // Skip if Clickhouse not configured
  if (!process.env.CLICKHOUSE_URL) return;

  // Build full event with defaults
  // Convert ISO timestamp to Clickhouse-compatible format (remove 'T' and 'Z')
  const rawTimestamp = event.timestamp || new Date().toISOString();
  const clickhouseTimestamp = rawTimestamp.replace("T", " ").replace("Z", "");

  const fullEvent: AnalyticsEvent = {
    request_id: event.request_id || "",
    timestamp: clickhouseTimestamp,
    method: event.method || "",
    endpoint: event.endpoint || "",
    path: event.path || "",
    url: event.url || "",
    hostname: event.hostname || "",
    source: event.source || "",
    outcome: event.outcome || "",
    status_code: event.status_code || 0,
    error_type: event.error_type || "",
    error_message: event.error_message || "",
    duration_ms: event.duration_ms || 0,
    fetch_ms: event.fetch_ms || 0,
    cache_lookup_ms: event.cache_lookup_ms || 0,
    cache_save_ms: event.cache_save_ms || 0,
    cache_hit: event.cache_hit || 0,
    cache_status: event.cache_status || "",
    article_length: event.article_length || 0,
    article_title: (event.article_title || "").slice(0, 500), // Truncate to prevent large strings
    summary_length: event.summary_length || 0,
    input_tokens: event.input_tokens || 0,
    output_tokens: event.output_tokens || 0,
    is_premium: event.is_premium || 0,
    client_ip: event.client_ip || "",
    user_agent: (event.user_agent || "").slice(0, 500), // Truncate
    heap_used_mb: event.heap_used_mb || 0,
    heap_total_mb: event.heap_total_mb || 0,
    rss_mb: event.rss_mb || 0,
    env: event.env || process.env.NODE_ENV || "development",
    version: event.version || process.env.npm_package_version || "unknown",
  };

  // MEMORY SAFETY: Drop oldest events if buffer is at capacity
  if (eventBuffer.length >= MAX_BUFFER_SIZE) {
    eventBuffer.shift();
  }

  eventBuffer.push(fullEvent);

  // Flush immediately if buffer hits batch size
  if (eventBuffer.length >= BATCH_SIZE) {
    // Fire-and-forget flush
    flushEvents().catch(() => {});
  } else {
    scheduleFlush();
  }
}

/**
 * Query helper for dashboard
 * Returns empty array on error (graceful degradation)
 */
export async function queryClickhouse<T>(query: string): Promise<T[]> {
  const clickhouse = getClient();
  if (!clickhouse) return [];

  try {
    const result = await clickhouse.query({
      query,
      format: "JSONEachRow",
    });
    return result.json<T>();
  } catch (error) {
    console.error(
      "[clickhouse] Query failed:",
      error instanceof Error ? error.message : error
    );
    return [];
  }
}

/**
 * Get buffer stats for monitoring
 */
export function getBufferStats(): { size: number; maxSize: number } {
  return {
    size: eventBuffer.length,
    maxSize: MAX_BUFFER_SIZE,
  };
}

/**
 * Graceful shutdown - flush remaining events
 * Called on process exit
 */
export async function closeClickhouse(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  await flushEvents();
  if (client) {
    await client.close();
    client = null;
  }
}

// Register shutdown handler (only once)
if (!isInitialized && typeof process !== "undefined") {
  isInitialized = true;
  process.on("beforeExit", async () => {
    await closeClickhouse();
  });
}
