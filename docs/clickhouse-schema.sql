-- SMRY.ai Clickhouse Analytics Schema
-- Run this SQL in your Clickhouse instance to set up the analytics tables

-- Create database if not exists
CREATE DATABASE IF NOT EXISTS smry_analytics;

-- Switch to the database
USE smry_analytics;

-- Main events table with MergeTree engine optimized for time-series queries
CREATE TABLE IF NOT EXISTS request_events
(
    -- Identifiers
    request_id String,
    timestamp DateTime64(3) DEFAULT now64(3),

    -- Request metadata
    method LowCardinality(String),
    endpoint LowCardinality(String),  -- /api/article, /api/summary
    path String,

    -- Article/content context
    url String,
    hostname LowCardinality(String),  -- nytimes.com, wsj.com, etc.
    source LowCardinality(String),    -- smry-fast, smry-slow, wayback

    -- Outcome metrics
    outcome LowCardinality(String),   -- success, error
    status_code UInt16,
    error_type LowCardinality(String) DEFAULT '',
    error_message String DEFAULT '',

    -- Performance metrics
    duration_ms UInt32,
    fetch_ms UInt32 DEFAULT 0,
    cache_lookup_ms UInt32 DEFAULT 0,
    cache_save_ms UInt32 DEFAULT 0,

    -- Cache behavior
    cache_hit UInt8 DEFAULT 0,        -- 0 = miss, 1 = hit
    cache_status LowCardinality(String) DEFAULT '',  -- hit, miss, invalid, error

    -- Content metrics
    article_length UInt32 DEFAULT 0,
    article_title String DEFAULT '',

    -- AI Summary specific (for /api/summary)
    summary_length UInt32 DEFAULT 0,
    input_tokens UInt32 DEFAULT 0,
    output_tokens UInt32 DEFAULT 0,

    -- User context
    is_premium UInt8 DEFAULT 0,
    client_ip String DEFAULT '',
    user_agent String DEFAULT '',

    -- System health
    heap_used_mb UInt16 DEFAULT 0,
    heap_total_mb UInt16 DEFAULT 0,
    rss_mb UInt16 DEFAULT 0,

    -- Environment
    env LowCardinality(String) DEFAULT 'production',
    version String DEFAULT ''
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (hostname, source, timestamp, request_id)
TTL toDateTime(timestamp) + INTERVAL 30 DAY  -- Auto-delete data older than 30 days
SETTINGS index_granularity = 8192;

-- Index for faster hostname lookups
ALTER TABLE request_events ADD INDEX idx_hostname hostname TYPE bloom_filter GRANULARITY 1;

-- Index for error filtering
ALTER TABLE request_events ADD INDEX idx_outcome outcome TYPE set(2) GRANULARITY 1;


-- Materialized view for hourly aggregates (pre-computed for dashboard performance)
CREATE MATERIALIZED VIEW IF NOT EXISTS hourly_stats
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(hour)
ORDER BY (hostname, source, hour)
TTL hour + INTERVAL 30 DAY  -- Match raw data TTL
AS SELECT
    toStartOfHour(timestamp) AS hour,
    hostname,
    source,
    count() AS request_count,
    countIf(outcome = 'success') AS success_count,
    countIf(outcome = 'error') AS error_count,
    countIf(cache_hit = 1) AS cache_hits,
    sum(duration_ms) AS total_duration_ms,
    sum(article_length) AS total_article_length
FROM request_events
GROUP BY hour, hostname, source;


-- Materialized view for error tracking by hostname
CREATE MATERIALIZED VIEW IF NOT EXISTS error_rates
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(hour)
ORDER BY (hostname, source, error_type, hour)
TTL hour + INTERVAL 30 DAY  -- Match raw data TTL
AS SELECT
    toStartOfHour(timestamp) AS hour,
    hostname,
    source,
    error_type,
    count() AS error_count
FROM request_events
WHERE outcome = 'error'
GROUP BY hour, hostname, source, error_type;


-- ============================================================================
-- AD EVENTS TABLE - Tracks ad requests, fill rates, and performance
-- ============================================================================

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
    device_type LowCardinality(String) DEFAULT '',  -- desktop, mobile, tablet
    os LowCardinality(String) DEFAULT '',            -- windows, macos, ios, android
    browser LowCardinality(String) DEFAULT '',       -- chrome, safari, firefox

    -- Response
    status LowCardinality(String),  -- filled, no_fill, premium_user, gravity_error, timeout, error
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
    ad_count UInt8 DEFAULT 0,               -- Number of ads returned in this request

    -- Provider (gravity or zeroclick)
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
TTL toDateTime(timestamp) + INTERVAL 90 DAY  -- Keep ad data longer for analysis
SETTINGS index_granularity = 8192;

-- Index for faster status filtering
ALTER TABLE ad_events ADD INDEX idx_status status TYPE set(10) GRANULARITY 1;

-- Index for brand lookups
ALTER TABLE ad_events ADD INDEX idx_brand brand_name TYPE bloom_filter GRANULARITY 1;


-- ============================================================================
-- USEFUL QUERIES FOR DEBUGGING AND MONITORING
-- ============================================================================

-- Check data is flowing in
-- SELECT count(), max(timestamp), min(timestamp) FROM request_events;

-- Top 10 sites by error count (last 24h)
-- SELECT hostname, count() as errors
-- FROM request_events
-- WHERE timestamp > now() - INTERVAL 24 HOUR AND outcome = 'error'
-- GROUP BY hostname
-- ORDER BY errors DESC
-- LIMIT 10;

-- Source success rates by hostname (last 24h)
-- SELECT hostname, source,
--        round(countIf(outcome = 'success') / count() * 100, 2) as success_rate,
--        count() as total
-- FROM request_events
-- WHERE timestamp > now() - INTERVAL 24 HOUR
-- GROUP BY hostname, source
-- HAVING total >= 5
-- ORDER BY hostname, success_rate DESC;

-- Memory usage over time (for leak detection)
-- SELECT toStartOfMinute(timestamp) as minute,
--        avg(heap_used_mb) as avg_heap,
--        max(heap_used_mb) as max_heap,
--        avg(rss_mb) as avg_rss
-- FROM request_events
-- WHERE timestamp > now() - INTERVAL 1 HOUR
-- GROUP BY minute
-- ORDER BY minute;

-- Cache hit rate by endpoint
-- SELECT endpoint,
--        round(countIf(cache_hit = 1) / count() * 100, 2) as cache_hit_rate,
--        count() as total
-- FROM request_events
-- WHERE timestamp > now() - INTERVAL 24 HOUR
-- GROUP BY endpoint;


-- ============================================================================
-- MEMORY MANAGEMENT
-- ============================================================================
--
-- Built-in safeguards:
-- 1. TTL (30 days) - auto-deletes old data via background merges
-- 2. LowCardinality columns - reduces memory for repeated strings (hostname, source, etc)
-- 3. Monthly partitioning - enables efficient partition drops
-- 4. Compression enabled client-side
--
-- Monitor disk usage:
-- SELECT database, table, formatReadableSize(sum(bytes)) as size
-- FROM system.parts
-- WHERE active
-- GROUP BY database, table;
--
-- Manual partition cleanup (if needed):
-- ALTER TABLE request_events DROP PARTITION '202501';
--
-- Check TTL progress:
-- SELECT table, formatReadableSize(sum(bytes)) as size,
--        min(min_date), max(max_date)
-- FROM system.parts
-- WHERE database = 'smry_analytics' AND active
-- GROUP BY table;
