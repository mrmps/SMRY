/**
 * Error Rate Alerting
 *
 * Monitors ClickHouse for error rate spikes and sends alerts via Resend.
 * Runs on a cron schedule from the Elysia server.
 */

import { Resend } from "resend";
import { queryClickhouse } from "./clickhouse";
import { env } from "./env";

// Alert configuration
const ALERT_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes between alerts
const ERROR_RATE_MULTIPLIER = 2; // Alert if error rate is 2x baseline
const MIN_ERRORS_TO_ALERT = 10; // Minimum errors to trigger alert (avoid noise)
const MIN_REQUESTS_FOR_BASELINE = 20; // Need enough baseline data

let lastAlertSent = 0;

interface ErrorRateStats {
  recent_errors: number;
  recent_total: number;
  recent_error_rate: number;
  baseline_errors: number;
  baseline_total: number;
  baseline_error_rate: number;
}

interface TopError {
  error_type: string;
  error_message: string;
  count: number;
}

/**
 * Query recent error rate (last 5 minutes) vs baseline (last hour, excluding last 5 min)
 */
async function getErrorRateStats(): Promise<ErrorRateStats | null> {
  const query = `
    SELECT
      countIf(outcome = 'error' AND timestamp > now() - INTERVAL 5 MINUTE) as recent_errors,
      countIf(timestamp > now() - INTERVAL 5 MINUTE) as recent_total,
      countIf(outcome = 'error' AND timestamp <= now() - INTERVAL 5 MINUTE AND timestamp > now() - INTERVAL 1 HOUR) as baseline_errors,
      countIf(timestamp <= now() - INTERVAL 5 MINUTE AND timestamp > now() - INTERVAL 1 HOUR) as baseline_total
    FROM request_events
    WHERE timestamp > now() - INTERVAL 1 HOUR
  `;

  const results = await queryClickhouse<{
    recent_errors: number;
    recent_total: number;
    baseline_errors: number;
    baseline_total: number;
  }>(query);

  if (results.length === 0) return null;

  const row = results[0];
  return {
    recent_errors: Number(row.recent_errors),
    recent_total: Number(row.recent_total),
    recent_error_rate: row.recent_total > 0 ? row.recent_errors / row.recent_total : 0,
    baseline_errors: Number(row.baseline_errors),
    baseline_total: Number(row.baseline_total),
    baseline_error_rate: row.baseline_total > 0 ? row.baseline_errors / row.baseline_total : 0,
  };
}

/**
 * Get top errors from the last 5 minutes for alert context
 */
async function getTopRecentErrors(): Promise<TopError[]> {
  const query = `
    SELECT
      error_type,
      error_message,
      count() as count
    FROM request_events
    WHERE timestamp > now() - INTERVAL 5 MINUTE
      AND outcome = 'error'
    GROUP BY error_type, error_message
    ORDER BY count DESC
    LIMIT 5
  `;

  return queryClickhouse<TopError>(query);
}

/**
 * Send alert email via Resend
 */
async function sendAlertEmail(stats: ErrorRateStats, topErrors: TopError[]): Promise<void> {
  const resend = new Resend(env.RESEND_API_KEY);

  const recentPct = (stats.recent_error_rate * 100).toFixed(1);
  const baselinePct = (stats.baseline_error_rate * 100).toFixed(1);

  const errorList = topErrors
    .map((e) => `  - ${e.error_type}: ${e.error_message.slice(0, 100)} (${e.count}x)`)
    .join("\n");

  const htmlErrorList = topErrors
    .map(
      (e) =>
        `<li><strong>${e.error_type}</strong>: ${e.error_message.slice(0, 100)} (${e.count}x)</li>`
    )
    .join("");

  await resend.emails.send({
    from: "SMRY Alerts <onboarding@resend.dev>",
    to: env.ALERT_EMAIL,
    subject: `[SMRY Alert] Error rate spike: ${recentPct}% (was ${baselinePct}%)`,
    text: `
Error Rate Spike Detected

Recent (5 min): ${stats.recent_errors}/${stats.recent_total} requests failed (${recentPct}%)
Baseline (1 hr): ${stats.baseline_errors}/${stats.baseline_total} requests failed (${baselinePct}%)

Top errors:
${errorList}

Check the admin dashboard for more details.
    `.trim(),
    html: `
<h2>Error Rate Spike Detected</h2>
<p>
  <strong>Recent (5 min):</strong> ${stats.recent_errors}/${stats.recent_total} requests failed (${recentPct}%)<br/>
  <strong>Baseline (1 hr):</strong> ${stats.baseline_errors}/${stats.baseline_total} requests failed (${baselinePct}%)
</p>
<h3>Top errors:</h3>
<ul>${htmlErrorList}</ul>
<p><a href="${env.NEXT_PUBLIC_URL}/admin">View Admin Dashboard</a></p>
    `.trim(),
  });

  console.log(`[alerting] Alert email sent to ${env.ALERT_EMAIL}`);
}

/**
 * Main check function - called by cron job
 */
export async function checkErrorRateAndAlert(): Promise<void> {
  try {
    const stats = await getErrorRateStats();
    if (!stats) {
      console.log("[alerting] No data from ClickHouse");
      return;
    }

    // Need enough baseline data
    if (stats.baseline_total < MIN_REQUESTS_FOR_BASELINE) {
      console.log(`[alerting] Not enough baseline data (${stats.baseline_total} requests)`);
      return;
    }

    // Check if we should alert
    const shouldAlert =
      stats.recent_errors >= MIN_ERRORS_TO_ALERT &&
      stats.recent_error_rate > stats.baseline_error_rate * ERROR_RATE_MULTIPLIER;

    if (!shouldAlert) {
      return;
    }

    // Check cooldown
    const now = Date.now();
    if (now - lastAlertSent < ALERT_COOLDOWN_MS) {
      console.log("[alerting] Skipping alert (cooldown active)");
      return;
    }

    // Send alert
    const topErrors = await getTopRecentErrors();
    await sendAlertEmail(stats, topErrors);
    lastAlertSent = now;
  } catch (error) {
    console.error("[alerting] Error checking error rate:", error);
  }
}
