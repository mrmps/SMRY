"use client";

import { useEffect, useCallback } from "react";
import useLocalStorage from "./use-local-storage";
import {
  type ReaderPreferences,
  type FontSizeLevel,
  type LineSpacingLevel,
  type ContentWidthLevel,
  type ReaderFont,
  DEFAULT_READER_PREFERENCES,
  FONT_SIZE_MAP,
  LINE_SPACING_MAP,
  CONTENT_WIDTH_MAP,
  FONT_FAMILY_MAP,
  FONT_SIZE_LEVELS,
} from "@/types/reader-preferences";

const STORAGE_KEY = "smry-reader-preferences";

// Apply CSS variables to body (where font CSS variables are defined)
// Note: We apply to body instead of :root because next/font variables are scoped to body
function applyCSSVariables(preferences: ReaderPreferences) {
  if (typeof document === "undefined") return;

  // Apply to both html and body to ensure proper variable resolution
  const root = document.documentElement;
  const body = document.body;

  // Font family - use resolved font name for better compatibility
  const fontFamily = FONT_FAMILY_MAP[preferences.font];
  root.style.setProperty("--reader-font-family", fontFamily);
  body.style.setProperty("--reader-font-family", fontFamily);

  // Font size
  const fontSize = FONT_SIZE_MAP[preferences.fontSize];
  root.style.setProperty("--reader-font-size", `${fontSize}px`);
  body.style.setProperty("--reader-font-size", `${fontSize}px`);

  // Line height
  const lineHeight = LINE_SPACING_MAP[preferences.lineSpacing];
  root.style.setProperty("--reader-line-height", String(lineHeight));
  body.style.setProperty("--reader-line-height", String(lineHeight));

  // Content width
  const contentWidth = CONTENT_WIDTH_MAP[preferences.contentWidth];
  root.style.setProperty("--reader-content-width", contentWidth);
  body.style.setProperty("--reader-content-width", contentWidth);
}

// Remove CSS variables
function removeCSSVariables() {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  const body = document.body;

  const vars = ["--reader-font-family", "--reader-font-size", "--reader-line-height", "--reader-content-width"];
  vars.forEach(v => {
    root.style.removeProperty(v);
    body.style.removeProperty(v);
  });
}

export function useReaderPreferences() {
  const [preferences, setPreferences, hasLoaded] = useLocalStorage<ReaderPreferences>(
    STORAGE_KEY,
    DEFAULT_READER_PREFERENCES
  );

  // Apply CSS variables whenever preferences change
  useEffect(() => {
    if (hasLoaded) {
      applyCSSVariables(preferences);
    }
  }, [preferences, hasLoaded]);

  // Update a single preference
  // Note: uses spread from preferences closure - safe with React's batching
  const updatePreference = useCallback(
    <K extends keyof ReaderPreferences>(key: K, value: ReaderPreferences[K]) => {
      setPreferences({
        ...preferences,
        [key]: value,
      });
    },
    [preferences, setPreferences]
  );

  // Font helpers
  const setFont = useCallback(
    (font: ReaderFont) => updatePreference("font", font),
    [updatePreference]
  );

  // Font size helpers
  const setFontSize = useCallback(
    (size: FontSizeLevel) => updatePreference("fontSize", size),
    [updatePreference]
  );

  const increaseFontSize = useCallback(() => {
    const currentIndex = FONT_SIZE_LEVELS.indexOf(preferences.fontSize);
    if (currentIndex < FONT_SIZE_LEVELS.length - 1) {
      setFontSize(FONT_SIZE_LEVELS[currentIndex + 1]);
    }
  }, [preferences.fontSize, setFontSize]);

  const decreaseFontSize = useCallback(() => {
    const currentIndex = FONT_SIZE_LEVELS.indexOf(preferences.fontSize);
    if (currentIndex > 0) {
      setFontSize(FONT_SIZE_LEVELS[currentIndex - 1]);
    }
  }, [preferences.fontSize, setFontSize]);

  const canIncreaseFontSize = FONT_SIZE_LEVELS.indexOf(preferences.fontSize) < FONT_SIZE_LEVELS.length - 1;
  const canDecreaseFontSize = FONT_SIZE_LEVELS.indexOf(preferences.fontSize) > 0;

  // Line spacing helpers
  const setLineSpacing = useCallback(
    (spacing: LineSpacingLevel) => updatePreference("lineSpacing", spacing),
    [updatePreference]
  );

  // Content width helpers
  const setContentWidth = useCallback(
    (width: ContentWidthLevel) => updatePreference("contentWidth", width),
    [updatePreference]
  );

  // Reset to defaults
  const resetToDefaults = useCallback(() => {
    setPreferences(DEFAULT_READER_PREFERENCES);
  }, [setPreferences]);

  // Check if current preferences differ from defaults
  const hasCustomPreferences =
    preferences.font !== DEFAULT_READER_PREFERENCES.font ||
    preferences.fontSize !== DEFAULT_READER_PREFERENCES.fontSize ||
    preferences.lineSpacing !== DEFAULT_READER_PREFERENCES.lineSpacing ||
    preferences.contentWidth !== DEFAULT_READER_PREFERENCES.contentWidth;

  return {
    // Current preferences
    preferences,
    hasLoaded,
    hasCustomPreferences,

    // Computed values
    currentFontSize: FONT_SIZE_MAP[preferences.fontSize],
    currentLineHeight: LINE_SPACING_MAP[preferences.lineSpacing],
    currentContentWidth: CONTENT_WIDTH_MAP[preferences.contentWidth],

    // Font methods
    setFont,

    // Font size methods
    setFontSize,
    increaseFontSize,
    decreaseFontSize,
    canIncreaseFontSize,
    canDecreaseFontSize,

    // Line spacing methods
    setLineSpacing,

    // Content width methods
    setContentWidth,

    // Reset
    resetToDefaults,
  };
}

// Export a client-side initializer for immediate CSS application
// Call this in a client component that mounts early (like layout providers)
export function initializeReaderPreferences() {
  if (typeof window === "undefined") return;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const preferences = JSON.parse(stored) as ReaderPreferences;
      applyCSSVariables(preferences);
    } else {
      // Apply defaults if no stored preferences
      applyCSSVariables(DEFAULT_READER_PREFERENCES);
    }
  } catch {
    // Ignore errors, defaults will apply via CSS
    applyCSSVariables(DEFAULT_READER_PREFERENCES);
  }
}
