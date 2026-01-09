# Next.js 16 Memory Leak Investigation

**Date:** January 2026
**Duration:** ~4 hours of investigation
**Outcome:** Complete fix - all user-facing pages now static, memory leak eliminated

---

## The Problem

The Next.js application was experiencing severe memory growth in production on Railway:
- Memory would grow continuously under load
- Eventually OOM (Out of Memory) crashes
- Restarting temporarily fixed it, but leak returned

### Symptoms
- ~100-110 KB of memory retained per request
- Memory never freed even after garbage collection
- Only affected dynamic routes (not static files like `/robots.txt`)

---

## Investigation Process

### Phase 1: Establish Baseline Measurements

**Tools Created:**
- `scripts/mem/repro.sh` - Orchestration script for reproducible testing
- `scripts/mem/snapshot.js` - V8 inspector-based heap snapshots with forced GC
- `scripts/mem/load.sh` - Deterministic load generation with autocannon
- `scripts/mem/analyze.js` - Heap snapshot diff analysis

**Key Insight:** You cannot trust memory measurements without forcing GC first. Node's GC is lazy - memory might look high but be reclaimable. The inspector API (`HeapProfiler.collectGarbage`) forces a full GC cycle.

**Measurement Protocol:**
1. Warmup (100 requests) - stabilize JIT, caches
2. Force GC + take baseline snapshot
3. Load test (N requests)
4. Wait for quiescence (5s)
5. Force GC + take snapshot
6. Repeat for multiple rounds
7. Cooldown (15s) + final snapshot
8. Compare heap snapshots

### Phase 2: Identify Leaked Objects

**Heap Snapshot Analysis Results (900 requests):**

| Object Type | Count | Size |
|------------|-------|------|
| ServerResponse | +900 | +386.7 KB |
| IncomingMessage | +900 | +231.9 KB |
| NodeNextRequest | +1800 | +168.5 KB |
| IncrementalCache | +900 | +98.3 KB |
| Promise | +26100 | +1.19 MB |
| Anonymous closures | +51300 | +2.79 MB |

**Key Observation:** Object counts matched request counts exactly. One `ServerResponse`, one `IncomingMessage`, one `IncrementalCache` per request - never cleaned up.

### Phase 3: Hypotheses Tested

#### Hypothesis 1: Node.js Version Issue
**Source:** GitHub issue #85914 suggested Node.js 20.15.1 or 20.18+ fixes the leak.

**Test:** Built Docker containers with different Node versions:
- Node.js 22.x - Leaked
- Node.js 20.18 - Leaked
- Node.js 20.15.1 - Leaked

**Result:** ❌ Node.js version doesn't fix the leak

#### Hypothesis 2: Patched Fetch Causes Leak
**Source:** Same GitHub issue blamed Next.js's patched fetch function.

**Test:** Replaced `globalThis.fetch` with undici in `instrumentation.ts`:
```typescript
const { fetch, Headers, Request, Response } = await import("undici");
globalThis.fetch = fetch;
```

**Result:** ❌ Same leak with or without undici replacement

#### Hypothesis 3: Static vs Dynamic Routes
**Test:** Compared memory behavior:
- `/robots.txt` (static file) - No leak, memory returns to baseline
- `/` (dynamic page) - Leaks ~110 KB per request

**Result:** ✅ Leak is specifically in dynamic page rendering

### Phase 4: Root Cause Analysis

**Location of Leak:** Next.js internal request handling for dynamic routes.

In `node_modules/next/dist/server/base-server.js`:
```javascript
// Line ~854 - creates new cache per request
const incrementalCache = this.getIncrementalCache(...);

// Stores references that prevent GC
addRequestMeta(req, 'incrementalCache', incrementalCache);
globalThis.__incrementalCache = incrementalCache;
```

**Why Objects Are Retained:**
1. `IncrementalCache` created per-request (should be singleton or cleaned up)
2. References stored in request metadata via Symbol
3. Closures and Promises capture request context
4. Something in Next.js's rendering pipeline holds references after response sent

**Why Static Routes Don't Leak:**
Static routes skip the rendering pipeline entirely. They just serve pre-built HTML files - no per-request object creation.

---

## The Solution

### Key Insight
The pages didn't actually need to be dynamic. They were dynamic because:
1. Root layout called `getLocale()` which reads headers
2. Proxy page called `headers()` to get client IP
3. But the IP was **never used** - dead code passed through 6+ components!

### The Fix

**Step 1: Remove Dead Code**
The `ip` prop was traced through the entire component tree:
```
proxy/page.tsx → ProxyContent → ArrowTabs → InlineSummary → ExpandedSummary → SummaryForm
```
But `SummaryForm` defined `ipProp` in its interface and never used it. Rate limiting actually happens in the Elysia API server using `extractClientIp(request)` directly.

**Step 2: Make Pages Static**
For each page, created a thin server wrapper with `dynamic = 'force-static'`:

```typescript
// app/[locale]/proxy/page.tsx
import { setRequestLocale } from 'next-intl/server';
import { ProxyPageContent } from '@/components/pages/proxy-content';

export const dynamic = 'force-static';

export default async function ProxyPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ProxyPageContent />;
}
```

**Step 3: Client-Side URL Handling**
Moved `searchParams` reading to client:

```typescript
// components/pages/proxy-content.tsx
"use client";
import { useSearchParams } from "next/navigation";

export function ProxyPageContent() {
  const searchParams = useSearchParams();
  const rawUrl = searchParams.get("url") ?? "";
  // ... URL validation and rendering
}
```

### Results

| Route | Before | After |
|-------|--------|-------|
| All locale pages | ƒ Dynamic | ● SSG |
| Memory per 900 req | +100 MiB | +1.4 MiB |
| Memory growth | 319% | 5.29% |
| Test result | FAIL | PASS |

---

## Key Learnings

### 1. Measure Before You Fix
Don't assume fixes work. The GitHub issue said "use Node 20.15.1" and "replace fetch with undici" - neither actually fixed the leak. Always verify with measurements.

### 2. Build a Reproducible Test Harness
The `scripts/mem/` harness was essential:
- Forced GC via inspector (not just waiting)
- Multiple rounds to confirm linear growth
- Heap snapshots for root cause analysis
- Pass/fail criteria (10% threshold)

### 3. Static is Always Faster and Leak-Free
Dynamic server rendering creates per-request objects. Static pages are just file serving - no memory accumulation possible.

### 4. Trace Props to Their Usage
The `ip` prop was passed through 6 components but never used. Always verify that data flowing through your app is actually consumed.

### 5. Rate Limiting Doesn't Need Frontend IP
API-level rate limiting reads headers directly from the incoming request. No need to pass IP through React component trees.

### 6. Client Components Can Be Statically Served
`"use client"` doesn't mean dynamic rendering. The server just sends the component code; the client handles interactivity. Wrap in a `force-static` server component.

---

## Technical Details

### How V8 Heap Snapshots Work

```javascript
// Connect to Node inspector via WebSocket
const ws = new WebSocket('ws://127.0.0.1:9229/...');

// Force garbage collection
await post('HeapProfiler.enable');
await post('HeapProfiler.collectGarbage');

// Get memory stats
const result = await post('Runtime.evaluate', {
  expression: 'JSON.stringify(process.memoryUsage())',
  returnByValue: true,
});

// Take heap snapshot
await post('HeapProfiler.takeHeapSnapshot', { reportProgress: false });
```

### Heap Snapshot Analysis

Snapshots are JSON with nodes and edges. Each node has:
- type (object, closure, string, etc.)
- name (class name or "(anonymous)")
- self_size (bytes)
- edge_count (references to other nodes)

Comparing two snapshots shows which objects grew.

### Why `Runtime.getHeapStatistics` Doesn't Work Over WebSocket

The Chrome DevTools Protocol doesn't expose `Runtime.getHeapStatistics`. Instead, use `Runtime.evaluate` to call `process.memoryUsage()` or `require('v8').getHeapStatistics()`.

---

## Files Modified

### New Files
- `scripts/mem/repro.sh` - Test harness
- `scripts/mem/snapshot.js` - Heap snapshot tool
- `scripts/mem/load.sh` - Load generator
- `scripts/mem/analyze.js` - Snapshot analyzer
- `components/pages/proxy-content.tsx` - Client-side proxy wrapper
- `components/pages/pricing-content.tsx` - Moved from page
- `components/pages/history-content.tsx` - Moved from page

### Modified Files
- `app/[locale]/page.tsx` - Added `force-static`
- `app/[locale]/hard-paywalls/page.tsx` - Added `force-static`
- `app/[locale]/pricing/page.tsx` - Thin server wrapper
- `app/[locale]/history/page.tsx` - Thin server wrapper
- `app/[locale]/proxy/page.tsx` - Removed `headers()`, thin wrapper
- `components/features/proxy-content.tsx` - Removed `ip` prop
- `components/features/inline-summary.tsx` - Removed `ipProp`
- `components/features/summary-form.tsx` - Removed `ipProp`
- `components/features/resizable-modal.tsx` - Removed `ip` prop
- `components/article/tabs.tsx` - Removed `ip` prop

---

## Future Recommendations

### 1. Monitor Memory in Production
Add memory metrics to your observability stack. Alert on sustained growth.

### 2. Keep Pages Static When Possible
Default to `force-static`. Only use dynamic when you genuinely need:
- User-specific server-side data
- Request headers that affect rendering
- Data that can't be fetched client-side

### 3. Run Memory Tests in CI
Add the harness to CI pipeline:
```bash
bash scripts/mem/repro.sh --rounds 2 --requests 100 --threshold 20
```
Fail the build if memory grows too much.

### 4. Watch Next.js Issues
The underlying bug in Next.js 16 may be fixed in future versions. Track:
- https://github.com/vercel/next.js/issues/85914
- Related issues about standalone mode memory

### 5. Consider Periodic Restarts for Any Remaining Dynamic Routes
If `/admin` or any future dynamic route leaks, configure Railway to restart:
- On memory threshold (e.g., 512MB)
- On schedule (e.g., daily)

---

## Commands Reference

```bash
# Run full memory test
bash scripts/mem/repro.sh --rounds 3 --requests 300

# Test specific URL
bash scripts/mem/repro.sh --url "http://localhost:3000/proxy?url=example.com"

# Quick test with lower threshold
bash scripts/mem/repro.sh --rounds 2 --requests 100 --threshold 20

# Analyze heap snapshots
node scripts/mem/analyze.js artifacts/mem/TIMESTAMP/round3.heapsnapshot \
  --compare artifacts/mem/TIMESTAMP/baseline.heapsnapshot

# Start server manually with inspector
node --inspect .next/standalone/server.js

# Take snapshot manually
node scripts/mem/snapshot.js --label "my-test" --snapshot /tmp/heap.heapsnapshot
```

---

## Appendix: Full Test Output (After Fix)

```
==============================================
  Memory Leak Reproduction Harness v2
==============================================

Configuration:
  Rounds:       3
  Requests:     300 per round
  URL:          http://localhost:3000/
  Threshold:    10% growth allowed

Baseline: 26.78 MiB

Round 1: 28.56 MiB (6.64% growth)
Round 2: 26.97 MiB (0.71% growth)
Round 3: 27.15 MiB (1.38% growth)

Cooldown: 27.15 MiB (1.38% growth)

==============================================
  PASS: Memory growth 1.38% within 10% threshold
==============================================
```
