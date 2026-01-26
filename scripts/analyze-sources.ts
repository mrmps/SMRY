/**
 * Analyze source effectiveness from ClickHouse logs
 * Run with: bun run scripts/analyze-sources.ts
 * Make sure .env.local is loaded or env vars are set
 */

import { createClient } from "@clickhouse/client";

// Load .env.local manually for bun
const projectRoot = import.meta.dir.replace("/scripts", "");
const envFile = Bun.file(`${projectRoot}/.env`);
const envContent = await envFile.text();
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith("#")) {
    const [key, ...valueParts] = trimmed.split("=");
    if (key && valueParts.length > 0) {
      const value = valueParts.join("=").replace(/^["']|["']$/g, "");
      process.env[key] = value;
    }
  }
}

const client = createClient({
  url: process.env.CLICKHOUSE_URL!,
  username: process.env.CLICKHOUSE_USER!,
  password: process.env.CLICKHOUSE_PASSWORD!,
  database: process.env.CLICKHOUSE_DATABASE!,
  request_timeout: 60_000,
});

async function query<T>(sql: string): Promise<T[]> {
  const result = await client.query({ query: sql, format: "JSONEachRow" });
  return result.json<T>();
}

async function main() {
  console.log("=== Source Effectiveness Analysis ===\n");

  // 1. Overall source success rates
  console.log("1. OVERALL SOURCE SUCCESS RATES (last 7 days)");
  console.log("-".repeat(60));
  const sourceRates = await query<{
    source: string;
    total: string;
    successes: string;
    success_rate: string;
  }>(`
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
    ORDER BY total DESC
  `);
  console.table(sourceRates);

  // 2. For URLs where multiple sources were tried, how many had only one success?
  console.log("\n2. URLs WHERE ONLY ONE SOURCE SUCCEEDED (last 7 days)");
  console.log("-".repeat(60));
  const onlyOneWorked = await query<{
    url: string;
    sources_tried: string;
    sources_succeeded: string;
    successful_source: string;
  }>(`
    SELECT
      url,
      uniq(source) as sources_tried,
      uniqIf(source, outcome = 'success') as sources_succeeded,
      groupArrayIf(source, outcome = 'success')[1] as successful_source
    FROM request_events
    WHERE timestamp > now() - INTERVAL 7 DAY
      AND source != ''
      AND endpoint = '/api/article'
    GROUP BY url
    HAVING sources_tried >= 2 AND sources_succeeded = 1
    ORDER BY sources_tried DESC
    LIMIT 50
  `);
  console.log(`Found ${onlyOneWorked.length} URLs where only 1 source worked`);
  if (onlyOneWorked.length > 0) {
    console.table(onlyOneWorked.slice(0, 20));
  }

  // 3. Which source is the "only one that works" most often?
  console.log("\n3. WHEN ONLY ONE SOURCE WORKS, WHICH ONE? (last 7 days)");
  console.log("-".repeat(60));
  const singleSourceWinner = await query<{
    successful_source: string;
    count: string;
    percentage: string;
  }>(`
    WITH single_success_urls AS (
      SELECT
        url,
        groupArrayIf(source, outcome = 'success')[1] as successful_source
      FROM request_events
      WHERE timestamp > now() - INTERVAL 7 DAY
        AND source != ''
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
    ORDER BY count DESC
  `);
  console.table(singleSourceWinner);

  // 4. What about when ALL sources fail vs when at least one works?
  console.log("\n4. URL OUTCOME DISTRIBUTION (last 7 days)");
  console.log("-".repeat(60));
  const urlOutcomes = await query<{
    outcome_type: string;
    url_count: string;
    percentage: string;
  }>(`
    WITH url_stats AS (
      SELECT
        url,
        uniq(source) as sources_tried,
        uniqIf(source, outcome = 'success') as sources_succeeded
      FROM request_events
      WHERE timestamp > now() - INTERVAL 7 DAY
        AND source != ''
        AND endpoint = '/api/article'
      GROUP BY url
      HAVING sources_tried >= 2
    )
    SELECT
      CASE
        WHEN sources_succeeded = 0 THEN 'all_failed'
        WHEN sources_succeeded = 1 THEN 'only_one_worked'
        WHEN sources_succeeded = 2 THEN 'two_worked'
        WHEN sources_succeeded = 3 THEN 'three_worked'
        ELSE 'all_worked'
      END as outcome_type,
      count() as url_count,
      round(count() / (SELECT count() FROM url_stats) * 100, 2) as percentage
    FROM url_stats
    GROUP BY outcome_type
    ORDER BY url_count DESC
  `);
  console.table(urlOutcomes);

  // 5. Correlation: when smry-fast fails, how often does smry-slow/wayback save the day?
  console.log("\n5. FALLBACK EFFECTIVENESS: When smry-fast fails... (last 7 days)");
  console.log("-".repeat(60));
  const fallbackStats = await query<{
    scenario: string;
    count: string;
    percentage: string;
  }>(`
    WITH url_outcomes AS (
      SELECT
        url,
        maxIf(1, source = 'smry-fast' AND outcome = 'success') as fast_success,
        maxIf(1, source = 'smry-slow' AND outcome = 'success') as slow_success,
        maxIf(1, source = 'wayback' AND outcome = 'success') as wayback_success,
        maxIf(1, source = 'smry-fast') as fast_tried,
        maxIf(1, source = 'smry-slow') as slow_tried,
        maxIf(1, source = 'wayback') as wayback_tried
      FROM request_events
      WHERE timestamp > now() - INTERVAL 7 DAY
        AND source IN ('smry-fast', 'smry-slow', 'wayback')
        AND endpoint = '/api/article'
      GROUP BY url
      HAVING fast_tried = 1 AND fast_success = 0  -- smry-fast was tried and failed
    )
    SELECT
      CASE
        WHEN slow_success = 1 AND wayback_success = 1 THEN 'both smry-slow and wayback worked'
        WHEN slow_success = 1 THEN 'only smry-slow worked'
        WHEN wayback_success = 1 THEN 'only wayback worked'
        ELSE 'nothing worked'
      END as scenario,
      count() as count,
      round(count() / (SELECT count() FROM url_outcomes) * 100, 2) as percentage
    FROM url_outcomes
    GROUP BY scenario
    ORDER BY count DESC
  `);
  console.table(fallbackStats);

  // 6. Average latency by source
  console.log("\n6. LATENCY BY SOURCE (last 7 days)");
  console.log("-".repeat(60));
  const latencyStats = await query<{
    source: string;
    avg_ms: string;
    p50_ms: string;
    p95_ms: string;
    p99_ms: string;
  }>(`
    SELECT
      source,
      round(avg(fetch_ms)) as avg_ms,
      round(quantile(0.5)(fetch_ms)) as p50_ms,
      round(quantile(0.95)(fetch_ms)) as p95_ms,
      round(quantile(0.99)(fetch_ms)) as p99_ms
    FROM request_events
    WHERE timestamp > now() - INTERVAL 7 DAY
      AND source != ''
      AND endpoint = '/api/article'
      AND outcome = 'success'
      AND fetch_ms > 0
    GROUP BY source
    ORDER BY avg_ms
  `);
  console.table(latencyStats);

  // 7. If we called sources SEQUENTIALLY (fast -> slow -> wayback), what would be the impact?
  console.log("\n7. SEQUENTIAL STRATEGY SIMULATION (last 7 days)");
  console.log("-".repeat(60));
  const sequentialSim = await query<{
    strategy: string;
    urls_resolved: string;
    avg_api_calls_per_url: string;
    total_api_calls: string;
  }>(`
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
        CASE
          WHEN fast_success = 1 THEN 1  -- just fast
          WHEN slow_success = 1 THEN 2  -- fast failed, then slow
          WHEN wayback_success = 1 THEN 3  -- fast+slow failed, then wayback
          ELSE 3  -- tried all 3, none worked
        END as calls_needed_sequential,
        3 as calls_parallel
      FROM url_outcomes
    )
    SELECT
      'Current (parallel)' as strategy,
      toString(countIf(fast_success = 1 OR slow_success = 1 OR wayback_success = 1)) as urls_resolved,
      '3.00' as avg_api_calls_per_url,
      toString(count() * 3) as total_api_calls
    FROM sequential_analysis
    UNION ALL
    SELECT
      'Sequential (fast->slow->wayback)' as strategy,
      toString(countIf(fast_success = 1 OR slow_success = 1 OR wayback_success = 1)) as urls_resolved,
      toString(round(avg(calls_needed_sequential), 2)) as avg_api_calls_per_url,
      toString(sum(calls_needed_sequential)) as total_api_calls
    FROM sequential_analysis
  `);
  console.table(sequentialSim);

  // 8. What if we removed a source entirely?
  console.log("\n8. IMPACT OF REMOVING A SOURCE (last 7 days)");
  console.log("-".repeat(60));
  const removalImpact = await query<{
    scenario: string;
    urls_resolved: string;
    resolution_rate: string;
  }>(`
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
    SELECT
      'All 3 sources' as scenario,
      toString(countIf(fast_success = 1 OR slow_success = 1 OR wayback_success = 1)) as urls_resolved,
      toString(round(countIf(fast_success = 1 OR slow_success = 1 OR wayback_success = 1) / count() * 100, 2)) as resolution_rate
    FROM url_outcomes
    UNION ALL
    SELECT
      'Without smry-fast' as scenario,
      toString(countIf(slow_success = 1 OR wayback_success = 1)) as urls_resolved,
      toString(round(countIf(slow_success = 1 OR wayback_success = 1) / count() * 100, 2)) as resolution_rate
    FROM url_outcomes
    UNION ALL
    SELECT
      'Without smry-slow' as scenario,
      toString(countIf(fast_success = 1 OR wayback_success = 1)) as urls_resolved,
      toString(round(countIf(fast_success = 1 OR wayback_success = 1) / count() * 100, 2)) as resolution_rate
    FROM url_outcomes
    UNION ALL
    SELECT
      'Without wayback' as scenario,
      toString(countIf(fast_success = 1 OR slow_success = 1)) as urls_resolved,
      toString(round(countIf(fast_success = 1 OR slow_success = 1) / count() * 100, 2)) as resolution_rate
    FROM url_outcomes
    UNION ALL
    SELECT
      'Only smry-fast' as scenario,
      toString(countIf(fast_success = 1)) as urls_resolved,
      toString(round(countIf(fast_success = 1) / count() * 100, 2)) as resolution_rate
    FROM url_outcomes
    UNION ALL
    SELECT
      'Only smry-slow' as scenario,
      toString(countIf(slow_success = 1)) as urls_resolved,
      toString(round(countIf(slow_success = 1) / count() * 100, 2)) as resolution_rate
    FROM url_outcomes
  `);
  console.table(removalImpact);

  // 9. Unique value: URLs where ONLY a specific source works
  console.log("\n9. UNIQUE VALUE: URLs where ONLY this source works (last 7 days)");
  console.log("-".repeat(60));
  const uniqueValue = await query<{
    source: string;
    exclusively_resolves: string;
    percentage_of_resolutions: string;
  }>(`
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
    totals AS (
      SELECT countIf(fast_success = 1 OR slow_success = 1 OR wayback_success = 1) as total_resolved
      FROM url_outcomes
    )
    SELECT
      'smry-fast' as source,
      toString(countIf(fast_success = 1 AND slow_success = 0 AND wayback_success = 0)) as exclusively_resolves,
      toString(round(countIf(fast_success = 1 AND slow_success = 0 AND wayback_success = 0) / (SELECT total_resolved FROM totals) * 100, 2)) as percentage_of_resolutions
    FROM url_outcomes
    UNION ALL
    SELECT
      'smry-slow' as source,
      toString(countIf(fast_success = 0 AND slow_success = 1 AND wayback_success = 0)) as exclusively_resolves,
      toString(round(countIf(fast_success = 0 AND slow_success = 1 AND wayback_success = 0) / (SELECT total_resolved FROM totals) * 100, 2)) as percentage_of_resolutions
    FROM url_outcomes
    UNION ALL
    SELECT
      'wayback' as source,
      toString(countIf(fast_success = 0 AND slow_success = 0 AND wayback_success = 1)) as exclusively_resolves,
      toString(round(countIf(fast_success = 0 AND slow_success = 0 AND wayback_success = 1) / (SELECT total_resolved FROM totals) * 100, 2)) as percentage_of_resolutions
    FROM url_outcomes
  `);
  console.table(uniqueValue);

  await client.close();
  console.log("\n=== Analysis Complete ===");
}

main().catch(console.error);
