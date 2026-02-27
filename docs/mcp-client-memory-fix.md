# MCP Client Memory Leak Fix - February 2026

## Problem Statement

Memory climbed from ~1GB to 4GB over 18 hours, then dropped to 378MB on rebuild/deploy. This pattern indicates a memory leak in long-running processes.

---

## Root Cause Analysis

### What Was NOT the Cause

| Component | Max Memory | Why Safe |
|-----------|------------|----------|
| `sessionFailures` Map | ~30 KB (200 entries × 150 bytes) | Too small for 4GB |
| `clientCache` | ~75 MB (50 clients × 1.5 MB) | Bounded with eviction |
| PostHog buffers | SDK-managed | PostHog SDK handles batching |
| Rate limiter | ~1.5 MB | Bounded at 10,000 IPs |
| Auth cache | ~100 KB | Bounded at 1,000 entries |

### Actual Cause: Orphaned MCP Clients

The MCP SDK's `Client` objects from `@modelcontextprotocol/sdk` hold:
- TCP socket with internal buffers (~500KB-1MB)
- HTTP connection state
- SSE (Server-Sent Events) stream buffers

**The leak mechanism:**
```
1. client.close() called with 2-second timeout
2. If close() doesn't resolve in 2s, Promise.race returns
3. But the underlying TCP socket and buffers remain alive
4. Over 18 hours: thousands of orphaned connections = 4GB
```

---

## Fix Implementation

### File: `lib/zeroclick.ts`

### Configuration Changes

| Setting | Before | After | Rationale |
|---------|--------|-------|-----------|
| `CLIENT_TTL_MS` | 5 min | 2 min | Shorter TTL = fewer stale connections |
| `CLIENT_CLEANUP_INTERVAL_MS` | 60s | 30s | More aggressive cleanup |
| `MAX_CACHED_CLIENTS` | 100 | 50 | Fewer clients = less memory baseline |
| `CLIENT_CLOSE_TIMEOUT_MS` | 2s | 1s | Faster orphan detection |
| Eviction batch size | 10 | 20 | More headroom when cache full |

### Code Changes

#### 1. Fire-and-Forget Close (Non-Blocking)

**Before:**
```typescript
async function closeClientWithTimeout(client: Client): Promise<void> {
  await Promise.race([
    client.close(),
    new Promise(resolve => setTimeout(resolve, 2000)),
  ]);
}
```

**After:**
```typescript
function closeClientFireAndForget(client: Client): void {
  const closePromise = client.close();
  const timeoutPromise = new Promise<"timeout">(resolve =>
    setTimeout(() => resolve("timeout"), CLIENT_CLOSE_TIMEOUT_MS)
  );

  Promise.race([closePromise, timeoutPromise])
    .then((result) => {
      if (result === "timeout") {
        orphanedClientCount++;
        logger.warn({ orphanedCount, created, closed }, "MCP client close timed out");
      } else {
        totalClientsClosed++;
      }
    })
    .catch(() => totalClientsClosed++);
}
```

**Why:** Non-blocking close doesn't hold up the request/cleanup cycle. Orphans are tracked for debugging.

#### 2. Orphan Tracking

```typescript
let orphanedClientCount = 0;
let totalClientsCreated = 0;
let totalClientsClosed = 0;

export function getZeroClickCacheStats() {
  return {
    clientCacheSize: clientCache.size,
    sessionFailuresSize: sessionFailures.size,
    maxClients: MAX_CACHED_CLIENTS,
    totalCreated: totalClientsCreated,
    totalClosed: totalClientsClosed,
    orphanedCount: orphanedClientCount,
  };
}
```

**Why:** Visibility into whether orphans are accumulating helps diagnose if the MCP SDK itself is leaking.

#### 3. Periodic Session Failures Cleanup

```typescript
function cleanupExpiredClients(): void {
  // ... client cleanup ...

  // Cleanup expired session failures
  const MAX_FAILURE_ENTRIES = 200;
  for (const [key, time] of sessionFailures) {
    if (now - time > SIGNAL_RETRY_COOLDOWN_MS) {
      sessionFailures.delete(key);
    }
  }

  // Hard cap eviction
  if (sessionFailures.size > MAX_FAILURE_ENTRIES) {
    const sorted = Array.from(sessionFailures.entries())
      .sort((a, b) => a[1] - b[1]);
    sorted.slice(0, sessionFailures.size - MAX_FAILURE_ENTRIES)
      .forEach(([key]) => sessionFailures.delete(key));
  }
}
```

**Why:** Previously cleanup only ran inside `getOrCreateSignalClient()`. Now runs every 30 seconds regardless.

---

## Ad Waterfall Logic - NOT Affected

**IMPORTANT:** These changes do NOT affect Gravity ads or revenue.

### Verification

The ad waterfall in `server/routes/gravity.ts` remains unchanged:

```
┌─────────────────────────────────────────────────────────────┐
│                    Ad Request Flow                          │
├─────────────────────────────────────────────────────────────┤
│  1. Request comes to /api/context                           │
│                        │                                    │
│                        ▼                                    │
│  2. Call Gravity API (always first)                         │
│                        │                                    │
│           ┌───────────┴───────────┐                         │
│           │                       │                         │
│     Gravity OK              Gravity Failed                  │
│           │                       │                         │
│           ▼                       ▼                         │
│  3a. Check ad count         3b. ZeroClick fallback          │
│      gravityAds.length          (full 5 ads)                │
│           │                                                 │
│     ┌─────┴─────┐                                           │
│     │           │                                           │
│   >= 5        < 5                                           │
│     │           │                                           │
│     ▼           ▼                                           │
│  Return     ZeroClick fills                                 │
│  Gravity    remaining slots                                 │
│  ads only   (5 - gravityAds.length)                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### What ZeroClick Functions Are Used

| Function | When Called | Purpose |
|----------|-------------|---------|
| `broadcastArticleSignal()` | Gravity < 5 ads OR Gravity failed | Send article context for ad targeting |
| `fetchZeroClickOffers()` | Gravity < 5 ads OR Gravity failed | Get ad offers from ZeroClick API |
| `mapZeroClickOfferToAd()` | After fetching offers | Convert offer format to ContextAd |

### What Was Changed (Internal Only)

| Function | Change | Impact on Ads |
|----------|--------|---------------|
| `closeClientFireAndForget()` | Fire-and-forget close with orphan tracking | None - internal cleanup |
| `cleanupExpiredClients()` | Now also cleans sessionFailures map | None - internal cleanup |
| `evictOldestClients()` | Evicts 20 instead of 10 | None - internal cleanup |
| `getZeroClickCacheStats()` | Added orphan tracking | None - debugging only |

---

## Enhanced Logging

Every client connection now logs:
```json
{
  "message": "MCP signal client connected",
  "sessionId": "abc12345",
  "cacheSize": 5,
  "created": 100,
  "closed": 95,
  "orphaned": 5
}
```

Orphan warnings:
```json
{
  "message": "MCP client close timed out - potential memory leak",
  "orphanedCount": 5,
  "created": 100,
  "closed": 95
}
```

---

## Monitoring After Deployment

### What to Watch

1. **Memory snapshot logs** (every 30s):
   ```json
   {"message": "memory_snapshot", "rss_mb": 500, "rss_delta_mb": 5}
   ```
   - `rss_delta_mb` should be ~0 when idle
   - Steady positive deltas indicate leak

2. **Orphan count in client logs:**
   - If `orphanedCount` climbs rapidly → MCP SDK issue
   - If stays low but memory still climbs → different leak source

3. **Cleanup logs:**
   ```
   "Cleaning up expired MCP signal clients" {count: 5}
   "Cleaned up session failure entries" {removed: 10, remaining: 50}
   ```

### Decision Tree

```
Memory climbing over hours?
├── YES → Check orphanedCount
│   ├── High (>100) → MCP SDK leak, consider disabling signals
│   └── Low (<10) → Different leak source, investigate further
└── NO → Fix is working
```

---

## If Memory Still Leaks

### Option 1: Disable Signal Broadcasting

In `lib/zeroclick.ts`, make `broadcastArticleSignal` a no-op:
```typescript
export async function broadcastArticleSignal(): Promise<void> {
  return; // Disabled due to memory leak
}
```

### Option 2: Use REST API Instead of MCP

Replace MCP signal broadcasting with REST API call (if ZeroClick provides one).

### Option 3: Per-Request Clients (No Pooling)

Create and immediately close clients per-request. Higher latency but no leak accumulation.

---

## ZeroClick Integration Reference

### Required Headers
- `x-zc-api-key` - API authentication
- `x-zc-llm-model` - LLM identifier (e.g., `anthropic/claude-sonnet-4.5`)

### Optional User Context Headers
- `x-zc-user-id` - Unique user identifier
- `x-zc-user-session-id` - Session grouping
- `x-zc-user-locale` - BCP 47 locale
- `x-zc-user-ip` - User IP address
- `x-zc-user-agent` - Browser/client info (max 1000 chars)

### broadcast_signal Tool
- `signals` array (1-10 signals per call)
- Each signal: `category`, `confidence` (0-1), `subject` (1-500 chars)
- Optional: `sourceContext` (max 2000 chars), `attributes`, `extractionReason`

### Docs
- Setup: https://developer.zeroclick.ai/docs/signal-collection/setup
- Headers: https://developer.zeroclick.ai/docs/signal-collection/headers
- Tools: https://developer.zeroclick.ai/docs/signal-collection/tools

---

## Files Modified

- `lib/zeroclick.ts` - Client pooling, cleanup, orphan tracking
- `server/routes/gravity.ts` - **NOT MODIFIED** (ad waterfall unchanged)

## Related Documentation

- `docs/memory-management.md` - General memory management notes
- Memory files in `~/.claude/projects/.../memory/` for Claude context
