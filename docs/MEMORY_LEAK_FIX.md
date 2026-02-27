# Memory Leak Fixes

## Fix History

### Phase 1: JSDOM Migration (2026-01)

**Problem:** JSDOM instances created full browser environments (`window` objects) that leaked when not closed. Memory climbed from ~2GB to 5GB+ on Railway.

**Fix:** Migrated from JSDOM to LinkedOM (`parseHTML`). LinkedOM is a lightweight DOM parser that doesn't require explicit cleanup — no `window.close()` needed. This eliminated the largest class of memory leaks.

**Files changed:**
- `server/routes/article.ts` — switched to `import { parseHTML } from "linkedom"`
- `lib/api/diffbot.ts` — same migration

### Phase 2: Singleton Rate Limiters (2026-01)

**Problem:** `new Ratelimit()` created per-request instead of as module-level singletons.

**Fix:** Moved to module-level singleton instances.

### Phase 3: Request Timeouts (2026-01)

**Problem:** Fetch requests had no timeout, causing connections to hang indefinitely.

**Fix:** Added timeouts to all fetch calls. See Phase 5 for current values.

### Phase 4: MCP Client Pool (2026-02)

**Problem:** ZeroClick MCP signal clients created per-request leaked connections and memory.

**Fix:** Session-based client pool with max 50 clients, 2-min TTL, 30s cleanup interval. Fire-and-forget close with orphan tracking. See `docs/mcp-client-memory-fix.md`.

### Phase 5: Race Pattern — Immediate Abort (2026-02)

**Problem:** Article race pattern (`/api/article/auto`) races 3 fetch sources. When smry-fast won (typically 1-3s), losing Diffbot calls continued for a 10s grace period + up to 45s timeout. During this time, Diffbot responses arrived and triggered heavy processing (JSON parse, DOM extraction, Readability) consuming 50-180MB RSS per call. With 10 concurrent users, this wasted 600MB-3.6GB.

**Root cause:** Abort signals only cancelled the HTTP `fetch()`. Once the response arrived, all downstream processing (body read, JSON.parse, parseHTML, Readability) ran to completion without checking if the race was already won.

**Fixes:**
1. **Immediate abort** — losers killed instantly on winner (was 10s grace period)
2. **Abort checkpoints** — added `externalSignal?.aborted` checks at every heavy processing step in `diffbot.ts`:
   - Before reading response body
   - After JSON parse, before DOM extraction
   - Before DOM parsing for date/image extraction
   - Before Readability fallback
3. **Reduced timeouts** — smry-fast: 12s (was 30s), Diffbot: 15s (was 45s)
4. **Reference cleanup** — null out `results[]` entries after winner resolves

**Files changed:**
- `server/routes/article.ts` — race logic, immediate abort, reference cleanup
- `lib/api/diffbot.ts` — abort checkpoints, 15s timeout

See `docs/ARTICLE_RACE_OPTIMIZATION.md` for full architecture details.

## Current Memory Bounds

| Resource | Limit | Notes |
|----------|-------|-------|
| Auth cache | 1,000 entries | LRU |
| ClickHouse buffer | 500 events | Flushed periodically |
| Rate limiter | 10,000 IPs | Sliding window |
| ZeroClick clients | 50 sessions | 2-min TTL |
| Response body | 25MB | `lib/safe-fetch.ts` |
| smry-fast timeout | 12s | Direct fetch |
| Diffbot timeout | 15s | API call |
| Race losers | 0s grace | Aborted immediately |

## Prevention

1. **Use LinkedOM** — not JSDOM. No cleanup needed, lower memory footprint
2. **Check abort signals** — at every expensive processing step, not just at fetch
3. **Singleton resources** — rate limiters, clients, caches at module level
4. **Bounded caches** — always set max size and TTL
5. **Kill losers immediately** — in race patterns, don't give grace periods
6. **Monitor** — `/health` endpoint, `memory_spike_operation` logs, `cache_stats_snapshot` logs
