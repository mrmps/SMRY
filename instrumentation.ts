/**
 * Next.js Instrumentation - Memory Leak Workaround
 *
 * Next.js 16 has a known memory leak with its patched fetch function
 * when using `output: standalone`. This workaround replaces the patched
 * fetch with undici's native implementation.
 *
 * See: https://github.com/vercel/next.js/issues/85914
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Restore native fetch from undici to bypass Next.js's leaky patch
    const { fetch, Headers, Request, Response } = await import("undici");

    // @ts-expect-error - Replacing global fetch
    globalThis.fetch = fetch;
    // @ts-expect-error - Replacing global Headers
    globalThis.Headers = Headers;
    // @ts-expect-error - Replacing global Request
    globalThis.Request = Request;
    // @ts-expect-error - Replacing global Response
    globalThis.Response = Response;

    console.log("[instrumentation] Replaced Next.js fetch with undici to fix memory leak");
  }
}
