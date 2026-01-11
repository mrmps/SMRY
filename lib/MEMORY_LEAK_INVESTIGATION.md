# Memory Leak Investigation - January 2026

## The Incident

**Date**: January 11, 2026, 10:30am - 12:30pm PST (18:30 - 20:30 UTC)

**Symptoms**:
- Memory grew from ~5GB to 32GB over 2 hours
- CPU usage increased proportionally
- Request error rate spiked to 60-80%
- Response times skyrocketed
- Service eventually crashed with OOM

**Key Observation**:
- `process.memoryUsage().rss` reported ~200-900MB
- Railway container showed 32GB
- This 35x discrepancy pointed to memory outside Node.js/V8 tracking

## Investigation

### Initial Analysis

Memory snapshots from logs showed:
```
18:32:13: rss=296MB
18:32:43: rss=438MB (+142MB)
18:33:13: rss=520MB (+82MB)
18:33:43: rss=972MB (+452MB) <- heap/external DROPPED but RSS SPIKED
```

The fact that V8-tracked memory (heap, external, array_buffers) decreased while RSS increased indicated the leak was in **native memory** outside V8's visibility.

### Root Cause Identified

**smry-api runs on Bun**, which uses JavaScriptCore (JSC) instead of V8.

Bun has a **documented memory leak with fetch requests**:
- GitHub Issue: https://github.com/oven-sh/bun/issues/20912
- Affects Bun 1.3.3+ (we use 1.3.5)
- After ~9,500 fetch requests, memory balloons
- Response bodies aren't properly garbage collected
- Still unresolved as of December 2025

This matches smry-api's workload perfectly - heavy fetch to:
- Diffbot API
- Original article URLs
- Wayback Machine
- Direct HTML fetches

### Why process.memoryUsage() Doesn't Match Container Memory

Bun uses JavaScriptCore (JSC), not V8. JSC has different memory management:
- `process.memoryUsage()` may not accurately report JSC's actual allocations
- Native memory from fetch internals isn't tracked
- LinkedOM DOM objects are allocated outside JSC heap

## Mitigation Strategy

### 1. Conditional Garbage Collection (`memory-monitor.ts`)

We added `Bun.gc(true)` calls, but **only when needed**:

```typescript
// Only force GC if:
// - RSS grew by 100MB+ since last check, OR
// - RSS is above 500MB total
const gcResult = maybeForceGC(currentRss);
```

**Why conditional?**
- `Bun.gc(true)` is synchronous and blocks the event loop
- Unconditional GC every 30s would cause latency spikes
- GC thrashing wastes CPU when memory is stable

### 2. GC Effectiveness Monitoring

Every GC run is logged:
```json
{
  "message": "gc_forced",
  "gc_duration_ms": 45,
  "gc_freed_mb": 120,
  "gc_effective": true
}
```

Also tracked in ClickHouse with `GC_INEFFECTIVE` error type if it only frees <=10MB.

### 3. Critical Threshold Protection

If RSS exceeds 1.5GB:
1. Log to ClickHouse for post-mortem
2. Force process exit after 1 second
3. Let Railway restart the service cleanly

## Monitoring & Alerting

### Logs to Watch

```bash
# GC effectiveness
railway logs --service smry-api --filter "gc_forced"

# Memory spikes
railway logs --service smry-api --filter "critical_rss_spike"

# Critical threshold reached
railway logs --service smry-api --filter "critical_memory_exceeded"
```

### ClickHouse Queries

```sql
-- GC effectiveness over time
SELECT
  toStartOfHour(timestamp) as hour,
  count() as gc_runs,
  avg(duration_ms) as avg_gc_duration,
  countIf(error_type = 'GC_INEFFECTIVE') as ineffective_runs
FROM request_events
WHERE endpoint = '/internal/gc'
GROUP BY hour
ORDER BY hour DESC;

-- Memory spike events
SELECT * FROM request_events
WHERE error_type IN ('MEMORY_SPIKE', 'MEMORY_CRITICAL')
ORDER BY timestamp DESC;
```

### Warning Signs

1. **`gc_effective: false` frequently** - GC isn't helping, leak is in native memory
2. **High `gc_duration_ms`** (>100ms) - Long pauses affecting request latency
3. **Memory still growing** despite frequent GC - need different approach
4. **Mismatch between RSS and container memory** - Bun internals leaking

## Potential Future Mitigations

If current approach doesn't work:

### Option 1: Switch to Node.js
```dockerfile
# In Dockerfile.api, change from:
FROM oven/bun:1
CMD ["bun", "run", "server/index.ts"]

# To:
FROM node:20.15.1-alpine
CMD ["npx", "tsx", "server/index.ts"]
```
Pros: V8 has better memory management, accurate reporting
Cons: Slower startup, may lose Bun-specific optimizations

### Option 2: Periodic Service Restart
Configure Railway to restart the service every N hours proactively.

### Option 3: Connection Pooling / Fetch Alternatives
- Limit concurrent fetch operations
- Use a fetch wrapper that explicitly cleans up
- Consider alternative HTTP clients

### Option 4: Report to Bun Team
If we can create a minimal reproduction, report to:
https://github.com/oven-sh/bun/issues

## Files Involved

- `lib/memory-monitor.ts` - Memory monitoring, GC forcing, threshold detection
- `lib/clickhouse.ts` - Analytics event tracking
- `Dockerfile.api` - Bun runtime configuration
- `lib/api/diffbot.ts` - Heavy fetch usage (Diffbot API)
- `server/routes/article.ts` - Heavy fetch usage (direct HTML)

## References

- Bun Fetch Memory Leak: https://github.com/oven-sh/bun/issues/20912
- Bun Memory Debugging: https://bun.com/blog/debugging-memory-leaks
- Bun GC API: `Bun.gc(true)` for synchronous full collection
- JSC vs V8: Different garbage collection strategies and memory accounting
