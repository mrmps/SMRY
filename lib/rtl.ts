/**
 * RTL (Right-to-Left) language detection utilities
 */

// ISO 639-1 codes for RTL languages
const RTL_LANGUAGES = new Set([
  'ar',  // Arabic
  'he',  // Hebrew
  'fa',  // Persian/Farsi
  'ur',  // Urdu
  'yi',  // Yiddish
  'ps',  // Pashto
  'sd',  // Sindhi
  'ug',  // Uyghur
  'ku',  // Kurdish (when written in Arabic script)
  'dv',  // Divehi/Maldivian
  'ha',  // Hausa (when written in Arabic script)
  'ks',  // Kashmiri
  'pa',  // Punjabi (when written in Shahmukhi script)
  'syr', // Syriac
  'arc', // Aramaic
]);

// Unicode ranges for RTL scripts
const RTL_CHAR_RANGES = [
  [0x0590, 0x05FF], // Hebrew
  [0x0600, 0x06FF], // Arabic
  [0x0700, 0x074F], // Syriac
  [0x0750, 0x077F], // Arabic Supplement
  [0x0780, 0x07BF], // Thaana (Maldivian)
  [0x07C0, 0x07FF], // N'Ko
  [0x0800, 0x083F], // Samaritan
  [0x0840, 0x085F], // Mandaic
  [0x08A0, 0x08FF], // Arabic Extended-A
  [0xFB1D, 0xFB4F], // Hebrew Presentation Forms
  [0xFB50, 0xFDFF], // Arabic Presentation Forms-A
  [0xFE70, 0xFEFF], // Arabic Presentation Forms-B
  [0x10800, 0x1083F], // Cypriot Syllabary
  [0x10840, 0x1085F], // Imperial Aramaic
];

/**
 * Check if a language code indicates an RTL language
 */
export function isRTLLanguage(langCode?: string | null): boolean {
  if (!langCode) return false;
  
  // Normalize: take first part of locale (e.g., 'ar-SA' -> 'ar')
  const baseLang = langCode.toLowerCase().split('-')[0].split('_')[0];
  return RTL_LANGUAGES.has(baseLang);
}

/**
 * Check if a Unicode code point is in an RTL script range
 */
function isRTLCodePoint(codePoint: number): boolean {
  return RTL_CHAR_RANGES.some(
    ([start, end]) => codePoint >= start && codePoint <= end
  );
}

/**
 * Analyze text content to detect if it's predominantly RTL
 * Returns 'rtl' if >30% of meaningful characters are RTL, 'ltr' otherwise
 */
export function detectTextDirection(text?: string | null): 'rtl' | 'ltr' {
  if (!text) return 'ltr';
  
  let rtlCount = 0;
  let ltrCount = 0;
  
  // Sample the text (for performance on large texts)
  const sampleSize = Math.min(text.length, 10000);
  const sample = text.slice(0, sampleSize);
  
  for (const char of sample) {
    const codePoint = char.codePointAt(0);
    if (codePoint === undefined) continue;
    
    // Skip common neutral characters (punctuation, numbers, whitespace)
    if (codePoint <= 0x007F) {
      // ASCII letters count as LTR
      if ((codePoint >= 0x0041 && codePoint <= 0x005A) || // A-Z
          (codePoint >= 0x0061 && codePoint <= 0x007A)) { // a-z
        ltrCount++;
      }
      continue;
    }
    
    if (isRTLCodePoint(codePoint)) {
      rtlCount++;
    } else if (codePoint >= 0x0080) {
      // Other non-ASCII characters are likely LTR (Cyrillic, Greek, CJK, etc.)
      ltrCount++;
    }
  }
  
  // If there's meaningful directional content, decide based on ratio
  const total = rtlCount + ltrCount;
  if (total === 0) return 'ltr';
  
  // Consider RTL if more than 30% of directional characters are RTL
  return (rtlCount / total) > 0.3 ? 'rtl' : 'ltr';
}

/**
 * Determine the text direction based on language code and/or content
 * Prefers explicit language code, falls back to content analysis
 */
export function getTextDirection(
  langCode?: string | null,
  textContent?: string | null
): 'rtl' | 'ltr' {
  // First check language code if provided
  if (langCode && isRTLLanguage(langCode)) {
    return 'rtl';
  }
  
  // Fall back to content analysis
  return detectTextDirection(textContent);
}

/**
 * Get direction attributes for HTML elements
 */
export function getDirectionAttributes(
  langCode?: string | null,
  textContent?: string | null
): { dir: 'rtl' | 'ltr'; lang?: string } {
  const dir = getTextDirection(langCode, textContent);
  
  return {
    dir,
    ...(langCode && { lang: langCode }),
  };
}

