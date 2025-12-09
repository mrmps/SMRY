import { describe, expect, it } from "bun:test";
import { buildProxyUrl, normalizeInputUrl } from "./proxy-url";

describe("proxy URL helpers", () => {
  it("builds proxy URL from full https URL", () => {
    const result = buildProxyUrl("https://www.nytimes.com/2025/12/08/us/politics/example.html");
    expect(result).toBe(
      "/proxy?url=https%3A%2F%2Fwww.nytimes.com%2F2025%2F12%2F08%2Fus%2Fpolitics%2Fexample.html"
    );
  });

  it("builds proxy URL from bare domain", () => {
    const result = buildProxyUrl("nyt.com");
    expect(result).toBe("/proxy?url=https%3A%2F%2Fnyt.com");
  });

  it("handles percent-encoded inputs without double-encoding", () => {
    const encoded = "https%3A%2F%2Fwww.nytimes.com%2F2025%2F12%2F08%2Fus%2Fpolitics%2Fexample.html";
    const result = buildProxyUrl(encoded);
    // Input is decoded first, then re-encoded once
    expect(result).toBe(
      "/proxy?url=https%3A%2F%2Fwww.nytimes.com%2F2025%2F12%2F08%2Fus%2Fpolitics%2Fexample.html"
    );
  });

  it("repairs single-slash protocol before normalization", () => {
    const normalized = normalizeInputUrl("https:/www.nytimes.com/path");
    expect(normalized).toBe("https://www.nytimes.com/path");
  });

  it("handles URLs with query params correctly", () => {
    const result = buildProxyUrl("https://example.com/article?search=test&page=2");
    expect(result).toBe(
      "/proxy?url=https%3A%2F%2Fexample.com%2Farticle%3Fsearch%3Dtest%26page%3D2"
    );
  });
});

