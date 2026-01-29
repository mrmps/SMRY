/**
 * Next.js Instrumentation - Fetch Override
 *
 * Replaces Next.js's patched fetch with undici's native implementation
 * to avoid memory leak in standalone builds.
 *
 * See: https://github.com/vercel/next.js/issues/85914
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Replace Next.js patched fetch with undici to reduce memory leak
    // See: https://github.com/vercel/next.js/issues/85914
    const { fetch, Headers, Request, Response } = await import("undici");
    globalThis.fetch = fetch as unknown as typeof globalThis.fetch;
    globalThis.Headers = Headers as unknown as typeof globalThis.Headers;
    globalThis.Request = Request as unknown as typeof globalThis.Request;
    globalThis.Response = Response as unknown as typeof globalThis.Response;

    console.log("[instrumentation] Replaced Next.js fetch with undici");
    console.log(`[instrumentation] Node.js version: ${process.version}`);
  }
}
