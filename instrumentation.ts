/**
 * Next.js Instrumentation - Memory Leak Workaround
 *
 * Next.js 16 has a known memory leak with its patched fetch function
 * when using `output: standalone`. This affects Node.js 20.16.0-20.17.x
 * and all Node.js 22.x versions.
 *
 * RECOMMENDED NODE.JS VERSIONS:
 * - Node.js 20.15.1: Does NOT exhibit the leak
 * - Node.js 20.18.0+: Contains the undici fix
 *
 * This workaround replaces Next.js's patched fetch with undici's
 * native implementation, which reduces (but may not eliminate) the leak.
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
