# Memory Leak Fixes

## Issue (2026-01-05)

The service experienced memory exhaustion on Railway, with memory climbing from ~2GB to 5GB+ causing 502 errors across all endpoints.

## Root Causes Found

### 1. JSDOM instances not closed

JSDOM instances were being created but never properly closed. JSDOM creates a full browser-like environment with a `window` object that holds significant memory. Without calling `window.close()`, these objects remain in memory indefinitely.

**Affected Files:**
- `app/api/article/route.ts` - `fetchArticleWithSmryFast()`
- `lib/api/diffbot.ts` - `extractWithReadability()` and date/image extraction helpers

### 2. Ratelimit instances created per-request

`new Ratelimit()` was being called inside the request handler, creating new instances on every request. These should be module-level singletons.

**Affected Files:**
- `app/api/summary/route.ts`

### 3. Missing request timeouts

Fetch requests had no timeout, causing requests to hang indefinitely when external servers were slow, leading to connection/memory pileup.

**Affected Files:**
- `app/api/article/route.ts` - Added 30s timeout
- `lib/api/diffbot.ts` - Added 45s timeout

### The Problem Pattern

```typescript
// BAD: JSDOM instance created but never closed
const dom = new JSDOM(html, { url, virtualConsole });
const doc = dom.window.document;
// ... use document ...
// Memory leak: dom.window is never closed
```

## The Fix

### Pattern 1: Simple try/finally

For straightforward JSDOM usage:

```typescript
const dom = new JSDOM(html, { url, virtualConsole });
try {
  const doc = dom.window.document;
  // ... use document ...
  return result;
} finally {
  dom.window.close(); // Always release memory
}
```

### Pattern 2: Tracking multiple instances

When multiple JSDOM instances may be created (e.g., in loops):

```typescript
const jsdomInstances: JSDOM[] = [];

try {
  const dom = new JSDOM(html, { url, virtualConsole });
  jsdomInstances.push(dom);

  // May create more instances in loops
  for (const selector of selectors) {
    const cleanDom = new JSDOM(cleanHtml, { url, virtualConsole });
    jsdomInstances.push(cleanDom);
    // ...
  }

  return result;
} finally {
  // Close ALL instances
  for (const instance of jsdomInstances) {
    try {
      instance.window.close();
    } catch {
      // Ignore cleanup errors
    }
  }
}
```

### Pattern 3: Inline with null tracking

For optional JSDOM usage:

```typescript
let tempDom: JSDOM | null = null;
try {
  tempDom = new JSDOM(html, { virtualConsole });
  const doc = tempDom.window.document;
  // ... extract data ...
} catch {
  // Handle errors
} finally {
  tempDom?.window.close();
}
```

## Prevention

1. **Always close JSDOM windows** - Every `new JSDOM()` should have a corresponding `window.close()` in a `finally` block
2. **Track instances** - When creating multiple instances, track them in an array for cleanup
3. **Use try/finally** - Ensures cleanup happens even when returning early or on exceptions

## References

- [JSDOM Memory Leaks - GitHub Issue](https://github.com/jsdom/jsdom/issues/1665)
- [JSDOM window.close() documentation](https://github.com/jsdom/jsdom#closing-a-window)
