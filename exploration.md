# UX Exploration: Simplifying the Paywall Bypass Experience

**Date:** January 5, 2026
**Status:** Research complete, ready for implementation

---

## The Problem

Users are confused by the current multi-source UI. They see failures prominently displayed (red "✗" badges) even when the overall extraction succeeds. This creates:

1. **False failure perception** - Smry Fast often fails first (in ~200ms), so users' first visual feedback is frequently a failure
2. **Choice paralysis** - 4 tabs with cryptic names (Fast, Slow, Wayback, Jina) creates cognitive load
3. **Support burden** - Users don't understand the UX and flood support with "why did it fail?"
4. **Leaky abstraction** - We're exposing implementation details (4 extraction pipelines) when users just want to read articles

### Current UX Flow (Problematic)
```
User enters URL
     ↓
Sees 4 tabs loading simultaneously
     ↓
Fast fails first → RED "✗" appears immediately
     ↓
User: "WTF, it failed!"
     ↓
Doesn't understand they should try other tabs
     ↓
Contacts support OR leaves
```

---

## Analytics Insights

From our Clickhouse analytics (49K requests over 7 days):

| Metric | Value |
|--------|-------|
| Overall Success Rate | 66.39% |
| Avg Latency | 2,934ms |
| P95 Latency | 14,099ms |

### Source Performance Varies Wildly by Domain

| Site | smry-fast | smry-slow | wayback | jina.ai |
|------|-----------|-----------|---------|---------|
| wsj.com | 0% | 0% | 16% | **68%** |
| bloomberg.com | 2.68% | 2.99% | 3.91% | **71%** |
| nytimes.com | **100%** | 93.67% | 11.84% | 100% |
| telegraph.co.uk | 32.85% | 32.85% | 13.84% | **69.75%** |
| washingtonpost.com | 0% | 25.45% | 17.45% | **100%** |

**Key insight:** For hard paywalls, jina.ai is often the ONLY source that works. But in our current UI, users see 2-3 failures before jina succeeds.

### Latency Characteristics
- **smry-fast:** ~200ms (fast but often fails on hard paywalls)
- **jina.ai:** ~1-2s
- **smry-slow:** ~2-4s (uses Diffbot, more reliable)
- **wayback:** ~5-15s (highly variable)

---

## UX Approaches Explored

### Approach A: "Wait for All, Show Best" ❌
Wait for all sources, pick the best result.

**Rejected because:** Adds 3-15s latency. Users want content ASAP.

### Approach B: "Sequential Display" ❌
Show sources trying one at a time like a progress indicator.

**Rejected because:** Loses the latency benefit of parallel fetching.

### Approach C: "Smart Routing with Domain Intelligence" ❌
Pre-compute which sources work for which domains. Skip sources that never work.

**Rejected because:** Too complex. Requires:
- Clickhouse aggregation jobs
- Redis caching
- Exploration/exploitation logic
- Anomaly detection for stale data
- Lots of moving parts that can break

### Approach D: "No Tabs Ever" (Considered)
Kill multi-source UI entirely. One result, period.

**Pros:** Simplest possible UX
**Cons:** Loses power-user flexibility

### Approach E: "Success-Only Progressive Tabs" ✅ SELECTED
Fetch all sources in parallel (keep current architecture), but only show tabs for sources that succeed. Hide all failures.

**This preserves:**
- Latency advantage (first success shows immediately)
- Power-user flexibility (can switch between successful sources)
- Simple mental model (no visible failures)

---

## The Solution

### Core Principle
**"Fetch everything, show first success, hide failures"**

No complex routing. No ML. No caching. Just change what we display.

### UI States

**State 1: Loading (no tabs yet)**
```
┌────────────────────────────────────────────────────────┐
│                                                        │
│            ◐  Bypassing paywall...                     │
│                                                        │
└────────────────────────────────────────────────────────┘
```

**State 2: First success arrives (one tab appears)**
```
┌────────────────────────────────────────────────────────┐
│  [● Reader 8.4k]  ◐                                    │
├────────────────────────────────────────────────────────┤
│  THEATLANTIC.COM                                       │
│                                                        │
│  Prepare for the New Paywall Era                       │
│  ...content immediately visible...                     │
└────────────────────────────────────────────────────────┘
```

**State 3: More successes arrive (tabs grow)**
```
┌────────────────────────────────────────────────────────┐
│  [● Reader 8.4k]  [Deep 9.2k]  [Archive 11k]          │
├────────────────────────────────────────────────────────┤
│  ...content...                                         │
└────────────────────────────────────────────────────────┘
```

**State 4: All sources failed**
```
┌────────────────────────────────────────────────────────┐
│                                                        │
│       ┌─────────────────────────────────────────┐      │
│       │   ✗  Couldn't bypass this paywall       │      │
│       │                                         │      │
│       │   This site may require a subscription. │      │
│       │                                         │      │
│       │   Try manually:                         │      │
│       │   → archive.is                          │      │
│       │   → Open original                       │      │
│       └─────────────────────────────────────────┘      │
│                                                        │
└────────────────────────────────────────────────────────┘
```

### Key Changes from Current UI

| Current | New |
|---------|-----|
| Tabs visible immediately | Tabs hidden until first success |
| Failures shown as red ✗ badges | Failures silently hidden |
| User sees Fast fail at T+200ms | User sees nothing until first success |
| 4 tabs always visible | Only successful sources become tabs |
| User must manually pick tab | Auto-shows first success |

### Hard Paywall Messaging

Simple hardcoded list for UI messaging (not routing):

```typescript
const HARD_PAYWALL_DOMAINS = new Set([
  "wsj.com",
  "bloomberg.com",
  "ft.com",
  "economist.com",
  "thetimes.com",
  "telegraph.co.uk",
  "barrons.com",
]);
```

Used only for showing appropriate loading message:
```
"This site has a hard paywall. This may take longer..."
```

Update manually when patterns emerge in analytics. No automation needed.

---

## Rejected Complexity

We explicitly decided NOT to implement:

- ❌ Domain intelligence caching in Redis
- ❌ Clickhouse aggregation jobs for source success rates
- ❌ Exploration/exploitation routing (10% explore, 90% exploit)
- ❌ Anomaly detection for stale cached data
- ❌ Decay functions for confidence over time
- ❌ Smart source skipping based on historical data
- ❌ LLM-based content verification (too slow)

**Why:** All of these add complexity and fragility. The simple solution (show successes, hide failures) achieves 90% of the benefit with 10% of the complexity.

---

## Future Considerations

### Content Verification (Heuristics Only)
If we need to verify extractions are real content (not paywall text), use fast heuristics:

```typescript
function isLikelyPaywallContent(content: string): boolean {
  if (content.length < 1000) return true;
  if (/subscribe to (continue|read)/i.test(content)) return true;
  if (/sign in to (continue|read)/i.test(content)) return true;
  if (/members?.only/i.test(content)) return true;
  return false;
}
```

No LLM needed. These patterns catch 90% of paywall text.

### Business Model Option
Could charge per verified successful extraction:
- Free: 1/day
- Pro: Unlimited

Only count as "used" when user actually gets readable content.

---

## Implementation Summary

1. **Keep parallel fetching** - No changes to backend
2. **Change frontend tabs component** - Only render tabs for successful sources
3. **Remove failure badges** - No red ✗ icons
4. **Add loading state** - Single loader until first success
5. **Add failure state** - Only shown when ALL sources fail
6. **Optional: Hard paywall list** - For messaging only, not routing

---

## Appendix: Source Renaming (Optional)

If we keep tabs visible, consider renaming for clarity:

| Current | Better |
|---------|--------|
| Smry Fast | Quick |
| Smry Slow | Deep |
| Wayback | Archive |
| Jina.ai | Reader |
