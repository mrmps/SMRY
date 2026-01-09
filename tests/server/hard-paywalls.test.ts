/**
 * Tests for hard paywall detection
 */

import { describe, test, expect } from "bun:test";
import {
  isHardPaywall,
  getHardPaywallInfo,
  getHardPaywallError,
  HARD_PAYWALL_SITES,
  CATEGORY_INFO,
} from "../../src/lib/hard-paywalls";

describe("Hard Paywall Detection", () => {
  describe("isHardPaywall", () => {
    test("returns true for known hard paywall sites", () => {
      expect(isHardPaywall("patreon.com")).toBe(true);
      expect(isHardPaywall("onlyfans.com")).toBe(true);
      expect(isHardPaywall("www.barrons.com")).toBe(true);
      expect(isHardPaywall("facebook.com")).toBe(true);
      expect(isHardPaywall("www.facebook.com")).toBe(true);
    });

    test("returns false for non-paywall sites", () => {
      expect(isHardPaywall("example.com")).toBe(false);
      expect(isHardPaywall("github.com")).toBe(false);
      expect(isHardPaywall("medium.com")).toBe(false);
      expect(isHardPaywall("nytimes.com")).toBe(false);
    });

    test("normalizes hostname correctly", () => {
      expect(isHardPaywall("patreon.com")).toBe(true);
      expect(isHardPaywall("www.instagram.com")).toBe(true);
      expect(isHardPaywall("instagram.com")).toBe(true);
    });
  });

  describe("getHardPaywallInfo", () => {
    test("returns site info for known sites", () => {
      const info = getHardPaywallInfo("patreon.com");
      expect(info).toBeDefined();
      expect(info?.name).toBe("Patreon");
      expect(info?.category).toBe("creator");
    });

    test("returns undefined for unknown sites", () => {
      const info = getHardPaywallInfo("example.com");
      expect(info).toBeUndefined();
    });

    test("returns correct category for each type", () => {
      expect(getHardPaywallInfo("www.barrons.com")?.category).toBe("news");
      expect(getHardPaywallInfo("patreon.com")?.category).toBe("creator");
      expect(getHardPaywallInfo("facebook.com")?.category).toBe("social");
      expect(getHardPaywallInfo("doc88.com")?.category).toBe("document");
    });
  });

  describe("getHardPaywallError", () => {
    test("returns category-specific error message for creator platforms", () => {
      const error = getHardPaywallError("patreon.com");
      expect(error.type).toBe("PAYWALL_ERROR");
      expect(error.siteName).toBe("Patreon");
      expect(error.category).toBe("creator");
      expect(error.learnMoreUrl).toBe("/hard-paywalls");
      expect(error.error).toContain("creator platform");
    });

    test("returns category-specific error message for social media", () => {
      const error = getHardPaywallError("facebook.com");
      expect(error.category).toBe("social");
      expect(error.error).toContain("private");
    });

    test("returns generic error for unknown sites", () => {
      const error = getHardPaywallError("unknown-site.com");
      expect(error.category).toBe("other");
      expect(error.siteName).toBe("unknown-site.com");
    });
  });

  describe("HARD_PAYWALL_SITES", () => {
    test("all sites have required fields", () => {
      for (const site of HARD_PAYWALL_SITES) {
        expect(site.hostname).toBeDefined();
        expect(site.hostname.length).toBeGreaterThan(0);
        expect(site.name).toBeDefined();
        expect(site.category).toBeDefined();
        expect(site.addedAt).toBeDefined();
        expect(site.addedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    });

    test("all categories have info defined", () => {
      const categories = new Set(HARD_PAYWALL_SITES.map((s) => s.category));
      for (const cat of categories) {
        expect(CATEGORY_INFO[cat]).toBeDefined();
        expect(CATEGORY_INFO[cat].title).toBeDefined();
        expect(CATEGORY_INFO[cat].description).toBeDefined();
        expect(CATEGORY_INFO[cat].errorMessage).toBeDefined();
      }
    });
  });
});
