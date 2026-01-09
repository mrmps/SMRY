import { describe, expect, it } from "bun:test";
import { normalizeUrl, isValidUrl } from "./url";

describe("normalizeUrl", () => {
  it("normalizes full https URL", () => {
    const result = normalizeUrl("https://www.nytimes.com/2025/12/08/us/politics/example.html");
    expect(result).toBe("https://www.nytimes.com/2025/12/08/us/politics/example.html");
  });

  it("adds https to bare domain", () => {
    const result = normalizeUrl("nyt.com");
    expect(result).toBe("https://nyt.com");
  });

  it("decodes percent-encoded URLs", () => {
    const encoded = "https%3A%2F%2Fwww.nytimes.com%2F2025%2F12%2F08%2Fus%2Fpolitics%2Fexample.html";
    const result = normalizeUrl(encoded);
    expect(result).toBe("https://www.nytimes.com/2025/12/08/us/politics/example.html");
  });

  it("repairs single-slash protocol", () => {
    const result = normalizeUrl("https:/www.nytimes.com/path");
    expect(result).toBe("https://www.nytimes.com/path");
  });

  it("handles URLs with query params", () => {
    const result = normalizeUrl("https://example.com/article?search=test&page=2");
    expect(result).toBe("https://example.com/article?search=test&page=2");
  });

  it("handles encoded URL with query params", () => {
    const encoded = "https%3A%2F%2Fexample.com%2Farticle%3Fsearch%3Dtest%26page%3D2";
    const result = normalizeUrl(encoded);
    expect(result).toBe("https://example.com/article?search=test&page=2");
  });

  it("throws on empty input", () => {
    expect(() => normalizeUrl("")).toThrow("Please enter a URL.");
  });

  it("throws on invalid URL", () => {
    expect(() => normalizeUrl("not a url")).toThrow("Please enter a valid URL");
  });

  it("blocks self-referential smry.ai URLs", () => {
    expect(() => normalizeUrl("https://smry.ai/proxy?url=https://example.com")).toThrow("Cannot summarize SMRY URLs");
    expect(() => normalizeUrl("https://www.smry.ai/article")).toThrow("Cannot summarize SMRY URLs");
    expect(() => normalizeUrl("smry.ai")).toThrow("Cannot summarize SMRY URLs");
  });

  it("blocks localhost URLs", () => {
    // localhost:port fails URL validation first, 127.0.0.1 hits our blocklist
    expect(() => normalizeUrl("http://localhost:3000/test")).toThrow();
    expect(() => normalizeUrl("http://127.0.0.1/test")).toThrow("Cannot summarize SMRY URLs");
  });
});

describe("isValidUrl", () => {
  it("returns true for valid URLs", () => {
    expect(isValidUrl("https://example.com")).toBe(true);
    expect(isValidUrl("example.com")).toBe(true);
  });

  it("returns false for invalid URLs", () => {
    expect(isValidUrl("")).toBe(false);
    expect(isValidUrl("not a url")).toBe(false);
  });
});

