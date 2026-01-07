/**
 * Next.js Instrumentation
 *
 * This file runs once when the Next.js server starts.
 * Memory leak mitigation strategies for Next.js 16 + standalone mode.
 *
 * MEMORY LEAK CONTEXT:
 * Next.js 16 + standalone mode has a known memory leak with native fetch (undici).
 * ~48-200KB of heap memory is leaked per request and cannot be recovered by GC.
 * @see https://github.com/vercel/next.js/issues/85914
 *
 * SOLUTION IMPLEMENTED:
 * 1. Server-side article/Diffbot fetches use node-fetch via lib/safe-fetch.ts
 *    - These are non-streaming and work perfectly with node-fetch
 * 2. AI SDK (summary endpoint) keeps native fetch for streaming compatibility
 * 3. Global fetch is still patched with cache: "no-store" as a fallback
 *
 * This targeted approach avoids the memory leak while keeping AI streaming working.
 */

export async function register() {
  // Only run on the server (Node.js runtime), not in edge or browser
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Wrap the original fetch to force no caching as a fallback
    // Note: Main fix is using safeFetch (node-fetch) in article/diffbot routes
    const originalFetch = globalThis.fetch;

    // @ts-expect-error - We're patching fetch to force no-cache, types are compatible at runtime
    globalThis.fetch = async function patchedFetch(
      input: RequestInfo | URL,
      init?: RequestInit & { next?: { revalidate?: number } }
    ): Promise<Response> {
      // Force no caching on all server-side fetches to prevent memory buildup
      const patchedInit = {
        ...init,
        cache: "no-store" as const,
        // Also set Next.js specific revalidate to 0
        next: { revalidate: 0, ...init?.next },
      };

      return originalFetch(input, patchedInit);
    };

    console.log(
      "[instrumentation] Patched global fetch to force cache: no-store (fallback for AI SDK)"
    );

    // Start memory monitor
    const { startMemoryMonitor } = await import("./lib/memory-monitor");
    startMemoryMonitor();
  }
}
