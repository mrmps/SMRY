# Memory Tracking System

This document describes the comprehensive memory tracking system implemented to identify and debug memory spikes in the SMRY application.

## Overview

The memory tracking system provides operation-level instrumentation to correlate memory spikes with specific operations. Unlike periodic snapshots (which only show "memory increased"), this system shows exactly which operation caused the increase.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Memory Monitoring Stack                       │
├─────────────────────────────────────────────────────────────────────┤
│  lib/memory-monitor.ts    │  Periodic snapshots every 30s           │
│                           │  GC triggering when memory grows        │
│                           │  Critical threshold alerts              │
├─────────────────────────────────────────────────────────────────────┤
│  lib/memory-tracker.ts    │  Per-operation tracking                 │
│                           │  Cache stats aggregation                │
│                           │  Large allocation warnings              │
├─────────────────────────────────────────────────────────────────────┤
│  Instrumented Paths       │  Article fetch, Ad requests,            │
│                           │  Signal broadcasting, Diffbot API       │
└─────────────────────────────────────────────────────────────────────┘
```

## Key Components

### 1. Memory Tracker (`lib/memory-tracker.ts`)

Core tracking utilities for instrumenting memory-intensive operations.

#### Functions

| Function | Purpose |
|----------|---------|
| `startMemoryTrack(name, metadata)` | Start tracking an operation. Returns tracker with `.end()`, `.checkpoint()`, `.addMetadata()` |
| `trackFetchResponse(url, source, response, contentLength, startTime)` | Log large (500KB+) or slow (1s+) fetch responses |
| `logLargeAllocation(context, estimatedBytes, metadata)` | Warn before creating large buffers |
| `getAllCacheStats()` | Get snapshot of all cache sizes |
| `startCacheStatsLogger()` | Start periodic cache stats logging (every 60s) |

#### Usage Example

```typescript
import { startMemoryTrack, logLargeAllocation } from "@/lib/memory-tracker";

async function fetchSomething(url: string) {
  const tracker = startMemoryTrack("my-operation", { url_host: hostname });

  try {
    const response = await fetch(url);
    tracker.checkpoint("response-received");

    const data = await response.text();

    if (data.length > 500_000) {
      logLargeAllocation("data-buffer", data.length, { url });
    }

    tracker.end({ success: true, data_length: data.length });
    return data;
  } catch (error) {
    tracker.end({ success: false, error: String(error) });
    throw error;
  }
}
```

### 2. Memory Monitor (`lib/memory-monitor.ts`)

Periodic memory snapshots with GC triggering and critical alerts.

- Logs memory every 30 seconds
- Triggers GC when RSS grows by 100MB+
- Alerts when RSS exceeds 1.5GB or spikes by 400MB in 30s
- Now includes cache stats in all snapshots

### 3. Cache Stats

The system tracks these bounded caches:

| Cache | Max Size | Location |
|-------|----------|----------|
| ZeroClick MCP Clients | 50 | `lib/zeroclick.ts` |
| Session Failures | 200 | `lib/zeroclick.ts` |
| Auth/Billing Cache | 1000 | `server/middleware/auth.ts` |
| ClickHouse Buffer | 500 events | `lib/clickhouse.ts` |
| Rate Limiter IPs | 10,000 | `lib/rate-limit-memory.ts` |

## Instrumented Operations

### Article Fetching

**File:** `server/routes/article.ts`

| Operation | Tracked Data |
|-----------|--------------|
| `article-fetch-smry-fast` | HTML bytes, parse time, success/failure |
| `article-fetch-smry-slow` | Diffbot response, article length |
| `article-fetch-wayback` | Wayback archive response |

### Ad Requests

**File:** `server/routes/gravity.ts`

| Operation | Tracked Data |
|-----------|--------------|
| `ad-context-request` | Article content length, session ID, ad counts |

### ZeroClick Integration

**File:** `lib/zeroclick.ts`

| Operation | Tracked Data |
|-----------|--------------|
| `zeroclick-signal-broadcast` | Content length, client acquisition, success |
| `zeroclick-fetch-offers` | Query length, offer count, retry attempts |

### Diffbot API

**File:** `lib/api/diffbot.ts`

| Operation | Tracked Data |
|-----------|--------------|
| `diffbot-api-call` | DOM size, extraction method, text/HTML lengths |

## Log Patterns

### Critical (Investigate Immediately)

```
memory_spike_operation  - Single operation used 50MB+ RSS
critical_rss_spike      - Memory spiked 400MB+ in 30 seconds
critical_memory_exceeded - RSS exceeded 1.5GB threshold
```

### Informational

```
memory_operation      - Significant operation (5MB+ delta or 1s+ duration)
memory_checkpoint     - Mid-operation checkpoint
fetch_response        - Large (500KB+) or slow (1s+) fetch
large_allocation      - Warning before big buffer creation
cache_stats_snapshot  - Periodic cache sizes (every 60s)
memory_snapshot       - Periodic memory state (every 30s)
```

## Debugging Workflow

### Step 1: Check Health Endpoint

```bash
curl https://your-api.com/health | jq
```

Response now includes cache stats:
```json
{
  "status": "ok",
  "memory": {
    "heapUsedMb": 245,
    "heapTotalMb": 512,
    "rssMb": 680
  },
  "caches": {
    "zeroclick_client_cache": 12,
    "zeroclick_session_failures": 5,
    "zeroclick_orphaned": 0,
    "clickhouse_buffer": 45,
    "clickhouse_active_queries": 2,
    "rate_limiter_ips": 1234,
    "active_operations": 3
  }
}
```

### Step 2: Search for Spike Operations

```bash
# Find operations that caused memory spikes
grep "memory_spike_operation" logs.json | jq .

# Find large fetch responses
grep "fetch_response" logs.json | jq 'select(.content_length_bytes > 1000000)'

# Find slow operations
grep "memory_operation" logs.json | jq 'select(.duration_ms > 5000)'
```

### Step 3: Correlate with Cache Growth

```bash
# Watch cache sizes over time
grep "cache_stats_snapshot" logs.json | jq '{
  time: .timestamp,
  zc_clients: .zeroclick_client_cache,
  ch_buffer: .clickhouse_buffer,
  rate_ips: .rate_limiter_ips
}'
```

### Step 4: Track Specific Operations

```bash
# Filter by operation name
grep '"op_name":"article-fetch-smry-fast"' logs.json | jq .

# Find failed operations
grep "memory_operation" logs.json | jq 'select(.success == false)'
```

## Thresholds

| Threshold | Value | Triggers |
|-----------|-------|----------|
| `DELTA_THRESHOLD_MB` | 5 MB | Log operation if memory delta exceeds this |
| `LARGE_RESPONSE_BYTES` | 500 KB | Log fetch responses larger than this |
| `OPERATION_TIME_THRESHOLD_MS` | 1000 ms | Log operations slower than this |
| `CRITICAL_RSS_MB` | 1500 MB | Health check returns 503 |
| `CRITICAL_RSS_SPIKE_MB` | 400 MB | Log critical spike alert |

## Adding New Instrumentation

To instrument a new operation:

```typescript
import { startMemoryTrack, logLargeAllocation, trackFetchResponse } from "@/lib/memory-tracker";

async function newOperation(params: Params) {
  // 1. Start tracking at function entry
  const tracker = startMemoryTrack("operation-name", {
    key_param: params.someValue,
  });

  try {
    // 2. Add checkpoints at significant steps
    const data = await someAsyncWork();
    tracker.checkpoint("step-1-complete");

    // 3. Warn before large allocations
    if (data.length > 500_000) {
      logLargeAllocation("buffer-name", data.length, { context: "value" });
    }

    // 4. Track fetch responses
    const response = await fetch(url);
    const content = await response.text();
    trackFetchResponse(url, "source-name", response, content.length, startTime);

    // 5. End with success metadata
    tracker.end({ success: true, result_size: data.length });
    return data;

  } catch (error) {
    // 6. End with failure metadata
    tracker.end({ success: false, error: String(error).slice(0, 100) });
    throw error;
  }
}
```

## Best Practices

1. **Always call `tracker.end()`** - Use try/finally if needed to ensure cleanup
2. **Keep metadata concise** - Truncate strings, avoid large objects
3. **Use checkpoints sparingly** - Only for long-running operations
4. **Log large allocations before creating them** - Helps identify what's about to consume memory
5. **Include operation identifiers** - Session IDs, URLs (hostname only), etc.

## Related Documentation

- [MEMORY_LEAK_FIX.md](./MEMORY_LEAK_FIX.md) - Previous memory leak fixes
- [lib/MEMORY_LEAK_INVESTIGATION.md](../lib/MEMORY_LEAK_INVESTIGATION.md) - Investigation notes
- [agents/MEMORY_LEAK_INVESTIGATION.md](../agents/MEMORY_LEAK_INVESTIGATION.md) - Agent investigation

## Files Reference

| File | Purpose |
|------|---------|
| `lib/memory-tracker.ts` | Core tracking utilities |
| `lib/memory-monitor.ts` | Periodic snapshots, GC, alerts |
| `server/index.ts` | Starts monitoring, health endpoint |
| `server/routes/article.ts` | Article fetch instrumentation |
| `server/routes/gravity.ts` | Ad request instrumentation |
| `lib/zeroclick.ts` | ZeroClick instrumentation |
| `lib/api/diffbot.ts` | Diffbot API instrumentation |
