/**
 * Memory-Safe Fetch Wrapper
 *
 * Next.js 16 + standalone has a known memory leak with native fetch (undici).
 * See: https://github.com/vercel/next.js/issues/85914
 *
 * IMPORTANT: node-fetch v3 ALSO uses undici, so it has the same leak!
 * We use node-fetch v2 which uses Node's native http/https modules.
 *
 * Usage:
 *   import { safeFetch } from "@/lib/safe-fetch";
 *   const response = await safeFetch(url, options);
 */

// node-fetch v2 is CommonJS
const nodeFetch = require("node-fetch");

// Types compatible with standard fetch
type FetchInput = string | URL;
type FetchOptions = RequestInit & {
  next?: { revalidate?: number };
};

/**
 * Memory-safe fetch for non-streaming requests.
 * Uses node-fetch v2 (http/https based) to avoid the undici memory leak.
 *
 * IMPORTANT: Do NOT use this for streaming responses (AI SDK).
 * Use native fetch for streaming.
 */
export async function safeFetch(
  input: FetchInput,
  init?: FetchOptions
): Promise<Response> {
  const url = typeof input === "string" ? input : input.toString();

  // Convert standard RequestInit to node-fetch v2 compatible options
  const nodeOptions: Record<string, unknown> = {
    method: init?.method,
    headers: init?.headers,
    body: init?.body,
    redirect: init?.redirect,
    signal: init?.signal,
  };

  // Use node-fetch v2 (uses http/https, NOT undici)
  const response = await nodeFetch(url, nodeOptions);

  // Convert node-fetch Response to standard Response
  return response as unknown as Response;
}

/**
 * Fetch with timeout wrapper for memory-safe fetch.
 * Automatically aborts after the specified timeout.
 */
export async function safeFetchWithTimeout(
  input: FetchInput,
  init?: FetchOptions,
  timeoutMs: number = 30000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await safeFetch(input, {
      ...init,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}
