# Ad System Architecture

SMRY serves contextual ads to free-tier users. The system uses a **waterfall** pattern: Gravity is the primary ad provider, and ZeroClick fills any remaining slots as a fallback.

## Overview

```
Client (useGravityAd hook)
  │
  ├── POST /api/context ─────────────────────────────────┐
  │                                                       │
  │   Server (gravity.ts)                                 │
  │   ┌───────────────────────────────────────────────┐   │
  │   │ 1. Check premium status (skip if premium)     │   │
  │   │ 2. Phase 1: Call Gravity API                  │   │
  │   │    └── Up to 5 placements requested           │   │
  │   │ 3. Phase 2: If slots remain, call ZeroClick   │   │
  │   │    └── Request (MAX_AD_SLOTS - gravityCount)  │   │
  │   │ 4. Phase 3: Combine & return tagged ads       │   │
  │   └───────────────────────────────────────────────┘   │
  │                                                       │
  │◄── { status, ad, ads[] } ─────────────────────────────┘
  │
  ├── Impression tracking ──────────────────────────────────┐
  │   (fires once per ad view)                              │
  │                                                         │
  │   Gravity ads:                                          │
  │     POST /api/px ──► forward GET to Gravity impUrl      │
  │                  └──► log to ClickHouse (with result)   │
  │                                                         │
  │   ZeroClick ads:                                        │
  │     POST /api/px ──► log to ClickHouse                  │
  │     sendBeacon ────► zeroclick.dev/api/v2/impressions   │
  │                      (client-side, required by ZC)      │
  └─────────────────────────────────────────────────────────┘
```

## API Endpoints

### `POST /api/context` — Ad Serving

Fetches contextual ads based on article content. Named neutrally to avoid ad blockers.

**Request body** (`ContextRequest` in `types/api.ts`):
- `url` — article URL
- `title` — article title
- `articleContent` — truncated article text (~4000 chars)
- `sessionId` — persistent client session ID
- `device` — timezone, locale, UA, screen dimensions, etc.
- `user` — optional Clerk user ID and email
- `byline`, `siteName`, `publishedTime`, `lang` — article metadata
- `prompt` — optional extra instruction for ad generation

**Response** (`ContextResponse` in `types/api.ts`):
- `status` — `filled`, `no_fill`, `premium_user`, `gravity_error`, `timeout`, `error`
- `ad` — primary ad (first in the array)
- `ads[]` — all ads from both providers, tagged with `provider: "gravity" | "zeroclick"`

### `POST /api/px` — Tracking Pixel

Unified tracking for impressions, clicks, and dismissals. Named "/px" to avoid blockers.

For **Gravity impressions**, this endpoint forwards the impression to Gravity's `impUrl` first (billing-critical), then logs the result to ClickHouse. For **ZeroClick impressions**, it only logs to ClickHouse — ZeroClick impression tracking happens client-side via `sendBeacon`.

## Provider Details

### Gravity (Primary)

- **API**: `POST https://server.trygravity.ai/api/v1/ad`
- **Auth**: `Authorization: Bearer {GRAVITY_API_KEY}`
- **Timeout**: 6000ms
- **Placements**: Up to 5 per request (right, inline, below, above, left)
- **Impression tracking**: Server-side forwarding via `/api/px` → Gravity `impUrl`
- **Revenue model**: Impression-based — `impUrl` must be hit for us to get paid

### ZeroClick (Fallback)

- **API**: `POST https://zeroclick.dev/api/v2/offers`
- **Auth**: `x-zc-api-key: {ZEROCLICK_API_KEY}` header
- **Timeout**: 3000ms (shorter since it's a fallback)
- **Method**: `server` — offers fetched server-side
- **Impression tracking**: Client-side `sendBeacon` to `https://zeroclick.dev/api/v2/impressions` with `{ ids: [offerId] }`
- **Module**: `lib/api/zeroclick.ts`

## Impression Tracking Flow

This is the most critical part of the system — incorrect tracking means lost revenue.

### Gravity Impressions
1. Client calls `fireImpression()` from `useGravityAd` hook
2. `sendBeacon` POSTs to `/api/px` with `type: "impression"` and `provider: "gravity"`
3. Server forwards GET request to Gravity's `impUrl` (this is how Gravity counts the impression)
4. Server logs to ClickHouse with `gravity_forwarded: 1|0` and `gravity_status_code`

### ZeroClick Impressions
1. Client calls `fireImpression()` from `useGravityAd` hook
2. `sendBeacon` POSTs to `/api/px` with `type: "impression"` and `provider: "zeroclick"` — logged to ClickHouse (no server forwarding)
3. **Separately**, client `sendBeacon` POSTs to `https://zeroclick.dev/api/v2/impressions` with `{ ids: [zeroClickId] }` — this is required by ZeroClick for their billing

## ClickHouse Schema

### `ad_events` Table

Tracks the full ad funnel: `request → impression → click/dismiss`.

Key columns:
| Column | Type | Description |
|--------|------|-------------|
| `event_type` | `LowCardinality(String)` | `request`, `impression`, `click`, `dismiss` |
| `status` | `LowCardinality(String)` | `filled`, `no_fill`, `premium_user`, `gravity_error`, `timeout`, `error` |
| `ad_provider` | `LowCardinality(String)` | `gravity` or `zeroclick` |
| `gravity_forwarded` | `UInt8` | 1 if impression was successfully forwarded to Gravity |
| `gravity_status_code` | `UInt16` | HTTP status from Gravity impression forwarding |
| `ad_count` | `UInt8` | Number of ads returned in the request |

See `docs/clickhouse-schema.sql` for the full CREATE TABLE statement.

### Materialized Views

- `ad_hourly_metrics_mv` — hourly aggregates by device/browser (fill, impression, click, dismiss counts)
- `ad_ctr_by_hour_mv` — CTR by hour-of-day and device type

## Client Hook: `useGravityAd`

Location: `lib/hooks/use-gravity-ad.ts`

The hook handles both Gravity and ZeroClick ads transparently. It:
1. Collects device info (timezone, UA, screen size, etc.) for better targeting
2. Fetches ads from `/api/context` via React Query
3. Auto-refreshes every 45 seconds
4. Provides `fireImpression`, `fireClick`, `fireDismiss` callbacks
5. For ZeroClick ads, `fireImpression` sends **two** beacons: one to `/api/px` (our tracking) and one to `zeroclick.dev` (their tracking)

## Admin Dashboard

Location: `server/routes/admin.ts`

The admin endpoint runs ClickHouse queries that include provider-level breakdowns. Ad metrics are split by `ad_provider` to show Gravity vs ZeroClick fill rates, impression counts, and CTR separately.

## File Map

| File | Purpose |
|------|---------|
| `server/routes/gravity.ts` | Route handler — waterfall orchestration, `/api/context` and `/api/px` |
| `lib/api/zeroclick.ts` | ZeroClick API client — `fetchOffers()`, `normalizeOffer()` |
| `lib/hooks/use-gravity-ad.ts` | React hook — ad fetching, device info, tracking callbacks |
| `lib/clickhouse.ts` | ClickHouse client — `trackAdEvent()`, `ad_events` schema migrations |
| `types/api.ts` | Zod schemas — `ContextAd`, `ContextRequest`, `ContextResponse` |
| `server/env.ts` | Env vars — `GRAVITY_API_KEY`, `ZEROCLICK_API_KEY` |
| `server/routes/admin.ts` | Admin dashboard queries with provider breakdowns |
| `docs/clickhouse-schema.sql` | Reference schema for `ad_events` table |

## Debugging Guide

### Tracing an ad request end-to-end

1. **Check the request log**: Filter `api:gravity` logger for `"Sending ad request to Gravity"` with the target URL
2. **Gravity response**: Look for `"Ad(s) received from Gravity"` (filled) or `"No matching ad from Gravity"` / `"Gravity API error"` (no fill)
3. **ZeroClick fallback**: Filter `lib:zeroclick` logger for `"ZeroClick offers received"` — shows offer count and duration
4. **Combined result**: Look for `"ZeroClick ads filled remaining slots"` showing how many slots each provider filled
5. **Impression forwarding**: Filter for `"Impression forwarded to Gravity"` or `"Failed to forward impression"` — this is the revenue-critical path

### Common issues

- **All ads from ZeroClick, none from Gravity**: Gravity may be returning 204 (no fill) or timing out. Check `gravity_status_code` in ClickHouse.
- **Impressions logged but `gravity_forwarded = 0`**: Gravity's impression URL may be down or returning errors. Check `gravity_status_code` and `error_message`.
- **ZeroClick impressions not counting on their dashboard**: Client-side `sendBeacon` to `zeroclick.dev/api/v2/impressions` may be blocked by ad blockers. This is expected — we can't control client-side blockers.
- **No ads at all**: Check if user is premium (`status = 'premium_user'`), or if both providers are timing out.

### Useful ClickHouse queries

```sql
-- Fill rate by provider (last 24h)
SELECT
  ad_provider,
  countIf(status = 'filled') AS filled,
  count() AS total,
  round(filled / total * 100, 2) AS fill_rate
FROM ad_events
WHERE event_type = 'request'
  AND timestamp > now() - INTERVAL 24 HOUR
  AND status != 'premium_user'
GROUP BY ad_provider;

-- Impression forwarding success rate (Gravity only)
SELECT
  countIf(gravity_forwarded = 1) AS forwarded,
  count() AS total,
  round(forwarded / total * 100, 2) AS success_rate
FROM ad_events
WHERE event_type = 'impression'
  AND ad_provider = 'gravity'
  AND timestamp > now() - INTERVAL 24 HOUR;

-- CTR by provider
SELECT
  ad_provider,
  countIf(event_type = 'impression') AS impressions,
  countIf(event_type = 'click') AS clicks,
  round(clicks / impressions * 100, 2) AS ctr
FROM ad_events
WHERE timestamp > now() - INTERVAL 24 HOUR
GROUP BY ad_provider;
```
