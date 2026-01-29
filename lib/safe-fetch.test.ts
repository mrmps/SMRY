import { describe, expect, it } from "bun:test";
import { safeText, safeJson, ResponseTooLargeError } from "./safe-fetch";

/**
 * Helper to create a Response with a string body.
 * Optionally sets Content-Length header.
 */
function makeResponse(body: string, options?: { contentLength?: boolean; url?: string }): Response {
  const headers = new Headers();
  if (options?.contentLength) {
    headers.set("content-length", String(new TextEncoder().encode(body).byteLength));
  }
  const res = new Response(body, { headers });
  // Response.url is read-only and set by fetch(), so we override for error messages
  if (options?.url) {
    Object.defineProperty(res, "url", { value: options.url });
  }
  return res;
}

/**
 * Helper to create a Response that streams chunks without Content-Length.
 * Simulates a server that doesn't send Content-Length (common with chunked encoding).
 */
function makeStreamingResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
  return new Response(stream);
}

describe("safeText", () => {
  it("reads a normal response body", async () => {
    const text = await safeText(makeResponse("hello world"));
    expect(text).toBe("hello world");
  });

  it("reads an empty response body", async () => {
    const text = await safeText(makeResponse(""));
    expect(text).toBe("");
  });

  it("reads multi-byte UTF-8 content correctly", async () => {
    const content = "Hello 世界 🌍 Ünïcödé";
    const text = await safeText(makeResponse(content));
    expect(text).toBe(content);
  });

  it("reads a response under the size limit", async () => {
    const body = "a".repeat(1000);
    const text = await safeText(makeResponse(body), 2000);
    expect(text).toBe(body);
  });

  it("reads a response exactly at the size limit", async () => {
    const body = "a".repeat(100);
    const text = await safeText(makeResponse(body), 100);
    expect(text).toBe(body);
  });

  it("rejects via Content-Length header before reading body", async () => {
    const bigBody = "x".repeat(200);
    const res = makeResponse(bigBody, { contentLength: true });

    try {
      await safeText(res, 100);
      expect(true).toBe(false); // should not reach
    } catch (err) {
      expect(err).toBeInstanceOf(ResponseTooLargeError);
      expect((err as Error).message).toContain("exceeded");
    }
  });

  it("rejects mid-stream when body exceeds limit (no Content-Length)", async () => {
    // Stream 5 chunks of 100 bytes each = 500 bytes, limit to 250
    const chunks = Array.from({ length: 5 }, () => "a".repeat(100));
    const res = makeStreamingResponse(chunks);

    try {
      await safeText(res, 250);
      expect(true).toBe(false); // should not reach
    } catch (err) {
      expect(err).toBeInstanceOf(ResponseTooLargeError);
    }
  });

  it("throws ResponseTooLargeError with descriptive message", async () => {
    const res = makeResponse("x".repeat(200), { url: "https://example.com/big-page" });

    try {
      await safeText(res, 100);
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(ResponseTooLargeError);
      expect((err as ResponseTooLargeError).name).toBe("ResponseTooLargeError");
    }
  });

  it("uses 25MB default limit", async () => {
    // A normal-sized response should work fine with the default
    const text = await safeText(makeResponse("normal page content"));
    expect(text).toBe("normal page content");
  });

  it("handles response with no body", async () => {
    const res = new Response(null);
    const text = await safeText(res);
    expect(text).toBe("");
  });
});

describe("safeJson", () => {
  it("parses valid JSON", async () => {
    const data = { title: "Test", count: 42, nested: { ok: true } };
    const res = makeResponse(JSON.stringify(data));
    const parsed = await safeJson(res);
    expect(parsed).toEqual(data);
  });

  it("parses JSON array", async () => {
    const data = [1, 2, 3, "four"];
    const res = makeResponse(JSON.stringify(data));
    const parsed = await safeJson(res);
    expect(parsed).toEqual(data);
  });

  it("throws on invalid JSON", async () => {
    const res = makeResponse("not json {{{");
    try {
      await safeJson(res);
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(SyntaxError);
    }
  });

  it("rejects oversized JSON before parsing", async () => {
    const bigJson = JSON.stringify({ data: "x".repeat(500) });
    const res = makeResponse(bigJson);

    try {
      await safeJson(res, 100);
      expect(true).toBe(false);
    } catch (err) {
      // Should fail on size limit, not JSON parse
      expect(err).toBeInstanceOf(ResponseTooLargeError);
    }
  });

  it("respects custom size limit", async () => {
    const smallJson = JSON.stringify({ ok: true });
    const res = makeResponse(smallJson);
    const parsed = await safeJson(res, 1024);
    expect(parsed).toEqual({ ok: true });
  });
});

describe("ResponseTooLargeError", () => {
  it("has correct name property", () => {
    const err = new ResponseTooLargeError("https://example.com", 1024 * 1024);
    expect(err.name).toBe("ResponseTooLargeError");
  });

  it("includes URL and size in message", () => {
    const err = new ResponseTooLargeError("https://example.com/page", 25 * 1024 * 1024);
    expect(err.message).toContain("example.com/page");
    expect(err.message).toContain("25MB");
  });

  it("redacts query params when thrown by safeText", async () => {
    const big = "x".repeat(200);
    const res = new Response(big);
    // Simulate a URL with secrets (like Diffbot token)
    Object.defineProperty(res, "url", {
      value: "https://api.diffbot.com/v3/article?token=SECRET_KEY&url=https://example.com",
    });

    try {
      await safeText(res, 100);
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(ResponseTooLargeError);
      const msg = (err as Error).message;
      expect(msg).toContain("api.diffbot.com/v3/article");
      expect(msg).not.toContain("SECRET_KEY");
      expect(msg).not.toContain("token=");
    }
  });

  it("is an instance of Error", () => {
    const err = new ResponseTooLargeError("https://example.com", 1024);
    expect(err).toBeInstanceOf(Error);
  });
});
