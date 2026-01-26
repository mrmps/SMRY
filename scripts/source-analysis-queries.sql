-- =============================================================================
-- SOURCE EFFECTIVENESS ANALYSIS QUERIES
-- Run these in ClickHouse console to understand source behavior
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. OVERALL SOURCE SUCCESS RATES (baseline)
-- -----------------------------------------------------------------------------
SELECT
  source,
  count() as total,
  countIf(outcome = 'success') as successes,
  round(countIf(outcome = 'success') / count() * 100, 2) as success_rate
FROM request_events
WHERE timestamp > now() - INTERVAL 7 DAY
  AND source != ''
  AND endpoint = '/api/article'
GROUP BY source
ORDER BY total DESC;

-- -----------------------------------------------------------------------------
-- 2. HOW OFTEN DOES ONLY ONE SOURCE WORK? (and which one?)
-- This answers: "For articles where multiple sources were tried,
-- how often was only one successful?"
-- -----------------------------------------------------------------------------
WITH url_outcomes AS (
  SELECT
    url,
    uniq(source) as sources_tried,
    uniqIf(source, outcome = 'success') as sources_succeeded,
    groupArrayIf(source, outcome = 'success') as successful_sources
  FROM request_events
  WHERE timestamp > now() - INTERVAL 7 DAY
    AND source IN ('smry-fast', 'smry-slow', 'wayback')
    AND endpoint = '/api/article'
  GROUP BY url
  HAVING sources_tried >= 2  -- At least 2 sources were tried
)
SELECT
  CASE sources_succeeded
    WHEN 0 THEN 'all_failed'
    WHEN 1 THEN 'only_one_worked'
    WHEN 2 THEN 'two_worked'
    ELSE 'all_worked'
  END as outcome_type,
  count() as url_count,
  round(count() / (SELECT count() FROM url_outcomes) * 100, 2) as percentage
FROM url_outcomes
GROUP BY outcome_type
ORDER BY url_count DESC;

-- -----------------------------------------------------------------------------
-- 3. WHEN ONLY ONE SOURCE WORKS, WHICH ONE IS IT?
-- Shows which source is the "hero" when others fail
-- -----------------------------------------------------------------------------
WITH single_success_urls AS (
  SELECT
    url,
    groupArrayIf(source, outcome = 'success')[1] as successful_source
  FROM request_events
  WHERE timestamp > now() - INTERVAL 7 DAY
    AND source IN ('smry-fast', 'smry-slow', 'wayback')
    AND endpoint = '/api/article'
  GROUP BY url
  HAVING uniq(source) >= 2 AND uniqIf(source, outcome = 'success') = 1
)
SELECT
  successful_source,
  count() as count,
  round(count() / (SELECT count() FROM single_success_urls) * 100, 2) as percentage
FROM single_success_urls
GROUP BY successful_source
ORDER BY count DESC;

-- -----------------------------------------------------------------------------
-- 4. FALLBACK EFFECTIVENESS: When smry-fast fails, what saves the day?
-- Answers: "If we called smry-fast first and it failed, how often would
-- smry-slow or wayback have worked?"
-- -----------------------------------------------------------------------------
WITH url_outcomes AS (
  SELECT
    url,
    maxIf(1, source = 'smry-fast' AND outcome = 'success') as fast_success,
    maxIf(1, source = 'smry-slow' AND outcome = 'success') as slow_success,
    maxIf(1, source = 'wayback' AND outcome = 'success') as wayback_success,
    maxIf(1, source = 'smry-fast') as fast_tried
  FROM request_events
  WHERE timestamp > now() - INTERVAL 7 DAY
    AND source IN ('smry-fast', 'smry-slow', 'wayback')
    AND endpoint = '/api/article'
  GROUP BY url
  HAVING fast_tried = 1 AND fast_success = 0  -- smry-fast was tried and failed
)
SELECT
  CASE
    WHEN slow_success = 1 AND wayback_success = 1 THEN 'both smry-slow AND wayback worked'
    WHEN slow_success = 1 THEN 'only smry-slow worked'
    WHEN wayback_success = 1 THEN 'only wayback worked'
    ELSE 'nothing worked (hard paywall or broken)'
  END as scenario,
  count() as count,
  round(count() / (SELECT count() FROM url_outcomes) * 100, 2) as percentage
FROM url_outcomes
GROUP BY scenario
ORDER BY count DESC;

-- -----------------------------------------------------------------------------
-- 5. SEQUENTIAL vs PARALLEL: How many API calls would we save?
-- Compares current parallel strategy (always 3 calls) vs sequential
-- -----------------------------------------------------------------------------
WITH url_outcomes AS (
  SELECT
    url,
    maxIf(1, source = 'smry-fast' AND outcome = 'success') as fast_success,
    maxIf(1, source = 'smry-slow' AND outcome = 'success') as slow_success,
    maxIf(1, source = 'wayback' AND outcome = 'success') as wayback_success
  FROM request_events
  WHERE timestamp > now() - INTERVAL 7 DAY
    AND source IN ('smry-fast', 'smry-slow', 'wayback')
    AND endpoint = '/api/article'
  GROUP BY url
),
sequential_analysis AS (
  SELECT
    url,
    fast_success,
    slow_success,
    wayback_success,
    -- Sequential: stop as soon as one works
    CASE
      WHEN fast_success = 1 THEN 1  -- just fast
      WHEN slow_success = 1 THEN 2  -- fast failed, then slow
      WHEN wayback_success = 1 THEN 3  -- fast+slow failed, then wayback
      ELSE 3  -- tried all 3, none worked
    END as calls_needed_sequential
  FROM url_outcomes
)
SELECT
  'Current (parallel)' as strategy,
  countIf(fast_success = 1 OR slow_success = 1 OR wayback_success = 1) as urls_resolved,
  3.00 as avg_api_calls_per_url,
  count() * 3 as total_api_calls
FROM sequential_analysis
UNION ALL
SELECT
  'Sequential (fast→slow→wayback)' as strategy,
  countIf(fast_success = 1 OR slow_success = 1 OR wayback_success = 1) as urls_resolved,
  round(avg(calls_needed_sequential), 2) as avg_api_calls_per_url,
  sum(calls_needed_sequential) as total_api_calls
FROM sequential_analysis;

-- -----------------------------------------------------------------------------
-- 6. IMPACT OF REMOVING A SOURCE
-- What's the resolution rate if we removed each source?
-- -----------------------------------------------------------------------------
WITH url_outcomes AS (
  SELECT
    url,
    maxIf(1, source = 'smry-fast' AND outcome = 'success') as fast_success,
    maxIf(1, source = 'smry-slow' AND outcome = 'success') as slow_success,
    maxIf(1, source = 'wayback' AND outcome = 'success') as wayback_success
  FROM request_events
  WHERE timestamp > now() - INTERVAL 7 DAY
    AND source IN ('smry-fast', 'smry-slow', 'wayback')
    AND endpoint = '/api/article'
  GROUP BY url
)
SELECT 'All 3 sources' as scenario,
  countIf(fast_success = 1 OR slow_success = 1 OR wayback_success = 1) as urls_resolved,
  count() as total_urls,
  round(countIf(fast_success = 1 OR slow_success = 1 OR wayback_success = 1) / count() * 100, 2) as resolution_rate
FROM url_outcomes
UNION ALL
SELECT 'Without smry-fast' as scenario,
  countIf(slow_success = 1 OR wayback_success = 1) as urls_resolved,
  count() as total_urls,
  round(countIf(slow_success = 1 OR wayback_success = 1) / count() * 100, 2) as resolution_rate
FROM url_outcomes
UNION ALL
SELECT 'Without smry-slow (Diffbot)' as scenario,
  countIf(fast_success = 1 OR wayback_success = 1) as urls_resolved,
  count() as total_urls,
  round(countIf(fast_success = 1 OR wayback_success = 1) / count() * 100, 2) as resolution_rate
FROM url_outcomes
UNION ALL
SELECT 'Without wayback' as scenario,
  countIf(fast_success = 1 OR slow_success = 1) as urls_resolved,
  count() as total_urls,
  round(countIf(fast_success = 1 OR slow_success = 1) / count() * 100, 2) as resolution_rate
FROM url_outcomes;

-- -----------------------------------------------------------------------------
-- 7. UNIQUE VALUE: URLs where ONLY this source works (exclusive value)
-- These are the URLs you'd LOSE if you removed that source
-- -----------------------------------------------------------------------------
WITH url_outcomes AS (
  SELECT
    url,
    maxIf(1, source = 'smry-fast' AND outcome = 'success') as fast_success,
    maxIf(1, source = 'smry-slow' AND outcome = 'success') as slow_success,
    maxIf(1, source = 'wayback' AND outcome = 'success') as wayback_success
  FROM request_events
  WHERE timestamp > now() - INTERVAL 7 DAY
    AND source IN ('smry-fast', 'smry-slow', 'wayback')
    AND endpoint = '/api/article'
  GROUP BY url
)
SELECT 'smry-fast' as source,
  countIf(fast_success = 1 AND slow_success = 0 AND wayback_success = 0) as exclusively_resolves,
  round(countIf(fast_success = 1 AND slow_success = 0 AND wayback_success = 0) /
        countIf(fast_success = 1 OR slow_success = 1 OR wayback_success = 1) * 100, 2) as pct_of_resolutions
FROM url_outcomes
UNION ALL
SELECT 'smry-slow (Diffbot)' as source,
  countIf(fast_success = 0 AND slow_success = 1 AND wayback_success = 0) as exclusively_resolves,
  round(countIf(fast_success = 0 AND slow_success = 1 AND wayback_success = 0) /
        countIf(fast_success = 1 OR slow_success = 1 OR wayback_success = 1) * 100, 2) as pct_of_resolutions
FROM url_outcomes
UNION ALL
SELECT 'wayback' as source,
  countIf(fast_success = 0 AND slow_success = 0 AND wayback_success = 1) as exclusively_resolves,
  round(countIf(fast_success = 0 AND slow_success = 0 AND wayback_success = 1) /
        countIf(fast_success = 1 OR slow_success = 1 OR wayback_success = 1) * 100, 2) as pct_of_resolutions
FROM url_outcomes;

-- -----------------------------------------------------------------------------
-- 8. LATENCY BY SOURCE (for sequential strategy timing estimation)
-- -----------------------------------------------------------------------------
SELECT
  source,
  round(avg(fetch_ms)) as avg_ms,
  round(quantile(0.5)(fetch_ms)) as p50_ms,
  round(quantile(0.95)(fetch_ms)) as p95_ms,
  round(quantile(0.99)(fetch_ms)) as p99_ms
FROM request_events
WHERE timestamp > now() - INTERVAL 7 DAY
  AND source IN ('smry-fast', 'smry-slow', 'wayback')
  AND endpoint = '/api/article'
  AND outcome = 'success'
  AND fetch_ms > 0
GROUP BY source
ORDER BY avg_ms;

-- -----------------------------------------------------------------------------
-- 9. HOSTNAME-SPECIFIC SOURCE EFFECTIVENESS
-- Which sources work best for which sites?
-- -----------------------------------------------------------------------------
SELECT
  hostname,
  source,
  count() as requests,
  round(countIf(outcome = 'success') / count() * 100, 2) as success_rate
FROM request_events
WHERE timestamp > now() - INTERVAL 7 DAY
  AND source IN ('smry-fast', 'smry-slow', 'wayback')
  AND endpoint = '/api/article'
  AND hostname != ''
GROUP BY hostname, source
HAVING requests >= 5  -- Only sites with enough data
ORDER BY hostname, success_rate DESC;

-- -----------------------------------------------------------------------------
-- 10. COST ANALYSIS: Diffbot API calls (smry-slow costs money)
-- How many Diffbot calls could we save with sequential strategy?
-- -----------------------------------------------------------------------------
WITH url_outcomes AS (
  SELECT
    url,
    maxIf(1, source = 'smry-fast' AND outcome = 'success') as fast_success,
    maxIf(1, source = 'smry-slow') as slow_tried
  FROM request_events
  WHERE timestamp > now() - INTERVAL 7 DAY
    AND source IN ('smry-fast', 'smry-slow')
    AND endpoint = '/api/article'
  GROUP BY url
)
SELECT
  countIf(slow_tried = 1) as current_diffbot_calls,
  countIf(slow_tried = 1 AND fast_success = 0) as needed_diffbot_calls_sequential,
  countIf(slow_tried = 1 AND fast_success = 1) as wasted_diffbot_calls,
  round(countIf(slow_tried = 1 AND fast_success = 1) / countIf(slow_tried = 1) * 100, 2) as pct_wasted
FROM url_outcomes;
