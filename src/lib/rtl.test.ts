import { describe, test, expect } from 'bun:test';
import { isRTLLanguage, detectTextDirection, getTextDirection } from './rtl';

describe('RTL Detection', () => {
  describe('isRTLLanguage', () => {
    test('identifies Arabic as RTL', () => {
      expect(isRTLLanguage('ar')).toBe(true);
      expect(isRTLLanguage('ar-SA')).toBe(true);
      expect(isRTLLanguage('ar_EG')).toBe(true);
    });

    test('identifies Hebrew as RTL', () => {
      expect(isRTLLanguage('he')).toBe(true);
      expect(isRTLLanguage('he-IL')).toBe(true);
    });

    test('identifies Persian/Farsi as RTL', () => {
      expect(isRTLLanguage('fa')).toBe(true);
      expect(isRTLLanguage('fa-IR')).toBe(true);
    });

    test('identifies Urdu as RTL', () => {
      expect(isRTLLanguage('ur')).toBe(true);
    });

    test('identifies English as LTR', () => {
      expect(isRTLLanguage('en')).toBe(false);
      expect(isRTLLanguage('en-US')).toBe(false);
      expect(isRTLLanguage('en-GB')).toBe(false);
    });

    test('identifies other languages as LTR', () => {
      expect(isRTLLanguage('fr')).toBe(false);
      expect(isRTLLanguage('de')).toBe(false);
      expect(isRTLLanguage('es')).toBe(false);
      expect(isRTLLanguage('zh')).toBe(false);
      expect(isRTLLanguage('ja')).toBe(false);
    });

    test('handles null/undefined', () => {
      expect(isRTLLanguage(null)).toBe(false);
      expect(isRTLLanguage(undefined)).toBe(false);
      expect(isRTLLanguage('')).toBe(false);
    });
  });

  describe('detectTextDirection', () => {
    test('detects Arabic text as RTL', () => {
      const arabicText = 'مرحبا بك في موقعنا. نحن سعداء بزيارتك.';
      expect(detectTextDirection(arabicText)).toBe('rtl');
    });

    test('detects Hebrew text as RTL', () => {
      const hebrewText = 'שלום עולם. זוהי בדיקה של כיוון הטקסט.';
      expect(detectTextDirection(hebrewText)).toBe('rtl');
    });

    test('detects English text as LTR', () => {
      const englishText = 'Hello world. This is a test of text direction detection.';
      expect(detectTextDirection(englishText)).toBe('ltr');
    });

    test('detects mixed text with majority RTL as RTL', () => {
      // Mostly Arabic with some English
      const mixedText = 'مرحبا Hello مرحبا بك في موقعنا World نحن سعداء بزيارتك';
      expect(detectTextDirection(mixedText)).toBe('rtl');
    });

    test('detects mixed text with majority LTR as LTR', () => {
      // Mostly English with some Arabic
      const mixedText = 'Hello world this is a long text مرحبا and it continues in English for a while.';
      expect(detectTextDirection(mixedText)).toBe('ltr');
    });

    test('handles empty/null text', () => {
      expect(detectTextDirection('')).toBe('ltr');
      expect(detectTextDirection(null)).toBe('ltr');
      expect(detectTextDirection(undefined)).toBe('ltr');
    });

    test('handles text with only numbers and punctuation', () => {
      expect(detectTextDirection('123-456-7890')).toBe('ltr');
      expect(detectTextDirection('... --- ...')).toBe('ltr');
    });
  });

  describe('getTextDirection', () => {
    test('prefers language code over content analysis', () => {
      // Arabic language code with English content should still be RTL
      expect(getTextDirection('ar', 'Hello world')).toBe('rtl');
      expect(getTextDirection('he', 'This is English text')).toBe('rtl');
    });

    test('falls back to content analysis when no language code', () => {
      const arabicText = 'مرحبا بك في موقعنا';
      expect(getTextDirection(null, arabicText)).toBe('rtl');
      expect(getTextDirection('', arabicText)).toBe('rtl');
    });

    test('returns ltr for LTR language with LTR content', () => {
      expect(getTextDirection('en', 'Hello world')).toBe('ltr');
    });

    test('handles Persian text', () => {
      const persianText = 'سلام دنیا. این یک آزمایش است.';
      expect(detectTextDirection(persianText)).toBe('rtl');
    });
  });
});

