import { describe, it, expect } from "bun:test";
import { normalizeUrl, isValidUrl, NormalizedUrlSchema } from "./url";

describe("normalizeUrl", () => {
  describe("basic URL normalization", () => {
    it("should add https:// to URLs without protocol", () => {
      expect(normalizeUrl("example.com")).toBe("https://example.com");
      expect(normalizeUrl("www.example.com")).toBe("https://www.example.com");
      expect(normalizeUrl("subdomain.example.com/path")).toBe(
        "https://subdomain.example.com/path"
      );
    });

    it("should preserve valid https:// URLs", () => {
      expect(normalizeUrl("https://example.com")).toBe("https://example.com");
      expect(normalizeUrl("https://www.example.com/path")).toBe(
        "https://www.example.com/path"
      );
    });

    it("should preserve valid http:// URLs", () => {
      expect(normalizeUrl("http://example.com")).toBe("http://example.com");
      expect(normalizeUrl("http://www.example.com/path")).toBe(
        "http://www.example.com/path"
      );
    });

    it("should trim whitespace", () => {
      expect(normalizeUrl("  example.com  ")).toBe("https://example.com");
      expect(normalizeUrl("  https://example.com  ")).toBe(
        "https://example.com"
      );
    });
  });

  describe("malformed protocol handling", () => {
    it("should fix https:/ (missing one slash)", () => {
      expect(normalizeUrl("https:/example.com")).toBe("https://example.com");
      expect(normalizeUrl("https:/www.example.com/path")).toBe(
        "https://www.example.com/path"
      );
    });

    it("should fix http:/ (missing one slash)", () => {
      expect(normalizeUrl("http:/example.com")).toBe("http://example.com");
      expect(normalizeUrl("http:/www.example.com/path")).toBe(
        "http://www.example.com/path"
      );
    });
  });

  describe("duplicate protocol handling", () => {
    it("should remove duplicate https://https://", () => {
      expect(normalizeUrl("https://https://example.com")).toBe(
        "https://example.com"
      );
      expect(normalizeUrl("https://https://www.example.com/path")).toBe(
        "https://www.example.com/path"
      );
    });

    it("should remove duplicate http://http://", () => {
      expect(normalizeUrl("http://http://example.com")).toBe(
        "http://example.com"
      );
    });

    it("should remove duplicate https://http://", () => {
      expect(normalizeUrl("https://http://example.com")).toBe(
        "http://example.com"
      );
    });

    it("should remove duplicate http://https://", () => {
      expect(normalizeUrl("http://https://example.com")).toBe(
        "https://example.com"
      );
    });

    it("should handle https://https:/ (duplicate with malformed second)", () => {
      expect(normalizeUrl("https://https:/example.com")).toBe(
        "https://example.com"
      );
      expect(
        normalizeUrl(
          "https://https:/www1.folha.uol.com.br/cotidiano/2025/12/rapper-rael-e-assaltado-e-tem-moto-levada-no-parque-villa-lobos-em-sao-paulo.shtml"
        )
      ).toBe(
        "https://www1.folha.uol.com.br/cotidiano/2025/12/rapper-rael-e-assaltado-e-tem-moto-levada-no-parque-villa-lobos-em-sao-paulo.shtml"
      );
    });

    it("should handle multiple duplicates", () => {
      expect(normalizeUrl("https://https://https://example.com")).toBe(
        "https://example.com"
      );
      expect(normalizeUrl("https://https://https://https://example.com")).toBe(
        "https://example.com"
      );
    });

    it("should handle http://https:/ (duplicate with malformed second)", () => {
      expect(normalizeUrl("http://https:/example.com")).toBe(
        "https://example.com"
      );
    });
  });

  describe("URLs with paths, queries, and fragments", () => {
    it("should preserve query parameters", () => {
      expect(normalizeUrl("example.com?foo=bar")).toBe(
        "https://example.com?foo=bar"
      );
      expect(normalizeUrl("https://example.com?foo=bar&baz=qux")).toBe(
        "https://example.com?foo=bar&baz=qux"
      );
    });

    it("should preserve fragments", () => {
      expect(normalizeUrl("example.com#section")).toBe(
        "https://example.com#section"
      );
      expect(normalizeUrl("https://example.com#section")).toBe(
        "https://example.com#section"
      );
    });

    it("should preserve paths", () => {
      expect(normalizeUrl("example.com/path/to/page")).toBe(
        "https://example.com/path/to/page"
      );
      expect(normalizeUrl("example.com/path/to/page?query=value#fragment")).toBe(
        "https://example.com/path/to/page?query=value#fragment"
      );
    });
  });

  describe("edge cases", () => {
    it("should handle URLs with ports", () => {
      expect(normalizeUrl("example.com:8080")).toBe("https://example.com:8080");
      expect(normalizeUrl("https://example.com:8080")).toBe(
        "https://example.com:8080"
      );
    });

    it("should handle URLs with authentication", () => {
      expect(normalizeUrl("user:pass@example.com")).toBe(
        "https://user:pass@example.com"
      );
      expect(normalizeUrl("https://user:pass@example.com")).toBe(
        "https://user:pass@example.com"
      );
    });

    it("should handle URLs with underscores", () => {
      expect(normalizeUrl("example_test.com")).toBe("https://example_test.com");
      expect(normalizeUrl("https://example_test.com")).toBe(
        "https://example_test.com"
      );
    });

    it("should throw error for empty string", () => {
      expect(() => normalizeUrl("")).toThrow("Please enter a URL.");
      expect(() => normalizeUrl("   ")).toThrow("Please enter a URL.");
    });

    it("should throw error for invalid URLs", () => {
      expect(() => normalizeUrl("not a url")).toThrow();
      expect(() => normalizeUrl("://example.com")).toThrow();
      expect(() => normalizeUrl("ftp://example.com")).toThrow();
    });
  });

  describe("real-world examples", () => {
    it("should handle the reported issue URL", () => {
      const malformedUrl =
        "https://https:/www1.folha.uol.com.br/cotidiano/2025/12/rapper-rael-e-assaltado-e-tem-moto-levada-no-parque-villa-lobos-em-sao-paulo.shtml";
      const expected =
        "https://www1.folha.uol.com.br/cotidiano/2025/12/rapper-rael-e-assaltado-e-tem-moto-levada-no-parque-villa-lobos-em-sao-paulo.shtml";
      expect(normalizeUrl(malformedUrl)).toBe(expected);
    });

    it("should handle various news site URLs", () => {
      expect(normalizeUrl("https://www.nytimes.com/2025/01/01/article.html")).toBe(
        "https://www.nytimes.com/2025/01/01/article.html"
      );

      expect(normalizeUrl("www.bbc.com/news")).toBe("https://www.bbc.com/news");

      expect(normalizeUrl("https:/theguardian.com/world")).toBe(
        "https://theguardian.com/world"
      );
    });
  });
});

describe("isValidUrl", () => {
  it("should return true for valid URLs", () => {
    expect(isValidUrl("https://example.com")).toBe(true);
    expect(isValidUrl("example.com")).toBe(true);
    expect(isValidUrl("https://www.example.com/path")).toBe(true);
  });

  it("should return false for invalid URLs", () => {
    expect(isValidUrl("")).toBe(false);
    expect(isValidUrl("not a url")).toBe(false);
    expect(isValidUrl("ftp://example.com")).toBe(false);
  });

  it("should handle malformed URLs", () => {
    expect(isValidUrl("https:/example.com")).toBe(true);
    expect(isValidUrl("https://https:/example.com")).toBe(true);
  });
});

describe("NormalizedUrlSchema", () => {
  it("should normalize valid URLs", () => {
    const result = NormalizedUrlSchema.parse("example.com");
    expect(result).toBe("https://example.com");
  });

  it("should normalize URLs with malformed protocols", () => {
    const result = NormalizedUrlSchema.parse("https:/example.com");
    expect(result).toBe("https://example.com");
  });

  it("should normalize URLs with duplicate protocols", () => {
    const result = NormalizedUrlSchema.parse("https://https://example.com");
    expect(result).toBe("https://example.com");
  });

  it("should trim whitespace", () => {
    const result = NormalizedUrlSchema.parse("  example.com  ");
    expect(result).toBe("https://example.com");
  });

  it("should reject empty strings", () => {
    expect(() => NormalizedUrlSchema.parse("")).toThrow();
    expect(() => NormalizedUrlSchema.parse("   ")).toThrow();
  });

  it("should reject invalid URLs", () => {
    expect(() => NormalizedUrlSchema.parse("not a url")).toThrow();
    expect(() => NormalizedUrlSchema.parse("ftp://example.com")).toThrow();
  });
});

