/**
 * Centralized theme configuration for the app
 * Used by both mobile (settings-drawer) and desktop (reader-settings-popover, settings-content)
 */

// =============================================================================
// THEME CLASSIFICATIONS
// =============================================================================

export const LIGHT_THEMES = ["light", "pure-light", "winter", "dawn"] as const;
export const DARK_THEMES = ["dark", "carbon", "black", "classic-dark", "magic-blue", "forest"] as const;

export type LightTheme = typeof LIGHT_THEMES[number];
export type DarkTheme = typeof DARK_THEMES[number];
export type Theme = LightTheme | DarkTheme | "system";

// =============================================================================
// DEFAULT THEME
// =============================================================================

// Carbon is our app's default theme
// "Match System" in dropdown maps to carbon
export const DEFAULT_THEME = "carbon";

// =============================================================================
// PALETTE CONFIGURATION
// =============================================================================

export interface PaletteConfig {
  id: string;
  label: string;
  theme: string;
  colors: {
    bg: string;
    border: string;
    text: string;
  };
}

// Dark mode palettes - shown when user is in dark mode
export const DARK_PALETTES: PaletteConfig[] = [
  {
    id: "carbon",
    label: "Carbon",
    theme: "carbon",
    colors: { bg: "#111111", border: "#2a2a2a", text: "#dcdcdc" },
  },
  {
    id: "black",
    label: "Black",
    theme: "black",
    colors: { bg: "#0a0a0a", border: "#1a1a1a", text: "#ffffff" },
  },
  {
    id: "winter",
    label: "Winter",
    theme: "magic-blue",
    colors: { bg: "#13151a", border: "#1e2028", text: "#ffffff" },
  },
  {
    id: "forest",
    label: "Forest",
    theme: "forest",
    colors: { bg: "#171512", border: "#292520", text: "#ffffff" },
  },
];

// Light mode palettes - shown when user is in light mode
export const LIGHT_PALETTES: PaletteConfig[] = [
  {
    id: "white",
    label: "White",
    theme: "pure-light",
    colors: { bg: "#ffffff", border: "#d1d5db", text: "#171717" },
  },
  {
    id: "sepia",
    label: "Sepia",
    theme: "light",
    colors: { bg: "#fef3c7", border: "#fcd34d", text: "#171717" },
  },
  {
    id: "paper",
    label: "Paper",
    theme: "winter",
    colors: { bg: "#e2e8f0", border: "#cbd5e1", text: "#1e293b" },
  },
  {
    id: "dawn",
    label: "Dawn",
    theme: "dawn",
    colors: { bg: "#fdf8f6", border: "#fecdd3", text: "#44403c" },
  },
];

// =============================================================================
// THEME TO PALETTE MAPPING (reverse lookup)
// =============================================================================

export const THEME_TO_DARK_PALETTE: Record<string, string> = {
  carbon: "carbon",
  black: "black",
  "magic-blue": "winter",
  "classic-dark": "winter",
  dark: "carbon",
  forest: "forest",
};

export const THEME_TO_LIGHT_PALETTE: Record<string, string> = {
  "pure-light": "white",
  light: "sepia",
  winter: "paper",
  dawn: "dawn",
};

// =============================================================================
// FULL THEME OPTIONS (for settings page)
// =============================================================================

export interface ThemeOption {
  value: string;
  label: string;
  description: string;
  preview: {
    bg: string;
    text: string;
    accent: string;
  };
}

export const THEME_OPTIONS: ThemeOption[] = [
  {
    value: "system",
    label: "System",
    description: "Match your device settings",
    preview: { bg: "linear-gradient(135deg, #faf6f1 50%, #181a1b 50%)", text: "#37352f", accent: "#6366f1" },
  },
  {
    value: "light",
    label: "Warm Paper",
    description: "Soft cream like quality book paper",
    preview: { bg: "#faf6f1", text: "#37352f", accent: "#6366f1" },
  },
  {
    value: "pure-light",
    label: "Pure Light",
    description: "Clean white, minimal design",
    preview: { bg: "#ffffff", text: "#171717", accent: "#6366f1" },
  },
  {
    value: "winter",
    label: "Winter",
    description: "Cool blue-tinted light theme",
    preview: { bg: "#e2e8f0", text: "#1e293b", accent: "#6366f1" },
  },
  {
    value: "dark",
    label: "Dark",
    description: "Comfortable dark mode for reading",
    preview: { bg: "#181a1b", text: "#fffffff2", accent: "#6d7eec" },
  },
  {
    value: "magic-blue",
    label: "Magic Blue",
    description: "Dark with subtle blue tint",
    preview: { bg: "#13151a", text: "#d4d2cf", accent: "#575ac6" },
  },
  {
    value: "classic-dark",
    label: "Classic Dark",
    description: "Neutral dark gray, professional",
    preview: { bg: "#18191b", text: "#d4d2cf", accent: "#5e69d1" },
  },
  {
    value: "carbon",
    label: "Carbon",
    description: "High contrast dark mode",
    preview: { bg: "#111111", text: "#dcdcdc", accent: "#8e8e8e" },
  },
  {
    value: "black",
    label: "Black (OLED)",
    description: "True black for OLED displays",
    preview: { bg: "#0a0a0a", text: "#e0e0e0", accent: "#737373" },
  },
  {
    value: "forest",
    label: "Forest",
    description: "Warm brown-tinted, earthy",
    preview: { bg: "#171512", text: "#f0f4f2", accent: "#62d348" },
  },
  {
    value: "dawn",
    label: "Dawn",
    description: "Warm peachy light theme",
    preview: { bg: "#fdf8f6", text: "#44403c", accent: "#d97706" },
  },
];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Check if a theme is a dark theme
 */
export function isDarkTheme(theme: string | undefined): boolean {
  if (!theme || theme === "system" || theme === "carbon") {
    return true; // Default to dark
  }
  return DARK_THEMES.includes(theme as DarkTheme);
}

/**
 * Get the palette ID for a given theme
 */
export function getPaletteForTheme(theme: string | undefined, isDark: boolean): string {
  if (!theme || theme === "system" || theme === "carbon") {
    return "carbon";
  }
  if (isDark) {
    return THEME_TO_DARK_PALETTE[theme] || "carbon";
  }
  return THEME_TO_LIGHT_PALETTE[theme] || "sepia";
}

/**
 * Get palette style for button rendering
 */
export function getPaletteStyle(paletteId: string, isDark: boolean): React.CSSProperties {
  const palettes = isDark ? DARK_PALETTES : LIGHT_PALETTES;
  const palette = palettes.find((p) => p.id === paletteId);

  if (palette) {
    return {
      backgroundColor: palette.colors.bg,
      borderColor: palette.colors.border,
    };
  }

  // Fallback
  return isDark
    ? { backgroundColor: "#111111", borderColor: "#2a2a2a" }
    : { backgroundColor: "#ffffff", borderColor: "#d1d5db" };
}

/**
 * Map dropdown value to actual theme
 * - "system" -> "carbon" (our default)
 * - "dark" -> "carbon"
 * - "light" -> "light" (sepia)
 */
export function mapDropdownToTheme(dropdownValue: string): string {
  if (dropdownValue === "system" || dropdownValue === "dark") {
    return "carbon";
  }
  if (dropdownValue === "light") {
    return "light"; // sepia
  }
  return dropdownValue;
}

/**
 * Map theme to dropdown value for display
 * - "carbon" -> "system" (show as Match System)
 * - light themes -> "light"
 * - dark themes -> "dark"
 */
export function mapThemeToDropdown(theme: string | undefined): string {
  if (!theme || theme === "system" || theme === "carbon") {
    return "system";
  }
  if (LIGHT_THEMES.includes(theme as LightTheme)) {
    return "light";
  }
  if (DARK_THEMES.includes(theme as DarkTheme)) {
    return "dark";
  }
  return theme;
}
