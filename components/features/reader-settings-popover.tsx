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
import { TextFont } from "@/components/ui/icons";
import {
  type ReaderFont,
  type LineSpacingLevel,
  type ContentWidthLevel,
} from "@/types/reader-preferences";
import {
  DARK_PALETTES,
  LIGHT_PALETTES,
  DEFAULT_THEME,
  isDarkTheme,
  getPaletteForTheme,
  mapDropdownToTheme,
  mapThemeToDropdown,
} from "@/lib/theme-config";

// =============================================================================
// PALETTE BACKGROUNDS for radio buttons
// =============================================================================

const PALETTE_BG: Record<string, string> = {
  carbon: "rgb(31, 32, 35)",
  black: "rgb(0, 0, 0)",
  winter: "rgb(24, 25, 33)",
  forest: "rgb(31, 28, 24)",
  white: "rgb(255, 255, 255)",
  sepia: "rgb(254, 243, 199)",
  paper: "rgb(226, 232, 240)",
  dawn: "rgb(253, 248, 246)",
};

// =============================================================================
// ICONS (matching reference SVGs)
// =============================================================================

function FontSizeSmallIcon() {
  return (
    <svg viewBox="0 0 11 11" fill="none" width="11" height="11" className="pointer-events-none">
      <path
        d="M4.81 0.514H6.35L9.752 10.174L10.62 10.314V11H6.924V10.314L8.086 10.174L7.428 8.102H3.34L2.682 10.174L3.886 10.314V11H0.568V10.314L1.436 10.174L4.81 0.514ZM5.692 2.754L5.342 1.522L5.006 2.782L3.592 7.276H7.162L5.692 2.754Z"
        fill="currentColor"
      />
    </svg>
  );
}

function FontSizeLargeIcon() {
  return (
    <svg viewBox="0 0 17 17" fill="none" width="17" height="17" className="pointer-events-none">
      <path
        d="M7.63 0.522H10.05L15.396 15.702L16.76 15.922V17H10.952V15.922L12.778 15.702L11.744 12.446H5.32L4.286 15.702L6.178 15.922V17H0.964V15.922L2.328 15.702L7.63 0.522ZM9.016 4.042L8.466 2.106L7.938 4.086L5.716 11.148H11.326L9.016 4.042Z"
        fill="currentColor"
      />
    </svg>
  );
}

function DownArrowIcon() {
  return (
    <svg viewBox="0 0 7 5" fill="none" width="7" height="5">
      <path
        d="M2.86297 4.52681C3.06302 4.7714 3.43698 4.7714 3.63703 4.52681L6.26274 1.31656C6.52977 0.990077 6.29748 0.5 5.87571 0.5H0.624293C0.202517 0.5 -0.0297675 0.990077 0.237264 1.31656L2.86297 4.52681Z"
        fill="currentColor"
      />
    </svg>
  );
}

function UpArrowIcon() {
  return (
    <svg viewBox="0 0 7 5" fill="none" width="7" height="5" style={{ transform: "rotate(180deg)" }}>
      <path
        d="M2.86297 4.52681C3.06302 4.7714 3.43698 4.7714 3.63703 4.52681L6.26274 1.31656C6.52977 0.990077 6.29748 0.5 5.87571 0.5H0.624293C0.202517 0.5 -0.0297675 0.990077 0.237264 1.31656L2.86297 4.52681Z"
        fill="currentColor"
      />
    </svg>
  );
}

function SpacingTightIcon() {
  return (
    <svg viewBox="0 0 26 12" fill="none" width="26" height="12" className="pointer-events-none">
      <rect fill="currentColor" width="25" height="1.5" transform="translate(0.25 0.75)" />
      <rect fill="currentColor" width="25" height="1.5" transform="translate(0.25 5.25)" />
      <rect fill="currentColor" width="25" height="1.5" transform="translate(0.25 9.75)" />
    </svg>
  );
}

function SpacingWideIcon() {
  return (
    <svg viewBox="0 0 26 16" fill="none" width="26" height="16" className="pointer-events-none">
      <rect fill="currentColor" width="25" height="1.5" transform="translate(0.75 0.75)" />
      <rect fill="currentColor" width="25" height="1.5" transform="translate(0.75 7.25)" />
      <rect fill="currentColor" width="25" height="1.5" transform="translate(0.75 13.75)" />
    </svg>
  );
}

function WidthNarrowIcon() {
  return (
    <svg viewBox="0 0 16 14" fill="none" width="16" height="14" className="pointer-events-none">
      <rect fill="currentColor" width="15" height="1.5" transform="translate(0.25 0.75)" />
      <rect fill="currentColor" width="15" height="1.5" transform="translate(0.25 6.25)" />
      <rect fill="currentColor" width="15" height="1.5" transform="translate(0.25 11.75)" />
    </svg>
  );
}

function WidthWideIcon() {
  return (
    <svg viewBox="0 0 36 14" fill="none" width="36" height="14" className="pointer-events-none">
      <rect fill="currentColor" width="35" height="1.5" transform="translate(0.75 0.75)" />
      <rect fill="currentColor" width="35" height="1.5" transform="translate(0.75 6.25)" />
      <rect fill="currentColor" width="35" height="1.5" transform="translate(0.75 11.75)" />
    </svg>
  );
}

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

function PanelSelect({
  value,
  onChange,
  options,
  name,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  name: string;
}) {
  return (
    <div className="relative w-[200px] min-w-[125px]">
      <select
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "appearance-none cursor-pointer border-0 outline-none focus:outline-none",
          "w-full h-[35px] rounded-[8px] pl-2.5 pr-7 text-[13.3px]",
          "text-foreground bg-foreground/7",
        )}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <svg
        className="absolute right-[6.5px] top-1/2 -translate-y-1/2 pointer-events-none text-foreground"
        width="10"
        height="10"
        viewBox="0 0 10 10"
        fill="none"
      >
        <path
          d="M7.87236 3.80697L5.39468 6.99256C5.1945 7.24993 4.8055 7.24993 4.60532 6.99256L2.12764 3.80697C1.8722 3.47854 2.10625 3 2.52232 3L7.47768 3C7.89375 3 8.1278 3.47854 7.87236 3.80697Z"
          fill="currentColor"
        />
      </svg>
    </div>
  );
}

function PaletteRadio({
  label,
  selected,
  onClick,
  bgColor,
}: {
  label: string;
  paletteId: string;
  selected: boolean;
  onClick: () => void;
  bgColor: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex-1 shrink-0 h-[35px] rounded-[8px] cursor-pointer"
      style={{
        backgroundColor: bgColor,
        border: `2px solid ${selected ? "rgb(0, 158, 250)" : "var(--color-border)"}`,
      }}
    >
      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-sm text-foreground/75 pointer-events-none">
        {label}
      </span>
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
        "flex items-center justify-between cursor-pointer transition-opacity",
        "disabled:opacity-40 disabled:pointer-events-none",
        "w-[92.5px] h-[35px] rounded-[8px] px-5 py-2.5 text-sm",
        "text-foreground border border-border bg-transparent",
        "hover:bg-foreground/5 active:scale-[0.98]",
      )}
    >
      {children}
      {direction === "decrease" ? <DownArrowIcon /> : <UpArrowIcon />}
    </button>
  );
}

// =============================================================================
// SECTION COMPONENTS
// =============================================================================

function ThemeSection({ onThemeChange }: { onThemeChange?: (theme: string) => void }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (mounted && (theme === "system" || !theme)) {
      setTheme("light");
    }
  }, [mounted, theme, setTheme]);

  if (!mounted) {
    return (
      <div className="h-20">
        <div className="flex items-center justify-between h-[35px]">
          <span className="text-sm font-bold text-muted-foreground">Theme</span>
          <div className="w-[200px] h-[35px] rounded-[8px] bg-foreground/7 animate-pulse" />
        </div>
        <div className="flex gap-[15px] mt-2.5 h-[35px]">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex-1 h-[35px] rounded-[8px] bg-foreground/7 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const isDark = isDarkTheme(theme);
  const palettes = isDark ? DARK_PALETTES : LIGHT_PALETTES;
  const selectedPalette = getPaletteForTheme(theme, isDark);

  const handleDropdownChange = (value: string) => {
    const actualTheme = mapDropdownToTheme(value);
    setTheme(actualTheme);
    onThemeChange?.(actualTheme);
  };

  const handlePaletteSelect = (paletteTheme: string) => {
    setTheme(paletteTheme);
    onThemeChange?.(paletteTheme);
  };

  return (
    <div className="flex flex-col gap-2.5">
      {/* Theme dropdown row */}
      <div className="flex items-center justify-between h-[35px]">
        <label
          htmlFor="entryActionColorScheme"
          className="text-sm font-bold text-muted-foreground"
        >
          Theme
        </label>
        <PanelSelect
          name="entryActionColorScheme"
          value={mapThemeToDropdown(theme || "system")}
          onChange={handleDropdownChange}
          options={[
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
            { value: "system", label: "Match System" },
          ]}
        />
      </div>

      {/* Palette buttons */}
      <div className="flex items-center gap-[15px] h-[35px] min-w-[296px]">
        {palettes.map((palette) => (
          <PaletteRadio
            key={palette.id}
            paletteId={palette.id}
            label={palette.label}
            selected={selectedPalette === palette.id}
            onClick={() => handlePaletteSelect(palette.theme)}
            bgColor={PALETTE_BG[palette.id] || palette.colors.bg}
          />
        ))}
      </div>
    </div>
  );
}

function FontSection({
  value,
  onChange,
}: {
  value: ReaderFont;
  onChange: (value: ReaderFont) => void;
}) {
  const options: { value: ReaderFont; label: string }[] = [
    { value: "atkinson", label: "Atkinson Hyperlegible" },
    { value: "inter", label: "Inter" },
    { value: "literata", label: "Literata" },
    { value: "georgia", label: "Georgia" },
    { value: "merriweather", label: "Merriweather" },
    { value: "opendyslexic", label: "OpenDyslexic" },
    { value: "system", label: "Match system" },
  ];

  return (
    <label
      htmlFor="entryActionFont"
      className="flex items-center justify-between h-[35px]"
    >
      <span className="text-sm font-bold text-muted-foreground">Font</span>
      <PanelSelect
        name="entryActionFont"
        value={value}
        onChange={(v) => onChange(v as ReaderFont)}
        options={options}
      />
    </label>
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
    <div className="flex items-center justify-between h-[35px]">
      <span className="text-sm font-bold text-muted-foreground">Font size</span>
      <div className="flex gap-[15px] w-[200px]">
        <StepperButton
          onClick={decreaseFontSize}
          disabled={!canDecreaseFontSize}
          direction="decrease"
        >
          <FontSizeSmallIcon />
        </StepperButton>
        <StepperButton
          onClick={increaseFontSize}
          disabled={!canIncreaseFontSize}
          direction="increase"
        >
          <FontSizeLargeIcon />
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
    <div className="flex items-center justify-between h-[35px]">
      <span className="text-sm font-bold text-muted-foreground">Spacing</span>
      <div className="flex gap-[15px] w-[200px]">
        <StepperButton
          onClick={decrease}
          disabled={currentIndex === 0}
          direction="decrease"
        >
          <SpacingTightIcon />
        </StepperButton>
        <StepperButton
          onClick={increase}
          disabled={currentIndex === levels.length - 1}
          direction="increase"
        >
          <SpacingWideIcon />
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
    <div className="flex items-center justify-between h-[35px]">
      <span className="text-sm font-bold text-muted-foreground">Width</span>
      <div className="flex gap-[15px] w-[200px]">
        <StepperButton
          onClick={decrease}
          disabled={currentIndex === 0}
          direction="decrease"
        >
          <WidthNarrowIcon />
        </StepperButton>
        <StepperButton
          onClick={increase}
          disabled={currentIndex === levels.length - 1}
          direction="increase"
        >
          <WidthWideIcon />
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

  const [themeChanged, setThemeChanged] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const hasCustomTheme = mounted && theme !== DEFAULT_THEME && theme !== undefined;
  const hasAnyCustomization = hasCustomPreferences || hasCustomTheme || themeChanged;

  const handleResetAll = () => {
    resetToDefaults();
    setTheme(DEFAULT_THEME);
    setThemeChanged(false);
  };

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
        className="!bg-transparent !border-0 !shadow-none !p-0 !before:hidden"
      >
        <div
          role="dialog"
          aria-hidden="false"
          className={cn(
            "w-[335px] min-w-[225px] rounded-[10px] overflow-hidden text-base",
            "bg-popover text-popover-foreground",
            "shadow-[rgba(0,0,0,0.1)_0px_0px_0px_1px,rgba(0,0,0,0.3)_0px_12px_8px_-8px]",
          )}
          style={{ padding: "10px 16px" }}
        >
          {/* Theme Section */}
          <div
            className="py-[5px]"
            style={{ boxShadow: "var(--color-border) 0px 0.5px 0px 0px" }}
          >
            <ThemeSection onThemeChange={handleThemeChange} />
          </div>

          {/* Style Options Section */}
          <div className="py-[5px]">
            <div className="flex flex-col gap-[15px]">
              <FontSection value={preferences.font} onChange={setFont} />
              <FontSizeStepper />
              <SpacingStepper />
              <WidthStepper />

              {/* Reset */}
              <div className="h-[35px] flex justify-center">
                <button
                  onClick={handleResetAll}
                  disabled={!hasAnyCustomization}
                  className={cn(
                    "inline-flex items-center justify-center cursor-pointer transition-opacity",
                    "disabled:opacity-40 disabled:pointer-events-none",
                    "h-[35px] rounded-[8px] px-[50px] text-sm",
                    "text-foreground bg-foreground/7",
                    "hover:bg-foreground/10 active:scale-[0.98]",
                  )}
                >
                  Reset to default
                </button>
              </div>
            </div>
          </div>
        </div>
      </PopoverPopup>
    </Popover>
  );
}
