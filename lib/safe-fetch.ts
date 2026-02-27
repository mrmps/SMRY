/**
 * Safe fetch helper with response size limits.
 * Prevents unbounded memory usage from large response bodies.
 */

const DEFAULT_MAX_SIZE = 25 * 1024 * 1024; // 25MB

/**
 * Strip query params from URLs to avoid leaking API tokens in logs.
 */
function redactUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`;
  } catch {
    return url.split("?")[0];
  }
}

export class ResponseTooLargeError extends Error {
  constructor(safeUrl: string, maxSize: number) {
    super(`Response from ${safeUrl} exceeded ${Math.round(maxSize / 1024 / 1024)}MB limit`);
    this.name = "ResponseTooLargeError";
  }
}

/**
 * Read a response body as text with a size limit.
 * Reads the body in chunks and aborts if it exceeds maxSize.
 */
export async function safeText(
  response: Response,
  maxSize: number = DEFAULT_MAX_SIZE
): Promise<string> {
  // Redact once, never let the raw URL reach error messages
  const safeUrl = redactUrl(response.url);

  // Check Content-Length header first for early rejection
  const contentLength = response.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > maxSize) {
    await response.body?.cancel();
    throw new ResponseTooLargeError(safeUrl, maxSize);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    return "";
  }

  const decoder = new TextDecoder();
  let result = "";
  let totalSize = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalSize += value.byteLength;
      if (totalSize > maxSize) {
        await reader.cancel();
        throw new ResponseTooLargeError(safeUrl, maxSize);
      }

      result += decoder.decode(value, { stream: true });
    }
  } catch (error) {
    if (error instanceof ResponseTooLargeError) throw error;
    throw error;
  }

  // Flush any remaining bytes in the decoder
  result += decoder.decode();

  return result;
}

/**
 * Read a response body as JSON with a size limit.
 */
export async function safeJson<T = unknown>(
  response: Response,
  maxSize: number = DEFAULT_MAX_SIZE
): Promise<T> {
  const text = await safeText(response, maxSize);
  return JSON.parse(text) as T;
}
