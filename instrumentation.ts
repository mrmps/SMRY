/**
 * Next.js Instrumentation
 *
 * This file runs once when the Next.js server starts.
 * Used to patch global fetch to avoid memory leak in Next.js 16 + standalone mode.
 *
 * @see https://github.com/vercel/next.js/issues/85914
 */

export async function register() {
  // Only patch on the server (Node.js runtime), not in edge or browser
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { default: nodeFetch, Headers, Request, Response } = await import(
      "node-fetch"
    );

    // Store original for potential debugging
    const _originalFetch = globalThis.fetch;

    // Replace global fetch with node-fetch to avoid Next.js 16 memory leak
    // @ts-expect-error - node-fetch types slightly differ but are compatible
    globalThis.fetch = nodeFetch;
    // @ts-expect-error
    globalThis.Headers = Headers;
    // @ts-expect-error
    globalThis.Request = Request;
    // @ts-expect-error
    globalThis.Response = Response;

    console.log(
      "[instrumentation] Patched global fetch with node-fetch to avoid memory leak"
    );

    // Start memory monitor
    const { startMemoryMonitor } = await import("./lib/memory-monitor");
    startMemoryMonitor();
  }
}
