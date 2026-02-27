# Article Race Optimization

## Overview

The `/api/article/auto` endpoint races 3 fetch sources in parallel and returns the first quality result. This document explains the race pattern, memory management, concurrency control, and how to tune it.

## Architecture

```
Client request
    |
    v
+---------------------------------------------+
|  /api/article/auto                           |
|                                              |
|  1. Check Redis cache (all sources)          |
|  2. If miss -> acquire concurrency slot      |
|     (max 20 concurrent race groups)          |
|  3. Race 3 fetchers:                         |
|     +----------------+                       |
|     |  smry-fast     | Direct fetch + Readability (12s timeout)
|     |  smry-slow     | Diffbot API (15s timeout)
|     |  wayback       | Diffbot via web.archive.org (15s timeout)
|     +----------------+                       |
|  4. First quality result wins                |
|  5. Losers aborted immediately               |
|  6. Release concurrency slot (finally block) |
+---------------------------------------------+
    |
    v
Client gets response with mayHaveEnhanced flag
    |
    v (after 4s)
Client polls /api/article/enhanced for longer version
```

## Memory Optimizations

### Problem: Unbounded Concurrency

At 100+ concurrent users with cache misses, the endpoint would spawn **300 simultaneous outbound HTTP connections** (3 per user) with no cap. Each article carries 200KB-2MB of htmlContent through the entire request lifecycle, and `safeText` double-buffered response bodies. Estimated peak: **600MB-1.3GB**.

### Fix 1: Concurrency Limiter (lib/article-concurrency.ts)

A semaphore limits concurrent race groups to 20 (configurable via `MAX_CONCURRENT_ARTICLE_FETCHES`). This caps outbound connections from 300 to 60 at peak. Excess requests queue with FIFO ordering and a 30s timeout, returning 503 + `Retry-After: 2` on timeout.

```
100 users hit /article/auto simultaneously (cache miss):
  Before: 300 outbound connections, unbounded memory
  After:  20 race groups active (60 connections), 80 queued
          Queue drains as races complete (~2-5s each)
          503 returned if queue waits >30s
```

### Fix 2: htmlContent Separation

Full htmlContent (200KB-2MB) is cached separately in Redis under `html:{source}:{url}` immediately after fetch, then **only a 50KB preview** is kept in the article object for bypass detection. The main cache key stores articles without full htmlContent.

```
Before: Article object carries 2MB htmlContent through:
  fetch -> validate -> compress -> cache -> response

After:  Full htmlContent -> Redis (html:smry-fast:{url})  [fire-and-forget]
        Article object carries 50KB preview only
        Main cache key stores article without full htmlContent
```

The `/article/html` endpoint checks the separate `html:` key first, falls back to legacy cache entries.

### Fix 3: Incremental safeText Decoding (lib/safe-fetch.ts)

Replaced `Uint8Array[]` chunk accumulation + batch decode with incremental `TextDecoder` string building. Each chunk is decoded immediately and appended. This eliminates the chunk array entirely, halving per-request buffer memory.

### Fix 4: Compression Payload Reduction

With htmlContent stripped from the main article object before `compressAsync()`, the compression payload drops from ~2MB to ~50KB. This directly reduces memory during the compress/decompress cycle.

## Previous Optimizations (Still Active)

### Immediate Abort (No Grace Period)

When a winner is found, losers are aborted immediately. The `/article/enhanced` endpoint fetches independently if needed — no need to keep losers running.

### Abort Checkpoints in Diffbot Pipeline

The Diffbot processing pipeline checks the abort signal at every heavy step:

```
fetch() --abort--> cancelled (AbortError)
    |
    v
[CHECK ABORT] <- before reading response body
    |
    v
safeJson() <- reads body into memory
    |
    v
[CHECK ABORT] <- before DOM extraction / validation
    |
    v
parseHTML(dom) <- LinkedOM creates document
    |
    v
[CHECK ABORT] <- before Readability fallback
    |
    v
Readability.parse() <- heavy text extraction
```

If abort fires between `fetch()` completing and DOM parsing starting, the entire downstream pipeline is skipped.

### Reduced Timeouts

| Source | Old Timeout | New Timeout | Why |
|--------|------------|-------------|-----|
| smry-fast | 30s | 12s | Direct fetch — fast or fail |
| smry-slow (Diffbot) | 45s | 15s | Diffbot responds in 1-8s normally |
| wayback (Diffbot) | 45s | 15s | Same Diffbot API |

### Reference Cleanup

After winner resolves, the `results[]` array entries for losers are nulled out immediately, allowing GC of large article objects.

## Key Files

| File | What it does |
|------|-------------|
| `server/routes/article.ts` | Race logic, abort controllers, immediate abort, htmlContent separation |
| `lib/article-concurrency.ts` | Semaphore-based concurrency limiter (max 20 races) |
| `lib/api/diffbot.ts` | Diffbot API call, abort checkpoints, 15s timeout |
| `lib/safe-fetch.ts` | Response size limits, incremental text decoding |
| `lib/memory-tracker.ts` | Memory instrumentation including concurrency stats |

## Signal Flow

```
article.ts                          diffbot.ts
+---------------------+             +---------------------+
| abortControllers = { |             | fetchArticleWithDiffbot(
|   "smry-fast": AC1,  |             |   url, source,
|   "smry-slow": AC2,  |  signal-->  |   externalSignal? )
|   "wayback":  AC3,   |             |                     |
| }                    |             | internal AC (15s) +  |
|                      |             | external signal      |
| On winner found:     |             | combined via         |
|   AC2.abort()  ------|--abort-->   | addEventListener     |
|   AC3.abort()  ------|--abort-->   |                     |
|                      |             | Abort checked at:    |
|                      |             |  - before body read  |
|                      |             |  - after JSON parse  |
|                      |             |  - before DOM parse  |
|                      |             |  - before Readability|
+---------------------+             +---------------------+
```

- `fetchArticleWithSmryFast` combines signals via `AbortSignal.any()`
- `fetchArticleWithDiffbot` links external signal to its internal controller via `addEventListener("abort", ...)`
- Both clean up listeners in `finally` blocks

## Tuning

### Concurrency Limiter

| Variable | Default | Location |
|----------|---------|----------|
| `MAX_CONCURRENT_ARTICLE_FETCHES` | 20 | `server/env.ts` |
| `ARTICLE_FETCH_SLOT_TIMEOUT_MS` | 30000 | `server/env.ts` |

Lower `MAX_CONCURRENT_ARTICLE_FETCHES` to reduce peak memory at the cost of higher queue wait times. On a 512MB instance, 10-15 is safer. On 1GB+, 20-30 is fine.

### Fetch Timeouts

| Source | Timeout | Location |
|--------|---------|----------|
| smry-fast | 12s | `article.ts` — `fetchArticleWithSmryFast` |
| smry-slow (Diffbot) | 15s | `diffbot.ts` — `fetchArticleWithDiffbot` |
| wayback (Diffbot) | 15s | `diffbot.ts` — `fetchArticleWithDiffbot` |

### Quality Threshold

```typescript
if (!resolved && result && result.article.length > 500) {
```

A result must have >500 chars of text content to be considered a "quality" winner. This prevents returning empty/stub pages.

## Monitoring

### Log Messages to Watch

| Log | Meaning |
|-----|---------|
| `Race winner found, losers aborted immediately` | Normal — race completed, losers killed |
| `Aborted losers immediately after winner found` | Abort signal fired |
| `aborted_after_response` | Abort caught between HTTP response and body read |
| `aborted_after_parse` | Abort caught between JSON parse and DOM extraction |
| `aborted_before_readability` | Abort caught before expensive Readability fallback |
| `memory_spike_operation: diffbot-api-call used XMB RSS` | Diffbot memory usage (should be rare now) |
| `aborted_before_start` | Loser was already aborted before Diffbot call started |

### Health Check

The `/health` endpoint includes cache stats. After deploying, watch for:
- RSS memory stabilizing at a lower baseline
- Fewer `memory_spike_operation` logs from Diffbot calls
- Abort checkpoint logs confirming losers are bailing out early
- `article_active_fetches` and `article_queued_fetches` in cache stats — high queued values indicate the concurrency limit is too low or fetch times are too slow

### Concurrency Stats (via /health)

```json
{
  "article_active_fetches": 12,
  "article_queued_fetches": 3,
  "article_max_concurrent": 20
}
```

## Cache Strategy

Articles are cached in Redis with htmlContent stored separately:

```
smry-fast:{url}       -> article without full htmlContent (50KB preview max)
smry-slow:{url}       -> article without full htmlContent
wayback:{url}         -> article without full htmlContent
html:smry-fast:{url}  -> full htmlContent (compressed, lazy-loaded by /article/html)
html:smry-slow:{url}  -> full htmlContent
html:wayback:{url}    -> full htmlContent
meta:{source}:{url}   -> lightweight metadata (title, siteName, length)
```

- Winner is cached immediately
- `/article/enhanced` checks all 3 cache keys for a longer version (>40% more content)
- `/article/enhanced` fetches independently if no cached result — does NOT rely on race losers
- `/article/html` loads full HTML on demand from `html:` keys, falls back to legacy cache

## Memory Budget at Scale

With the concurrency limiter at max 20:

| Component | Per-race | At 20 concurrent | Notes |
|-----------|----------|-------------------|-------|
| smry-fast HTML (fetch) | 200KB-2MB | 4-40MB | Released after parse |
| Diffbot response (x2) | 1-5MB each | 20-100MB | Aborted if loser |
| Article object (preview) | ~50KB | 1MB | 50KB htmlContent preview |
| safeText buffer | ~2MB | 40MB | Incremental, no doubling |
| Compression | ~50KB | 1MB | Small without htmlContent |
| **Total peak** | | **~100-180MB** | Down from 600MB-1.3GB |

Excess users queue and wait (up to 30s). At sustained high load, some get 503 + Retry-After.
