import { createClient, ClickHouseClient } from "@clickhouse/client";
import { env } from "../server/env";

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

  if (!client) {
    client = createClient({
      url: env.CLICKHOUSE_URL,
      username: env.CLICKHOUSE_USER,
      password: env.CLICKHOUSE_PASSWORD,
      database: env.CLICKHOUSE_DATABASE,
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

// =============================================================================
// Ad Event Tracking
// =============================================================================

// Ad event status - matches ContextResponseStatus in types/api.ts
export type AdEventStatus = "filled" | "no_fill" | "premium_user" | "gravity_error" | "timeout" | "error";

// Event type for tracking funnel: request -> impression -> click/dismiss
export type AdEventType = "request" | "impression" | "click" | "dismiss";

export type AdProvider = "gravity" | "zeroclick";

export interface AdEvent {
  event_id: string;
  timestamp: string;
  // Event type (request, impression, click, dismiss)
  event_type: AdEventType;
  // Request context
  url: string;
  hostname: string;
  article_title: string;
  article_content_length: number;
  session_id: string;
  // User context
  user_id: string;
  is_premium: number;
  // Device context
  device_type: string;
  os: string;
  browser: string;
  // Response
  status: AdEventStatus;
  gravity_status_code: number;
  error_message: string;
  // Gravity forwarding status (for impressions)
  // 1 = successfully forwarded to Gravity, 0 = failed or not applicable
  gravity_forwarded: number;
  // Ad data (when filled)
  brand_name: string;
  ad_title: string;
  ad_text: string;
  click_url: string;
  imp_url: string;
  cta: string;
  favicon: string;
  ad_count: number; // Number of ads returned in this request
  // Provider (gravity or zeroclick)
  ad_provider: AdProvider;
  // ZeroClick offer ID (for impression reconciliation)
  zeroclick_id: string;
  // Performance
  duration_ms: number;
  // Environment
  env: string;
}

// Separate buffer for ad events
const adEventBuffer: AdEvent[] = [];
let adFlushTimer: NodeJS.Timeout | null = null;
let adSchemaMigrated = false;

/**
 * Ensure ad_events table exists
 */
async function ensureAdSchema(): Promise<void> {
  if (adSchemaMigrated) return;

  const clickhouse = getClient();
  if (!clickhouse) return;

  try {
    await clickhouse.command({
      query: `
        CREATE TABLE IF NOT EXISTS ad_events
        (
            event_id String,
            timestamp DateTime64(3) DEFAULT now64(3),
            -- Event type (request, impression, click, dismiss)
            event_type LowCardinality(String) DEFAULT 'request',
            -- Request context
            url String,
            hostname LowCardinality(String),
            article_title String DEFAULT '',
            article_content_length UInt32 DEFAULT 0,
            session_id String,
            -- User context
            user_id String DEFAULT '',
            is_premium UInt8 DEFAULT 0,
            -- Device context
            device_type LowCardinality(String) DEFAULT '',
            os LowCardinality(String) DEFAULT '',
            browser LowCardinality(String) DEFAULT '',
            -- Response
            status LowCardinality(String),
            gravity_status_code UInt16 DEFAULT 0,
            error_message String DEFAULT '',
            -- Gravity forwarding status (for impressions)
            -- 1 = successfully forwarded to Gravity, 0 = failed or not applicable
            gravity_forwarded UInt8 DEFAULT 0,
            -- Ad data (when filled)
            brand_name LowCardinality(String) DEFAULT '',
            ad_title String DEFAULT '',
            ad_text String DEFAULT '',
            click_url String DEFAULT '',
            imp_url String DEFAULT '',
            cta LowCardinality(String) DEFAULT '',
            favicon String DEFAULT '',
            ad_count UInt8 DEFAULT 0,
            ad_provider LowCardinality(String) DEFAULT 'gravity',
            -- ZeroClick offer ID (for impression reconciliation)
            zeroclick_id String DEFAULT '',
            -- Performance
            duration_ms UInt32 DEFAULT 0,
            -- Environment
            env LowCardinality(String) DEFAULT 'production'
        )
        ENGINE = MergeTree()
        PARTITION BY toYYYYMM(timestamp)
        ORDER BY (hostname, event_type, status, timestamp, event_id)
        TTL toDateTime(timestamp) + INTERVAL 90 DAY
        SETTINGS index_granularity = 8192
      `,
    });

    // Add new columns for existing tables (safe migration)
    try {
      await clickhouse.command({
        query: `ALTER TABLE ad_events ADD COLUMN IF NOT EXISTS event_type LowCardinality(String) DEFAULT 'request'`,
      });
      await clickhouse.command({
        query: `ALTER TABLE ad_events ADD COLUMN IF NOT EXISTS ad_text String DEFAULT ''`,
      });
      await clickhouse.command({
        query: `ALTER TABLE ad_events ADD COLUMN IF NOT EXISTS click_url String DEFAULT ''`,
      });
      await clickhouse.command({
        query: `ALTER TABLE ad_events ADD COLUMN IF NOT EXISTS imp_url String DEFAULT ''`,
      });
      await clickhouse.command({
        query: `ALTER TABLE ad_events ADD COLUMN IF NOT EXISTS cta LowCardinality(String) DEFAULT ''`,
      });
      await clickhouse.command({
        query: `ALTER TABLE ad_events ADD COLUMN IF NOT EXISTS favicon String DEFAULT ''`,
      });
      await clickhouse.command({
        query: `ALTER TABLE ad_events ADD COLUMN IF NOT EXISTS ad_count UInt8 DEFAULT 0`,
      });
      // Track whether impression was successfully forwarded to Gravity (for billing)
      await clickhouse.command({
        query: `ALTER TABLE ad_events ADD COLUMN IF NOT EXISTS gravity_forwarded UInt8 DEFAULT 0`,
      });
      // Track which ad provider served the ad (gravity or zeroclick)
      await clickhouse.command({
        query: `ALTER TABLE ad_events ADD COLUMN IF NOT EXISTS ad_provider LowCardinality(String) DEFAULT 'gravity'`,
      });
      // ZeroClick offer ID for impression reconciliation
      await clickhouse.command({
        query: `ALTER TABLE ad_events ADD COLUMN IF NOT EXISTS zeroclick_id String DEFAULT ''`,
      });
    } catch {
      // Ignore errors - columns may already exist
    }

    // Create materialized views for ad analytics performance
    try {
      // Hourly ad metrics materialized view
      await clickhouse.command({
        query: `
          CREATE MATERIALIZED VIEW IF NOT EXISTS ad_hourly_metrics_mv
          ENGINE = SummingMergeTree()
          PARTITION BY toYYYYMM(hour)
          ORDER BY (hour, device_type, browser)
          AS SELECT
            toStartOfHour(timestamp) AS hour,
            if(device_type = '', 'unknown', device_type) AS device_type,
            if(browser = '', 'unknown', browser) AS browser,
            countIf(event_type = 'request' AND status = 'filled') AS filled_count,
            countIf(event_type = 'impression') AS impression_count,
            countIf(event_type = 'click') AS click_count,
            countIf(event_type = 'dismiss') AS dismiss_count,
            uniqState(session_id) AS unique_sessions_state
          FROM ad_events
          GROUP BY hour, device_type, browser
        `,
      });

      // CTR by hour of day materialized view
      await clickhouse.command({
        query: `
          CREATE MATERIALIZED VIEW IF NOT EXISTS ad_ctr_by_hour_mv
          ENGINE = SummingMergeTree()
          PARTITION BY toYYYYMM(date)
          ORDER BY (date, hour_of_day, device_type)
          AS SELECT
            toDate(timestamp) AS date,
            toHour(timestamp) AS hour_of_day,
            if(device_type = '', 'unknown', device_type) AS device_type,
            countIf(event_type = 'impression') AS impressions,
            countIf(event_type = 'click') AS clicks,
            countIf(event_type = 'request' AND status = 'filled') AS filled,
            countIf(event_type = 'request' AND status != 'premium_user') AS requests
          FROM ad_events
          GROUP BY date, hour_of_day, device_type
        `,
      });

      console.log("[clickhouse] Ad materialized views created");
    } catch {
      // Ignore errors - views may already exist
    }

    adSchemaMigrated = true;
    console.log("[clickhouse] Ad events schema migration complete");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("ECONNREFUSED") || message.includes("ENOTFOUND") || message.includes("ETIMEDOUT") || message.includes("Authentication failed")) {
      disableClickhouse(message);
    } else {
      console.error("[clickhouse] Ad schema migration failed:", message);
    }
  }
}

/**
 * Flush ad events to ClickHouse
 */
async function flushAdEvents(): Promise<void> {
  if (adEventBuffer.length === 0) return;

  const clickhouse = getClient();
  if (!clickhouse) return;

  await ensureAdSchema();

  const events = adEventBuffer.splice(0, adEventBuffer.length);

  try {
    await clickhouse.insert({
      table: "ad_events",
      values: events,
      format: "JSONEachRow",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("ECONNREFUSED") || message.includes("ENOTFOUND") || message.includes("ETIMEDOUT") || message.includes("Authentication failed")) {
      disableClickhouse(message);
    } else {
      console.error("[clickhouse] Ad events flush failed:", message);
    }
  }
}

/**
 * Schedule ad events flush
 */
function scheduleAdFlush(): void {
  if (adFlushTimer) return;
  adFlushTimer = setTimeout(async () => {
    adFlushTimer = null;
    await flushAdEvents();
  }, FLUSH_INTERVAL_MS);
  adFlushTimer.unref();
}

/**
 * Track an ad event
 */
export function trackAdEvent(event: Partial<AdEvent>): void {
  const rawTimestamp = event.timestamp || new Date().toISOString();
  const clickhouseTimestamp = rawTimestamp.replace("T", " ").replace("Z", "");

  const fullEvent: AdEvent = {
    event_id: event.event_id || crypto.randomUUID(),
    timestamp: clickhouseTimestamp,
    event_type: event.event_type || "request",
    url: event.url || "",
    hostname: event.hostname || "",
    article_title: (event.article_title || "").slice(0, 500),
    article_content_length: event.article_content_length || 0,
    session_id: event.session_id || "",
    user_id: event.user_id || "",
    is_premium: event.is_premium || 0,
    device_type: event.device_type || "",
    os: event.os || "",
    browser: event.browser || "",
    status: event.status || "error",
    gravity_status_code: event.gravity_status_code || 0,
    error_message: (event.error_message || "").slice(0, 500),
    gravity_forwarded: event.gravity_forwarded || 0,
    brand_name: event.brand_name || "",
    ad_title: (event.ad_title || "").slice(0, 500),
    ad_text: (event.ad_text || "").slice(0, 1000),
    click_url: (event.click_url || "").slice(0, 2000),
    imp_url: (event.imp_url || "").slice(0, 2000),
    cta: (event.cta || "").slice(0, 100),
    favicon: (event.favicon || "").slice(0, 500),
    ad_count: event.ad_count || 0,
    ad_provider: event.ad_provider || "gravity",
    zeroclick_id: event.zeroclick_id || "",
    duration_ms: event.duration_ms || 0,
    env: event.env || env.NODE_ENV,
  };

  if (adEventBuffer.length >= MAX_BUFFER_SIZE) {
    adEventBuffer.shift();
  }

  adEventBuffer.push(fullEvent);

  if (adEventBuffer.length >= BATCH_SIZE) {
    flushAdEvents().catch(() => {});
  } else {
    scheduleAdFlush();
  }
}

// =============================================================================
// Request Event Tracking
// =============================================================================

// MEMORY SAFETY: Bounded buffer with strict max size
const MAX_BUFFER_SIZE = 500;
const BATCH_SIZE = 50;
const FLUSH_INTERVAL_MS = 5000;

// CONCURRENCY CONTROL: Limit concurrent queries to prevent thread exhaustion
// ClickHouse has limited threads (typically 28), so we limit concurrent queries
// Admin dashboard runs 13 queries in parallel, so we need at least ~7 slots
const MAX_CONCURRENT_QUERIES = 8;
const QUERY_SLOT_TIMEOUT_MS = 60_000; // 60s timeout waiting for slot
let activeQueries = 0;
const queryQueue: Array<{
  resolve: () => void;
  reject: (err: Error) => void;
}> = [];

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
      query: `CREATE DATABASE IF NOT EXISTS ${env.CLICKHOUSE_DATABASE}`,
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
        TTL toDateTime(timestamp) + INTERVAL 30 DAY
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
    if (message.includes("ECONNREFUSED") || message.includes("ENOTFOUND") || message.includes("ETIMEDOUT") || message.includes("Authentication failed")) {
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
    if (message.includes("ECONNREFUSED") || message.includes("ENOTFOUND") || message.includes("ETIMEDOUT") || message.includes("Authentication failed")) {
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
    error_severity: event.error_severity || "",
    upstream_hostname: event.upstream_hostname || "",
    upstream_status_code: event.upstream_status_code || 0,
    upstream_error_code: event.upstream_error_code || "",
    upstream_message: (event.upstream_message || "").slice(0, 500), // Truncate
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
    env: event.env || env.NODE_ENV,
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
 * Uses semaphore to limit concurrent queries and prevent thread exhaustion
 */
export async function queryClickhouse<T>(query: string): Promise<T[]> {
  const clickhouse = getClient();
  if (!clickhouse) return [];

  let slotAcquired = false;

  try {
    // Acquire a query slot (may wait if at capacity)
    await acquireQuerySlot();
    slotAcquired = true;

    const result = await clickhouse.query({
      query,
      format: "JSONEachRow",
    });
    return result.json<T>();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Check for connection errors and disable to prevent spam
    if (message.includes("ECONNREFUSED") || message.includes("ENOTFOUND") || message.includes("ETIMEDOUT") || message.includes("Authentication failed")) {
      disableClickhouse(message);
    } else if (message.includes("Query slot timeout")) {
      // Log slot timeouts but don't disable - indicates too many concurrent queries
      console.warn("[clickhouse] Query slot timeout - too many concurrent queries");
    } else {
      console.error("[clickhouse] Query failed:", message);
    }
    return [];
  } finally {
    // Only release the slot if we actually acquired one
    if (slotAcquired) {
      releaseQuerySlot();
    }
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
  if (adFlushTimer) {
    clearTimeout(adFlushTimer);
    adFlushTimer = null;
  }
  await Promise.all([flushEvents(), flushAdEvents()]);
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
