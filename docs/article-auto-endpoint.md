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
  "status": "success"
}

// Error response (all sources failed)
{
  "error": "Failed to fetch from all sources",
  "type": "ALL_SOURCES_FAILED"
}
```

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
