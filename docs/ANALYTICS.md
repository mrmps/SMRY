# PostHog Analytics — SMRY

Complete reference for all analytics events, setup, dashboards, and maintenance.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  Client (Browser)                                                │
│                                                                  │
│  posthog-js SDK                                                  │
│  ├── Autocapture (clicks, form submits, link clicks)             │
│  ├── Session Recording + Heatmaps                                │
│  ├── $pageview / $pageleave (manual SPA tracking)                │
│  ├── User Identification (Clerk → PostHog identify)              │
│  ├── Custom Events (track() via useAnalytics hook)               │
│  └── Feature Adoption ($set_once via markFeatureUsed)            │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│  Server (Elysia / Bun)                                           │
│                                                                  │
│  posthog-node SDK                                                │
│  ├── request_event (every API request)                           │
│  ├── ad_event (impression/click/dismiss with placement data)     │
│  ├── $ai_generation (LLM analytics for chat)                     │
│  └── HogQL queries (admin dashboard)                             │
└──────────────────────────────────────────────────────────────────┘
```

### Key Files

| File | Purpose |
|------|---------|
| `lib/posthog.ts` | Server SDK client, `trackEvent`, `trackAdEvent`, `trackLLMGeneration`, `queryPostHog` |
| `lib/hooks/use-analytics.ts` | Client hook: `track()`, `trackArticle()`, `markFeatureUsed()` |
| `components/providers/posthog-provider.tsx` | SDK init, pageview tracking, user identification |
| `lib/hooks/use-gravity-ad.ts` | Ad impression/click/dismiss tracking with placement data |
| `server/routes/gravity.ts` | Server-side ad event logging (`/api/px` endpoint) |
| `server/routes/chat.ts` | LLM generation tracking (`$ai_generation` events) |

---

## Environment Variables

```bash
# Server-side SDK
POSTHOG_API_KEY=phc_...           # Project API key
POSTHOG_HOST=https://us.i.posthog.com
POSTHOG_PROJECT_ID=12345          # For HogQL queries
POSTHOG_PERSONAL_API_KEY=phx_...  # For HogQL query API

# Client-side SDK
NEXT_PUBLIC_POSTHOG_KEY=phc_...   # Same project, public key
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

---

## Client-Side SDK Configuration

Initialized in `components/providers/posthog-provider.tsx`:

| Feature | Setting | What it does |
|---------|---------|-------------|
| Autocapture | `autocapture: true` | Tracks every button click, form submit, link click |
| Heatmaps | `enable_heatmaps: true` | Visual click/scroll maps per page |
| Session Recording | `enable_recording_console_log: true` | Replay user sessions with console logs |
| Dead Clicks | `capture_dead_clicks: true` | Detects clicks on non-interactive elements |
| Cross-origin iframes | `session_recording.recordCrossOriginIframes: true` | Records embedded content |
| Web Vitals | `capture_performance: true` | LCP, FID, CLS, TTFB metrics |
| Persistence | `persistence: "localStorage+cookie"` | Tracks returning users across sessions |
| Pageview | `capture_pageview: false` | Manual SPA tracking (PostHogPageView component) |
| Page leave | `capture_pageleave: true` | Tracks when users leave pages |

---

## User Identification

The `PostHogIdentify` component (in the provider) links Clerk accounts to PostHog:

### Properties set on every visit (`$set`)

| Property | Source | Use |
|----------|--------|-----|
| `email` | Clerk | Contact/debugging |
| `name` | Clerk | Display |
| `is_premium` | Clerk plan check | Segment by plan |
| `plan` | `"premium"` or `"free"` | Plan-based cohorts |
| `last_seen` | Timestamp | Activity tracking |

### Properties set once (`$set_once`) — first visit only

| Property | Source | Use |
|----------|--------|-----|
| `signup_date` | Clerk `createdAt` | Cohort by signup date |
| `initial_referrer` | `document.referrer` | Acquisition channel |
| `initial_utm_source` | URL param | Campaign attribution |
| `initial_utm_medium` | URL param | Campaign attribution |
| `initial_utm_campaign` | URL param | Campaign attribution |

### Group Analytics

Users are grouped by `plan_tier` (`"premium"` or `"free"`), enabling plan-level metrics in PostHog.

---

## Custom Events Reference

### Home Page (`home-content.tsx`)

| Event | Trigger | Properties |
|-------|---------|------------|
| `article_submitted` | URL form submit | `hostname`, `article_url` |
| `url_validation_error` | Invalid URL entered | `error_message` |

### Article Reader (`proxy-content.tsx`)

| Event | Trigger | Properties |
|-------|---------|------------|
| `article_loaded` | Article data received | `source`, `article_title`, `article_url`, `hostname` |
| `article_error` | Fetch failed | `error_message`, `article_url`, `hostname` |
| `chat_opened` | Chat panel opened | `hostname` |
| `settings_opened` | Settings drawer opened | — |
| `setting_changed` | View mode changed | `setting`, `value` |
| `ad_loaded` | New ad rotation received | `ad_count`, `brand_names`, `providers` |

### Ad Tracking (client-side PostHog events)

| Event | Trigger | Properties |
|-------|---------|------------|
| `ad_impression_client` | Ad enters viewport (50%+) | `placement`, `ad_index`, `brand_name`, `ad_provider` |
| `ad_click_client` | Ad link clicked | `placement`, `ad_index`, `brand_name`, `ad_provider` |
| `ad_dismiss_client` | Ad dismissed | `placement`, `ad_index`, `brand_name`, `ad_provider` |

**Ad Placements:**

| Placement | Index | Location |
|-----------|-------|----------|
| `sidebar` | 0 | Fixed bottom-right (desktop) |
| `inline` | 1 | Mid-article |
| `footer` | 2 | End of article |
| `chat_header` | 3 | Top of chat panel |
| `micro` | 4 | Below chat input |
| `mobile_bottom` | 0 | Fixed above bottom bar (mobile) |
| `mobile_chat_header` | varies | Chat header (mobile) |
| `mobile_chat_inline` | varies | Inside mobile chat |
| `chat_inline` | varies | Chat panel (desktop, reuses inline/footer) |
| `home` | 0 | Home page |

### Chat (`article-chat.tsx`)

| Event | Trigger | Properties |
|-------|---------|------------|
| `chat_message_sent` | User sends message | `message_length`, `language` |
| `chat_suggestion_clicked` | Suggestion chip tapped | `suggestion_text` |
| `chat_message_copied` | Copy button on response | `message_length` |
| `chat_cleared` | Clear chat clicked | `message_count` |

### Share (`share-button.tsx`)

| Event | Trigger | Properties |
|-------|---------|------------|
| `article_shared` | Any share action | `method`: `copy_link` / `native` / `x_twitter` / `linkedin` / `reddit` |

### Highlights (`highlight-toolbar.tsx`, `export-highlights.tsx`)

| Event | Trigger | Properties |
|-------|---------|------------|
| `highlight_created` | Text highlighted | `text_length`, `color` |
| `highlights_exported` | Export copy/download | `format`, `method` (`copy`/`download`), `highlight_count` |

### Settings (`settings-drawer.tsx`)

| Event | Trigger | Properties |
|-------|---------|------------|
| `setting_changed` | Theme/language/palette | `setting`, `value` |

### TTS (`proxy-content.tsx` — TTSControls)

| Event | Trigger | Properties |
|-------|---------|------------|
| `tts_played` | Play pressed | `voice`, `article_url` |
| `tts_paused` | Pause pressed | `article_url` |
| `tts_voice_changed` | Voice selector | `from_voice`, `to_voice` |

### Feature Adoption (`feature_used`)

Fires with `$set_once` (first usage date) and `$set` (last usage date) on the user's PostHog profile:

| Feature | Trigger | Person Properties Set |
|---------|---------|----------------------|
| `tts` | First TTS play | `first_used_tts`, `last_used_tts` |
| `chat` | First chat message / open | `first_used_chat`, `last_used_chat` |
| `share` | First share action | `first_used_share`, `last_used_share` |
| `highlights` | First highlight | `first_used_highlights`, `last_used_highlights` |
| `export_highlights` | First export | `first_used_export_highlights`, `last_used_export_highlights` |

---

## Server-Side Events

### `request_event` — API Request Analytics

Captured in `lib/posthog.ts` → `trackEvent()`. Fired for every API request via request context middleware.

| Property | Type | Description |
|----------|------|-------------|
| `method` | string | HTTP method |
| `endpoint` | string | API endpoint |
| `status_code` | number | Response status |
| `duration_ms` | number | Total request time |
| `cache_hit` | boolean | Redis cache hit |
| `article_length` | number | Extracted content length |
| `input_tokens` | number | LLM prompt tokens |
| `output_tokens` | number | LLM completion tokens |
| `is_premium` | number | 1 = premium user |
| `error_type` | string | Error classification |
| `hostname` | string | Article domain |

### `ad_event` — Ad Funnel Analytics

Captured via `trackAdEvent()`. Fired from `/api/px` (client tracking) and `/api/context` (server ad requests).

| Property | Type | Description |
|----------|------|-------------|
| `event_type` | `request` / `impression` / `click` / `dismiss` | Funnel stage |
| `status` | `filled` / `no_fill` / `premium_user` / `error` | Ad request result |
| `brand_name` | string | Advertiser brand |
| `ad_provider` | string | `zeroclick` or `gravity` |
| `placement` | string | UI slot (sidebar, inline, footer, etc.) |
| `ad_index` | number | Position in ad array (0-4) |
| `gravity_forwarded` | number | 1 = Gravity received impression (revenue) |
| `gravity_status_code` | number | Gravity's response status |
| `device_type` | string | desktop / mobile / tablet |
| `session_id` | string | Session identifier |

### `$ai_generation` — LLM Analytics

Captured via `trackLLMGeneration()`. Fires on every chat completion (free and premium).

| Property | PostHog Key | Description |
|----------|-------------|-------------|
| Trace ID | `$ai_trace_id` | Links related LLM calls |
| Model | `$ai_model` | e.g., `google/gemini-2.0-flash-001` |
| Provider | `$ai_provider` | `openrouter` |
| Input tokens | `$ai_input_tokens` | Prompt token count |
| Output tokens | `$ai_output_tokens` | Completion token count |
| Latency | `$ai_latency` | Seconds (not ms) |
| Is error | `$ai_is_error` | Boolean |
| Output | `$ai_output_choices` | `[{role: "assistant", content: "..."}]` |
| Premium | `is_premium` | Boolean |
| Language | `language` | Chat language |
| Messages | `message_count` | Conversation length |

PostHog automatically builds an **LLM Analytics dashboard** from `$ai_generation` events showing cost, latency, token usage, and error rates.

---

## Ad Tracking Data Flow

```
User sees ad (IntersectionObserver ≥ 50%)
    │
    ├── Client: track("ad_impression_client", { placement, brand_name, ... })
    │   → PostHog (client-side, for funnels/attribution)
    │
    └── Client: fireImpression(ad, "sidebar", 0)
        │
        ├── sendBeacon → /api/px { type: "impression", placement, adIndex, ... }
        │   │
        │   ├── If Gravity: forward to impUrl (server-side)
        │   │   └── Log gravity_forwarded = 1/0 (revenue assurance)
        │   │
        │   └── trackAdEvent → PostHog (server-side, complete data)
        │
        └── If ZeroClick: fetch → zeroclick.dev/api/v2/impressions
            (client-side only, per ZeroClick docs)

User clicks ad
    │
    ├── Client: track("ad_click_client", { placement, brand_name, ... })
    │   → PostHog (client-side)
    │
    ├── Client: fireClick(ad, "sidebar", 0)
    │   └── sendBeacon → /api/px { type: "click", placement, adIndex }
    │       └── trackAdEvent → PostHog (server-side)
    │
    └── Browser navigates to ad.clickUrl
        ├── ZeroClick: zero.click/{id} → advertiser
        └── Gravity: trygravity.ai/... → advertiser
```

---

## PostHog Dashboards to Create

### 1. Product Health (DAU/MAU)

**Type:** Trends insight with formula

1. Create a Trends insight
2. Series A: `$pageview` — unique users — daily
3. Series B: `$pageview` — unique users — monthly
4. Formula: `A / B` (ratio)
5. A healthy DAU/MAU is 20-30%+

### 2. New vs Returning Users

**Type:** Lifecycle insight

1. Create a Lifecycle insight
2. Event: `$pageview`
3. PostHog auto-segments into: New, Returning, Resurrecting, Dormant
4. Track week-over-week to see growth

### 3. Feature Adoption

**Type:** Trends insight + Cohorts

1. **Trends:** Event `feature_used`, break down by `feature` property
2. **Cohorts:** Create cohorts like "Users who have `first_used_tts` is set"
3. **Stickiness:** How many days/week do users use each feature?

### 4. Churn Rate

**Type:** Retention insight

1. Create a Retention insight
2. Start event: `$pageview` (first visit)
3. Return event: `$pageview` (subsequent visit)
4. Period: Weekly
5. Churn = 100% - Retention at each period

### 5. Ad Revenue Funnel

**Type:** Funnel insight

1. Step 1: `ad_event` where `event_type = impression`
2. Step 2: `ad_event` where `event_type = click`
3. Break down by `placement` to see which slots convert
4. Break down by `ad_provider` to compare ZeroClick vs Gravity

### 6. Ad Placement Performance

**Type:** Trends insight

1. Event: `ad_click_client`, break down by `placement`
2. Compare: sidebar vs inline vs footer vs chat_header vs micro
3. Calculate CTR: clicks / impressions per placement

### 7. LLM Cost & Performance

**Type:** Built-in LLM Analytics dashboard

PostHog auto-creates this from `$ai_generation` events:
- Cost per model
- Token usage trends
- Latency distribution
- Error rates
- Premium vs free usage

### 8. Power Users

**Type:** Cohort + Stickiness

1. **Stickiness insight:** `article_loaded` — how many days/week
2. **Cohort:** Users with 5+ `article_loaded` events in last 7 days
3. Cross-reference with `is_premium` to find conversion opportunities

---

## Adding a New Event

### Client-side

1. Add event name to `AnalyticsEvent` type in `lib/hooks/use-analytics.ts`
2. Call `track("event_name", { ...props })` in the component
3. If it's a feature users adopt, also call `markFeatureUsed("feature_name")`

```tsx
import { useAnalytics } from "@/lib/hooks/use-analytics";

function MyComponent() {
  const { track, markFeatureUsed } = useAnalytics();

  const handleAction = () => {
    track("my_event", { some_prop: "value" });
    markFeatureUsed("my_feature"); // optional: for adoption tracking
  };
}
```

### Server-side

Use `trackEvent()` for request analytics or `trackAdEvent()` for ad events:

```typescript
import { trackEvent } from "../../lib/posthog";

trackEvent({
  endpoint: "/api/my-endpoint",
  status_code: 200,
  duration_ms: 150,
  // ... other properties
});
```

---

## Maintenance Guide

### Weekly checks
- [ ] Check **Live Events** in PostHog — are events flowing?
- [ ] Review **Session Recordings** for UX issues
- [ ] Check **LLM Analytics** for cost spikes or error rate increases

### Monthly checks
- [ ] Review **DAU/MAU ratio** — is it trending up?
- [ ] Check **Retention** — is churn improving?
- [ ] Review **Ad funnel** — impression-to-click rates by placement
- [ ] Check **Feature adoption** — are new features being used?
- [ ] Review **Power user cohort** — identify conversion opportunities

### When adding features
1. Add custom events for the key interactions
2. Add `markFeatureUsed()` call for adoption tracking
3. Update this doc with the new events
4. Create a PostHog insight/dashboard for the feature

### When removing features
1. Remove the tracking code
2. Remove event from `AnalyticsEvent` type
3. Archive related PostHog insights (don't delete — historical data stays)
4. Update this doc

---

## Debugging

### Check if events are sending
1. Open browser DevTools → Network tab
2. Filter by `posthog` or `i.posthog.com`
3. You should see batch requests every few seconds

### Check server-side events
```bash
# In PostHog: Activity → Live Events
# Filter by event name: request_event, ad_event, $ai_generation
```

### HogQL queries (admin)
```typescript
import { queryPostHog } from "@/lib/posthog";

const results = await queryPostHog<{ count: number }>(
  "SELECT count() as count FROM events WHERE event = 'ad_event' AND timestamp > now() - interval 1 day"
);
```

### Common issues
- **No events in PostHog:** Check `POSTHOG_API_KEY` and `POSTHOG_HOST` env vars
- **No user identification:** Check Clerk is loaded before PostHog identify runs
- **Missing ad placements:** Check `placement` property in ad events — should not be "unknown"
- **LLM events missing:** Check `$ai_generation` events — verify `onFinish` callback in chat.ts
