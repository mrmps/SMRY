/**
 * Memory Tracker - Operation-level memory tracking for leak detection
 *
 * Instruments memory-intensive operations to identify exactly what causes spikes.
 * Unlike memory-monitor.ts (periodic snapshots), this tracks individual operations.
 *
 * Key features:
 * - Per-operation memory deltas (before/after)
 * - Cache size tracking across all bounded caches
 * - Operation correlation for post-mortem analysis
 * - Structured logs for easy parsing
 *
 * Usage:
 *   const tracker = startMemoryTrack("article-fetch", { url, source });
 *   // ... operation ...
 *   tracker.end({ bytesReceived: 12345 });
 */

import { createLogger } from "./logger";
import { getZeroClickCacheStats } from "./zeroclick";
import { getBufferStats } from "./clickhouse";
import { abuseRateLimiter } from "./rate-limit-memory";

const logger = createLogger("memory-tracker");

// Thresholds for logging (only log significant operations to avoid noise)
const DELTA_THRESHOLD_MB = 5; // Only log if operation used 5MB+
const LARGE_RESPONSE_BYTES = 500_000; // 500KB
const OPERATION_TIME_THRESHOLD_MS = 1000; // Only log slow operations

// Track active operations for correlation
const activeOperations = new Map<string, {
  name: string;
  startTime: number;
  startHeap: number;
  startRss: number;
  metadata: Record<string, unknown>;
}>();

// Operation counters for debugging
let operationIdCounter = 0;

/**
 * Get current memory usage in MB
 */
function getMemoryMb(): { heapUsed: number; rss: number; external: number; arrayBuffers: number } {
  const mem = process.memoryUsage();
  return {
    heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
    rss: Math.round(mem.rss / 1024 / 1024),
    external: Math.round(mem.external / 1024 / 1024),
    arrayBuffers: Math.round(mem.arrayBuffers / 1024 / 1024),
  };
}

/**
 * Get all cache stats for correlation
 */
export function getAllCacheStats(): Record<string, unknown> {
  try {
    const zeroClick = getZeroClickCacheStats();
    const clickhouse = getBufferStats();

    return {
      zeroclick_client_cache: zeroClick.clientCacheSize,
      zeroclick_session_failures: zeroClick.sessionFailuresSize,
      zeroclick_orphaned: zeroClick.orphanedCount,
      zeroclick_total_created: zeroClick.totalCreated,
      zeroclick_total_closed: zeroClick.totalClosed,
      clickhouse_buffer: clickhouse.size,
      clickhouse_active_queries: clickhouse.activeQueries,
      clickhouse_queued_queries: clickhouse.queuedQueries,
      rate_limiter_ips: abuseRateLimiter.size,
      active_operations: activeOperations.size,
    };
  } catch {
    return { error: "Failed to get cache stats" };
  }
}

/**
 * Log a memory snapshot with cache stats
 */
export function logMemorySnapshot(context: string, extra?: Record<string, unknown>): void {
  const mem = getMemoryMb();
  const caches = getAllCacheStats();

  logger.info({
    context,
    ...mem,
    ...caches,
    ...extra,
  }, `memory_snapshot: ${context}`);
}

interface MemoryTracker {
  /** End the operation and log results */
  end: (extra?: Record<string, unknown>) => void;
  /** Add metadata during the operation */
  addMetadata: (data: Record<string, unknown>) => void;
  /** Mark a checkpoint within the operation */
  checkpoint: (name: string, extra?: Record<string, unknown>) => void;
}

/**
 * Start tracking memory for an operation.
 * Call .end() when the operation completes.
 *
 * @param name - Operation name (e.g., "article-fetch", "ad-request", "signal-broadcast")
 * @param metadata - Initial context (url, sessionId, etc.)
 */
export function startMemoryTrack(name: string, metadata?: Record<string, unknown>): MemoryTracker {
  const opId = `${name}-${++operationIdCounter}`;
  const startTime = Date.now();
  const startMem = getMemoryMb();

  activeOperations.set(opId, {
    name,
    startTime,
    startHeap: startMem.heapUsed,
    startRss: startMem.rss,
    metadata: metadata || {},
  });

  return {
    addMetadata(data: Record<string, unknown>) {
      const op = activeOperations.get(opId);
      if (op) {
        op.metadata = { ...op.metadata, ...data };
      }
    },

    checkpoint(checkpointName: string, extra?: Record<string, unknown>) {
      const op = activeOperations.get(opId);
      if (!op) return;

      const currentMem = getMemoryMb();
      const heapDelta = currentMem.heapUsed - op.startHeap;
      const rssDelta = currentMem.rss - op.startRss;
      const elapsed = Date.now() - op.startTime;

      // Only log if significant
      if (Math.abs(heapDelta) >= DELTA_THRESHOLD_MB || Math.abs(rssDelta) >= DELTA_THRESHOLD_MB) {
        logger.info({
          op_id: opId,
          op_name: name,
          checkpoint: checkpointName,
          elapsed_ms: elapsed,
          heap_used_mb: currentMem.heapUsed,
          heap_delta_mb: heapDelta,
          rss_mb: currentMem.rss,
          rss_delta_mb: rssDelta,
          ...op.metadata,
          ...extra,
        }, `memory_checkpoint: ${name}/${checkpointName}`);
      }
    },

    end(extra?: Record<string, unknown>) {
      const op = activeOperations.get(opId);
      if (!op) return;

      activeOperations.delete(opId);

      const endTime = Date.now();
      const endMem = getMemoryMb();
      const duration = endTime - op.startTime;
      const heapDelta = endMem.heapUsed - op.startHeap;
      const rssDelta = endMem.rss - op.startRss;

      // Determine if this operation is significant enough to log
      const isSignificant =
        Math.abs(heapDelta) >= DELTA_THRESHOLD_MB ||
        Math.abs(rssDelta) >= DELTA_THRESHOLD_MB ||
        duration >= OPERATION_TIME_THRESHOLD_MS ||
        (extra?.bytes_received && (extra.bytes_received as number) >= LARGE_RESPONSE_BYTES);

      if (isSignificant) {
        const caches = getAllCacheStats();
        const logData = {
          op_id: opId,
          op_name: name,
          duration_ms: duration,
          heap_start_mb: op.startHeap,
          heap_end_mb: endMem.heapUsed,
          heap_delta_mb: heapDelta,
          rss_start_mb: op.startRss,
          rss_end_mb: endMem.rss,
          rss_delta_mb: rssDelta,
          external_mb: endMem.external,
          array_buffers_mb: endMem.arrayBuffers,
          ...caches,
          ...op.metadata,
          ...extra,
        };

        // Warn if memory grew significantly during this single operation
        if (heapDelta >= 20 || rssDelta >= 50) {
          logger.warn(logData, `memory_spike_operation: ${name} used ${rssDelta}MB RSS`);
        } else {
          logger.info(logData, `memory_operation: ${name}`);
        }
      }
    },
  };
}

/**
 * Track a fetch response for memory analysis.
 * Logs content length, response timing, and memory impact.
 */
export function trackFetchResponse(
  url: string,
  source: string,
  response: Response,
  contentLength: number,
  startTime: number
): void {
  const duration = Date.now() - startTime;
  const mem = getMemoryMb();

  // Only log large responses or slow fetches
  if (contentLength >= LARGE_RESPONSE_BYTES || duration >= OPERATION_TIME_THRESHOLD_MS) {
    logger.info({
      source,
      url_host: (() => { try { return new URL(url).hostname; } catch { return "unknown"; } })(),
      content_length_bytes: contentLength,
      content_length_mb: Math.round(contentLength / 1024 / 1024 * 100) / 100,
      duration_ms: duration,
      status: response.status,
      heap_used_mb: mem.heapUsed,
      rss_mb: mem.rss,
    }, `fetch_response: ${source} ${Math.round(contentLength / 1024)}KB in ${duration}ms`);
  }
}

/**
 * Wrap a function to track its memory usage.
 * Useful for instrumenting existing functions without modifying them.
 */
export function withMemoryTracking<T extends (...args: unknown[]) => Promise<unknown>>(
  name: string,
  fn: T,
  getMetadata?: (...args: Parameters<T>) => Record<string, unknown>
): T {
  return (async (...args: Parameters<T>) => {
    const metadata = getMetadata ? getMetadata(...args) : {};
    const tracker = startMemoryTrack(name, metadata);
    try {
      const result = await fn(...args);
      tracker.end({ success: true });
      return result;
    } catch (error) {
      tracker.end({ success: false, error: String(error) });
      throw error;
    }
  }) as T;
}

/**
 * Log when a large object is about to be created/held in memory.
 * Call this before creating large buffers, arrays, or string concatenations.
 */
export function logLargeAllocation(
  context: string,
  estimatedBytes: number,
  metadata?: Record<string, unknown>
): void {
  if (estimatedBytes < LARGE_RESPONSE_BYTES) return;

  const mem = getMemoryMb();
  logger.info({
    context,
    estimated_bytes: estimatedBytes,
    estimated_mb: Math.round(estimatedBytes / 1024 / 1024 * 100) / 100,
    heap_used_mb: mem.heapUsed,
    rss_mb: mem.rss,
    ...metadata,
  }, `large_allocation: ${context} ~${Math.round(estimatedBytes / 1024)}KB`);
}

/**
 * Periodic cache stats logger - runs every 60 seconds
 * Supplements memory-monitor.ts with cache-specific tracking
 */
let cacheStatsInterval: ReturnType<typeof setInterval> | null = null;

export function startCacheStatsLogger(): void {
  if (cacheStatsInterval) return;

  cacheStatsInterval = setInterval(() => {
    const mem = getMemoryMb();
    const caches = getAllCacheStats();

    logger.info({
      ...mem,
      ...caches,
    }, "cache_stats_snapshot");
  }, 60_000);

  cacheStatsInterval.unref();
}

export function stopCacheStatsLogger(): void {
  if (cacheStatsInterval) {
    clearInterval(cacheStatsInterval);
    cacheStatsInterval = null;
  }
}
