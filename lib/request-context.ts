import { createLogger } from "./logger";
import { randomUUID } from "crypto";

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

    if (extra) {
      Object.assign(event, extra);
    }

    // Emit the canonical log line
    if (outcome === "error") {
      logger.error(event, "request completed");
    } else {
      logger.info(event, "request completed");
    }
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
