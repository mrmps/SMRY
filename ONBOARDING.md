# SMRY Onboarding Guide

Welcome to SMRY (internally "13ft") - an AI-powered article summarizer that bypasses paywalls. This guide will help you understand the architecture and get up to speed quickly.

---

## Quick Start

```bash
# Install dependencies (uses Bun - 10x faster than npm)
bun install

# Start development environment
bun run dev  # Starts ClickHouse + Elysia server + Next.js

# Or with full Docker stack
bun run dev:docker
```

**Required:** Node.js >= 24, Bun >= 1.3.5

---

## Project Overview

SMRY fetches articles from behind paywalls using multiple extraction sources and generates AI-powered summaries. Users can access articles via:

1. **Direct URL:** `smry.ai/https://example.com/article`
2. **Search box:** Enter URL on the landing page
3. **Bookmarklet:** One-click from any article
4. **Browser extension:** (in development)

---

## Architecture at a Glance

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Browser                          │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Next.js (Port 3000)                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  App Router │  │   Pages     │  │  /api/* → Elysia (3001) │  │
│  │    (RSC)    │  │  (Proxy)    │  │      (rewrite)          │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Elysia API (Port 3001)                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  /article   │  │  /summary   │  │  /admin, /webhooks      │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
         │                  │                    │
         ▼                  ▼                    ▼
    ┌─────────┐       ┌──────────┐         ┌──────────┐
    │ Diffbot │       │OpenRouter│         │ClickHouse│
    │  (API)  │       │  (AI)    │         │(Analytics)│
    └─────────┘       └──────────┘         └──────────┘
         │
         ▼
    ┌──────────┐
    │  Redis   │
    │ (Cache)  │
    └──────────┘
```

---

## Directory Structure

```
SMRY/
├── app/                    # Next.js App Router (pages, layouts)
│   └── [locale]/           # i18n routing (14 languages)
│       ├── page.tsx        # Landing page
│       ├── proxy/          # Article display page
│       ├── pricing/        # Subscription page
│       └── ...
├── server/                 # Elysia API server
│   ├── index.ts            # Server setup, CORS, error handling
│   ├── env.ts              # Environment variables (Zod schema)
│   ├── middleware/         # Auth, rate limiting
│   └── routes/             # API endpoints
├── components/             # React components (~108 files)
│   ├── ui/                 # shadcn/ui primitives
│   ├── article/            # Article display components
│   ├── ai/                 # AI summary components
│   └── ...
├── lib/                    # Shared utilities
│   ├── api/                # API clients, Diffbot integration
│   ├── hooks/              # Custom React hooks
│   ├── errors/             # Error types and handling
│   └── validation/         # Zod schemas
├── types/                  # TypeScript type definitions
├── tests/                  # Unit and integration tests
├── docker/                 # Docker and ClickHouse setup
├── messages/               # i18n translation files
└── docs/                   # Additional documentation
```

---

## Tech Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| Next.js 16 | App Router with React Server Components |
| React 19 | UI library |
| TanStack Query | Client-side data fetching and caching |
| Tailwind CSS 4 | Styling (oklch color space) |
| shadcn/ui + Radix | Accessible component primitives |
| next-intl | Internationalization (14 languages) |
| next-themes | Dark mode support |

### Backend (Elysia)
| Technology | Purpose |
|------------|---------|
| Elysia | Lightweight TypeScript HTTP framework |
| Clerk | Authentication and billing |
| Upstash Redis | Serverless caching (with zlib compression) |
| ClickHouse | Analytics database |
| OpenRouter | AI model access (300+ models) |
| Diffbot | AI-powered article extraction |

### Content Extraction
| Technology | Purpose |
|------------|---------|
| Diffbot API | Primary paywall bypass |
| Mozilla Readability | Fallback content extraction |
| linkedom | Fast DOM parsing (replaces JSDOM) |
| Archive.org | Wayback Machine fallback |

---

## Key API Endpoints

### `GET /api/article?url=...&source=...`

Fetches articles from 3 sources in parallel:

| Source | Description |
|--------|-------------|
| `smry-fast` | Direct fetch + Mozilla Readability |
| `smry-slow` | Diffbot API (bypasses paywalls) |
| `wayback` | Archive.org + Diffbot |

Returns whichever source responds first. Responses are cached in Redis.

### `POST /api/summary`

Generates AI summaries using OpenRouter:

- **Rate limits:** 12/minute, 20/day per IP
- **Premium users:** Better AI models
- **Caching:** Results cached by `language:url`
- **Streaming:** Supports streaming response

### `GET /health`

Memory monitoring for Railway/load balancers:
- Returns 503 if RSS > 1GB (circuit breaker)
- Used for auto-restart on memory issues

---

## Environment Variables

Create a `.env` file with these variables:

```bash
# Required
DIFFBOT_API_KEY=         # Diffbot API key for article extraction
OPENROUTER_API_KEY=      # OpenRouter for AI summaries
UPSTASH_REDIS_REST_URL=  # Redis cache URL
UPSTASH_REDIS_REST_TOKEN= # Redis auth token

# Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SECRET=

# Analytics
CLICKHOUSE_HOST=         # ClickHouse for analytics
CLICKHOUSE_DATABASE=
CLICKHOUSE_USERNAME=
CLICKHOUSE_PASSWORD=

# Optional
NEXT_PUBLIC_API_URL=     # API URL for client (default: /api)
INTERNAL_API_URL=        # Internal API URL for server
GRAVITY_API_KEY=         # Ads integration
INBOUND_WEBHOOK_URL=     # Email webhooks
```

---

## Important Patterns

### 1. Dual Server Architecture

Next.js and Elysia run separately but are unified:

```javascript
// next.config.mjs
rewrites: async () => ({
  beforeFiles: [
    { source: '/api/:path*', destination: 'http://localhost:3001/api/:path*' }
  ]
})
```

Both run in the same Docker container on Railway.

### 2. Result-Based Error Handling

Uses `neverthrow` for functional error handling:

```typescript
import { ok, err, Result } from 'neverthrow'

function fetchArticle(url: string): Result<Article, ArticleError> {
  if (!isValidUrl(url)) {
    return err(new ValidationError('Invalid URL'))
  }
  return ok(article)
}

// Usage
const result = await fetchArticle(url)
result.match(
  (article) => console.log(article),
  (error) => console.error(error)
)
```

### 3. Parallel Content Fetching

All 3 sources are queried simultaneously:

```typescript
// lib/hooks/use-articles.ts
const queries = useQueries({
  queries: sources.map((source) => ({
    queryKey: ['article', url, source],
    queryFn: () => fetchArticle(url, source),
  })),
})
```

First successful response is displayed.

### 4. Structured Logging

Module-specific loggers with Pino:

```typescript
import { createLogger } from '@/lib/logger'

const logger = createLogger('api:article')
logger.info({ url, source }, 'Fetching article')
logger.error({ error, context }, 'Extraction failed')
```

### 5. Zod Validation

All API requests/responses validated at runtime:

```typescript
// types/article.ts
export const ArticleSchema = z.object({
  title: z.string(),
  content: z.string(),
  author: z.string().optional(),
  publishedAt: z.string().optional(),
})

// Usage
const article = ArticleSchema.parse(response)
```

---

## Design Philosophy

SMRY follows a "nested card aesthetic" with these principles:

1. **Double-layer depth** - Outer accent, inner card background
2. **Generous rounding** - 14px outer, 12px inner
3. **Ghost-first buttons** - Secondary actions use ghost variant
4. **Semantic color tokens** - Auto light/dark mode
5. **P3 color space** - oklch format for richer colors
6. **No scale/shadow animations** - Flat, professional feel

See [DESIGN_PHILOSOPHY.md](./DESIGN_PHILOSOPHY.md) for detailed guidelines.

---

## Things to Keep in Mind

### Performance

- **Use linkedom, not JSDOM** - 10-50x faster, no memory leaks
- **Compress cached articles** - zlib compression in Redis
- **Bounded caches** - Max 1000 entries with cleanup
- **GC time** - TanStack Query set to 5 min

### Security

- **Rate limiting** - Upstash Ratelimit + in-memory fallback
- **DOMPurify** - Sanitize all HTML content
- **Non-root Docker user** - nodejs:1001 for security
- **URL validation** - Always validate user-provided URLs

### Reliability

- **Multi-source fetching** - Always try all 3 sources
- **Debug context** - Include in all errors
- **Health checks** - /health endpoint for monitoring
- **Circuit breakers** - Return 503 if memory > 1GB

### Code Quality

- **TypeScript strict mode** - Catch errors at compile time
- **ESLint 9** - Consistent code style
- **Husky pre-commit** - Run checks before commit
- **Knip** - Detect unused dependencies

---

## Common Tasks

### Adding a New API Endpoint

1. Create route file in `server/routes/`
2. Define Zod schemas for request/response
3. Add route to `server/index.ts`
4. Create client hook in `lib/hooks/`

### Adding a New Component

1. Use shadcn/ui as base: `bunx shadcn@latest add [component]`
2. Place in appropriate `components/` subdirectory
3. Follow design philosophy guidelines

### Adding a Translation

1. Add translations to `messages/[locale].json`
2. Use `useTranslations()` hook in components
3. Supported locales: en, es, fr, de, zh, ja, pt, ru, hi, it, ko, ar, nl, tr

### Running Tests

```bash
bun test              # All tests
bun test server/      # Server tests only
bun test --watch      # Watch mode
```

---

## Useful Commands

```bash
# Development
bun run dev           # Start dev environment
bun run dev:docker    # Start with Docker

# Quality
bun run lint          # Run ESLint
bun run typecheck     # TypeScript check
bun run check-deps    # Find unused dependencies

# Build
bun run build         # Production build
bun run start         # Start production server

# Deployment
bun run pages:deploy  # Deploy to Cloudflare Pages
```

---

## Key Files to Understand

| File | Purpose |
|------|---------|
| `server/routes/article.ts` | Core article fetching logic |
| `server/routes/summary.ts` | AI summary generation |
| `lib/api/diffbot.ts` | Content extraction with fallbacks |
| `lib/hooks/use-articles.ts` | Client-side article fetching |
| `app/[locale]/proxy/page.tsx` | Main article display page |
| `server/middleware/auth.ts` | Authentication and billing |
| `lib/redis.ts` | Caching with compression |

---

## Troubleshooting

### "Memory limit exceeded"

- Check `/health` endpoint for memory stats
- Ensure linkedom is used instead of JSDOM
- Review Redis compression is working

### "Article extraction failed"

- Check Diffbot API key is valid
- Review debug context in error response
- Try different source (smry-fast vs smry-slow)

### "Rate limit exceeded"

- Check Upstash Redis connection
- In-memory fallback should kick in
- Premium users have higher limits

---

## Further Reading

- [README.md](./README.md) - Project overview and motivation
- [DESIGN_PHILOSOPHY.md](./DESIGN_PHILOSOPHY.md) - UI/UX guidelines
- [MIGRATION_PLAN.md](./MIGRATION_PLAN.md) - Deployment guide
- [docs/clickhouse-schema.sql](./docs/clickhouse-schema.sql) - Analytics schema
- [docs/MEMORY_LEAK_FIX.md](./docs/MEMORY_LEAK_FIX.md) - Performance optimizations

---

## Need Help?

- Check existing documentation in `/docs`
- Review error logs with structured logging
- Ask in team chat or open an issue

Happy coding!
