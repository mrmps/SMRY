/**
 * Memory Monitor - Periodic memory usage logging for leak detection
 *
 * Logs memory stats every 30 seconds to help identify memory leaks.
 * Also triggers garbage collection before logging (if --expose-gc flag is set).
 *
 * CRITICAL FEATURE: If RSS exceeds threshold, logs emergency info to ClickHouse
 * before forcing a restart. This captures debug info for post-mortem analysis.
 */

import { trackEvent } from "./clickhouse";

const INTERVAL_MS = 30_000; // 30 seconds
const CRITICAL_RSS_MB = 1500; // 1.5GB - force restart above this
const CRITICAL_RSS_SPIKE_MB = 400; // 400MB spike in 30s is suspicious
let intervalId: NodeJS.Timeout | null = null;
let lastHeapUsed = 0;
let lastRss = 0;
let startTime = Date.now();

interface MemorySnapshot {
  timestamp: string;
  uptime_minutes: number;
  heap_used_mb: number;
  heap_total_mb: number;
  heap_used_delta_mb: number;
  rss_mb: number;
  rss_delta_mb: number;
  external_mb: number;
  array_buffers_mb: number;
}

function getMemorySnapshot(): MemorySnapshot {
  const mem = process.memoryUsage();
  const heapUsedMb = Math.round(mem.heapUsed / 1024 / 1024);
  const rssMb = Math.round(mem.rss / 1024 / 1024);
  const heapDelta = heapUsedMb - lastHeapUsed;
  const rssDelta = rssMb - lastRss;
  lastHeapUsed = heapUsedMb;
  lastRss = rssMb;

  return {
    timestamp: new Date().toISOString(),
    uptime_minutes: Math.round((Date.now() - startTime) / 60000),
    heap_used_mb: heapUsedMb,
    heap_total_mb: Math.round(mem.heapTotal / 1024 / 1024),
    heap_used_delta_mb: heapDelta,
    rss_mb: rssMb,
    rss_delta_mb: rssDelta,
    external_mb: Math.round(mem.external / 1024 / 1024),
    array_buffers_mb: Math.round(mem.arrayBuffers / 1024 / 1024),
  };
}

function logMemory(): void {
  // Try to trigger GC if available (requires --expose-gc flag)
  if (typeof global.gc === "function") {
    global.gc();
  }

  const snapshot = getMemorySnapshot();

  // Log as structured JSON for easy parsing
  console.log(
    JSON.stringify({
      level: "info",
      message: "memory_snapshot",
      ...snapshot,
    })
  );

  // Warn if heap is growing significantly
  if (snapshot.heap_used_delta_mb > 50) {
    console.warn(
      JSON.stringify({
        level: "warn",
        message: "memory_growth_detected",
        delta_mb: snapshot.heap_used_delta_mb,
        current_heap_mb: snapshot.heap_used_mb,
      })
    );
  }

  // CRITICAL: Detect large RSS spike (like the 452MB spike that crashed us)
  if (snapshot.rss_delta_mb > CRITICAL_RSS_SPIKE_MB) {
    console.error(
      JSON.stringify({
        level: "error",
        message: "critical_rss_spike",
        rss_delta_mb: snapshot.rss_delta_mb,
        rss_mb: snapshot.rss_mb,
        heap_used_mb: snapshot.heap_used_mb,
        external_mb: snapshot.external_mb,
        array_buffers_mb: snapshot.array_buffers_mb,
      })
    );

    // Log to ClickHouse for post-mortem analysis
    trackEvent({
      request_id: `memory_spike_${Date.now()}`,
      endpoint: "/internal/memory",
      path: "/internal/memory",
      method: "INTERNAL",
      outcome: "error",
      error_type: "MEMORY_SPIKE",
      error_message: `RSS spiked by ${snapshot.rss_delta_mb}MB in 30s (${lastRss}MB -> ${snapshot.rss_mb}MB)`,
      error_severity: "unexpected",
      heap_used_mb: snapshot.heap_used_mb,
      heap_total_mb: snapshot.heap_total_mb,
      rss_mb: snapshot.rss_mb,
    });
  }

  // CRITICAL: Force restart if RSS exceeds threshold
  if (snapshot.rss_mb > CRITICAL_RSS_MB) {
    console.error(
      JSON.stringify({
        level: "error",
        message: "critical_memory_exceeded",
        rss_mb: snapshot.rss_mb,
        threshold_mb: CRITICAL_RSS_MB,
        heap_used_mb: snapshot.heap_used_mb,
        external_mb: snapshot.external_mb,
        array_buffers_mb: snapshot.array_buffers_mb,
        action: "forcing_restart",
      })
    );

    // Log to ClickHouse before we die
    trackEvent({
      request_id: `memory_critical_${Date.now()}`,
      endpoint: "/internal/memory",
      path: "/internal/memory",
      method: "INTERNAL",
      outcome: "error",
      error_type: "MEMORY_CRITICAL",
      error_message: `RSS ${snapshot.rss_mb}MB exceeded threshold ${CRITICAL_RSS_MB}MB - forcing restart`,
      error_severity: "unexpected",
      heap_used_mb: snapshot.heap_used_mb,
      heap_total_mb: snapshot.heap_total_mb,
      rss_mb: snapshot.rss_mb,
    });

    // Give ClickHouse a moment to flush, then exit
    setTimeout(() => {
      console.error("[MEMORY] Forcing process exit due to critical memory usage");
      process.exit(1);
    }, 1000);
  }
}

/**
 * Start the memory monitor
 * Call this once at app startup (e.g., in instrumentation.ts)
 */
export function startMemoryMonitor(): void {
  if (intervalId) return; // Already running

  startTime = Date.now();
  const mem = process.memoryUsage();
  lastHeapUsed = Math.round(mem.heapUsed / 1024 / 1024);
  lastRss = Math.round(mem.rss / 1024 / 1024);

  console.log(
    JSON.stringify({
      level: "info",
      message: "memory_monitor_started",
      initial_heap_mb: lastHeapUsed,
      initial_rss_mb: lastRss,
      critical_rss_threshold_mb: CRITICAL_RSS_MB,
      critical_spike_threshold_mb: CRITICAL_RSS_SPIKE_MB,
    })
  );

  intervalId = setInterval(logMemory, INTERVAL_MS);
  intervalId.unref(); // Don't keep process alive just for this
}

/**
 * Stop the memory monitor
 */
export function stopMemoryMonitor(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

/**
 * Get current memory snapshot (for on-demand checks)
 */
export function getCurrentMemory(): MemorySnapshot {
  return getMemorySnapshot();
}

// Note: Memory monitor is started from instrumentation.ts
// This avoids duplicate starts and ensures it runs after fetch is patched
