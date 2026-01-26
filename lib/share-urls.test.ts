import { describe, expect, it } from "bun:test";
import { getSmryUrl, generateShareUrls } from "./share-urls";

describe("getSmryUrl", () => {
  it("generates clean smry.ai URL from original article URL", () => {
    const result = getSmryUrl("www.theatlantic.com/technology/archive/2017/11/the-big-unanswered-questions-about-paywalls/547091");
    expect(result).toBe("https://smry.ai/www.theatlantic.com/technology/archive/2017/11/the-big-unanswered-questions-about-paywalls/547091");
  });

  it("handles URL with https:// prefix", () => {
    const result = getSmryUrl("https://example.com/article");
    expect(result).toBe("https://smry.ai/https://example.com/article");
  });

  it("handles simple domain", () => {
    const result = getSmryUrl("example.com");
    expect(result).toBe("https://smry.ai/example.com");
  });

  it("handles empty originalUrl", () => {
    const result = getSmryUrl("");
    expect(result).toBe("https://smry.ai/");
  });
});

describe("generateShareUrls", () => {
  const testUrl = "www.theatlantic.com/technology/archive/2017/11/the-big-unanswered-questions-about-paywalls/547091";

  describe("X/Twitter share URL", () => {
    it("uses text parameter with smry.ai short format (no https://)", () => {
      const { x } = generateShareUrls(testUrl);
      expect(x).toBe(`https://twitter.com/intent/tweet?text=${encodeURIComponent(`smry.ai/${testUrl}`)}`);
    });

    it("does not include url parameter", () => {
      const { x } = generateShareUrls(testUrl);
      expect(x).not.toContain("&url=");
    });

    it("does not use proxy URL format", () => {
      const { x } = generateShareUrls(testUrl);
      expect(x).not.toContain("proxy?url=");
    });

    it("handles empty URL gracefully", () => {
      const { x } = generateShareUrls("");
      expect(x).toBe(`https://twitter.com/intent/tweet?text=${encodeURIComponent("smry.ai/")}`);
    });
  });

  describe("LinkedIn share URL", () => {
    it("uses full smry.ai URL with https://", () => {
      const { linkedin } = generateShareUrls(testUrl);
      const expectedUrl = `https://smry.ai/${testUrl}`;
      expect(linkedin).toBe(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(expectedUrl)}`);
    });

    it("does not use proxy URL format", () => {
      const { linkedin } = generateShareUrls(testUrl);
      expect(linkedin).not.toContain("proxy?url=");
    });
  });

  describe("Reddit share URL", () => {
    it("uses full smry.ai URL with https://", () => {
      const { reddit } = generateShareUrls(testUrl);
      const expectedUrl = `https://smry.ai/${testUrl}`;
      expect(reddit).toBe(`https://www.reddit.com/submit?url=${encodeURIComponent(expectedUrl)}`);
    });

    it("does not use proxy URL format", () => {
      const { reddit } = generateShareUrls(testUrl);
      expect(reddit).not.toContain("proxy?url=");
    });
  });

  describe("URL encoding", () => {
    it("properly encodes special characters in URLs", () => {
      const urlWithParams = "example.com/article?id=123&category=tech";
      const { x, linkedin, reddit } = generateShareUrls(urlWithParams);

      // All URLs should be properly encoded
      expect(x).toContain(encodeURIComponent(`smry.ai/${urlWithParams}`));
      expect(linkedin).toContain(encodeURIComponent(`https://smry.ai/${urlWithParams}`));
      expect(reddit).toContain(encodeURIComponent(`https://smry.ai/${urlWithParams}`));
    });
  });
});
