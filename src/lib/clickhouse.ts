import { createClient, ClickHouseClient } from "@clickhouse/client";
import { env } from "./env";

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
// Track if ClickHouse is unavailable (connection failed) to prevent repeated attempts
let clickhouseDisabled = false;
let lastConnectionAttempt = 0;
const CONNECTION_RETRY_INTERVAL_MS = 60_000; // Retry connection check every 60 seconds

function getClient(): ClickHouseClient | null {
  // Skip if Clickhouse not configured
  if (!env.CLICKHOUSE_URL) {
    return null;
  }

  // Skip if we've determined ClickHouse is unavailable
  // Allow retry after CONNECTION_RETRY_INTERVAL_MS
  if (clickhouseDisabled) {
    const now = Date.now();
    if (now - lastConnectionAttempt < CONNECTION_RETRY_INTERVAL_MS) {
      return null;
    }
    // Reset to allow retry
    clickhouseDisabled = false;
  }

  client ??= createClient({
    url: env.CLICKHOUSE_URL,
    username: env.CLICKHOUSE_USER ?? "default",
    password: env.CLICKHOUSE_PASSWORD,
    database: env.CLICKHOUSE_DATABASE ?? "smry_analytics",
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
  return client;
}

/**
 * Mark ClickHouse as temporarily disabled due to connection failure
 */
function disableClickhouse(reason: string): void {
  if (!clickhouseDisabled) {
    console.warn(`[clickhouse] Disabled due to connection failure: ${reason}. Will retry in ${CONNECTION_RETRY_INTERVAL_MS / 1000}s`);
    clickhouseDisabled = true;
    lastConnectionAttempt = Date.now();
  }
}

// Analytics event type matching our Clickhouse schema
// Error severity levels for distinguishing expected vs unexpected errors
export type ErrorSeverity = "expected" | "degraded" | "unexpected" | "";

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
  error_severity: ErrorSeverity;
  // Upstream error info - which host/service actually caused the error
  upstream_hostname: string;
  upstream_status_code: number;
  upstream_error_code: string;
  upstream_message: string;
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

// CONCURRENCY CONTROL: Limit concurrent queries to prevent thread exhaustion
// ClickHouse has limited threads (typically 28), so we limit concurrent queries
const MAX_CONCURRENT_QUERIES = 4;
const QUERY_SLOT_TIMEOUT_MS = 30_000; // 30s timeout waiting for slot
let activeQueries = 0;
const queryQueue: {
  resolve: () => void;
  reject: (err: Error) => void;
}[] = [];

async function acquireQuerySlot(): Promise<void> {
  if (activeQueries < MAX_CONCURRENT_QUERIES) {
    activeQueries++;
    return;
  }
  // Wait for a slot to become available (with timeout)
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      const idx = queryQueue.findIndex((q) => q.resolve === wrappedResolve);
      if (idx !== -1) queryQueue.splice(idx, 1);
      reject(new Error("Query slot timeout - too many concurrent queries"));
    }, QUERY_SLOT_TIMEOUT_MS);

    const wrappedResolve = () => {
      clearTimeout(timeout);
      resolve();
    };

    queryQueue.push({ resolve: wrappedResolve, reject });
  });
}

function releaseQuerySlot(): void {
  activeQueries--;
  const next = queryQueue.shift();
  if (next) {
    activeQueries++;
    next.resolve();
  }
}

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
      query: `CREATE DATABASE IF NOT EXISTS ${env.CLICKHOUSE_DATABASE || "smry_analytics"}`,
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
            error_severity LowCardinality(String) DEFAULT '',
            upstream_hostname LowCardinality(String) DEFAULT '',
            upstream_status_code UInt16 DEFAULT 0,
            upstream_error_code LowCardinality(String) DEFAULT '',
            upstream_message String DEFAULT '',
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

    // Add new upstream columns to existing tables (safe for already-existing tables)
    try {
      await clickhouse.command({
        query: `ALTER TABLE request_events ADD COLUMN IF NOT EXISTS upstream_hostname LowCardinality(String) DEFAULT ''`,
      });
      await clickhouse.command({
        query: `ALTER TABLE request_events ADD COLUMN IF NOT EXISTS upstream_status_code UInt16 DEFAULT 0`,
      });
      await clickhouse.command({
        query: `ALTER TABLE request_events ADD COLUMN IF NOT EXISTS upstream_error_code LowCardinality(String) DEFAULT ''`,
      });
      await clickhouse.command({
        query: `ALTER TABLE request_events ADD COLUMN IF NOT EXISTS upstream_message String DEFAULT ''`,
      });
    } catch {
      // Ignore errors - columns may already exist
    }

    schemaMigrated = true;
    console.log("[clickhouse] Schema migration complete");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Check for connection errors and disable to prevent spam
    if (message.includes("ECONNREFUSED") || message.includes("ENOTFOUND") || message.includes("ETIMEDOUT")) {
      disableClickhouse(message);
    } else {
      // Log other errors but don't disable - might be transient
      console.error("[clickhouse] Schema migration failed:", message);
    }
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
    const message = error instanceof Error ? error.message : String(error);
    // Check for connection errors and disable to prevent spam
    if (message.includes("ECONNREFUSED") || message.includes("ENOTFOUND") || message.includes("ETIMEDOUT")) {
      disableClickhouse(message);
    } else {
      // Log other errors but don't disable - might be transient
      console.error("[clickhouse] Flush failed:", message);
    }
    // Don't push events back - prevents infinite memory growth on persistent errors
  }
}

/**
 * Schedule a flush if not already scheduled
 */
function scheduleFlush(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushEvents();
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
  if (!env.CLICKHOUSE_URL) return;

  // Build full event with defaults
  // Convert ISO timestamp to Clickhouse-compatible format (remove 'T' and 'Z')
  const rawTimestamp = event.timestamp ?? new Date().toISOString();
  const clickhouseTimestamp = rawTimestamp.replace("T", " ").replace("Z", "");

  const fullEvent: AnalyticsEvent = {
    request_id: event.request_id ?? "",
    timestamp: clickhouseTimestamp,
    method: event.method ?? "",
    endpoint: event.endpoint ?? "",
    path: event.path ?? "",
    url: event.url ?? "",
    hostname: event.hostname ?? "",
    source: event.source ?? "",
    outcome: event.outcome ?? "",
    status_code: event.status_code ?? 0,
    error_type: event.error_type ?? "",
    error_message: event.error_message ?? "",
    error_severity: event.error_severity ?? "",
    upstream_hostname: event.upstream_hostname ?? "",
    upstream_status_code: event.upstream_status_code ?? 0,
    upstream_error_code: event.upstream_error_code ?? "",
    upstream_message: (event.upstream_message ?? "").slice(0, 500), // Truncate
    duration_ms: event.duration_ms ?? 0,
    fetch_ms: event.fetch_ms ?? 0,
    cache_lookup_ms: event.cache_lookup_ms ?? 0,
    cache_save_ms: event.cache_save_ms ?? 0,
    cache_hit: event.cache_hit ?? 0,
    cache_status: event.cache_status ?? "",
    article_length: event.article_length ?? 0,
    article_title: (event.article_title ?? "").slice(0, 500), // Truncate to prevent large strings
    summary_length: event.summary_length ?? 0,
    input_tokens: event.input_tokens ?? 0,
    output_tokens: event.output_tokens ?? 0,
    is_premium: event.is_premium ?? 0,
    client_ip: event.client_ip ?? "",
    user_agent: (event.user_agent ?? "").slice(0, 500), // Truncate
    heap_used_mb: event.heap_used_mb ?? 0,
    heap_total_mb: event.heap_total_mb ?? 0,
    rss_mb: event.rss_mb ?? 0,
    env: event.env ?? env.NODE_ENV ?? "development",
    version: event.version ?? process.env.npm_package_version ?? "unknown",
  };

  // MEMORY SAFETY: Drop oldest events if buffer is at capacity
  if (eventBuffer.length >= MAX_BUFFER_SIZE) {
    eventBuffer.shift();
  }

  eventBuffer.push(fullEvent);

  // Flush immediately if buffer hits batch size
  if (eventBuffer.length >= BATCH_SIZE) {
    // Fire-and-forget flush
    flushEvents().catch(() => {
      // Intentionally empty - fire and forget
    });
  } else {
    scheduleFlush();
  }
}

/**
 * Query helper for dashboard
 * Returns empty array on error (graceful degradation)
 * Uses semaphore to limit concurrent queries and prevent thread exhaustion
 */
export async function queryClickhouse<T>(query: string): Promise<T[]> {
  const clickhouse = getClient();
  if (!clickhouse) return [];

  // Acquire a query slot (may wait if at capacity)
  await acquireQuerySlot();

  try {
    const result = await clickhouse.query({
      query,
      format: "JSONEachRow",
    });
    return result.json<T>();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Check for connection errors and disable to prevent spam
    if (message.includes("ECONNREFUSED") || message.includes("ENOTFOUND") || message.includes("ETIMEDOUT")) {
      disableClickhouse(message);
    } else {
      console.error("[clickhouse] Query failed:", message);
    }
    return [];
  } finally {
    // Always release the slot, even on error
    releaseQuerySlot();
  }
}

/**
 * Get buffer and query stats for monitoring
 */
export function getBufferStats(): {
  size: number;
  maxSize: number;
  activeQueries: number;
  queuedQueries: number;
  maxConcurrentQueries: number;
} {
  return {
    size: eventBuffer.length,
    maxSize: MAX_BUFFER_SIZE,
    activeQueries,
    queuedQueries: queryQueue.length,
    maxConcurrentQueries: MAX_CONCURRENT_QUERIES,
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
  process.on("beforeExit", () => {
    void closeClickhouse();
  });
}
