/**
 * Reader Preferences Types
 * Typography and display customization for the reading experience
 */

export type ReaderFont =
  | 'literata'
  | 'atkinson'
  | 'inter'
  | 'system'
  | 'opendyslexic'
  | 'georgia'
  | 'merriweather';

export type FontSizeLevel = -2 | -1 | 0 | 1 | 2 | 3;  // 14px to 24px
export type LineSpacingLevel = 'tight' | 'normal' | 'relaxed';
export type ContentWidthLevel = 'narrow' | 'normal';

export interface ReaderPreferences {
  version: 1;
  font: ReaderFont;
  fontSize: FontSizeLevel;
  lineSpacing: LineSpacingLevel;
  contentWidth: ContentWidthLevel;
}

export const DEFAULT_READER_PREFERENCES: ReaderPreferences = {
  version: 1,
  font: 'system',
  fontSize: 0,           // 18px
  lineSpacing: 'normal', // 1.8
  contentWidth: 'normal', // 740px
};

export const FONT_SIZE_MAP: Record<FontSizeLevel, number> = {
  [-2]: 14,
  [-1]: 16,
  [0]: 18,
  [1]: 20,
  [2]: 22,
  [3]: 24,
};

export const LINE_SPACING_MAP: Record<LineSpacingLevel, number> = {
  tight: 1.5,
  normal: 1.8,
  relaxed: 2.0,
};

export const CONTENT_WIDTH_MAP: Record<ContentWidthLevel, string> = {
  narrow: '620px',
  normal: '740px',
};

export const FONT_DISPLAY_NAMES: Record<ReaderFont, string> = {
  literata: 'Literata',
  atkinson: 'Atkinson Hyperlegible',
  inter: 'Inter',
  system: 'System Default',
  opendyslexic: 'OpenDyslexic',
  georgia: 'Georgia',
  merriweather: 'Merriweather',
};

export const FONT_DESCRIPTIONS: Record<ReaderFont, string> = {
  literata: 'Premium serif for extended reading',
  atkinson: 'Optimized for visual clarity',
  inter: 'Clean modern sans-serif',
  system: 'Your device default font',
  opendyslexic: 'Designed for dyslexic readers',
  georgia: 'Classic web serif',
  merriweather: 'Elegant screen-optimized serif',
};

// CSS font-family stacks for each font option
export const FONT_FAMILY_MAP: Record<ReaderFont, string> = {
  literata: 'var(--font-literata), Georgia, serif',
  atkinson: 'var(--font-atkinson), system-ui, sans-serif',
  inter: 'var(--font-geist-sans), Inter, system-ui, sans-serif',
  system: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  opendyslexic: '"OpenDyslexic", Comic Sans MS, sans-serif',
  georgia: 'Georgia, "Times New Roman", serif',
  merriweather: 'var(--font-merriweather), Georgia, serif',
};

// All available font size levels for iteration
export const FONT_SIZE_LEVELS: FontSizeLevel[] = [-2, -1, 0, 1, 2, 3];
