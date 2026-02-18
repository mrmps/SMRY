# Article Race Optimization

## Overview

The `/api/article/auto` endpoint races 3 fetch sources in parallel and returns the first quality result. This document explains the race pattern, the memory optimization (abort with grace period), and how to tune it.

## Architecture

```
Client request
    │
    ▼
┌─────────────────────────────────────┐
│  /api/article/auto                  │
│                                     │
│  1. Check Redis cache (all sources) │
│  2. If miss → race 3 fetchers:      │
│     ┌──────────────┐                │
│     │  smry-fast   │ Direct fetch + Readability parse (30s timeout)
│     │  smry-slow   │ Diffbot API (45s timeout)
│     │  wayback     │ Diffbot via web.archive.org (45s timeout)
│     └──────────────┘                │
│  3. First quality result wins       │
│  4. Losers get 10s grace → abort    │
└─────────────────────────────────────┘
    │
    ▼
Client gets response with mayHaveEnhanced flag
    │
    ▼ (after 4s)
Client polls /api/article/enhanced for longer version
```

## The Problem (Pre-Optimization)

When smry-fast won the race (typically in 1-3s), the two Diffbot fetches continued running for their full 45s timeout. Each Diffbot call consumed **15-58MB RSS** during JSON parsing and DOM extraction. With concurrent users, this meant:

- 10 users × 2 zombie Diffbot calls × 30-58MB = **600MB-1.1GB wasted memory**
- Losers held memory for up to 43 extra seconds after the winner was already returned
- No way to reclaim memory until the 45s timeout expired

### Evidence from Logs

```
memory_spike_operation: diffbot-api-call used 58MB RSS
memory_spike_operation: diffbot-api-call used 36MB RSS
memory_spike_operation: article-fetch-smry-slow used 31MB RSS
Diffbot request timed out after 45s   ← loser ran full duration
```

## The Fix: Abort with Grace Period

### How It Works

Each fetch source gets its own `AbortController`. When a winner is found:

1. **Winner cached immediately** — result returned to client
2. **10s grace period starts** — losers continue running so they can finish and cache their results (needed for `/article/enhanced`)
3. **After 10s** — any losers still running get `controller.abort()`, which:
   - Cancels the HTTP fetch (closes TCP connection)
   - Prevents JSON parsing / DOM extraction from starting
   - Frees all memory held by that operation
4. **If losers finish within 10s** — they cache normally, grace timeout is cleared

### Timeline

```
0s          2s                    12s                    45s
│───────────│─────────────────────│──────────────────────│
│  All 3    │  smry-fast wins     │  Losers aborted      │  (old timeout)
│  start    │  → returned to user │  → memory freed       │
│           │  → 10s grace starts │                       │
│           │                     │                       │
│           │  Losers continue... │                       │
│           │  (may finish & cache│                       │
│           │   within grace)     │                       │
```

### Why 10 Seconds?

- Most Diffbot calls complete within **5-8 seconds**
- 10s gives them a realistic chance to finish and cache quality results
- The `/article/enhanced` endpoint polls at 4s — by 10s, Diffbot has usually finished
- Beyond 10s, diminishing returns vs memory cost

## Key Files

| File | What it does |
|------|-------------|
| `server/routes/article.ts` | Race logic, abort controllers, grace period |
| `lib/api/diffbot.ts` | Diffbot API call, accepts external `AbortSignal` |
| `lib/safe-fetch.ts` | Response size limits (25MB default) |
| `lib/memory-tracker.ts` | Memory instrumentation for debugging |

## Signal Flow

```
article.ts                          diffbot.ts
┌─────────────────────┐             ┌─────────────────────┐
│ abortControllers = { │             │ fetchArticleWithDiffbot(
│   "smry-fast": AC1,  │             │   url, source,
│   "smry-slow": AC2,  │  signal──▶  │   externalSignal? )
│   "wayback":  AC3,   │             │                     │
│ }                    │             │ internal AC (45s) +  │
│                      │             │ external signal      │
│ On winner found:     │             │ combined via         │
│   AC2.abort()  ──────│──abort──▶   │ addEventListener     │
│   AC3.abort()  ──────│──abort──▶   │                     │
└─────────────────────┘             └─────────────────────┘
```

- `fetchArticleWithSmryFast` combines signals via `AbortSignal.any()`
- `fetchArticleWithDiffbot` links external signal to its internal controller via `addEventListener("abort", ...)`
- Both clean up listeners in `finally` blocks

## Tuning

### Grace Period (`LOSER_GRACE_MS`)

Located in `server/routes/article.ts` inside the `raceForFirstSuccess` function.

```typescript
const LOSER_GRACE_MS = 10_000; // 10 seconds
```

- **Increase** if you see `/article/enhanced` frequently returning `{ enhanced: false }` — losers may need more time
- **Decrease** if memory is still spiking — shorter grace = less memory held

### Fetch Timeouts

| Source | Timeout | Location |
|--------|---------|----------|
| smry-fast | 30s | `article.ts:115` |
| smry-slow (Diffbot) | 45s | `diffbot.ts:456` |
| wayback (Diffbot) | 45s | `diffbot.ts:456` |

The grace period abort fires **before** these timeouts in most cases (at winner + 10s).

### Quality Threshold

```typescript
if (!resolved && result && result.article.length > 500) {
```

A result must have >500 chars of text content to be considered a "quality" winner. This prevents returning empty/stub pages.

## Monitoring

### Log Messages to Watch

| Log | Meaning |
|-----|---------|
| `Race winner found, losers have 10s grace period` | Normal — race completed, grace started |
| `Aborted remaining losers after grace period` | Losers didn't finish in time, aborted |
| `memory_spike_operation: diffbot-api-call used XMB RSS` | Diffbot memory usage (should decrease post-fix) |
| `aborted_before_start` | Loser was already aborted before Diffbot call started |

### Health Check

The `/health` endpoint includes cache stats. After deploying, watch for:
- RSS memory stabilizing at a lower baseline
- Fewer `memory_spike_operation` logs from Diffbot calls
- Grace period aborts in logs (confirms the fix is active)

## Cache Strategy

All 3 sources cache independently in Redis:

```
smry-fast:{url}  → fast direct fetch result
smry-slow:{url}  → Diffbot API result
wayback:{url}    → Diffbot via Wayback Machine result
```

- Winner is cached immediately
- Losers that finish within the grace period are also cached
- `/article/enhanced` checks all 3 cache keys for a longer version (>40% more content)
- Cache entries with `htmlContent` at exactly 51200 bytes are treated as old truncated entries and refreshed
