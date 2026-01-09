/**
 * Memory Monitor - Periodic memory usage logging for leak detection
 *
 * Logs memory stats every 30 seconds to help identify memory leaks.
 * Also triggers garbage collection before logging (if --expose-gc flag is set).
 */

const INTERVAL_MS = 30_000; // 30 seconds
let intervalId: NodeJS.Timeout | null = null;
let lastHeapUsed = 0;
let startTime = Date.now();

interface MemorySnapshot {
  timestamp: string;
  uptime_minutes: number;
  heap_used_mb: number;
  heap_total_mb: number;
  heap_used_delta_mb: number;
  rss_mb: number;
  external_mb: number;
  array_buffers_mb: number;
}

function getMemorySnapshot(): MemorySnapshot {
  const mem = process.memoryUsage();
  const heapUsedMb = Math.round(mem.heapUsed / 1024 / 1024);
  const delta = heapUsedMb - lastHeapUsed;
  lastHeapUsed = heapUsedMb;

  return {
    timestamp: new Date().toISOString(),
    uptime_minutes: Math.round((Date.now() - startTime) / 60000),
    heap_used_mb: heapUsedMb,
    heap_total_mb: Math.round(mem.heapTotal / 1024 / 1024),
    heap_used_delta_mb: delta,
    rss_mb: Math.round(mem.rss / 1024 / 1024),
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
      msg: "memory_snapshot",
      ...snapshot,
    })
  );

  // Warn if heap is growing significantly
  if (snapshot.heap_used_delta_mb > 50) {
    console.warn(
      JSON.stringify({
        level: "warn",
        msg: "memory_growth_detected",
        delta_mb: snapshot.heap_used_delta_mb,
        current_heap_mb: snapshot.heap_used_mb,
      })
    );
  }

  // Critical warning if heap exceeds threshold
  if (snapshot.heap_used_mb > 4000) {
    console.error(
      JSON.stringify({
        level: "error",
        msg: "high_memory_usage",
        heap_used_mb: snapshot.heap_used_mb,
        rss_mb: snapshot.rss_mb,
      })
    );
  }
}

/**
 * Start the memory monitor
 * Call this once at app startup (e.g., in instrumentation.ts)
 */
export function startMemoryMonitor(): void {
  if (intervalId) return; // Already running

  startTime = Date.now();
  lastHeapUsed = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);

  console.log(
    JSON.stringify({
      level: "info",
      msg: "memory_monitor_started",
      initial_heap_mb: lastHeapUsed,
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
