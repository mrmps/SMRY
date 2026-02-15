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

  describe("edge-case hosts", () => {
    it("allows URLs with userinfo", () => {
      const result = normalizeUrl("https://user:pass@example.com/path");
      expect(result).toBe("https://user:pass@example.com/path");
    });

    it("allows public IPv6 literals", () => {
      const result = normalizeUrl("https://[2606:4700:4700::1111]/");
      expect(result).toBe("https://[2606:4700:4700::1111]/");
    });

    it("blocks IPv6 loopback", () => {
      expect(() => normalizeUrl("http://[::1]/")).toThrow(
        "Cannot summarize SMRY URLs"
      );
    });

    it("blocks IPv6 unique local addresses", () => {
      expect(() => normalizeUrl("http://[fd00::1]/")).toThrow(
        "Cannot access internal or private network addresses."
      );
    });

    it("blocks IPv4-mapped private IPv6 addresses", () => {
      expect(() => normalizeUrl("http://[::ffff:10.0.0.1]/")).toThrow(
        "Cannot access internal or private network addresses."
      );
    });

    it("blocks IPv4-mapped hex-hextet private IPv6 addresses", () => {
      expect(() => normalizeUrl("http://[::ffff:a00:1]/")).toThrow(
        "Cannot access internal or private network addresses."
      );
    });

    it("blocks expanded IPv4-mapped private IPv6 addresses", () => {
      expect(() => normalizeUrl("http://[0:0:0:0:0:ffff:10.0.0.1]/")).toThrow(
        "Cannot access internal or private network addresses."
      );
    });

    it("allows IPv4-mapped public IPv6 addresses", () => {
      const result = normalizeUrl("http://[::ffff:8.8.8.8]/");
      expect(result).toBe("http://[::ffff:8.8.8.8]/");
    });

    it("allows IPv4-mapped hex-hextet public IPv6 addresses", () => {
      // ::ffff:808:808 == ::ffff:8.8.8.8
      const result = normalizeUrl("http://[::ffff:808:808]/");
      expect(result).toBe("http://[::ffff:808:808]/");
    });

    it("blocks cloud metadata endpoints", () => {
      expect(() => normalizeUrl("http://169.254.169.254/latest/meta-data/")).toThrow(
        "Cannot summarize SMRY URLs"
      );
    });
  });

  describe("duplicate protocol handling", () => {
    it("removes duplicate protocols at start", () => {
      const result = normalizeUrl("https://https://example.com");
      expect(result).toBe("https://example.com");
    });

    it("removes multiple duplicate protocols", () => {
      const result = normalizeUrl("https://https://https://example.com");
      expect(result).toBe("https://example.com");
    });

    it("handles domain followed by protocol", () => {
      const result = normalizeUrl("example.com/https://www.wired.com/story/article");
      expect(result).toBe("https://www.wired.com/story/article");
    });

    it("handles full URL with domain and protocol", () => {
      const result = normalizeUrl("https://example.com/https://www.wired.com/story/article");
      expect(result).toBe("https://www.wired.com/story/article");
    });

    it("handles domain without slash before protocol", () => {
      const result = normalizeUrl("example.comhttps://www.wired.com/story");
      expect(result).toBe("https://www.wired.com/story");
    });

    it("handles duplicate protocols with query params", () => {
      const result = normalizeUrl("https://https://example.com/article?page=1&sort=date");
      expect(result).toBe("https://example.com/article?page=1&sort=date");
    });

    it("handles domain with protocol and query params", () => {
      const result = normalizeUrl("example.com/https://www.nytimes.com/article?page=1");
      expect(result).toBe("https://www.nytimes.com/article?page=1");
    });

    it("handles duplicate protocols with paths", () => {
      const result = normalizeUrl("https://https://www.nytimes.com/2025/12/08/politics/article.html");
      expect(result).toBe("https://www.nytimes.com/2025/12/08/politics/article.html");
    });

    it("handles http duplicate protocols", () => {
      const result = normalizeUrl("http://http://example.com");
      expect(result).toBe("http://example.com");
    });

    it("handles mixed http and https duplicates", () => {
      // When mixed, it keeps the first protocol found
      const result = normalizeUrl("https://http://example.com");
      expect(result).toBe("https://example.com");
    });

    it("still works with normal URLs", () => {
      const result = normalizeUrl("https://example.com/article");
      expect(result).toBe("https://example.com/article");
    });

    it("still works with bare domains", () => {
      const result = normalizeUrl("example.com/article");
      expect(result).toBe("https://example.com/article");
    });
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

