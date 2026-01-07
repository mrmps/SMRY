/**
 * Next.js Instrumentation
 *
 * This file runs once when the Next.js server starts.
 * Memory leak mitigation strategies for Next.js 16 + standalone mode.
 *
 * Previous attempt: Patching fetch with node-fetch
 * Issue: node-fetch streams are incompatible with AI SDK streaming responses
 *
 * Current approach: Use native fetch but disable Next.js fetch caching entirely
 * via next.config.js experimental.serverActions.allowedOrigins and
 * ensuring all fetch calls use cache: "no-store"
 *
 * @see https://github.com/vercel/next.js/issues/85914
 */

export async function register() {
  // Only run on the server (Node.js runtime), not in edge or browser
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Wrap the original fetch to force no caching and log for debugging
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
      "[instrumentation] Patched global fetch to force cache: no-store on all requests"
    );

    // Start memory monitor
    const { startMemoryMonitor } = await import("./lib/memory-monitor");
    startMemoryMonitor();
  }
}
