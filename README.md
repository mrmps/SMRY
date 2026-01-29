# 13ft / SMRY.ai

SMRY.ai is a Next.js application that bypasses paywalls and generates AI-powered summaries by fetching content from multiple sources simultaneously. It is the spiritual successor to 12ft: type `http://smry.ai/` in front of any article URL and you'll land on a distraction-free reader with the summary builder already loaded.

**[View Changelog →](https://smry.ai/changelog)**

## Why SMRY Exists

- Paywalls make it hard to reference reporting, even when articles are already public on social media.
- Researchers, journalists, and readers still need the original article, not just an LLM hallucination.
- Summaries should live next to the cleaned article, not in a separate chat window.
- A single extraction service often fails, so we hit multiple sources at once and cache whatever works.

## Quick Start

1. **Prepend the prefix**: Add `smry.ai/` before any article URL (e.g. `smry.ai/example.com/2026/any-article`) to jump straight into SMRY.
2. **Paste a link on the homepage**: smry.ai will fetch it, clean it, and let you generate summaries.
3. **Use the bookmarklet**: Drag the provided bookmarklet to your bookmarks bar; click it on any page to wrap it in SMRY.
4. **Call the proxy route directly**: `https://your-domain.com/proxy?url=https://example.com/article` works for deep linking and integrations.

## What You Get

- **Clean reader** that strips overlays, ads, and archive UI.
- **Multi-source fetching** (direct, wayback) so at least one source usually succeeds.
- **Built-in AI summaries** in 14 languages with caching and rate limiting.
- **Rich debug context** for every fetch so you can see what worked and why.

## What This Does

1. **Soft Paywall Access**: Fetches article content from two sources in parallel:
   - **Direct**: Uses Diffbot API for intelligent article extraction from original URLs (server-side)
   - **Wayback Machine**: Uses Diffbot API to extract clean content from archived pages (server-side)

   > **Note**: Hard paywalls (Bloomberg, Barron's, etc.) cannot be accessed. See [/hard-paywalls](https://smry.ai/hard-paywalls) for details.

2. **AI Summaries**: Generates concise summaries in 8 languages using OpenRouter (openai/gpt-oss-20b:free)

3. **Smart Extraction**: Uses Diffbot's AI-powered extraction for direct and archived content

## Architecture Highlights

### Multi-Source Parallel Fetching
Uses TanStack Query to fetch from all sources simultaneously, displaying whichever responds first. Each source is independently cached.

**Server-side sources (Direct, Wayback):**
```typescript
// These hit the /api/article endpoint
const serverQueries = useQueries({
  queries: SERVER_SOURCES.map((source) => ({
    queryKey: ["article", source, url],
    queryFn: () => articleAPI.getArticle(url, source),
  }))
});
```

### Type-Safe Error Handling
Uses `neverthrow`'s Result types for error handling instead of try-catch, making errors type-safe:

```typescript
// Returns Result<DiffbotArticle, AppError> instead of throwing
export function fetchArticleWithDiffbot(url: string, source: string): ResultAsync<DiffbotArticle, AppError>
```

Nine distinct error types (NetworkError, RateLimitError, TimeoutError, etc.) with user-friendly messages.

**Enhanced Error Context:**
All errors now include debug context showing:
- What extraction methods were attempted
- Why each method failed or succeeded
- Content length at each step
- Complete extraction timeline

This makes debugging extraction failures much easier.

### Dual Caching Strategy
- **Server-side**: Upstash Redis for persistent caching across requests
- **Client-side**: TanStack Query for instant UI updates (1min stale time, 5min GC)

Articles are cached by `source:url` key. When fetching, if a longer version exists in cache, it's preserved.

### Intelligent Source Routing
Different sources require different extraction strategies:

**Direct & Wayback** → Diffbot API with Multi-Layer Fallbacks
```typescript
// Diffbot extracts structured article data with fallback chain:
// 1. Diffbot API extraction
// 2. Mozilla Readability on returned DOM
// 3. Multiple Diffbot fields (html, text, media)
// 4. Wayback-specific original URL extraction
const diffbotResult = await fetchArticleWithDiffbot(urlWithSource, source);
```

This multi-layered approach maximizes content extraction success across diverse article formats and site structures.

### Content Parsing Pipeline

**For Direct & Wayback (via Diffbot):**
1. Send URL to Diffbot API
2. Receive structured article data (title, HTML, text, siteName)
3. **Fallback chain if extraction incomplete:**
   - Try Mozilla Readability on Diffbot's returned DOM
   - For Wayback: Try extracting original URL and re-parsing
   - Attempt multiple Diffbot article fields
4. Track extraction steps in debug context
5. Cache the parsed result

### Debug Context & Error Tracking
Each article fetch now includes detailed debug context that tracks:
- All extraction attempts and their outcomes
- Fallback strategies that were tried
- Content length at each step
- Timestamps for performance analysis
- Error details for troubleshooting

Debug context is preserved through errors and displayed in the UI for debugging.

### Multilingual Summaries
Language-specific prompts for 14 languages (en, es, fr, de, zh, ja, pt, ru, hi, it, ko, ar, nl, tr). Each language gets its own cache key:

```
summary:en:https://example.com
summary:es:https://example.com
```

Rate limited to 20 summaries per IP per day, 6 per minute.

## Tech Stack

- **Next.js 16** (App Router) with React Server Components
- **TanStack Query** for client-side data fetching and caching
- **Zod** for runtime type validation
- **neverthrow** for Result-based error handling
- **Upstash Redis** for caching
- **OpenRouter** for AI summaries (unified access to 300+ models)
- **Diffbot API** for AI-powered article extraction (direct & wayback sources)
- **Mozilla Readability** for fallback content extraction
- **Logo.dev API** for company logos (client-side)
- **Radix UI** + **Tailwind CSS** for UI

## Key Files

```
app/
├── api/
│   ├── article/route.ts      # Fetches & parses articles from sources
│   └── summary/route.ts      # Generates AI summaries with rate limiting
├── proxy/page.tsx            # Main article display page
└── page.tsx                  # Landing page

lib/
├── api/
│   ├── diffbot.ts            # Diffbot API with multi-layer fallback extraction
│   └── client.ts             # Type-safe API client
├── errors/
│   ├── types.ts              # Type-safe error definitions (9 types)
│   ├── safe-error.ts         # Safe error utilities
│   └── index.ts              # Barrel export
├── logger.ts                 # Pino structured logging
└── hooks/
    └── use-articles.ts       # TanStack Query hook for parallel fetching

components/
├── arrow-tabs.tsx            # Tab interface for switching sources
├── article-content.tsx       # Renders parsed article with summary form
├── summary-form.tsx          # AI summary generation UI
└── proxy-content.tsx         # Main content wrapper

types/
└── api.ts                    # Zod schemas for all API requests/responses
```

## How It Works

### Request Flow
```
User enters URL
    ↓
ProxyContent component
    ↓
useArticles() hook - fires 2 parallel requests
    ↓
API route /api/article?url=...&source=...
    ↓
Route to appropriate fetcher:
  - Direct/Wayback → fetchArticleWithDiffbot() with multi-layer fallback
    ↓
Cache in Upstash Redis (if longer than existing)
    ↓
Return to client
    ↓
Display first successful response
```

### Summary Flow
```
User clicks "Generate Summary"
    ↓
POST /api/summary with content + language
    ↓
Check cache by language:url key
    ↓
If miss: OpenRouter openai/gpt-oss-20b:free with language-specific prompt
    ↓
Cache result
    ↓
Return summary
```

## Environment Variables

All variables are required. The app will fail to start if any are missing.

```bash
# Auth - https://clerk.com
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=

# AI/API
OPENROUTER_API_KEY=        # https://openrouter.ai/settings/keys
DIFFBOT_API_KEY=           # https://diffbot.com

# Cache - https://console.upstash.com
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Analytics - ClickHouse (use docker-compose for local dev)
CLICKHOUSE_URL=http://localhost:8123
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=
CLICKHOUSE_DATABASE=smry_analytics

# Alerting - https://resend.com
RESEND_API_KEY=
ALERT_EMAIL=

# Server config
CORS_ORIGIN=http://localhost:3000
NEXT_PUBLIC_URL=http://localhost:3000
```

## Setup

1. **Install dependencies**:
```bash
pnpm install
```

2. **Set up environment variables**:
   - Copy `.env.example` to `.env.local`
   - Get API keys from: Clerk, OpenRouter, Diffbot, Upstash, Resend
   - Run `docker-compose up -d clickhouse` for local analytics

3. **Run development server**:
```bash
pnpm dev
```

4. **Build for production**:
```bash
pnpm build
pnpm start
```

## Usage

### Direct prepend (fastest)
```
http://smry.ai/https://example.com/article
```
Type that directly into the address bar (or edit the existing URL) and SMRY will load the cleaned article plus summary controls immediately. This works on smry.ai or any self-hosted deployment.

### Paste a URL on the homepage
```
https://your-domain.com
```
Open the homepage, paste the article URL into the input, and we’ll route you to the proxy page with all sources firing in parallel.

### Bookmarklet
Create a browser bookmark with this URL:
```javascript
javascript:(function(){window.location='https://your-domain.com/'+window.location.href})()
```
Drag it to your bookmarks bar. Clicking it on any page reloads the article inside SMRY with summaries ready.

### Proxy route (manual deep-link)
```
https://your-domain.com/proxy?url=https://example.com/article
```
Use this when you want to share or embed a direct link to the cleaned reader.

## Interesting Implementation Details

### Multi-Layer Content Extraction
The Diffbot integration uses a sophisticated fallback chain to maximize extraction success:

1. **Primary: Diffbot API** - AI-powered article extraction
2. **Fallback 1: Mozilla Readability** - Applied to Diffbot's returned DOM for complex layouts
3. **Fallback 2: Multiple Diffbot fields** - Tries html, text, and media fields
4. **Fallback 3: Wayback re-extraction** - For archived pages, extracts original URL and re-parses

Each step is tracked in debug context, making it easy to understand what worked and what didn't. This approach handles challenging cases like:
- Google Blogger sites with complex DOM structures
- Paywalled content with dynamic loading
- Archive.org pages with wrapped content
- Sites with heavy JavaScript rendering

### Why Two Sources?
- **Direct + Diffbot**: AI-powered extraction bypasses most paywalls and anti-bot measures
- **Wayback + Diffbot**: Extracts clean content from archived pages, removing archive.org UI clutter

By fetching both in parallel and displaying any that succeed, the app maximizes success rate.

### Why Diffbot for Direct & Wayback?
Diffbot's API is specifically trained to extract article content from HTML, removing navigation, ads, and other clutter. This works excellently for:
- Direct URLs: Bypasses many paywall implementations
- Wayback archives: Removes archive.org's UI wrapper and metadata

**Fallback Strategy:**
If Diffbot's extraction is incomplete, the system automatically tries:
1. **Mozilla Readability** on the returned DOM for better extraction
2. **Multiple Diffbot fields** (html, text, media) to find the best content
3. **Wayback-specific logic** to extract and re-parse original URLs

This multi-layered approach maximizes content extraction success, especially for complex sites like Google Blogger or pages with dynamic layouts.

### Caching Strategy
Articles are cached with the article itself as the value, not just metadata. When a new fetch completes, it compares text length to the cached version and keeps the longer one. This prevents losing content if a source returns a partial article.

### Type Safety
All API routes validate inputs with Zod schemas at runtime. This catches invalid data before it reaches application logic. The schemas are shared between client and server, ensuring consistency.

### Error Resilience
Using neverthrow's Result types instead of exceptions means errors are handled explicitly. Each error type has a user-friendly message, so users get helpful feedback instead of generic errors.

### Structured Logging
Uses **Pino** for production-ready logging:
- **Development**: Pretty-printed, colorized output for easy debugging
- **Production**: Structured JSON logs for parsing and monitoring
- **Contextual**: Each module has its own logger context (e.g., `api:article`, `lib:fetch`)
- **Levels**: debug, info, warn, error with appropriate defaults

See [LOGGING.md](./LOGGING.md) for detailed documentation and integration with log aggregation services like Axiom, Logtail, or Datadog.

## Contributing

**Contributions are very welcome!** Areas where help is especially appreciated:

### High Priority
- [ ] Support for more content sources (Archive.is, Google Cache, etc.)
- [ ] Better soft paywall handling for news sites
- [ ] Browser extension for easier access
- [ ] PDF export functionality
- [ ] Better mobile UI/UX

### Technical Improvements
- [ ] Streaming AI summaries for real-time generation
- [ ] Webhook support for asynchronous processing
- [ ] Support for video/podcast content
- [ ] OCR for image-based paywalls
- [x] Upstash Redis for caching (self-hosted compatible)

### UI/UX Enhancements
- [ ] Dark mode
- [ ] Reading time estimate
- [ ] Text-to-speech integration
- [ ] Customizable fonts and layouts
- [ ] Save/bookmark functionality

### Testing
- [ ] Unit tests for core functions
- [ ] Integration tests for API routes
- [ ] E2E tests for critical paths

**How to contribute:**
1. Fork the repository
2. Create a feature branch
3. Make your changes with clear commit messages
4. Add tests if applicable
5. Submit a pull request

For major changes, open an issue first to discuss the approach.

## License

MIT License - see LICENSE file for details

## Related Projects

- [12ft.io](https://12ft.io) - Original inspiration
- [archive.is](https://archive.is) - Archive service
- [Diffbot](https://diffbot.com) - Article extraction API

## Contact

Issues and feature requests: [GitHub Issues](https://github.com/mrmps/SMRY/issues)

---

Built with Next.js 16, TanStack Query, and OpenRouter.
