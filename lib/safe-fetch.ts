/**
 * Memory-Safe Fetch Wrapper
 *
 * Next.js 16 + standalone has a known memory leak with native fetch (undici).
 * See: https://github.com/vercel/next.js/issues/85914
 *
 * This module provides a fetch wrapper that uses node-fetch for non-streaming
 * requests to avoid the memory leak, while keeping native fetch available
 * for streaming responses (like AI SDK).
 *
 * Usage:
 *   import { safeFetch } from "@/lib/safe-fetch";
 *   const response = await safeFetch(url, options);
 */

import nodeFetch, { RequestInit as NodeFetchRequestInit } from "node-fetch";

// Types compatible with standard fetch
type FetchInput = string | URL;
type FetchOptions = RequestInit & {
  next?: { revalidate?: number };
};

/**
 * Memory-safe fetch for non-streaming requests.
 * Uses node-fetch instead of native fetch to avoid the Next.js memory leak.
 *
 * IMPORTANT: Do NOT use this for streaming responses (AI SDK).
 * Use native fetch for streaming.
 */
export async function safeFetch(
  input: FetchInput,
  init?: FetchOptions
): Promise<Response> {
  const url = typeof input === "string" ? input : input.toString();

  // Convert standard RequestInit to node-fetch compatible options
  const nodeOptions: NodeFetchRequestInit = {
    method: init?.method,
    headers: init?.headers as NodeFetchRequestInit["headers"],
    body: init?.body as NodeFetchRequestInit["body"],
    redirect: init?.redirect as NodeFetchRequestInit["redirect"],
    signal: init?.signal as NodeFetchRequestInit["signal"],
    // node-fetch doesn't cache, so no need for cache: "no-store"
  };

  // Use node-fetch
  const response = await nodeFetch(url, nodeOptions);

  // Convert node-fetch Response to standard Response
  // This is needed because the return types are slightly different
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

/**
 * Check if we should use safe fetch (node-fetch) or native fetch.
 * Use native fetch only for:
 * - AI SDK streaming responses
 * - WebSocket upgrades
 * - Other streaming use cases
 */
export function shouldUseSafeFetch(_url: string, _options?: FetchOptions): boolean {
  // For now, always prefer safe fetch for server-side requests
  // The AI SDK will use its own fetch internally
  return true;
}
