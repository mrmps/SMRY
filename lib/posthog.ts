import { PostHog } from "posthog-node";

/**
 * PostHog Analytics Client
 *
 * Replaces the custom ClickHouse setup. PostHog handles batching,
 * retries, and connection management internally via its SDK.
 *
 * Env vars:
 *   POSTHOG_API_KEY          – project API key (server-side)
 *   POSTHOG_HOST             – PostHog instance URL
 *   POSTHOG_PROJECT_ID       – numeric project ID (for HogQL queries)
 *   POSTHOG_PERSONAL_API_KEY – personal API key (for HogQL query API)
 */

let client: PostHog | null = null;

function getClient(): PostHog | null {
  if (client) return client;

  const apiKey = process.env.POSTHOG_API_KEY;
  const host = process.env.POSTHOG_HOST;
  if (!apiKey || !host) return null;

  client = new PostHog(apiKey, {
    host,
    flushAt: 50,
    flushInterval: 5000,
  });
  return client;
}

// ---------------------------------------------------------------------------
// Type exports (unchanged from clickhouse.ts)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Ad Event Types
// ---------------------------------------------------------------------------

export type AdEventStatus = "filled" | "no_fill" | "premium_user" | "gravity_error" | "timeout" | "error";
export type AdEventType = "request" | "impression" | "click" | "dismiss";

export interface AdEvent {
  event_id: string;
  timestamp: string;
  event_type: AdEventType;
  url: string;
  hostname: string;
  article_title: string;
  article_content_length: number;
  session_id: string;
  user_id: string;
  is_premium: number;
  device_type: string;
  os: string;
  browser: string;
  status: AdEventStatus;
  gravity_status_code: number;
  error_message: string;
  gravity_forwarded: number;
  brand_name: string;
  ad_title: string;
  ad_text: string;
  click_url: string;
  imp_url: string;
  cta: string;
  favicon: string;
  ad_count: number;
  duration_ms: number;
  env: string;
}

// ---------------------------------------------------------------------------
// trackEvent – captures request analytics
// ---------------------------------------------------------------------------

export function trackEvent(event: Partial<AnalyticsEvent>): void {
  const posthog = getClient();
  if (!posthog) return;

  const distinctId = event.request_id || `req_${crypto.randomUUID().slice(0, 8)}`;

  posthog.capture({
    distinctId,
    event: "request_event",
    properties: {
      ...event,
      timestamp: event.timestamp || new Date().toISOString(),
    },
  });
}

// ---------------------------------------------------------------------------
// trackAdEvent – captures ad funnel analytics
// ---------------------------------------------------------------------------

export function trackAdEvent(event: Partial<AdEvent>): void {
  const posthog = getClient();
  if (!posthog) return;

  const eventId = event.event_id || crypto.randomUUID();
  const distinctId = event.session_id || eventId;

  posthog.capture({
    distinctId,
    event: "ad_event",
    properties: {
      ...event,
      event_id: eventId,
      timestamp: event.timestamp || new Date().toISOString(),
    },
  });
}

// ---------------------------------------------------------------------------
// queryPostHog – HogQL query API (replaces queryClickhouse)
// ---------------------------------------------------------------------------

export async function queryPostHog<T>(query: string): Promise<T[]> {
  const host = process.env.POSTHOG_HOST;
  const projectId = process.env.POSTHOG_PROJECT_ID;
  const personalApiKey = process.env.POSTHOG_PERSONAL_API_KEY;

  if (!host || !projectId || !personalApiKey) return [];

  try {
    const response = await fetch(`${host}/api/projects/${projectId}/query/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${personalApiKey}`,
      },
      body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
    });

    if (!response.ok) {
      console.error(`[posthog] HogQL query failed (${response.status}):`, await response.text().catch(() => ""));
      return [];
    }

    const data = await response.json();
    // HogQL returns { columns: string[], results: any[][] }
    const columns: string[] = data.columns ?? [];
    const rows: unknown[][] = data.results ?? [];

    return rows.map((row) => {
      const obj: Record<string, unknown> = {};
      columns.forEach((col, i) => {
        obj[col] = row[i];
      });
      return obj as T;
    });
  } catch (error) {
    console.error("[posthog] HogQL query error:", error instanceof Error ? error.message : String(error));
    return [];
  }
}

// ---------------------------------------------------------------------------
// getBufferStats – simplified (PostHog SDK manages its own buffer)
// ---------------------------------------------------------------------------

export function getBufferStats(): {
  size: number;
  maxSize: number;
  activeQueries: number;
  queuedQueries: number;
  maxConcurrentQueries: number;
} {
  return {
    size: 0,
    maxSize: 0,
    activeQueries: 0,
    queuedQueries: 0,
    maxConcurrentQueries: 0,
  };
}

// ---------------------------------------------------------------------------
// closePostHog – graceful shutdown
// ---------------------------------------------------------------------------

export async function closePostHog(): Promise<void> {
  if (client) {
    await client.shutdown();
    client = null;
  }
}

// Register shutdown handler
let isInitialized = false;
if (!isInitialized && typeof process !== "undefined") {
  isInitialized = true;
  process.on("beforeExit", async () => {
    await closePostHog();
  });
}
