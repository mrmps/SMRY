import { createLogger } from "./logger";
import { randomUUID } from "crypto";
import { trackEvent, ErrorSeverity } from "./clickhouse";

/**
 * Determine error severity based on error type
 *
 * - expected: Normal operational errors (external API failures, paywalls, validation)
 *   → Logged as INFO, doesn't trigger alerts
 * - degraded: Service partially impaired but functioning (cache failures)
 *   → Logged as WARN, may need attention
 * - unexpected: Bugs, crashes, unhandled exceptions
 *   → Logged as ERROR, requires immediate attention
 */
function getErrorSeverity(errorType: string | undefined): ErrorSeverity {
  if (!errorType) return "unexpected";

  const expectedErrors = [
    "DIFFBOT_ERROR",     // External API failures (404s, 403s, timeouts)
    "PAYWALL_ERROR",     // Hard paywalls - expected behavior
    "VALIDATION_ERROR",  // Bad user input
    "RATE_LIMIT_ERROR",  // Rate limiting - normal operation
    "RATE_LIMIT",        // Alternative rate limit type
    "TIMEOUT_ERROR",     // External timeouts
    "NETWORK_ERROR",     // Network issues with external services
    "PROXY_ERROR",       // Proxy failures
    "PARSE_ERROR",       // Content parsing issues (site structure)
  ];

  const degradedErrors = [
    "CACHE_ERROR",       // Cache failures - service degraded but working
  ];

  if (expectedErrors.includes(errorType)) {
    return "expected";
  }

  if (degradedErrors.includes(errorType)) {
    return "degraded";
  }

  // UNKNOWN_ERROR or any unrecognized type = unexpected
  return "unexpected";
}

const logger = createLogger("request");

/**
 * Wide Event / Canonical Log Line Pattern
 *
 * Instead of scattered log lines, we build ONE comprehensive event per request.
 * This event is emitted at the end of the request with all context.
 *
 * Usage:
 *   const ctx = createRequestContext({ method: "GET", path: "/api/article" });
 *   ctx.set("user_id", userId);
 *   ctx.set("cache_hit", true);
 *   // ... do work ...
 *   ctx.success({ article_length: 5000 });  // or ctx.error(err);
 */

export interface RequestContext {
  /** Add a field to the event */
  set: (key: string, value: unknown) => void;
  /** Merge multiple fields at once */
  merge: (fields: Record<string, unknown>) => void;
  /** Mark request as successful and emit the wide event */
  success: (extra?: Record<string, unknown>) => void;
  /** Mark request as failed and emit the wide event */
  error: (err: Error | string, extra?: Record<string, unknown>) => void;
  /** Get the request ID for propagation */
  requestId: string;
  /** Get current duration in ms */
  durationMs: () => number;
}

interface InitialContext {
  method?: string;
  path?: string;
  source?: string;
  ip?: string;
  userAgent?: string;
}

/**
 * Create a request context for building wide events.
 * Call success() or error() at the end to emit the canonical log line.
 */
export function createRequestContext(initial?: InitialContext): RequestContext {
  const startTime = Date.now();
  const requestId = `req_${randomUUID().slice(0, 8)}`;

  const event: Record<string, unknown> = {
    request_id: requestId,
    timestamp: new Date().toISOString(),
    service: "smry",
    version: process.env.npm_package_version || "unknown",
    env: process.env.NODE_ENV || "development",
    ...initial,
  };

  const set = (key: string, value: unknown) => {
    event[key] = value;
  };

  const merge = (fields: Record<string, unknown>) => {
    Object.assign(event, fields);
  };

  const durationMs = () => Date.now() - startTime;

  const emit = (outcome: "success" | "error", extra?: Record<string, unknown>) => {
    event.duration_ms = durationMs();
    event.outcome = outcome;

    // Add memory usage for monitoring memory leaks
    const memUsage = process.memoryUsage();
    event.heap_used_mb = Math.round(memUsage.heapUsed / 1024 / 1024);
    event.heap_total_mb = Math.round(memUsage.heapTotal / 1024 / 1024);
    event.rss_mb = Math.round(memUsage.rss / 1024 / 1024);

    if (extra) {
      Object.assign(event, extra);
    }

    // Determine error severity for proper log level
    const errorSeverity = outcome === "error"
      ? getErrorSeverity(event.error_type as string | undefined)
      : "";
    event.error_severity = errorSeverity;

    // Emit the canonical log line with appropriate level:
    // - SUCCESS → INFO
    // - ERROR + expected → INFO (normal operational failure)
    // - ERROR + degraded → WARN (service partially impaired)
    // - ERROR + unexpected → ERROR (bug, needs attention)
    if (outcome === "success") {
      logger.info(event, "request completed");
    } else if (errorSeverity === "expected") {
      logger.info(event, "request completed");
    } else if (errorSeverity === "degraded") {
      logger.warn(event, "request completed");
    } else {
      logger.error(event, "request completed");
    }

    // Send to Clickhouse analytics (fire-and-forget, non-blocking)
    // trackEvent is memory-safe: bounded buffer, auto-flush, no errors thrown
    trackEvent({
      request_id: event.request_id as string,
      timestamp: event.timestamp as string,
      method: (event.method as string) || "",
      endpoint: (event.endpoint as string) || "",
      path: (event.path as string) || "",
      url: (event.url as string) || "",
      hostname: (event.hostname as string) || "",
      source: (event.source as string) || "",
      outcome: event.outcome as string,
      status_code: (event.status_code as number) || 0,
      error_type: (event.error_type as string) || "",
      error_message: (event.error_message as string) || "",
      error_severity: (event.error_severity as ErrorSeverity) || "",
      // Upstream error info - which host/service actually caused the error
      upstream_hostname: (event.upstream_hostname as string) || "",
      upstream_status_code: (event.upstream_status_code as number) || 0,
      upstream_error_code: (event.upstream_error_code as string) || "",
      upstream_message: (event.upstream_message as string) || "",
      duration_ms: event.duration_ms as number,
      fetch_ms: (event.fetch_ms as number) || 0,
      cache_lookup_ms: (event.cache_lookup_ms as number) || 0,
      cache_save_ms: (event.cache_save_ms as number) || 0,
      cache_hit: event.cache_hit ? 1 : 0,
      cache_status: (event.cache_status as string) || "",
      article_length: (event.article_length as number) || 0,
      article_title: (event.article_title as string) || "",
      summary_length: (event.summary_length as number) || 0,
      input_tokens: (event.input_tokens as number) || 0,
      output_tokens: (event.output_tokens as number) || 0,
      is_premium: event.is_premium ? 1 : 0,
      client_ip: (event.ip as string) || "",
      user_agent: (event.userAgent as string) || "",
      heap_used_mb: event.heap_used_mb as number,
      heap_total_mb: event.heap_total_mb as number,
      rss_mb: event.rss_mb as number,
      env: (event.env as string) || "",
      version: (event.version as string) || "",
    });
  };

  const success = (extra?: Record<string, unknown>) => {
    emit("success", extra);
  };

  const error = (err: Error | string, extra?: Record<string, unknown>) => {
    const errorInfo: Record<string, unknown> = {
      error_message: typeof err === "string" ? err : err.message,
    };

    if (typeof err !== "string") {
      errorInfo.error_type = err.name;
      if ("code" in err) {
        errorInfo.error_code = (err as Error & { code?: string }).code;
      }
    }

    emit("error", { ...errorInfo, ...extra });
  };

  return {
    set,
    merge,
    success,
    error,
    requestId,
    durationMs,
  };
}

/**
 * Extract common request info from NextRequest
 */
export function extractRequestInfo(request: Request): InitialContext {
  const url = new URL(request.url);
  return {
    method: request.method,
    path: url.pathname,
    userAgent: request.headers.get("user-agent") || undefined,
  };
}

/**
 * Extract client IP from request headers (works with Vercel/Cloudflare)
 */
export function extractClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}
