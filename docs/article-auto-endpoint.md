# Article Auto Endpoint Architecture

## Overview

The `/api/article/auto` endpoint consolidates article fetching into a **single client request** that races multiple sources on the backend and returns the fastest successful result.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT (Browser)                               │
│                                                                             │
│   Single Request: GET /api/article/auto?url=https://example.com/article    │
│                                    │                                        │
│                                    ▼                                        │
│                         ┌──────────────────┐                                │
│                         │  Loading State   │                                │
│                         │   (Skeleton)     │                                │
│                         └──────────────────┘                                │
│                                    │                                        │
│                                    ▼                                        │
│                         ┌──────────────────┐                                │
│                         │  Article Content │  ← First successful result     │
│                         │   (from best     │                                │
│                         │    source)       │                                │
│                         └──────────────────┘                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     │ HTTPS
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              SERVER (Backend)                               │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         1. CHECK CACHE                               │   │
│  │                                                                      │   │
│  │   for source in [smry-fast, smry-slow, wayback]:                    │   │
│  │       cached = redis.get(source:url)                                │   │
│  │       if cached && valid:                                           │   │
│  │           return cached  ──────────────────────► INSTANT RESPONSE   │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                     │                                       │
│                              (cache miss)                                   │
│                                     ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    2. RACE ALL SOURCES IN PARALLEL                   │   │
│  │                                                                      │   │
│  │   Promise.allSettled([                                              │   │
│  │                                                                      │   │
│  │     ┌─────────────┐   ┌─────────────┐   ┌─────────────────────┐    │   │
│  │     │ smry-fast   │   │ smry-slow   │   │     wayback         │    │   │
│  │     │             │   │             │   │                     │    │   │
│  │     │ Direct      │   │ Diffbot     │   │ web.archive.org     │    │   │
│  │     │ fetch +     │   │ API         │   │ + Diffbot           │    │   │
│  │     │ Readability │   │             │   │                     │    │   │
│  │     │             │   │             │   │                     │    │   │
│  │     │ ~1-3s       │   │ ~3-8s       │   │ ~2-10s              │    │   │
│  │     └─────────────┘   └─────────────┘   └─────────────────────┘    │   │
│  │           │                 │                     │                 │   │
│  │           └─────────────────┴─────────────────────┘                 │   │
│  │                             │                                        │   │
│  │                             ▼                                        │   │
│  │                    All results collected                             │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                     │                                       │
│                                     ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      3. SELECT BEST RESULT                           │   │
│  │                                                                      │   │
│  │   for each result:                                                  │   │
│  │       if success && article.length > 500:                           │   │
│  │           bestResult = result  ← First quality result wins          │   │
│  │           break                                                     │   │
│  │                                                                      │   │
│  │   Order checked: smry-fast → smry-slow → wayback                    │   │
│  │   (fastest sources first)                                           │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                     │                                       │
│                                     ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                  4. CACHE ALL SUCCESSFUL RESULTS                     │   │
│  │                     (fire and forget - background)                   │   │
│  │                                                                      │   │
│  │   for each successfulResult:                                        │   │
│  │       redis.set(source:url, article)  ← Non-blocking                │   │
│  │                                                                      │   │
│  │   Next request will hit cache instantly!                            │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                     │                                       │
│                                     ▼                                       │
│                            Return bestResult                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Source Details

| Source | Method | Speed | Best For |
|--------|--------|-------|----------|
| **smry-fast** | Direct fetch + Readability | ~1-3s | Most sites, no paywall |
| **smry-slow** | Diffbot API | ~3-8s | Complex sites, some paywalls |
| **wayback** | Wayback Machine + Diffbot | ~2-10s | Archived content, paywalls |

## Request Flow

### 1. Client Makes Single Request
```typescript
// Client code (React hook)
const { data, isLoading, error } = useArticleAuto(url);

// Internally calls:
GET /api/article/auto?url=https://medium.com/some-article
```

### 2. Server Checks Cache First
```typescript
// Check all source caches - return first hit
for (const source of ["smry-fast", "smry-slow", "wayback"]) {
  const cached = await redis.get(`${source}:${url}`);
  if (cached && isValid(cached)) {
    return cached; // Instant response!
  }
}
```

### 3. Server Races All Sources (First Success Wins!)
```typescript
// All three fetch in parallel - but we DON'T wait for all!
const fetchPromises = [
  fetchArticleWithSmryFast(url),      // Direct fetch (~1-3s)
  fetchArticleWithDiffbot(url),        // Diffbot API (~3-8s)
  fetchArticleWithWayback(url),        // Wayback + Diffbot (~2-10s)
];

// As soon as ONE succeeds with quality content → return immediately!
// Don't wait for slower sources
```

### 4. First Quality Result Returns Instantly
```typescript
// When smry-fast succeeds in 1s → return to client immediately
// Don't wait for smry-slow (8s) or wayback (5s)!
if (result.article.length > 500) {
  return result; // 🚀 User sees article NOW
}
```

### 5. Others Continue in Background
```typescript
// While user is reading, slower sources finish and get cached
// Next request for this URL → instant cache hit!
Promise.allSettled(fetchPromises).then((allResults) => {
  allResults.forEach((r) => {
    if (r.status === "fulfilled") {
      redis.set(`${r.source}:${url}`, r.article); // Background cache
    }
  });
});
```

## Benefits

| Before (3 requests) | After (1 request) |
|---------------------|-------------------|
| 3 parallel requests from client | 1 request from client |
| Client manages race logic | Server manages race logic |
| User sees confusing tabs | User sees clean loading → content |
| Each source loads separately | Best source appears first |
| Cache checked 3 times | Cache checked once, returns immediately |

## Performance: "First Success Wins"

```
❌ Old approach (Promise.allSettled - waits for ALL):

smry-fast:  ████ done (1s)
smry-slow:  ████████████████████████ done (8s)
wayback:    ██████████████ done (5s)
                                        │
            User waits ─────────────────┘ 8 seconds total!


✅ New approach (First success wins):

smry-fast:  ████ done (1s) ─► RETURN TO USER!
smry-slow:  ████████████████████████ (continues for cache)
wayback:    ██████████████ (continues for cache)
                │
                └─► User sees article in 1 second!
```

**Result**: User gets article as fast as the fastest source, not the slowest!

## Response Format

```typescript
// Success response
{
  "source": "smry-fast",           // Which source won
  "cacheURL": "https://...",       // URL that was fetched
  "article": {
    "title": "Article Title",
    "content": "<p>HTML content...</p>",
    "textContent": "Plain text...",
    "length": 5432,
    "siteName": "example.com",
    "byline": "Author Name",
    "publishedTime": "2024-01-15",
    "image": "https://...",
    "htmlContent": "<!DOCTYPE html>...",
    "lang": "en",
    "dir": "ltr"
  },
  "status": "success",
  "mayHaveEnhanced": true          // Flag for optimistic updates (see below)
}

// Error response (all sources failed)
{
  "error": "Failed to fetch from all sources",
  "type": "ALL_SOURCES_FAILED"
}
```

## Optimistic Update: Full Article Enhancement

Sometimes `smry-fast` returns a partial article (due to paywalls, lazy loading, etc.) while slower sources like `wayback` have the full content. The system handles this with **optimistic updates**.

### How It Works

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           OPTIMISTIC UPDATE FLOW                            │
│                                                                             │
│  1. Initial Request                                                         │
│     ───────────────                                                         │
│     GET /article/auto → Returns smry-fast result (2500 chars)               │
│                         mayHaveEnhanced: true                               │
│                                                                             │
│  2. User Sees Article Immediately                                           │
│     ──────────────────────────────                                          │
│     [Article displayed - user starts reading]                               │
│                                                                             │
│  3. Background: Other Sources Cached                                        │
│     ────────────────────────────────                                        │
│     smry-slow finishes → cached (8000 chars)                                │
│     wayback finishes → cached (7500 chars)                                  │
│                                                                             │
│  4. Client Checks for Enhanced Version (after 4s delay)                     │
│     ─────────────────────────────────────────────────                       │
│     GET /article/enhanced?url=...&currentLength=2500&currentSource=smry-fast│
│                                                                             │
│  5. Server Compares Cached Results                                          │
│     ──────────────────────────────                                          │
│     smry-slow: 8000 chars (220% longer!) ✓                                  │
│     wayback: 7500 chars (200% longer)                                       │
│     → Returns smry-slow article                                             │
│                                                                             │
│  6. Seamless Update                                                         │
│     ───────────────                                                         │
│     Article content updates without page reload                             │
│     Scroll position preserved (content extends, doesn't shift)              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Enhanced Endpoint

```typescript
// GET /api/article/enhanced?url=...&currentLength=2500&currentSource=smry-fast

// Enhanced version found (>40% longer)
{
  "enhanced": true,
  "source": "smry-slow",
  "cacheURL": "https://...",
  "article": { ... }  // Full article
}

// No enhancement available
{
  "enhanced": false
}
```

### Client Implementation

```typescript
// The useArticleAuto hook handles this automatically
const { data, isLoading, wasEnhanced } = useArticleAuto(url);

// wasEnhanced = true if article was upgraded to full version
```

### Key Features

| Feature | Description |
|---------|-------------|
| **No jarring updates** | Content extends naturally, scroll position preserved |
| **Silent failures** | If enhanced check fails, user still has initial article |
| **One check per URL** | Won't repeatedly poll for same article |
| **40% threshold** | Only updates if significantly more content (>40% longer) |
| **4 second delay** | Gives slower sources time to complete and cache |

## Cache Strategy

```
First request for URL:
  Client ──► Server ──► [smry-fast, smry-slow, wayback] ──► Best result
                    └──► Cache ALL successful results

Second request for same URL:
  Client ──► Server ──► Cache hit! ──► Instant response (~50ms)
```

## Error Handling

If **all sources fail**, the client receives a single error with options:
- Try archive.is (external)
- Try Wayback Machine (external)
- Retry the request
- Open original page

## Inline Ads

Articles display contextual ads from Gravity AI. One inline ad is always placed mid-article (at ~40% of content, or after first paragraph for short articles).

### Ad Placements Requested

```typescript
placements: [
  { placement: "below_response", placement_id: "smry-summary-bottom" },  // Sidebar
  { placement: "right_response", placement_id: "smry-sidebar-right" },   // Sidebar
  { placement: "inline_response", placement_id: "smry-article-inline" }, // Mid-article
]
```

### Ad Distribution

| Index | Placement | Location |
|-------|-----------|----------|
| `gravityAds[0]` | below_response | Sidebar (below summary) |
| `gravityAds[1]` | right_response | Sidebar (right) |
| `gravityAds[2]` | inline_response | Mid-article (~40% into content) |

### Inline Ad Placement Logic

```typescript
// Always show inline ad if available
// Placed at ~40% of content, minimum after 1st paragraph
const targetParagraph = Math.max(1, Math.floor(totalParagraphs * 0.4));
```

- **Always shown** - No minimum article length requirement
- **Natural placement** - After ~40% of content for engaged readers
- **Fallback** - After first paragraph if article is very short

## Files Reference

| File | Purpose |
|------|---------|
| `server/routes/article.ts` | `/article/auto` and `/article/enhanced` endpoints |
| `server/routes/gravity.ts` | Gravity AI ad placements configuration |
| `lib/api/client.ts` | `getArticleAuto()` and `getArticleEnhanced()` methods |
| `lib/hooks/use-articles.ts` | `useArticleAuto()` hook with optimistic updates |
| `types/api.ts` | TypeScript types for responses |
| `components/article/content.tsx` | Article rendering with inline ad |
| `components/features/proxy-content.tsx` | Main proxy page component |
