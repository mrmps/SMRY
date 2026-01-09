# TanStack Start Migration Guide

This document provides guidance and documentation for the Next.js to TanStack Start migration.

---

## CHANGES MADE (2026-01-08)

The following issues have been fixed by the review agent:

### Fixed Files

1. **`src/components/shared/language-switcher.tsx`** - Completely rewritten to use TanStack Router's `useRouter` and `useLocation` hooks instead of non-existent `usePathname`/`useRouter` from `@/i18n/navigation`.

2. **`src/components/shared/underline-link.tsx`** - Migrated from `next/link` to TanStack Router's `Link` component.

3. **`src/components/features/upgrade-modal.tsx`** - Migrated from `next/link` to TanStack Router's `Link` component.

4. **`src/components/features/inline-summary.tsx`** - Migrated all `next/link` imports to TanStack Router's `Link` component (6 Link usages updated).

5. **`src/components/features/summary-form.tsx`** - Migrated all `next/link` imports to TanStack Router's `Link` component.

6. **`src/components/marketing/ad-spot.tsx`** - Replaced all `next/image` `Image` components with standard `<img>` tags.

7. **`src/components/marketing/upgrade-cta.tsx`** - Replaced all `next/image` `Image` components with standard `<img>` tags.

### New Files Created

1. **`src/start.ts`** - Created Clerk middleware configuration for TanStack Start authentication.

2. **`src/i18n/hooks.ts`** - Created re-export file for `useTranslations` and `useLocale` hooks.

### OpenRouter SDK

**No migration needed.** The `server/routes/summary.ts` already uses `@openrouter/sdk` directly with streaming support and model fallbacks. The AI gateway has been removed - we're using OpenRouter SDK directly which is cleaner and works well.

---

## CRITICAL BUGS (FIXED)

### 1. ✅ `language-switcher.tsx` - FIXED

Was importing non-existent modules. Now uses TanStack Router's `useRouter` and `useLocation`.

### 2. ✅ Components Using `next/link` and `next/image` - FIXED

All components migrated:
- `ad-spot.tsx` - `<img>` tags
- `upgrade-cta.tsx` - `<img>` tags
- `underline-link.tsx` - TanStack `Link`
- `inline-summary.tsx` - TanStack `Link`
- `summary-form.tsx` - TanStack `Link`
- `upgrade-modal.tsx` - TanStack `Link`

### 3. `"use client"` Directives Are No-Ops

**77 files** have `"use client"` directives. In TanStack Start (without RSC support), these are no-ops - they don't break anything but are unnecessary.

**Low priority:** Can be removed during cleanup, but not blocking.

---

## CRITICAL WARNINGS

### 1. Clerk TanStack Start SDK is BETA

**The Clerk TanStack React Start SDK is currently in beta. It is NOT yet recommended for production use.**

Source: [Clerk TanStack Start Quickstart](https://clerk.com/docs/tanstack-react-start/getting-started/quickstart)

**What this means:**
- API surface may change without notice
- There may be undiscovered bugs
- Not recommended for mission-critical authentication flows
- Consider keeping a fallback plan or waiting for stable release

### 2. nuqs Does NOT Support TanStack Start Yet

**"TanStack Router support is experimental and does not yet cover TanStack Start."**

Source: [nuqs Adapters Documentation](https://nuqs.dev/docs/adapters)

**Current state in `__root.tsx`:**
```tsx
import { NuqsAdapter } from 'nuqs/adapters/tanstack-router'
```

**This will have issues because:**
- The adapter is for TanStack Router only, not TanStack Start
- SSR/hydration may not work correctly
- URL state may desync between server and client

**Recommendation:** Use TanStack Router's built-in `validateSearch` for URL state management instead:
```tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/search')({
  validateSearch: (search) => ({
    query: search.query as string ?? '',
    page: Number(search.page) ?? 0,
  }),
  component: SearchPage,
})

function SearchPage() {
  const { query, page } = Route.useSearch()
  // ...
}
```

Source: [TanStack Router Data Loading](https://tanstack.com/router/v1/docs/framework/react/guide/data-loading)

---

## Known TanStack Start Issues (2025)

### Redirect with Middleware Bug (Issue #4460)

**Problem:** Throwing redirects in server functions that use middleware doesn't work.

```tsx
// THIS DOES NOT WORK when middleware is present
throw redirect({ to: '/login' })
```

**Workaround:** Remove middleware or handle redirects differently.

Source: [GitHub Issue #4460](https://github.com/TanStack/router/issues/4460)

### notFound() Handling Broken (Issue #5960)

**Problem:** When navigating to a route where the loader throws `notFound()`, the error is not correctly caught by `notFoundComponent`. Server returns raw errors instead of proper 404 pages.

Source: [GitHub Issue #5960](https://github.com/TanStack/router/issues/5960)

**Impact on current code in `src/app/.tsx`:**
```tsx
loader: async ({ params }) => {
  if (!isLocale(localeParam)) {
    throw notFound()  // May not render properly!
  }
}
```

---

## Clerk Authentication Setup

### ✅ `src/start.ts` Created

The Clerk middleware file has been created at `src/start.ts`.

Source: [Clerk TanStack Start SDK Reference](https://clerk.com/docs/reference/tanstack-react-start/clerk-middleware)

### Route Protection Pattern

For protected routes, use this pattern:

```tsx
import { createFileRoute, redirect } from '@tanstack/react-router'
import { auth } from '@clerk/tanstack-react-start/server'

export const Route = createFileRoute('/dashboard')({
  beforeLoad: async () => {
    const { userId } = await auth()
    if (!userId) {
      throw redirect({ to: '/sign-in' })
    }
  },
  loader: async () => {
    const { userId } = await auth()
    return { userId }
  },
  component: Dashboard,
})
```

Source: [Clerk SDK Reference: auth()](https://clerk.com/docs/reference/tanstack-react-start/auth)

---

## Memory Leak Workarounds

### Background

The previous Next.js app had memory leaks caused by Next.js's patched fetch (using undici internally). These were documented in commits:
- `ee28bf5`: replace Next.js patched fetch with undici to fix memory leak
- `fc61b40`: replace Redis/fetch with axios to fix Next.js 16 memory leak

### Do We Still Need These Workarounds?

**Likely NO.** TanStack Start uses Nitro server which has different fetch handling:

1. **Nitro's fetch** is not the same as Next.js's patched fetch
2. **Bun runtime** (which you're using) has its own native fetch that doesn't have the same issues
3. **The memory monitor** (`src/lib/memory-monitor.ts`) should still be kept to verify

Source: [Node.js/undici fetch memory leak](https://github.com/nodejs/undici/issues/3895)

**Recommendation:**
1. Remove explicit `undici` usage from client code
2. Use standard `fetch` and monitor memory
3. Keep the memory monitor active for first few deployments
4. If leaks return, investigate Nitro-specific solutions

---

## Server Functions Best Practices

### Loaders are Isomorphic (NOT Server-Only!)

**This is critical:** Route loaders run on BOTH server and client, not just server.

```tsx
// WRONG - This will expose secrets on client
export const Route = createFileRoute('/api-call')({
  loader: async () => {
    const data = await fetch(process.env.SECRET_API_URL)  // SECRET_API_URL exposed!
    return data.json()
  },
})

// CORRECT - Use createServerFn for server-only code
import { createServerFn } from '@tanstack/react-start'

const fetchSecretData = createServerFn().handler(async () => {
  const data = await fetch(process.env.SECRET_API_URL)  // Safe on server
  return data.json()
})

export const Route = createFileRoute('/api-call')({
  loader: async () => {
    return fetchSecretData()
  },
})
```

Source: [TanStack Start Server Functions](https://tanstack.com/start/latest/docs/framework/react/guide/server-functions)

### Input Validation

Always validate inputs with Zod:

```tsx
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

const getArticle = createServerFn()
  .validator(z.object({ url: z.string().url() }))
  .handler(async ({ data }) => {
    // data.url is validated
  })
```

Source: [TanStack Start Server Functions - Validation](https://tanstack.com/start/latest/docs/framework/react/guide/server-functions)

---

## i18n Implementation

### Current Setup Analysis

The `src/app/.tsx` file handles locale routing:

```tsx
export const Route = createFileRoute('/$locale')({
  loader: async ({ params }) => {
    const localeParam = params.locale ?? defaultLocale
    if (!isLocale(localeParam)) {
      throw notFound()
    }
    const messages = await loadMessages(localeParam)
    return { locale: localeParam, messages }
  },
})
```

**Issues:**
1. Default locale (`en`) should probably not require a prefix
2. `notFound()` throwing may not render correctly (see Issue #5960)

### Recommended: URL Rewriting for Default Locale

TanStack Router supports URL rewriting:

```tsx
// router.tsx
export function getRouter() {
  return createRouter({
    routeTree,
    // Rewrite URLs to strip/add locale prefix
    url: {
      input: (href) => {
        // User visits /es/about -> router sees /about with locale context
        const match = href.match(/^\/(en|es|de|pt|zh|nl)(.*)/)
        if (match) return match[2] || '/'
        return href
      },
      output: (href) => {
        // Generate links with locale prefix
        const locale = getCurrentLocale()
        if (locale === 'en') return href  // No prefix for default
        return `/${locale}${href}`
      },
    },
  })
}
```

Source: [How to implement locale-based routing in TanStack Start](https://lingo.dev/en/tanstack-start-i18n/locale-based-routing)

---

## Environment Variables

### Client-Side Variable Prefix

The vite.config.ts currently allows both prefixes:
```tsx
envPrefix: ['NEXT_PUBLIC_', 'VITE_'],
```

**Current `src/lib/env.ts` uses `NEXT_PUBLIC_` prefix** - this works but is a migration artifact.

**Consider migrating to `VITE_` prefix** for consistency with Vite ecosystem:
- `NEXT_PUBLIC_URL` -> `VITE_URL`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` -> `VITE_CLERK_PUBLISHABLE_KEY`

### Server vs Client Environment Variables

In TanStack Start, the separation is different from Next.js:

```tsx
// Server-only: use process.env directly in server functions
const serverFn = createServerFn().handler(async () => {
  const secret = process.env.CLERK_SECRET_KEY  // Safe - server only
})

// Client-accessible: use import.meta.env
const publicUrl = import.meta.env.VITE_URL
```

---

## Vite Config Notes

Current `vite.config.ts`:

```tsx
tanstackStart({
  srcDirectory: 'src',
  router: {
    routesDirectory: 'app',  // Routes in src/app/
  },
}),
```

**File naming convention:**
- `__root.tsx` - Root layout
- `index.tsx` - Index route for a directory
- `$param.tsx` - Dynamic parameter (like `$locale`)
- `$.tsx` - Catch-all/splat route

Source: [TanStack Start Routing](https://tanstack.com/start/latest/docs/framework/react/guide/routing)

---

## Documentation Links

### TanStack Start
- [Overview](https://tanstack.com/start/latest/docs/framework/react/overview)
- [Server Functions](https://tanstack.com/start/latest/docs/framework/react/guide/server-functions)
- [Server Routes](https://tanstack.com/start/latest/docs/framework/react/guide/server-routes)
- [Middleware](https://tanstack.com/start/latest/docs/framework/react/guide/middleware)
- [Routing](https://tanstack.com/start/latest/docs/framework/react/guide/routing)
- [Hosting/Deployment](https://tanstack.com/start/latest/docs/framework/react/guide/hosting)

### Clerk + TanStack Start
- [Quickstart (Beta)](https://clerk.com/docs/tanstack-react-start/getting-started/quickstart)
- [clerkMiddleware()](https://clerk.com/docs/reference/tanstack-react-start/clerk-middleware)
- [auth()](https://clerk.com/docs/reference/tanstack-react-start/auth)
- [GitHub Quickstart Repo](https://github.com/clerk/clerk-tanstack-react-start-quickstart)

### nuqs
- [Adapters](https://nuqs.dev/docs/adapters)
- [TanStack Router Support Discussion](https://github.com/47ng/nuqs/discussions/943)

### i18n
- [Intlayer Guide](https://intlayer.org/doc/environment/tanstack-start)
- [Paraglide JS Guide](https://eugeneistrach.com/blog/paraglide-tanstack-start/)
- [Locale-based Routing](https://lingo.dev/en/tanstack-start-i18n/locale-based-routing)

### Memory/Performance
- [Next.js Memory Usage Guide](https://nextjs.org/docs/app/guides/memory-usage)
- [Next.js fetch memory leak discussion](https://github.com/vercel/next.js/discussions/68636)
- [TanStack Start on Bun](https://bun.com/docs/guides/ecosystem/tanstack-start)

---

## Checklist Before Going Live

- [x] Set up `src/start.ts` with Clerk middleware
- [x] Fix all `next/link` imports
- [x] Fix all `next/image` imports
- [x] Fix language-switcher broken imports
- [ ] Verify nuqs works or migrate to TanStack Router's `validateSearch`
- [ ] Test `notFound()` handling thoroughly
- [ ] Test redirects with and without middleware
- [ ] Monitor memory for first 24-48 hours
- [ ] Test SSR hydration with all providers (Clerk, nuqs, i18n)
- [ ] Verify locale routing works with and without prefix
- [ ] Load test to ensure no memory leaks

---

*Last updated: 2026-01-08*
