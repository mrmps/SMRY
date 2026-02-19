import { describe, expect, it, beforeEach } from "bun:test";
import {
  acquireFetchSlot,
  releaseFetchSlot,
  getFetchSlotStats,
  configureFetchLimiter,
  FetchSlotTimeoutError,
  _resetForTests,
} from "./article-concurrency";

beforeEach(() => {
  _resetForTests();
});

describe("article-concurrency", () => {
  it("allows requests up to max", async () => {
    configureFetchLimiter({ maxConcurrent: 3 });

    await acquireFetchSlot();
    await acquireFetchSlot();
    await acquireFetchSlot();

    const stats = getFetchSlotStats();
    expect(stats.activeFetches).toBe(3);
    expect(stats.queuedFetches).toBe(0);

    releaseFetchSlot();
    releaseFetchSlot();
    releaseFetchSlot();
  });

  it("queues requests beyond max", async () => {
    configureFetchLimiter({ maxConcurrent: 2, slotTimeout: 5000 });

    await acquireFetchSlot();
    await acquireFetchSlot();

    // Third request should queue
    let thirdResolved = false;
    const thirdPromise = acquireFetchSlot().then(() => {
      thirdResolved = true;
    });

    // Give microtasks a chance to run
    await new Promise((r) => setTimeout(r, 10));

    expect(thirdResolved).toBe(false);
    expect(getFetchSlotStats().queuedFetches).toBe(1);

    // Release one slot — third should now resolve
    releaseFetchSlot();
    await thirdPromise;

    expect(thirdResolved).toBe(true);
    expect(getFetchSlotStats().activeFetches).toBe(2);

    releaseFetchSlot();
    releaseFetchSlot();
  });

  it("times out waiting requests", async () => {
    configureFetchLimiter({ maxConcurrent: 1, slotTimeout: 50 });

    await acquireFetchSlot();

    try {
      await acquireFetchSlot();
      expect(true).toBe(false); // should not reach
    } catch (err) {
      expect(err).toBeInstanceOf(FetchSlotTimeoutError);
      expect((err as Error).message).toContain("timeout");
    }

    releaseFetchSlot();
  });

  it("processes queue in FIFO order", async () => {
    configureFetchLimiter({ maxConcurrent: 1, slotTimeout: 5000 });

    await acquireFetchSlot();

    const order: number[] = [];
    const p1 = acquireFetchSlot().then(() => order.push(1));
    const p2 = acquireFetchSlot().then(() => order.push(2));
    const p3 = acquireFetchSlot().then(() => order.push(3));

    expect(getFetchSlotStats().queuedFetches).toBe(3);

    // Release slots one by one
    releaseFetchSlot();
    await p1;
    releaseFetchSlot();
    await p2;
    releaseFetchSlot();
    await p3;

    expect(order).toEqual([1, 2, 3]);

    releaseFetchSlot();
  });

  it("reports stats correctly", async () => {
    configureFetchLimiter({ maxConcurrent: 2, slotTimeout: 5000 });

    const stats1 = getFetchSlotStats();
    expect(stats1.activeFetches).toBe(0);
    expect(stats1.queuedFetches).toBe(0);
    expect(stats1.maxConcurrentFetches).toBe(2);

    await acquireFetchSlot();
    const stats2 = getFetchSlotStats();
    expect(stats2.activeFetches).toBe(1);

    releaseFetchSlot();
    const stats3 = getFetchSlotStats();
    expect(stats3.activeFetches).toBe(0);
  });
});
