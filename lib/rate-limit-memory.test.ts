import { describe, test, expect, beforeEach } from "bun:test";
import { MemoryRateLimiter } from "./rate-limit-memory";

describe("MemoryRateLimiter", () => {
  let limiter: MemoryRateLimiter;

  beforeEach(() => {
    limiter = new MemoryRateLimiter({
      limit: 5,
      windowMs: 1000,
      maxEntries: 100,
      cleanupIntervalMs: 60000,
    });
  });

  test("allows requests under limit", () => {
    const result = limiter.check("ip1");
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(4);
  });

  test("tracks remaining requests", () => {
    limiter.check("ip1");
    limiter.check("ip1");
    const result = limiter.check("ip1");
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(2);
  });

  test("blocks requests over limit", () => {
    for (let i = 0; i < 5; i++) {
      limiter.check("ip1");
    }
    const result = limiter.check("ip1");
    expect(result.success).toBe(false);
    expect(result.remaining).toBe(0);
  });

  test("tracks different IPs separately", () => {
    for (let i = 0; i < 5; i++) {
      limiter.check("ip1");
    }
    const result = limiter.check("ip2");
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(4);
  });

  test("resets after window expires", async () => {
    for (let i = 0; i < 5; i++) {
      limiter.check("ip1");
    }
    expect(limiter.check("ip1").success).toBe(false);

    // Wait for window to expire
    await new Promise((r) => setTimeout(r, 1100));

    const result = limiter.check("ip1");
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(4);
  });

  test("respects maxEntries limit", () => {
    const smallLimiter = new MemoryRateLimiter({
      limit: 10,
      windowMs: 60000,
      maxEntries: 3,
      cleanupIntervalMs: 60000,
    });

    smallLimiter.check("ip1");
    smallLimiter.check("ip2");
    smallLimiter.check("ip3");
    expect(smallLimiter.size).toBe(3);

    // Adding a 4th should evict the oldest
    smallLimiter.check("ip4");
    expect(smallLimiter.size).toBe(3);

    smallLimiter.destroy();
  });

  test("destroy clears store and timer", () => {
    limiter.check("ip1");
    expect(limiter.size).toBe(1);

    limiter.destroy();
    expect(limiter.size).toBe(0);
  });
});
