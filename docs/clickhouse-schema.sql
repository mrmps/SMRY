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
    endpoint LowCardinality(String),  -- /api/article, /api/summary, /api/jina
    path String,

    -- Article/content context
    url String,
    hostname LowCardinality(String),  -- nytimes.com, wsj.com, etc.
    source LowCardinality(String),    -- smry-fast, smry-slow, wayback, jina.ai

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
TTL timestamp + INTERVAL 90 DAY
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
