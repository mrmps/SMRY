/**
 * Safe fetch helper with response size limits.
 * Prevents unbounded memory usage from large response bodies.
 */

const DEFAULT_MAX_SIZE = 25 * 1024 * 1024; // 25MB

export class ResponseTooLargeError extends Error {
  constructor(url: string, maxSize: number) {
    super(`Response from ${url} exceeded ${Math.round(maxSize / 1024 / 1024)}MB limit`);
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
  // Check Content-Length header first for early rejection
  const contentLength = response.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > maxSize) {
    // Cancel the body to free resources
    await response.body?.cancel();
    throw new ResponseTooLargeError(response.url, maxSize);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    return "";
  }

  const chunks: Uint8Array[] = [];
  let totalSize = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalSize += value.byteLength;
      if (totalSize > maxSize) {
        await reader.cancel();
        throw new ResponseTooLargeError(response.url, maxSize);
      }

      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof ResponseTooLargeError) throw error;
    throw error;
  }

  const decoder = new TextDecoder();
  return chunks.map((chunk) => decoder.decode(chunk, { stream: true })).join("") +
    decoder.decode();
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
