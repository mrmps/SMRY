/**
 * TTS Concurrency Limiter
 *
 * Caps concurrent API requests to Inworld to prevent:
 * - Rate limit errors from Inworld (429s)
 * - Memory exhaustion (each request holds audio buffer in memory)
 * - Worker thread starvation (other API requests get blocked)
 *
 * With 30K DAU and 100+ concurrent TTS users, we must:
 * - Cap global concurrent TTS synthesis at MAX_CONCURRENT_TTS (default: 20)
 * - Cap per-user concurrent requests at MAX_PER_USER (default: 2)
 * - Queue excess requests with FIFO + timeout
 * - Track active connections for /health monitoring
 * - Force-cleanup on client disconnect (AbortSignal)
 */

import { createLogger } from "./logger";

const logger = createLogger("tts:concurrency");

// --- Configuration ---
let maxConcurrentTTS = 20; // Global max simultaneous Inworld API requests
let maxPerUser = 2; // Per-user max concurrent TTS requests
let slotTimeoutMs = 15_000; // Max wait time in queue before 503

// --- State ---
let activeSlots = 0;
const perUserActive = new Map<string, number>(); // userId -> active count
const queue: Array<{
  resolve: () => void;
  reject: (err: Error) => void;
  userId: string | null;
  signal?: AbortSignal;
}> = [];

// Metrics
let totalAcquired = 0;
let totalRejected = 0;
let totalTimedOut = 0;
let peakConcurrent = 0;

export class TTSSlotTimeoutError extends Error {
  constructor(active: number, queued: number) {
    super(`TTS slot timeout — ${active} active, ${queued} queued`);
    this.name = "TTSSlotTimeoutError";
  }
}

export class TTSUserLimitError extends Error {
  constructor(userId: string, active: number) {
    super(`TTS per-user limit — user ${userId} has ${active} active streams`);
    this.name = "TTSUserLimitError";
  }
}

/**
 * Acquire a TTS slot. Blocks if at capacity, queues with FIFO + timeout.
 * Pass AbortSignal for cleanup when client disconnects.
 */
export async function acquireTTSSlot(
  userId: string | null,
  signal?: AbortSignal,
): Promise<void> {
  const uid = userId || "anonymous";

  // Per-user limit check (immediate reject, don't queue)
  const userActive = perUserActive.get(uid) || 0;
  if (userActive >= maxPerUser) {
    totalRejected++;
    throw new TTSUserLimitError(uid, userActive);
  }

  // Global slot available
  if (activeSlots < maxConcurrentTTS) {
    activeSlots++;
    perUserActive.set(uid, userActive + 1);
    totalAcquired++;
    if (activeSlots > peakConcurrent) peakConcurrent = activeSlots;
    return;
  }

  // Queue the request
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      totalTimedOut++;
      reject(new TTSSlotTimeoutError(activeSlots, queue.length));
    }, slotTimeoutMs);

    // Abort handler — clean up if client disconnects while queued
    const onAbort = () => {
      cleanup();
      totalRejected++;
      reject(new Error("TTS request aborted while queued"));
    };

    const entry = {
      resolve: () => {
        clearTimeout(timeout);
        signal?.removeEventListener("abort", onAbort);
        resolve();
      },
      reject,
      userId: uid,
      signal,
    };

    const cleanup = () => {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", onAbort);
      const idx = queue.indexOf(entry);
      if (idx !== -1) queue.splice(idx, 1);
    };

    signal?.addEventListener("abort", onAbort, { once: true });
    queue.push(entry);

    logger.debug(
      { activeSlots, queued: queue.length, userId: uid },
      "TTS request queued",
    );
  });
}

/**
 * Release a TTS slot. Dequeues next waiter if any.
 */
export function releaseTTSSlot(userId: string | null): void {
  const uid = userId || "anonymous";

  activeSlots = Math.max(0, activeSlots - 1);

  const userActive = perUserActive.get(uid) || 0;
  if (userActive <= 1) {
    perUserActive.delete(uid);
  } else {
    perUserActive.set(uid, userActive - 1);
  }

  // Dequeue next waiting request
  while (queue.length > 0) {
    const next = queue.shift();
    if (!next) break;

    // Check if the queued request's client already disconnected
    if (next.signal?.aborted) {
      continue;
    }

    // Check per-user limit for the queued request
    const nextUid = next.userId || "anonymous";
    const nextUserActive = perUserActive.get(nextUid) || 0;
    if (nextUserActive >= maxPerUser) {
      next.reject(new TTSUserLimitError(nextUid, nextUserActive));
      continue;
    }

    activeSlots++;
    perUserActive.set(nextUid, nextUserActive + 1);
    totalAcquired++;
    if (activeSlots > peakConcurrent) peakConcurrent = activeSlots;
    next.resolve();
    return;
  }
}

/**
 * Get stats for /health endpoint and monitoring.
 */
export function getTTSSlotStats(): {
  activeSlots: number;
  queuedRequests: number;
  maxConcurrentTTS: number;
  maxPerUser: number;
  perUserBreakdown: Record<string, number>;
  totalAcquired: number;
  totalRejected: number;
  totalTimedOut: number;
  peakConcurrent: number;
} {
  return {
    activeSlots,
    queuedRequests: queue.length,
    maxConcurrentTTS,
    maxPerUser,
    perUserBreakdown: Object.fromEntries(perUserActive),
    totalAcquired,
    totalRejected,
    totalTimedOut,
    peakConcurrent,
  };
}

/**
 * Configure the TTS limiter. Call at server startup.
 */
export function configureTTSLimiter(opts: {
  maxConcurrent?: number;
  maxPerUser?: number;
  slotTimeout?: number;
}): void {
  if (opts.maxConcurrent !== undefined) maxConcurrentTTS = opts.maxConcurrent;
  if (opts.maxPerUser !== undefined) maxPerUser = opts.maxPerUser;
  if (opts.slotTimeout !== undefined) slotTimeoutMs = opts.slotTimeout;
  logger.info(
    { maxConcurrentTTS, maxPerUser, slotTimeoutMs },
    "TTS concurrency limiter configured",
  );
}

// Periodic cleanup of stale per-user entries (every 60s)
const cleanupInterval = setInterval(() => {
  for (const [uid, count] of perUserActive.entries()) {
    if (count <= 0) perUserActive.delete(uid);
  }
}, 60_000);
cleanupInterval.unref();
