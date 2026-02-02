import { describe, expect, it } from "bun:test";
import { getSmryUrl, generateShareUrls } from "./share-urls";

describe("getSmryUrl", () => {
  it("generates clean smry.ai URL from original article URL", () => {
    const originalUrl = "www.theatlantic.com/technology/archive/2017/11/the-big-unanswered-questions-about-paywalls/547091";
    const result = getSmryUrl(originalUrl);
    expect(result).toBe(`https://smry.ai/proxy?url=${encodeURIComponent(originalUrl)}`);
  });

  it("handles URL with https:// prefix", () => {
    const originalUrl = "https://example.com/article";
    const result = getSmryUrl(originalUrl);
    expect(result).toBe(`https://smry.ai/proxy?url=${encodeURIComponent(originalUrl)}`);
  });

  it("handles simple domain", () => {
    const originalUrl = "example.com";
    const result = getSmryUrl(originalUrl);
    expect(result).toBe(`https://smry.ai/proxy?url=${encodeURIComponent(originalUrl)}`);
  });

  it("handles empty originalUrl", () => {
    const result = getSmryUrl("");
    expect(result).toBe("https://smry.ai/");
  });
});

describe("generateShareUrls", () => {
  const testUrl = "www.theatlantic.com/technology/archive/2017/11/the-big-unanswered-questions-about-paywalls/547091";

  describe("X/Twitter share URL", () => {
    it("uses text parameter with proxy URL format", () => {
      const { x } = generateShareUrls(testUrl);
      const expectedUrl = `https://smry.ai/proxy?url=${encodeURIComponent(testUrl)}`;
      expect(x).toBe(`https://twitter.com/intent/tweet?text=${encodeURIComponent(expectedUrl)}`);
    });

    it("handles empty URL gracefully", () => {
      const { x } = generateShareUrls("");
      expect(x).toBe(`https://twitter.com/intent/tweet?text=${encodeURIComponent("https://smry.ai/")}`);
    });
  });

  describe("LinkedIn share URL", () => {
    it("uses proxy URL format", () => {
      const { linkedin } = generateShareUrls(testUrl);
      const expectedUrl = `https://smry.ai/proxy?url=${encodeURIComponent(testUrl)}`;
      expect(linkedin).toBe(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(expectedUrl)}`);
    });
  });

  describe("Reddit share URL", () => {
    it("uses proxy URL format", () => {
      const { reddit } = generateShareUrls(testUrl);
      const expectedUrl = `https://smry.ai/proxy?url=${encodeURIComponent(testUrl)}`;
      expect(reddit).toBe(`https://www.reddit.com/submit?url=${encodeURIComponent(expectedUrl)}`);
    });
  });

  describe("URL encoding", () => {
    it("properly encodes special characters in URLs", () => {
      const urlWithParams = "example.com/article?id=123&category=tech";
      const { x, linkedin, reddit } = generateShareUrls(urlWithParams);

      // All URLs should be properly encoded
      expect(x).toContain(encodeURIComponent(`https://smry.ai/proxy?url=${encodeURIComponent(urlWithParams)}`));
      expect(linkedin).toContain(encodeURIComponent(`https://smry.ai/proxy?url=${encodeURIComponent(urlWithParams)}`));
      expect(reddit).toContain(encodeURIComponent(`https://smry.ai/proxy?url=${encodeURIComponent(urlWithParams)}`));
    });
  });
});
