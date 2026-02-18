/**
 * Shared theme constants used across the application
 * Centralizes theme configuration to prevent drift between components
 */

// Default theme - matches ThemeProvider's defaultTheme in app/layout.tsx
export const DEFAULT_THEME = "system";

// Light themes in the app
export const LIGHT_THEMES = ["light", "pure-light", "winter", "dawn"];

// Dark themes in the app
export const DARK_THEMES = ["dark", "carbon", "black", "classic-dark", "magic-blue", "forest"];

// Palette configuration - maps display labels to actual theme names
export const DARK_PALETTES = [
  { id: "carbon", label: "Carbon", theme: "carbon" },
  { id: "black", label: "Black", theme: "black" },
  { id: "winter", label: "Winter", theme: "classic-dark" },
  { id: "forest", label: "Forest", theme: "forest" },
] as const;

export const LIGHT_PALETTES = [
  { id: "white", label: "White", theme: "pure-light" },
  { id: "sepia", label: "Sepia", theme: "light" },
  { id: "paper", label: "Paper", theme: "winter" },
  { id: "dawn", label: "Dawn", theme: "dawn" },
] as const;

// Reverse lookup: theme name to palette id
export const THEME_TO_DARK_PALETTE: Record<string, string> = {
  "carbon": "carbon",
  "black": "black",
  "classic-dark": "winter",
  "dark": "carbon",
  "magic-blue": "carbon",
  "forest": "forest",
};

export const THEME_TO_LIGHT_PALETTE: Record<string, string> = {
  "pure-light": "white",
  "light": "sepia",
  "winter": "paper",
  "dawn": "dawn",
};

// Helper to check if a theme is dark
export function isDarkTheme(theme: string | undefined): boolean {
  if (!theme) return false;
  return DARK_THEMES.includes(theme);
}

// Helper to check if a theme is light
export function isLightTheme(theme: string | undefined): boolean {
  if (!theme) return false;
  return LIGHT_THEMES.includes(theme);
}
