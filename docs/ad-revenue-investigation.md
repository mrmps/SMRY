# Ad Revenue Investigation (2026-02-16)

## Issue

Revenue dropped

Gravity's stats showed:
- ~75% fill rate (should be 100% with relevancy=0 - Gravity is debugging)
- ~20% impression rate (ads returned vs impressions fired)

## Root Causes Found

### 1. Impression Tracking Bug (PRIMARY - ~80% impression loss)

**File:** `components/ads/gravity-ad.tsx`
**Date introduced:** January 16, 2026 (commit `e8fec28`)

The original implementation used `IntersectionObserver` with a **50% visibility threshold**, meaning impressions only fired when ads were 50% visible in the viewport.

**Gravity docs state:** "Fire the impUrl **when the ad is rendered**"

This caused ~80% of ads to never register impressions because:
- Below-fold ads (sidebar, footer, inline) never scrolled into view
- Users bounced before scrolling
- 5-minute `impUrl` TTL expired before user scrolled
- 63% of traffic is mobile where scroll-to-see is less likely

**Fix:** Fire impression immediately on render:
```typescript
// Before: IntersectionObserver with threshold: 0.5
// After: Fire immediately on mount
useLayoutEffect(() => {
  if (hasTrackedImpression) return;
  setHasTrackedImpression(true);
  onVisible();
}, [ad.impUrl, hasTrackedImpression, onVisible]);
```

---

### 2. Mobile Chat Ad Placement (SECONDARY)

**File:** `components/features/mobile-chat-drawer.tsx`
**Date introduced:** February 5, 2026 (commit `40159b5`)

The chat UI redesign:
- Removed header ad (was always visible)
- Moved ad to inline (after AI response)
- On mobile (63% of traffic), users often don't scroll to see inline ads

**Fix:** Added header ad banner that's visible immediately when mobile chat opens:
```tsx
{/* Header ad banner - visible immediately when chat opens */}
{chatAd && activeView === "chat" && (
  <div className="shrink-0 border-b border-border/30 px-3 py-2 bg-muted/20">
    <GravityAd
      ad={chatAd}
      variant="mobile"
      onVisible={onChatAdVisible ?? (() => {})}
      onClick={onChatAdClick}
    />
  </div>
)}
```

---

### 3. ZeroClick Waterfall Dilution (TESTING)

**File:** `server/routes/gravity.ts`
**Date introduced:** February 11, 2026 (commit `2df10dd`)

1. Gravity returns 1-3 ads per request (not always 5)
2. Waterfall logic: `if (gravityAds.length < 5)` fetches ZeroClick for remaining slots
3. ZeroClick fills with lower-CPM ads, diluting Gravity's premium inventory

**Fix:** Added `ZEROCLICK_DISABLED` env var to test hypothesis:
```bash
ZEROCLICK_DISABLED=true  # Disable ZeroClick, Gravity only
```

---

## Timeline

| Date | Change | Impact |
|------|--------|--------|
| Jan 16 | 50% visibility threshold added | ~80% impressions lost (but baseline was $2k) |
| Feb 5 | Header ad → Inline ad | Further reduces mobile impressions |
| Feb 11 | ZeroClick integration | Dilutes Gravity revenue |
| Feb 16 | Fixes applied | Pending verification |

---

## Files Modified

| File | Change |
|------|--------|
| `components/ads/gravity-ad.tsx` | Fire impression on render instead of 50% visibility |
| `components/features/mobile-chat-drawer.tsx` | Added header ad banner visible immediately |
| `server/env.ts` | Added `ZEROCLICK_DISABLED` env var |
| `server/routes/gravity.ts` | Guard waterfall + fallback with env check, added logging |

---

## Expected Impact

| Fix | Expected Impact |
|-----|-----------------|
| Impression tracking fix | Impressions should increase ~5x (from 20% to ~100% of served ads) |
| Mobile header ad | Mobile impressions should increase significantly |
| ZeroClick disabled | Revenue per impression may increase (higher CPM from Gravity-only) |

---

## Monitoring

Search logs for:
- `ad_provider_stats` - Gravity response stats
- `ad_waterfall_result` - Final ad mix returned

Check Gravity dashboard for:
- Fill rate (should be 100% after Gravity fixes their bug)
- Impression rate (should increase significantly after our fixes)

---

## Rollback

- **Impression fix:** Revert `gravity-ad.tsx` to use IntersectionObserver
- **Mobile header ad:** Remove the header ad section from `mobile-chat-drawer.tsx`
- **ZeroClick:** Set `ZEROCLICK_DISABLED=false` or remove the env var
