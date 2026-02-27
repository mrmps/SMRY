# Memory Management Guide

This document covers memory management practices, known issues, and debugging techniques for the SMRY application.

## Table of Contents
- [Architecture Overview](#architecture-overview)
- [Memory-Safe Components](#memory-safe-components)
- [Known Issues & Fixes](#known-issues--fixes)
- [Monitoring](#monitoring)
- [Debugging Memory Leaks](#debugging-memory-leaks)
- [Best Practices](#best-practices)

---

## Architecture Overview

SMRY runs as two processes:
- **Next.js frontend** (port 3000) — React SSR, API routes proxy to Elysia
- **Elysia API server** (port 3001) — Bun runtime, handles ads, chat, articles

Memory-intensive operations:
- Article fetching and parsing (Diffbot)
- Ad requests (Gravity + ZeroClick waterfall)
- Chat streaming (LLM responses)
- Analytics (PostHog SDK manages its own buffer)

---

## Memory-Safe Components

### 1. PostHog Event Buffer
**Location:** `lib/posthog.ts`

PostHog SDK handles batching internally:
- `flushAt: 50` events triggers a batch send
- `flushInterval: 5000ms` auto-flush every 5 seconds
- SDK manages retries and connection pooling

### 2. Auth Billing Cache
**Location:** `server/middleware/auth.ts`

```typescript
const MAX_CACHE_SIZE = 1000;      // Max cached users
const CACHE_TTL_MS = 5 * 60_000;  // 5-minute TTL
const CLEANUP_INTERVAL_MS = 60_000; // Cleanup every minute
```

- Caches Clerk billing status to avoid repeated API calls
- LRU eviction when cache is full
- Periodic cleanup of expired entries

### 3. Rate Limiter
**Location:** `lib/rate-limit-memory.ts`

```typescript
const MAX_ENTRIES = 10_000;       // Max tracked IPs
const CLEANUP_INTERVAL = 60_000;  // Cleanup every minute
```

- In-memory rate limiting for non-authenticated requests
- Evicts oldest entries when at capacity

### 4. ZeroClick Signal Client Pool
**Location:** `lib/zeroclick.ts`

```typescript
const MAX_CACHED_CLIENTS = 100;           // Max MCP connections
const CLIENT_TTL_MS = 5 * 60 * 1000;      // 5-minute idle timeout
const CLIENT_CLEANUP_INTERVAL_MS = 60_000; // Cleanup every minute
```

- MCP clients cached by `sessionId` (per ZeroClick docs)
- Auto-cleanup of idle connections
- Graceful shutdown on SIGTERM/SIGINT

---

## Known Issues & Fixes

### MCP Signal Client Leak (Fixed Feb 2026)

**Symptom:** Gradual memory climb in production, reset on container restart.

**Root Cause:** MCP signal clients were created per-request instead of per-session, and weren't being properly closed.

**Fix:** Implemented session-based client pooling with:
- Cache by `sessionId`
- Max 100 clients
- 5-minute TTL
- Periodic cleanup
- Graceful shutdown handler

**Logs to watch:**
```bash
# Good: Client reuse
"MCP signal client connected" {sessionId: "...", cacheSize: 1}
"Article signal broadcasted"  # No new connection

# Bad: Connection spam (pre-fix)
"MCP signal client connected"
"MCP signal client connected"
"MCP signal client connected"
```

### Article Response Size Leak (Fixed Feb 2026)

**Symptom:** Socket hang ups (ECONNRESET), memory steadily climbing, logs showing "items over 2MB can not be cached".

**Root Cause:** Two issues in `/api/article/auto`:
1. **Full htmlContent in responses** - Original page HTML (2-7MB) was sent to every client
2. **Race pattern holding all results** - Three concurrent fetches accumulated in memory until Promise.allSettled

**Memory Impact (before fix):**
- Each article response: 2-7MB
- 3 concurrent sources per request: up to 21MB per request
- At 100 concurrent requests: 2.1GB+ just from pending promises

**Fix:**
1. Added `truncateHtmlContent()` helper - limits htmlContent to 500KB max
2. Modified race pattern to cache each result immediately (not hold all 3 in memory)
3. Applied truncation to all 6 response locations in article route

**Location:** `server/routes/article.ts`

**Logs to watch:**
```bash
# Good: Small responses
"Failed to set Next.js data cache" # Should see fewer of these

# Bad: Socket hang ups (indicates server overwhelmed)
"Failed to proxy...socket hang up" {code: 'ECONNRESET'}
```

---

## Monitoring

### Memory Snapshots
The app logs memory stats every 30 seconds:

```json
{
  "message": "memory_snapshot",
  "heap_used_mb": 52,
  "heap_total_mb": 49,
  "rss_mb": 228,
  "rss_delta_mb": 0
}
```

| Field | Description | Healthy Value |
|-------|-------------|---------------|
| `heap_used_mb` | V8 heap in use | < 500MB |
| `rss_mb` | Total process memory | < 1.5GB |
| `rss_delta_mb` | Change since last snapshot | ~0 when idle |

**Red flags:**
- `rss_delta_mb` consistently positive = memory leak
- `rss_mb` approaching container limit = imminent OOM

### Memory Monitor
**Location:** `lib/memory-monitor.ts`

Automatic alerts when:
- RSS exceeds 1.5GB (critical threshold)
- Memory spike > 400MB in short period

---

## Debugging Memory Leaks

### Step 1: Check Logs for Patterns

```bash
# Look for connection spam
grep "connected" logs.txt | wc -l

# Check memory deltas
grep "memory_snapshot" logs.txt | jq '.rss_delta_mb'

# Look for cleanup activity
grep "Cleaning up" logs.txt
```

### Step 2: Identify Unbounded Growth

Search for data structures that might grow without limits:

```bash
# Maps without size limits
grep -r "new Map()" --include="*.ts" lib/ server/

# Arrays that might accumulate
grep -r "\.push(" --include="*.ts" lib/ server/

# Event listeners without cleanup
grep -r "addEventListener\|\.on(" --include="*.ts" lib/
```

### Step 3: Check for Missing Cleanup

Common patterns that leak:
- `setInterval` without `clearInterval`
- Event listeners without removal
- HTTP connections without `.close()`
- Streams without `.destroy()`

### Step 4: Profile in Development

```bash
# Run with memory inspection
node --inspect server/index.ts

# Take heap snapshots in Chrome DevTools
# Compare snapshots to find retained objects
```

---

## Best Practices

### 1. Always Bound Caches

```typescript
// Bad: Unbounded cache
const cache = new Map();
cache.set(key, value);

// Good: Bounded with eviction
const MAX_SIZE = 1000;
if (cache.size >= MAX_SIZE) {
  const oldest = cache.keys().next().value;
  cache.delete(oldest);
}
cache.set(key, value);
```

### 2. Use TTL for Cached Data

```typescript
interface CachedItem {
  value: T;
  expiresAt: number;
}

// Periodic cleanup
setInterval(() => {
  const now = Date.now();
  for (const [key, item] of cache) {
    if (item.expiresAt <= now) {
      cache.delete(key);
    }
  }
}, 60_000).unref(); // Don't block exit
```

### 3. Always Clear Timers

```typescript
// Bad: Timer keeps reference
const timeoutId = setTimeout(() => {}, 5000);

// Good: Clear on completion or error
try {
  const result = await operation();
  clearTimeout(timeoutId);
  return result;
} catch (error) {
  clearTimeout(timeoutId);
  throw error;
}
```

### 4. Close Connections Properly

```typescript
// Bad: Fire and forget
broadcastSignal().catch(() => {});

// Good: Ensure cleanup in finally
let client;
try {
  client = await createClient();
  await client.send(data);
} finally {
  if (client) await client.close();
}
```

### 5. Use AbortController for Fetch

```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 5000);

try {
  const response = await fetch(url, { signal: controller.signal });
  clearTimeout(timeoutId);
  return response;
} catch (error) {
  clearTimeout(timeoutId);
  throw error;
}
```

### 6. Unref Timers That Shouldn't Block Exit

```typescript
const interval = setInterval(cleanup, 60_000);
interval.unref(); // Process can exit even if timer is pending
```

---

## Container Configuration

### Railway Settings
- Memory limit: 8GB (current)
- Recommended: Set alert at 6GB usage
- Auto-restart on OOM: Enabled

### Health Checks
The `/health` endpoint returns memory stats:

```json
{
  "status": "ok",
  "memory": {
    "heapUsed": 52000000,
    "rss": 228000000
  }
}
```

---

## Quick Reference

| Component | Max Size | TTL | Cleanup Interval |
|-----------|----------|-----|------------------|
| ZeroClick Clients | 100 | 5 min | 1 min |
| Auth Cache | 1000 | 5 min | 1 min |
| Rate Limiter | 10,000 | varies | 1 min |
| PostHog Buffer | SDK-managed | - | 5 sec flush |
| Article htmlContent | 500KB | - | per-response truncation |

---

## Related Files

- `lib/memory-monitor.ts` — Memory monitoring and alerts
- `lib/zeroclick.ts` — ZeroClick client pool
- `lib/posthog.ts` — PostHog analytics client
- `lib/rate-limit-memory.ts` — Rate limiting
- `server/middleware/auth.ts` — Billing cache
