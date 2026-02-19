/**
 * Article Fetch Concurrency Limiter
 *
 * Caps the number of concurrent article fetch race groups to prevent
 * unbounded outbound HTTP connections at high user counts.
 * At 100+ concurrent users with cache misses, the /api/article/auto endpoint
 * would otherwise spawn 300 simultaneous connections (3 per user).
 *
 * Modeled on the ClickHouse acquireQuerySlot/releaseQuerySlot pattern.
 */

let maxConcurrentFetches = 20;
let slotTimeoutMs = 30_000;
let activeFetches = 0;

const fetchQueue: Array<{
  resolve: () => void;
  reject: (err: Error) => void;
}> = [];

export class FetchSlotTimeoutError extends Error {
  constructor(active: number, queued: number) {
    super(`Article fetch slot timeout — ${active} active, ${queued} queued`);
    this.name = "FetchSlotTimeoutError";
  }
}

/**
 * Acquire a fetch slot. Blocks if at max, queues with FIFO + timeout.
 */
export async function acquireFetchSlot(): Promise<void> {
  if (activeFetches < maxConcurrentFetches) {
    activeFetches++;
    return;
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      const idx = fetchQueue.findIndex((q) => q.resolve === wrappedResolve);
      if (idx !== -1) fetchQueue.splice(idx, 1);
      reject(new FetchSlotTimeoutError(activeFetches, fetchQueue.length));
    }, slotTimeoutMs);

    const wrappedResolve = () => {
      clearTimeout(timeout);
      resolve();
    };

    fetchQueue.push({ resolve: wrappedResolve, reject });
  });
}

/**
 * Release a fetch slot. Dequeues next waiter if any.
 */
export function releaseFetchSlot(): void {
  activeFetches--;
  const next = fetchQueue.shift();
  if (next) {
    activeFetches++;
    next.resolve();
  }
}

/**
 * Get current concurrency stats for monitoring.
 */
export function getFetchSlotStats(): {
  activeFetches: number;
  queuedFetches: number;
  maxConcurrentFetches: number;
} {
  return {
    activeFetches,
    queuedFetches: fetchQueue.length,
    maxConcurrentFetches,
  };
}

/**
 * Configure the limiter. Call at server startup with env values.
 */
export function configureFetchLimiter(opts: {
  maxConcurrent?: number;
  slotTimeout?: number;
}): void {
  if (opts.maxConcurrent !== undefined) maxConcurrentFetches = opts.maxConcurrent;
  if (opts.slotTimeout !== undefined) slotTimeoutMs = opts.slotTimeout;
}

/**
 * Reset internal state (for tests only).
 */
export function _resetForTests(): void {
  activeFetches = 0;
  fetchQueue.length = 0;
  maxConcurrentFetches = 20;
  slotTimeoutMs = 30_000;
}
