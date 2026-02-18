"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { useReaderPreferences } from "@/lib/hooks/use-reader-preferences";
import {
  Popover,
  PopoverTrigger,
  PopoverPopup,
} from "@/components/ui/popover";
import { ChevronDown, ChevronUp, TextFont } from "@/components/ui/icons";
import {
  type ReaderFont,
  type LineSpacingLevel,
  type ContentWidthLevel,
} from "@/types/reader-preferences";

// =============================================================================
// CONSTANTS
// =============================================================================

// Default theme for the app - carbon is the app default
const DEFAULT_THEME = "carbon";

// Light themes in the app
const LIGHT_THEMES = ["light", "pure-light", "winter", "dawn"];

// Dark themes in the app
const DARK_THEMES = ["dark", "carbon", "black", "classic-dark", "magic-blue", "forest"];

// Palette configuration - maps display labels to actual theme names
const DARK_PALETTES = [
  { id: "carbon", label: "Carbon", theme: "carbon" },
  { id: "black", label: "Black", theme: "black" },
  { id: "winter", label: "Winter", theme: "classic-dark" },
  { id: "forest", label: "Forest", theme: "forest" },
] as const;

const LIGHT_PALETTES = [
  { id: "white", label: "White", theme: "pure-light" },
  { id: "sepia", label: "Sepia", theme: "light" },
  { id: "paper", label: "Paper", theme: "winter" },
  { id: "dawn", label: "Dawn", theme: "dawn" },
] as const;

// Reverse lookup: theme name to palette id
const THEME_TO_DARK_PALETTE: Record<string, string> = {
  "carbon": "carbon",
  "black": "black",
  "classic-dark": "winter",
  "dark": "carbon",
  "magic-blue": "carbon",
  "forest": "forest",
};

const THEME_TO_LIGHT_PALETTE: Record<string, string> = {
  "pure-light": "white",
  "light": "sepia",
  "winter": "paper",
  "dawn": "dawn",
};

// =============================================================================
// ICONS
// =============================================================================

function SpacingIcon({ tight }: { tight?: boolean }) {
  const gap = tight ? 3 : 5;
  return (
    <svg width="20" height="16" viewBox="0 0 20 16" fill="currentColor">
      <rect x="0" y={8 - gap - 1} width="20" height="1.5" rx="0.5" />
      <rect x="0" y="7.25" width="20" height="1.5" rx="0.5" />
      <rect x="0" y={8 + gap - 0.5} width="20" height="1.5" rx="0.5" />
    </svg>
  );
}

function WidthIcon({ narrow }: { narrow?: boolean }) {
  const width = narrow ? 14 : 20;
  const offset = narrow ? 3 : 0;
  return (
    <svg width="20" height="14" viewBox="0 0 20 14" fill="currentColor">
      <rect x={offset} y="1" width={width} height="1.5" rx="0.5" />
      <rect x={offset} y="6.25" width={width} height="1.5" rx="0.5" />
      <rect x={offset} y="11.5" width={width} height="1.5" rx="0.5" />
    </svg>
  );
}

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

function ThemeDropdown({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const options = [
    { value: "system", label: "Match System" },
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
  ];

  // Map specific themes back to light/dark/system for dropdown
  const getDropdownValue = (theme: string) => {
    if (theme === "system") return "system";
    if (LIGHT_THEMES.includes(theme)) return "light";
    if (DARK_THEMES.includes(theme)) return "dark";
    return theme;
  };

  return (
    <div className="relative">
      <select
        value={getDropdownValue(value)}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "w-full appearance-none rounded-xl px-4 py-3 pr-10 text-sm font-medium",
          "bg-muted border-0",
          "focus:outline-none focus:ring-2 focus:ring-primary/30",
          "cursor-pointer"
        )}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
    </div>
  );
}

function PaletteButton({
  label,
  selected,
  onClick,
  isDark,
  paletteId,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  isDark: boolean;
  paletteId: string;
}) {
  const getBgClass = () => {
    if (isDark) {
      switch (paletteId) {
        case "carbon": return "bg-zinc-800 border-zinc-700";
        case "black": return "bg-zinc-950 border-zinc-800";
        case "winter": return "bg-slate-700 border-slate-600";
        case "forest": return "bg-emerald-950 border-emerald-900";
        default: return "bg-zinc-800 border-zinc-700";
      }
    } else {
      switch (paletteId) {
        case "white": return "bg-white border-gray-300";
        case "sepia": return "bg-amber-50 border-amber-200";
        case "paper": return "bg-slate-100 border-slate-300";
        case "dawn": return "bg-rose-50 border-rose-200";
        default: return "bg-white border-gray-300";
      }
    }
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all border",
        getBgClass(),
        isDark ? "text-white" : "text-zinc-900",
        selected && "ring-2 ring-ring ring-offset-2 ring-offset-background"
      )}
    >
      {label}
    </button>
  );
}

function StepperButton({
  onClick,
  disabled,
  direction,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  direction: "decrease" | "increase";
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex-1 flex items-center justify-center gap-1 py-3 px-4 rounded-xl transition-all",
        "bg-muted hover:bg-accent active:scale-[0.98]",
        "disabled:opacity-40 disabled:pointer-events-none"
      )}
    >
      {children}
      {direction === "decrease" ? (
        <ChevronDown className="size-3.5 text-muted-foreground" />
      ) : (
        <ChevronUp className="size-3.5 text-muted-foreground" />
      )}
    </button>
  );
}

// =============================================================================
// SECTION COMPONENTS
// =============================================================================

function ThemeSection({ onThemeChange }: { onThemeChange?: (theme: string) => void }) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Theme</span>
          <div className="h-10 flex-1 ml-8 bg-muted rounded-xl animate-pulse" />
        </div>
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex-1 h-9 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const isDark = DARK_THEMES.includes(resolvedTheme || "") ||
    (resolvedTheme === "dark");

  const palettes = isDark ? DARK_PALETTES : LIGHT_PALETTES;

  // Determine selected palette based on current theme
  const getCurrentPalette = () => {
    const currentTheme = theme || "system";
    if (currentTheme === "system") {
      // For system theme, use resolved theme to determine palette
      if (isDark) {
        return "carbon"; // Default dark palette
      }
      return "sepia"; // Default light palette (light theme)
    }
    if (isDark) {
      return THEME_TO_DARK_PALETTE[currentTheme] || "carbon";
    } else {
      return THEME_TO_LIGHT_PALETTE[currentTheme] || "sepia";
    }
  };

  const selectedPalette = getCurrentPalette();

  // Handle dropdown change
  const handleDropdownChange = (value: string) => {
    setTheme(value);
    onThemeChange?.(value);
  };

  // Handle palette selection
  const handlePaletteSelect = (paletteTheme: string) => {
    setTheme(paletteTheme);
    onThemeChange?.(paletteTheme);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-foreground shrink-0">Theme</span>
        <div className="flex-1">
          <ThemeDropdown value={theme || "system"} onChange={handleDropdownChange} />
        </div>
      </div>
      <div className="flex gap-2">
        {palettes.map((palette) => (
          <PaletteButton
            key={palette.id}
            paletteId={palette.id}
            label={palette.label}
            selected={selectedPalette === palette.id}
            onClick={() => handlePaletteSelect(palette.theme)}
            isDark={isDark}
          />
        ))}
      </div>
    </div>
  );
}

function FontDropdown({
  value,
  onChange,
}: {
  value: ReaderFont;
  onChange: (value: ReaderFont) => void;
}) {
  const options: { value: ReaderFont; label: string }[] = [
    { value: "literata", label: "Literata" },
    { value: "atkinson", label: "Atkinson Hyperlegible" },
    { value: "inter", label: "Inter" },
    { value: "georgia", label: "Georgia" },
    { value: "merriweather", label: "Merriweather" },
    { value: "opendyslexic", label: "OpenDyslexic" },
    { value: "system", label: "System" },
  ];

  return (
    <div className="flex items-center gap-4">
      <span className="text-sm font-medium text-foreground shrink-0">Font</span>
      <div className="relative flex-1">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as ReaderFont)}
          className={cn(
            "w-full appearance-none rounded-xl px-4 py-3 pr-10 text-sm font-medium",
            "bg-muted border-0",
            "focus:outline-none focus:ring-2 focus:ring-primary/30",
            "cursor-pointer"
          )}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
      </div>
    </div>
  );
}

function FontSizeStepper() {
  const {
    increaseFontSize,
    decreaseFontSize,
    canIncreaseFontSize,
    canDecreaseFontSize,
  } = useReaderPreferences();

  return (
    <div className="flex items-center gap-4">
      <span className="text-sm font-medium text-foreground shrink-0">Font size</span>
      <div className="flex-1 flex gap-2">
        <StepperButton
          onClick={decreaseFontSize}
          disabled={!canDecreaseFontSize}
          direction="decrease"
        >
          <span className="text-base font-medium">A</span>
        </StepperButton>
        <StepperButton
          onClick={increaseFontSize}
          disabled={!canIncreaseFontSize}
          direction="increase"
        >
          <span className="text-xl font-medium">A</span>
        </StepperButton>
      </div>
    </div>
  );
}

function SpacingStepper() {
  const { preferences, setLineSpacing } = useReaderPreferences();
  const levels: LineSpacingLevel[] = ["tight", "normal", "relaxed"];
  const currentIndex = levels.indexOf(preferences.lineSpacing);

  const decrease = () => {
    if (currentIndex > 0) setLineSpacing(levels[currentIndex - 1]);
  };
  const increase = () => {
    if (currentIndex < levels.length - 1) setLineSpacing(levels[currentIndex + 1]);
  };

  return (
    <div className="flex items-center gap-4">
      <span className="text-sm font-medium text-foreground shrink-0">Spacing</span>
      <div className="flex-1 flex gap-2">
        <StepperButton
          onClick={decrease}
          disabled={currentIndex === 0}
          direction="decrease"
        >
          <SpacingIcon tight />
        </StepperButton>
        <StepperButton
          onClick={increase}
          disabled={currentIndex === levels.length - 1}
          direction="increase"
        >
          <SpacingIcon />
        </StepperButton>
      </div>
    </div>
  );
}

function WidthStepper() {
  const { preferences, setContentWidth } = useReaderPreferences();
  const levels: ContentWidthLevel[] = ["narrow", "normal"];
  const currentIndex = levels.indexOf(preferences.contentWidth);

  const decrease = () => {
    if (currentIndex > 0) setContentWidth(levels[currentIndex - 1]);
  };
  const increase = () => {
    if (currentIndex < levels.length - 1) setContentWidth(levels[currentIndex + 1]);
  };

  return (
    <div className="flex items-center gap-4">
      <span className="text-sm font-medium text-foreground shrink-0">Width</span>
      <div className="flex-1 flex gap-2">
        <StepperButton
          onClick={decrease}
          disabled={currentIndex === 0}
          direction="decrease"
        >
          <WidthIcon narrow />
        </StepperButton>
        <StepperButton
          onClick={increase}
          disabled={currentIndex === levels.length - 1}
          direction="increase"
        >
          <WidthIcon />
        </StepperButton>
      </div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

interface ReaderSettingsPopoverProps {
  side?: "right" | "left" | "top" | "bottom";
  align?: "start" | "center" | "end";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ReaderSettingsPopover({
  side = "right",
  align = "center",
  open,
  onOpenChange,
}: ReaderSettingsPopoverProps) {
  const { theme, setTheme } = useTheme();
  const {
    preferences,
    setFont,
    resetToDefaults,
    hasCustomPreferences,
  } = useReaderPreferences();

  // Track if theme has been customized (not system default)
  const [themeChanged, setThemeChanged] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Check if theme is different from default
  const hasCustomTheme = mounted && theme !== DEFAULT_THEME && theme !== undefined;

  // Combined check for any customization
  const hasAnyCustomization = hasCustomPreferences || hasCustomTheme || themeChanged;

  // Handle full reset - both preferences and theme
  const handleResetAll = () => {
    resetToDefaults();
    setTheme(DEFAULT_THEME);
    setThemeChanged(false);
  };

  // Track theme changes
  const handleThemeChange = () => {
    setThemeChanged(true);
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        className={cn(
          "size-10 flex items-center justify-center rounded-lg transition-all duration-150",
          "hover:bg-accent hover:text-accent-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "active:scale-95",
          "text-muted-foreground"
        )}
        aria-label="Style Options"
      >
        <TextFont className="size-5" />
      </PopoverTrigger>
      <PopoverPopup
        side={side}
        align={align}
        sideOffset={12}
        className="w-[360px]"
      >
        <div className="p-5 space-y-5">
          {/* Theme Section */}
          <ThemeSection onThemeChange={handleThemeChange} />

          {/* Font */}
          <FontDropdown value={preferences.font} onChange={setFont} />

          {/* Font Size */}
          <FontSizeStepper />

          {/* Spacing */}
          <SpacingStepper />

          {/* Width */}
          <WidthStepper />

          {/* Reset */}
          <button
            onClick={handleResetAll}
            disabled={!hasAnyCustomization}
            className={cn(
              "w-full py-3 text-sm font-medium rounded-xl transition-colors",
              "bg-muted hover:bg-accent",
              "disabled:opacity-40 disabled:pointer-events-none"
            )}
          >
            Reset to default
          </button>
        </div>
      </PopoverPopup>
    </Popover>
  );
}
