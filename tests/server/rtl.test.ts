/**
 * Tests for RTL (Right-to-Left) language detection
 */

import { describe, test, expect } from "bun:test";
import {
  isRTLLanguage,
  detectTextDirection,
  getTextDirection,
  getDirectionAttributes,
} from "../../lib/rtl";

describe("RTL Language Detection", () => {
  describe("isRTLLanguage", () => {
    test("returns true for RTL language codes", () => {
      expect(isRTLLanguage("ar")).toBe(true);
      expect(isRTLLanguage("he")).toBe(true);
      expect(isRTLLanguage("fa")).toBe(true);
      expect(isRTLLanguage("ur")).toBe(true);
      expect(isRTLLanguage("yi")).toBe(true);
    });

    test("returns false for LTR language codes", () => {
      expect(isRTLLanguage("en")).toBe(false);
      expect(isRTLLanguage("es")).toBe(false);
      expect(isRTLLanguage("fr")).toBe(false);
      expect(isRTLLanguage("zh")).toBe(false);
      expect(isRTLLanguage("ja")).toBe(false);
    });

    test("handles locale variants", () => {
      expect(isRTLLanguage("ar-SA")).toBe(true);
      expect(isRTLLanguage("he-IL")).toBe(true);
      expect(isRTLLanguage("en-US")).toBe(false);
      expect(isRTLLanguage("ar_EG")).toBe(true);
    });

    test("handles null/undefined", () => {
      expect(isRTLLanguage(null)).toBe(false);
      expect(isRTLLanguage(undefined)).toBe(false);
      expect(isRTLLanguage("")).toBe(false);
    });

    test("handles case variations", () => {
      expect(isRTLLanguage("AR")).toBe(true);
      expect(isRTLLanguage("Ar")).toBe(true);
      expect(isRTLLanguage("hE")).toBe(true);
    });
  });

  describe("detectTextDirection", () => {
    test("detects Arabic text as RTL", () => {
      const arabicText = "مرحبا بك في موقعنا";
      expect(detectTextDirection(arabicText)).toBe("rtl");
    });

    test("detects Hebrew text as RTL", () => {
      const hebrewText = "שלום עולם";
      expect(detectTextDirection(hebrewText)).toBe("rtl");
    });

    test("detects English text as LTR", () => {
      const englishText = "Hello world, this is a test.";
      expect(detectTextDirection(englishText)).toBe("ltr");
    });

    test("handles empty/null text", () => {
      expect(detectTextDirection("")).toBe("ltr");
      expect(detectTextDirection(null)).toBe("ltr");
      expect(detectTextDirection(undefined)).toBe("ltr");
    });

    test("handles CJK text as LTR", () => {
      const chineseText = "你好世界";
      expect(detectTextDirection(chineseText)).toBe("ltr");

      const japaneseText = "こんにちは世界";
      expect(detectTextDirection(japaneseText)).toBe("ltr");
    });

    test("handles numbers and punctuation only", () => {
      expect(detectTextDirection("12345!@#$%")).toBe("ltr");
    });
  });

  describe("getTextDirection", () => {
    test("prefers language code over content analysis", () => {
      const dir = getTextDirection("ar", "Hello world in English");
      expect(dir).toBe("rtl");
    });

    test("falls back to content analysis when no language code", () => {
      const dir = getTextDirection(null, "مرحبا بك");
      expect(dir).toBe("rtl");
    });

    test("returns ltr when no info available", () => {
      expect(getTextDirection(null, null)).toBe("ltr");
      expect(getTextDirection(undefined, undefined)).toBe("ltr");
    });
  });

  describe("getDirectionAttributes", () => {
    test("returns dir and lang attributes", () => {
      const attrs = getDirectionAttributes("ar", "نص عربي");
      expect(attrs.dir).toBe("rtl");
      expect(attrs.lang).toBe("ar");
    });

    test("omits lang when not provided", () => {
      const attrs = getDirectionAttributes(null, "نص عربي");
      expect(attrs.dir).toBe("rtl");
      expect(attrs.lang).toBeUndefined();
    });

    test("returns ltr for English content", () => {
      const attrs = getDirectionAttributes("en", "Hello world");
      expect(attrs.dir).toBe("ltr");
      expect(attrs.lang).toBe("en");
    });
  });
});
