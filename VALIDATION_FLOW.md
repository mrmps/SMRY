# Validation Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    API Request to /api/article                   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │ Validate Request     │
                  │ (ArticleRequestSchema)│
                  └──────────┬───────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │ Check Cache (KV)     │
                  └──────────┬───────────┘
                             │
              ┌──────────────┴──────────────┐
              │                             │
              ▼ Cache Hit                   ▼ Cache Miss
   ┌──────────────────────┐      ┌──────────────────────┐
   │ Validate Cached Data │      │ Fetch from Diffbot   │
   │ (CachedArticleSchema)│      └──────────┬───────────┘
   └──────────┬───────────┘                 │
              │                             ▼
              │              ┌──────────────────────────────┐
              │              │   lib/api/diffbot.ts         │
              │              │   ┌────────────────────────┐ │
              │              │   │ 1. Validate HTTP       │ │
              │              │   │    Response Structure  │ │
              │              │   │    (DiffbotArticle     │ │
              │              │   │     ResponseSchema)    │ │
              │              │   └──────────┬─────────────┘ │
              │              │              │               │
              │              │              ▼               │
              │              │   ┌────────────────────────┐ │
              │              │   │ 2. Try Diffbot Extract│ │
              │              │   │    - New Format       │ │
              │              │   │    - Old Format       │ │
              │              │   │    Validate each with │ │
              │              │   │    DiffbotArticle     │ │
              │              │   │    Schema             │ │
              │              │   └──────────┬─────────────┘ │
              │              │              │               │
              │              │   ┌──────────┴─────────────┐ │
              │              │   │ Success? │   Failed?   │ │
              │              │   └──────┬───┴───┬─────────┘ │
              │              │          │       │           │
              │              │          │       ▼           │
              │              │          │   ┌─────────────┐ │
              │              │          │   │ 3. Fallback │ │
              │              │          │   │    Readability│ │
              │              │          │   │    Extract  │ │
              │              │          │   │    Validate: │ │
              │              │          │   │    - Readability│
              │              │          │   │      Article │ │
              │              │          │   │      Schema  │ │
              │              │          │   │    - Final   │ │
              │              │          │   │      Diffbot │ │
              │              │          │   │      Article │ │
              │              │          │   │      Schema  │ │
              │              │          │   └──────┬──────┘ │
              │              │          │          │        │
              │              └──────────┴──────────┴────────┘
              │                         │
              │                         ▼
              │              ┌──────────────────────┐
              │              │ Validate Diffbot     │
              │              │ Response             │
              │              │ (DiffbotArticleSchema)│
              │              └──────────┬───────────┘
              │                         │
              └─────────────────────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │ Save to Cache        │
                  │ - Validate incoming  │
                  │ - Validate existing  │
                  │ - Validate saved     │
                  │ (CachedArticleSchema)│
                  └──────────┬───────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │ Validate Final       │
                  │ Response             │
                  │ (ArticleResponseSchema)│
                  └──────────┬───────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │ Return to Client     │
                  └──────────────────────┘

LEGEND:
  Every box with "Validate" = Zod schema validation with safeParse()
  All validation failures are logged with detailed context
  Failed validations trigger fallbacks or return errors
```

## Validation Coverage Summary

### 🔒 **13 Validation Points Total**

#### In `lib/api/diffbot.ts` (7 points)
1. ✅ Raw Diffbot API response structure
2. ✅ Diffbot article extraction (new format)
3. ✅ Diffbot article extraction (old format)
4. ✅ Readability targeted container result
5. ✅ Readability full document result
6. ✅ Final Readability result before resolve
7. ✅ All article objects before returning

#### In `app/api/article/route.ts` (6 points)
1. ✅ Diffbot function response
2. ✅ Cached article on read
3. ✅ Incoming article before cache save
4. ✅ Existing cached article
5. ✅ Saved article after cache operation
6. ✅ Article in error handler

### 🛡️ **100% Coverage**
Every data transformation point is validated
Every external API response is validated  
Every cache read/write is validated
Every return path is validated

