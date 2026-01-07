/**
 * Memory-Safe Fetch Wrapper
 *
 * Next.js 16 + standalone has a known memory leak with native fetch (undici).
 * See: https://github.com/vercel/next.js/issues/85914
 *
 * This uses Node's built-in http/https modules directly to avoid undici entirely.
 */

import * as https from "https";
import * as http from "http";
import { URL } from "url";

// Types compatible with standard fetch
type FetchInput = string | URL;
type FetchOptions = RequestInit & {
  next?: { revalidate?: number };
};

/**
 * Memory-safe fetch using Node's native http/https modules.
 * Avoids undici entirely to prevent memory leaks.
 */
export async function safeFetch(
  input: FetchInput,
  init?: FetchOptions
): Promise<Response> {
  const urlString = typeof input === "string" ? input : input.toString();
  const url = new URL(urlString);
  const isHttps = url.protocol === "https:";
  const httpModule = isHttps ? https : http;

  return new Promise((resolve, reject) => {
    const options: http.RequestOptions = {
      method: init?.method || "GET",
      headers: init?.headers as http.OutgoingHttpHeaders,
      timeout: 30000,
    };

    const req = httpModule.request(url, options, (res) => {
      const chunks: Buffer[] = [];

      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const body = Buffer.concat(chunks);
        const headers = new Headers();

        // Convert Node headers to fetch Headers
        for (const [key, value] of Object.entries(res.headers)) {
          if (value) {
            if (Array.isArray(value)) {
              value.forEach(v => headers.append(key, v));
            } else {
              headers.set(key, value);
            }
          }
        }

        // Create a Response-like object
        const response = new Response(body, {
          status: res.statusCode || 200,
          statusText: res.statusMessage || "",
          headers,
        });

        resolve(response);
      });
      res.on("error", reject);
    });

    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });

    // Handle abort signal
    if (init?.signal) {
      init.signal.addEventListener("abort", () => {
        req.destroy();
        reject(new Error("Aborted"));
      });
    }

    // Send body if present
    if (init?.body) {
      req.write(init.body);
    }

    req.end();
  });
}

/**
 * Fetch with timeout wrapper.
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
