/**
 * In-Memory Rate Limiter
 *
 * Lightweight rate limiting for abuse prevention without external dependencies.
 * Uses a fixed-size Map with automatic cleanup to prevent memory leaks.
 */

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

interface RateLimitResult {
  success: boolean;
  remaining: number;
  reset: number;
}

interface MemoryRateLimiterOptions {
  /** Maximum requests per window */
  limit: number;
  /** Window size in milliseconds */
  windowMs: number;
  /** Maximum number of tracked IPs (prevents unbounded growth) */
  maxEntries?: number;
  /** Cleanup interval in milliseconds */
  cleanupIntervalMs?: number;
}

export class MemoryRateLimiter {
  private store: Map<string, RateLimitEntry>;
  private readonly limit: number;
  private readonly windowMs: number;
  private readonly maxEntries: number;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(options: MemoryRateLimiterOptions) {
    this.limit = options.limit;
    this.windowMs = options.windowMs;
    this.maxEntries = options.maxEntries ?? 10_000;
    this.store = new Map();

    // Start cleanup interval (default: every minute)
    const cleanupInterval = options.cleanupIntervalMs ?? 60_000;
    this.cleanupTimer = setInterval(() => this.cleanup(), cleanupInterval);
    this.cleanupTimer.unref(); // Don't keep process alive
  }

  /**
   * Check if request should be allowed
   */
  check(key: string): RateLimitResult {
    const now = Date.now();
    const entry = this.store.get(key);

    // No entry or window expired - allow and start new window
    if (!entry || now - entry.windowStart >= this.windowMs) {
      // Enforce max entries before adding new one
      if (this.store.size >= this.maxEntries && !this.store.has(key)) {
        this.evictOldest();
      }

      this.store.set(key, { count: 1, windowStart: now });
      return {
        success: true,
        remaining: this.limit - 1,
        reset: now + this.windowMs,
      };
    }

    // Window still active
    if (entry.count >= this.limit) {
      return {
        success: false,
        remaining: 0,
        reset: entry.windowStart + this.windowMs,
      };
    }

    // Increment count
    entry.count++;
    return {
      success: true,
      remaining: this.limit - entry.count,
      reset: entry.windowStart + this.windowMs,
    };
  }

  /**
   * Remove expired entries to prevent memory growth
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now - entry.windowStart >= this.windowMs) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Evict oldest entry when at capacity
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.store) {
      if (entry.windowStart < oldestTime) {
        oldestTime = entry.windowStart;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.store.delete(oldestKey);
    }
  }

  /**
   * Get current store size (for monitoring)
   */
  get size(): number {
    return this.store.size;
  }

  /**
   * Stop cleanup timer (call on shutdown)
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.store.clear();
  }
}

// Shared instance for article/jina routes
// High limit: 200 requests per minute per IP (abuse prevention, not strict limiting)
export const abuseRateLimiter = new MemoryRateLimiter({
  limit: 200,
  windowMs: 60_000, // 1 minute
  maxEntries: 10_000, // Max 10k IPs tracked
  cleanupIntervalMs: 60_000, // Cleanup every minute
});
