# SMRY

Article reader and summarizer with AI chat.

## Tech Stack

- **Runtime**: Bun
- **Frontend**: Next.js (React 19, TypeScript, Tailwind CSS)
- **Backend**: Elysia (Bun-native web framework)
- **AI/LLM**: OpenRouter (Vercel AI SDK for streaming)
- **Auth**: Clerk (billing + JWT)
- **Database**: ClickHouse (analytics), Upstash Redis (rate limiting, chat thread storage)
- **Client Storage**: IndexedDB (offline-first chat threads), localStorage (article history, preferences)

## Project Structure

```
app/              Next.js pages and route handlers
components/       React components (features/, ui/, ads/, ai/)
lib/              Shared utilities, hooks, storage
server/           Elysia API server
  routes/         API endpoints (chat, chat-threads, gravity, admin)
  middleware/     Auth middleware
types/            Zod schemas and shared types
```

## Key Commands

```bash
bun dev           # Start dev server (Next.js + Elysia + ClickHouse)
bun run build     # Production build
bun run lint      # ESLint
bun run typecheck # TypeScript check
bun test          # Run tests
```

## Architecture Notes

- Monorepo: Next.js frontend on port 3000, Elysia API on port 3001
- Next.js route handlers proxy to Elysia for streaming (avoids SSE buffering)
- Ad system: Gravity (primary) + ZeroClick (fallback) waterfall
- Chat threads: offline-first (IndexedDB) with server sync (Redis) for premium users
- Article history: client-side only (localStorage), premium users see full history
