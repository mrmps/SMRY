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

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const MAX_REDIRECTS = 5;

/**
 * Memory-safe fetch using Node's native http/https modules.
 * Avoids undici entirely to prevent memory leaks.
 */
export async function safeFetch(
  input: FetchInput,
  init?: FetchOptions
): Promise<Response> {
  const originalUrl = typeof input === "string" ? input : input.toString();
  const redirectMode = init?.redirect ?? "follow";

  let currentUrl = originalUrl;
  let method = init?.method || "GET";
  let body = init?.body;
  let redirects = 0;

  while (true) {
    const response = await performRequest(currentUrl, { ...init, method, body });

    if (
      !REDIRECT_STATUSES.has(response.status) ||
      redirectMode === "manual"
    ) {
      return response;
    }

    if (redirectMode === "error") {
      throw new Error(
        `Redirect encountered with redirect mode 'error' (${response.status})`
      );
    }

    const location = response.headers.get("location");
    if (!location) {
      return response;
    }

    if (redirects >= MAX_REDIRECTS) {
      throw new Error("Too many redirects");
    }

    redirects += 1;
    const nextUrl = new URL(location, currentUrl).toString();

    if (
      response.status === 303 ||
      ((response.status === 301 || response.status === 302) && method === "POST")
    ) {
      method = "GET";
      body = undefined;
    }

    currentUrl = nextUrl;
  }
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

function performRequest(urlString: string, init?: FetchOptions): Promise<Response> {
  const url = new URL(urlString);
  const isHttps = url.protocol === "https:";
  const httpModule = isHttps ? https : http;

  if (init?.signal?.aborted) {
    return Promise.reject(new Error("Aborted"));
  }

  return new Promise((resolve, reject) => {
    let settled = false;

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

        for (const [key, value] of Object.entries(res.headers)) {
          if (!value) continue;
          if (Array.isArray(value)) {
            value.forEach((v) => headers.append(key, v));
          } else {
            headers.set(key, value);
          }
        }

        const response = new Response(body, {
          status: res.statusCode || 200,
          statusText: res.statusMessage || "",
          headers,
        });

        if (!settled) {
          settled = true;
          resolve(response);
        }
      });
      res.on("error", (error) => {
        if (!settled) {
          settled = true;
          reject(error);
        }
      });
    });

    req.on("error", (error) => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    });
    req.on("timeout", () => {
      req.destroy();
      if (!settled) {
        settled = true;
        reject(new Error("Request timeout"));
      }
    });

    const onAbort = () => {
      if (settled) return;
      settled = true;
      req.destroy();
      reject(new Error("Aborted"));
    };

    if (init?.signal) {
      init.signal.addEventListener("abort", onAbort, { once: true });
    }

    if (init?.body) {
      req.write(init.body);
    }

    req.end();

    const cleanup = () => {
      if (init?.signal) {
        init.signal.removeEventListener("abort", onAbort);
      }
    };

    req.on("close", cleanup);
    req.on("error", cleanup);
    req.on("timeout", cleanup);
  });
}
