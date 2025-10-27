# `/lib` Directory Structure

This directory contains shared utilities, API clients, hooks, and error handling for the application.

## Directory Organization

```
lib/
├── api/                    # API clients and external service integrations
│   ├── diffbot.ts         # Diffbot API for article extraction
│   ├── jina.ts            # Jina.ai client for markdown fetching (client-side)
│   └── client.ts          # General API client utilities
├── errors/                 # Error handling utilities
│   ├── index.ts           # Barrel export (use this for imports)
│   ├── types.ts           # Error type definitions and constructors
│   └── safe-error.ts      # Safe error utilities
├── hooks/                  # React hooks
│   ├── use-articles.ts    # Fetch articles from multiple sources
│   ├── use-media-query.ts # Responsive media queries
│   ├── use-local-storage.ts # Local storage hook
│   └── use-scroll.ts      # Scroll detection
├── logger.ts               # Centralized Pino logger
└── utils.ts                # General utility functions
```

## Import Guidelines

### ✅ Correct Imports

```typescript
// Errors - use barrel export
import { AppError, createNetworkError } from "@/lib/errors";

// API clients
import { fetchArticleWithDiffbot } from "@/lib/api/diffbot";
import { fetchJinaArticle } from "@/lib/api/jina";
import { articleAPI } from "@/lib/api/client";

// Hooks
import { useArticles } from "@/lib/hooks/use-articles";
import useScroll from "@/lib/hooks/use-scroll";

// Logger
import { createLogger } from "@/lib/logger";
```

### ❌ Avoid These

```typescript
// Don't import from deep paths when barrel exports exist
import { AppError } from "@/lib/errors/types"; // Use @/lib/errors instead

// Don't import from old paths (these files were removed/renamed)
import { fetchWithTimeout } from "@/lib/fetch-with-timeout"; // Removed
import { getUrlWithSource } from "@/lib/get-url-with-source"; // Removed
```

## Module Descriptions

### `api/`

**`diffbot.ts`**
- Integrates with Diffbot API for intelligent article extraction
- Handles both direct URLs and Wayback Machine archives
- Returns structured article data (title, HTML, text, siteName)
- Includes retry logic and fallback mechanisms

**`jina.ts`**
- Client-side Jina.ai integration
- Fetches markdown from Jina Reader API
- Converts markdown to HTML
- Used for client-side scraping to reduce server load

**`client.ts`**
- General-purpose API client
- Type-safe wrappers for API calls
- Handles common HTTP operations

### `errors/`

**`types.ts`**
- Defines 9 error types: NetworkError, ProxyError, DiffbotError, ParseError, TimeoutError, RateLimitError, CacheError, ValidationError, UnknownError
- Factory functions for creating typed errors
- User-friendly error messages

**`safe-error.ts`**
- Safely extracts error information
- Handles unknown error types
- Prevents error handling from throwing

**`index.ts`**
- Barrel export for all error utilities
- Always import from `@/lib/errors`

### `hooks/`

**`use-articles.ts`**
- Fetches articles from 3 sources in parallel (direct, wayback, jina.ai)
- Uses TanStack Query for caching and state management
- Jina is fetched client-side, others server-side
- Smart cache management with length-based updates

**`use-media-query.ts`**
- React hook for responsive design
- SSR-safe media query detection

**`use-local-storage.ts`**
- React hook for persisting state in localStorage
- Type-safe with TypeScript
- Handles JSON serialization automatically

**`use-scroll.ts`**
- Detects scroll position
- Used for show/hide top bar on scroll

### Root Level

**`logger.ts`**
- Centralized Pino logger
- Structured JSON logging in production
- Pretty-printed colored output in development
- Context-based logging (e.g., `api:article`, `lib:diffbot`)

**`utils.ts`**
- General utility functions
- cn() for className merging
- Other shared utilities

## Migration Notes

### Renamed Files
- ❌ `fetch-with-timeout.ts` → ✅ `api/diffbot.ts`
- ❌ `jina-client.ts` → ✅ `api/jina.ts`
- ❌ `api-client.ts` → ✅ `api/client.ts`
- ❌ `errors.ts` → ✅ `errors/types.ts`

### Removed Files
- `data.ts` - Unused type definitions
- `get-url-with-source.ts` - Unused utility
- `format-error.ts` - Unused formatter
- `create-error-response.ts` - Unused response builder

### Moved Files
- `use-local-storage.ts` → `hooks/use-local-storage.ts`
- `use-scroll.ts` → `hooks/use-scroll.ts`
- `safe-error.ts` → `errors/safe-error.ts`

## Adding New Code

### New API Client
Add to `lib/api/` and follow the pattern:
```typescript
// lib/api/new-service.ts
import { createLogger } from "@/lib/logger";

const logger = createLogger('lib:new-service');

export async function fetchFromNewService(url: string) {
  logger.info({ url }, 'Fetching from new service');
  // Implementation
}
```

### New Hook
Add to `lib/hooks/` and export:
```typescript
// lib/hooks/use-new-feature.ts
"use client";

export function useNewFeature() {
  // Implementation
}
```

### New Error Type
Add to `lib/errors/types.ts`:
```typescript
export interface NewErrorType extends BaseError {
  type: "NEW_ERROR";
  specificField: string;
}

export function createNewError(message: string, specificField: string): NewErrorType {
  return {
    type: "NEW_ERROR",
    message,
    specificField,
    timestamp: new Date(),
  };
}
```

Don't forget to update the barrel export in `lib/errors/index.ts` if needed!

