"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import {
  Share2,
  Upload,
  Link2,
  ExternalLink,
  Twitter,
  FileText,
  Settings,
  TextFont,
  ChevronRight,
  Check,
} from "@/components/ui/icons";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Slider } from "@/components/ui/slider";
import { useReaderPreferences } from "@/lib/hooks/use-reader-preferences";
import {
  type ReaderFont,
  type FontSizeLevel,
  type LineSpacingLevel,
  FONT_SIZE_MAP,
  FONT_SIZE_LEVELS,
} from "@/types/reader-preferences";
import {
  DARK_PALETTES,
  LIGHT_PALETTES,
  DEFAULT_THEME,
  isDarkTheme,
  getPaletteForTheme,
  mapDropdownToTheme,
} from "@/lib/theme-config";

type ViewMode = "markdown" | "html" | "iframe";

// Font display names
const FONT_DISPLAY_NAMES: Record<ReaderFont, string> = {
  literata: "Literata",
  atkinson: "Atkinson Hyperlegible",
  inter: "Inter",
  georgia: "Georgia",
  merriweather: "Merriweather",
  opendyslexic: "OpenDyslexic",
  system: "System Default",
};

// Font family styles for preview
const FONT_PREVIEW_STYLES: Record<ReaderFont, React.CSSProperties> = {
  literata: { fontFamily: "var(--font-literata), Georgia, serif" },
  atkinson: { fontFamily: "var(--font-atkinson), system-ui, sans-serif" },
  inter: {
    fontFamily: "var(--font-geist-sans), Inter, system-ui, sans-serif",
  },
  georgia: { fontFamily: "Georgia, Times New Roman, serif" },
  merriweather: { fontFamily: "var(--font-merriweather), Georgia, serif" },
  opendyslexic: { fontFamily: "OpenDyslexic, Comic Sans MS, sans-serif" },
  system: { fontFamily: "system-ui, -apple-system, sans-serif" },
};

// Line spacing multipliers for preview
const LINE_SPACING_PREVIEW: Record<LineSpacingLevel, number> = {
  tight: 1.5,
  normal: 1.8,
  relaxed: 2.0,
};

// Segmented control component
function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex bg-muted rounded-xl p-1 gap-0.5">
      {options.map((option) => {
        const isSelected = value === option.value;
        return (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            style={{ touchAction: "manipulation" }}
            className={cn(
              "flex-1 py-2.5 text-sm font-medium rounded-lg transition-all min-h-[44px]",
              "active:scale-[0.97]",
              isSelected
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

interface MobileBottomBarProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  smryUrl: string;
  originalUrl: string;
  articleTitle?: string;
  onOpenSettings?: () => void;
  className?: string;
}

export function MobileBottomBar({
  smryUrl,
  originalUrl,
  articleTitle,
  onOpenSettings,
  className,
}: MobileBottomBarProps) {
  const [shareDrawerOpen, setShareDrawerOpen] = React.useState(false);
  const [copiedItem, setCopiedItem] = React.useState<string | null>(null);
  const [styleDrawerOpen, setStyleDrawerOpen] = React.useState(false);
  const [fontDrawerOpen, setFontDrawerOpen] = React.useState(false);

  const { theme, setTheme } = useTheme();
  const {
    preferences,
    hasLoaded,
    hasCustomPreferences,
    setFontSize,
    setLineSpacing,
    setFont,
    resetToDefaults,
  } = useReaderPreferences();

  const [mounted, setMounted] = React.useState(false);
  const [themeChanged, setThemeChanged] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (mounted && (theme === "system" || !theme)) {
      setTheme("carbon");
    }
  }, [mounted, theme, setTheme]);

  const isDark = isDarkTheme(theme);
  const palettes = isDark ? DARK_PALETTES : LIGHT_PALETTES;
  const selectedPalette = getPaletteForTheme(theme, isDark);

  const hasCustomTheme =
    mounted && theme !== undefined && theme !== DEFAULT_THEME;
  const hasAnyCustomization =
    hasCustomPreferences || hasCustomTheme || themeChanged;

  const handleThemeChange = (newTheme: string) => {
    const actualTheme = mapDropdownToTheme(newTheme);
    setTheme(actualTheme);
    setThemeChanged(actualTheme !== DEFAULT_THEME);
  };

  // Separate handler for the mode segmented control
  // "dark" should set the actual "dark" theme (not "carbon", which is "auto")
  const handleModeChange = (mode: string) => {
    if (mode === "system") {
      setTheme("carbon");
    } else if (mode === "light") {
      setTheme("light");
    } else if (mode === "dark") {
      setTheme("dark");
    }
    setThemeChanged(mode !== "system");
  };

  // Derive current mode for the segmented control
  const currentMode = (() => {
    if (!theme || theme === "system" || theme === "carbon") return "system";
    if (LIGHT_PALETTES.some((p) => p.theme === theme)) return "light";
    return "dark";
  })();

  const handleResetAll = () => {
    resetToDefaults();
    setTheme(DEFAULT_THEME);
    setThemeChanged(false);
  };

  const fonts: { value: ReaderFont; label: string }[] = [
    { value: "literata", label: "Literata" },
    { value: "atkinson", label: "Atkinson" },
    { value: "inter", label: "Inter" },
    { value: "georgia", label: "Georgia" },
    { value: "merriweather", label: "Merriweather" },
    { value: "opendyslexic", label: "OpenDyslexic" },
    { value: "system", label: "System" },
  ];

  // Font size slider index (0-5 maps to levels -2 to 3)
  const fontSizeIndex = FONT_SIZE_LEVELS.indexOf(preferences.fontSize);

  const handleFontSizeSlider = (newValue: number | readonly number[]) => {
    const idx = Array.isArray(newValue) ? newValue[0] : newValue;
    setFontSize(FONT_SIZE_LEVELS[idx] as FontSizeLevel);
  };

  const handleCopy = async (text: string, item: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedItem(item);
      setTimeout(() => setCopiedItem(null), 2000);
    } catch {
      // Fallback for older browsers
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: articleTitle || "Article",
          url: smryUrl,
        });
        setShareDrawerOpen(false);
      } catch {
        // User cancelled or error
      }
    }
  };

  const handleTweet = () => {
    const xShareText = `https://smry.ai/proxy?url=${encodeURIComponent(originalUrl)}`;
    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(xShareText)}`;
    window.open(tweetUrl, "_blank", "noopener,noreferrer");
    setShareDrawerOpen(false);
  };

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 border-t border-border/40 bg-card/98 backdrop-blur-xl",
        "pb-[env(safe-area-inset-bottom)]",
        className
      )}
    >
      <div className="flex items-center justify-around h-14 px-4">
        {/* Style Options */}
        <button
          onClick={() => setStyleDrawerOpen(true)}
          style={{ touchAction: "manipulation" }}
          className="flex flex-col items-center justify-center gap-0.5 min-w-[64px] min-h-[44px] py-1.5 text-muted-foreground hover:text-foreground transition-colors active:scale-[0.97] active:opacity-80"
        >
          <TextFont className="size-5" />
          <span className="text-[11px] font-medium">Style</span>
        </button>

        {/* Share */}
        <Drawer open={shareDrawerOpen} onOpenChange={setShareDrawerOpen}>
          <DrawerTrigger
            render={(props) => {
              const { key, ...rest } = props as typeof props & {
                key?: React.Key;
              };
              return (
                <button
                  {...rest}
                  key={key}
                  style={{ touchAction: "manipulation" }}
                  className="flex flex-col items-center justify-center gap-0.5 min-w-[64px] min-h-[44px] py-1.5 text-muted-foreground hover:text-foreground transition-colors active:scale-[0.97] active:opacity-80"
                >
                  <Share2 key="share-icon" className="size-5" />
                  <span key="share-label" className="text-[11px] font-medium">
                    Share
                  </span>
                </button>
              );
            }}
          />
          <DrawerContent className="pb-safe">
            <DrawerHeader className="sr-only">
              <DrawerTitle>Share</DrawerTitle>
            </DrawerHeader>

            <div className="px-4 pt-2 pb-4 space-y-3" data-vaul-no-drag>
              {/* Top action buttons */}
              <div className="flex gap-2">
                <button
                  style={{ touchAction: "manipulation" }}
                  className="flex-1 h-12 flex items-center justify-center gap-2 rounded-xl bg-muted text-foreground font-medium text-sm transition-opacity active:opacity-70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  onClick={handleNativeShare}
                >
                  <Upload className="size-4" aria-hidden="true" />
                  Share
                </button>
                <button
                  style={{ touchAction: "manipulation" }}
                  className="flex-1 h-12 flex items-center justify-center gap-2 rounded-xl bg-muted text-foreground font-medium text-sm transition-opacity active:opacity-70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  onClick={handleTweet}
                >
                  <Twitter className="size-4" aria-hidden="true" />
                  Tweet
                </button>
              </div>

              {/* Action list card */}
              <div className="bg-muted rounded-xl overflow-hidden">
                <div className="relative">
                  <button
                    onClick={() => handleCopy(smryUrl, "smry")}
                    style={{ touchAction: "manipulation" }}
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-opacity active:opacity-70 focus-visible:bg-accent focus-visible:outline-none"
                  >
                    <Link2
                      className="size-5 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <span className="flex-1">Copy smry link</span>
                    {copiedItem === "smry" && (
                      <span
                        className="text-xs text-primary"
                        role="status"
                        aria-live="polite"
                      >
                        Copied!
                      </span>
                    )}
                  </button>
                  <div className="absolute bottom-0 left-12 right-0 h-px bg-border/50" />
                </div>

                <div className="relative">
                  <button
                    onClick={() => {
                      window.open(
                        originalUrl,
                        "_blank",
                        "noopener,noreferrer"
                      );
                      setShareDrawerOpen(false);
                    }}
                    style={{ touchAction: "manipulation" }}
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-opacity active:opacity-70 focus-visible:bg-accent focus-visible:outline-none"
                  >
                    <ExternalLink
                      className="size-5 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <span className="flex-1">Open original in browser</span>
                  </button>
                  <div className="absolute bottom-0 left-12 right-0 h-px bg-border/50" />
                </div>

                <button
                  onClick={() => {
                    const markdown = `[${articleTitle || "Article"}](${smryUrl})`;
                    handleCopy(markdown, "markdown");
                  }}
                  style={{ touchAction: "manipulation" }}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-opacity active:opacity-70 focus-visible:bg-accent focus-visible:outline-none"
                >
                  <FileText
                    className="size-5 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <span className="flex-1">Copy as markdown</span>
                  {copiedItem === "markdown" && (
                    <span
                      className="text-xs text-primary"
                      role="status"
                      aria-live="polite"
                    >
                      Copied!
                    </span>
                  )}
                </button>
              </div>

              {/* Cancel button card */}
              <button
                className="w-full h-12 rounded-xl bg-muted text-muted-foreground font-medium transition-opacity active:opacity-70"
                style={{ touchAction: "manipulation" }}
                onClick={() => setShareDrawerOpen(false)}
              >
                Cancel
              </button>
            </div>
          </DrawerContent>
        </Drawer>

        {/* Settings */}
        <button
          onClick={onOpenSettings}
          style={{ touchAction: "manipulation" }}
          className="flex flex-col items-center justify-center gap-0.5 min-w-[64px] min-h-[44px] py-1.5 text-muted-foreground hover:text-foreground transition-colors active:scale-[0.97] active:opacity-80"
        >
          <Settings className="size-5" />
          <span className="text-[11px] font-medium">Settings</span>
        </button>
      </div>

      {/* Style Options Drawer */}
      <Drawer open={styleDrawerOpen} onOpenChange={setStyleDrawerOpen}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="sr-only">
            <DrawerTitle>Style Options</DrawerTitle>
          </DrawerHeader>

          <div
            className="px-4 pb-[max(2rem,env(safe-area-inset-bottom))] overflow-y-auto space-y-4"
            data-vaul-no-drag
          >
            {/* Live text preview */}
            {hasLoaded && (
              <div
                className="bg-muted rounded-xl px-4 py-4 relative overflow-hidden"
                style={{
                  ...FONT_PREVIEW_STYLES[preferences.font],
                  fontSize: `${FONT_SIZE_MAP[preferences.fontSize]}px`,
                  lineHeight: LINE_SPACING_PREVIEW[preferences.lineSpacing],
                  transition: "font-size 0.2s ease, line-height 0.2s ease",
                }}
              >
                <span className="absolute top-2.5 right-3 text-[10px] font-mono text-muted-foreground/60 bg-background/50 px-1.5 py-0.5 rounded">
                  {FONT_SIZE_MAP[preferences.fontSize]}px
                </span>
                <p className="text-foreground/90 pr-10">
                  The quick brown fox jumps over the lazy dog.
                </p>
              </div>
            )}

            {/* Theme: Segmented control (Auto / Light / Dark) */}
            {mounted ? (
              <SegmentedControl
                options={[
                  { value: "system", label: "Auto" },
                  { value: "light", label: "Light" },
                  { value: "dark", label: "Dark" },
                ]}
                value={currentMode}
                onChange={handleModeChange}
              />
            ) : (
              <div className="h-[52px] rounded-xl bg-muted animate-pulse" />
            )}

            {/* Palette: Rounded rectangle buttons with names */}
            {mounted ? (
              <div className="flex gap-2">
                {palettes.map((palette) => {
                  const isSelected = selectedPalette === palette.id;
                  return (
                    <button
                      key={palette.id}
                      onClick={() => handleThemeChange(palette.theme)}
                      style={{
                        touchAction: "manipulation",
                        backgroundColor: palette.colors.bg,
                      }}
                      className={cn(
                        "flex-1 py-2.5 px-2 rounded-xl text-xs font-medium min-h-[44px]",
                        "border-2 transition-colors duration-150",
                        "active:opacity-80",
                        "outline-none focus-visible:outline-none",
                        isDark ? "text-white" : "text-zinc-900",
                        isSelected
                          ? "border-primary"
                          : "border-transparent"
                      )}
                    >
                      {palette.label}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex gap-2">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="flex-1 h-[44px] rounded-xl bg-muted animate-pulse"
                  />
                ))}
              </div>
            )}

            <div className="h-px bg-border/30" />

            {/* Font selector row */}
            {hasLoaded ? (
              <button
                type="button"
                onClick={() => setFontDrawerOpen(true)}
                style={{ touchAction: "manipulation" }}
                className={cn(
                  "flex items-center justify-between w-full px-1 py-2 text-left",
                  "min-h-[44px]",
                  "transition-all duration-150 active:opacity-70"
                )}
              >
                <span className="text-sm font-medium text-muted-foreground">
                  Font
                </span>
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="text-sm">
                    {FONT_DISPLAY_NAMES[preferences.font]}
                  </span>
                  <ChevronRight className="size-4" />
                </span>
              </button>
            ) : (
              <div className="h-[44px] rounded-xl bg-muted animate-pulse" />
            )}

            {/* Font size: Slider with A anchors and aligned ticks */}
            {hasLoaded ? (
              <div className="space-y-1.5">
                <div className="flex items-center gap-3 px-1">
                  <span className="text-sm font-medium text-muted-foreground shrink-0">
                    Size
                  </span>
                  <span className="text-xs text-muted-foreground/60 shrink-0">
                    A
                  </span>
                  <Slider
                    min={0}
                    max={5}
                    step={1}
                    value={fontSizeIndex}
                    onValueChange={handleFontSizeSlider}
                    aria-label="Font size"
                  />
                  <span className="text-lg font-medium text-muted-foreground/60 shrink-0 leading-none">
                    A
                  </span>
                </div>
                {/* Tick labels — positioned relative to the slider track area */}
                <div className="relative h-4" style={{ marginLeft: "60px", marginRight: "28px" }}>
                  {FONT_SIZE_LEVELS.map((level, i) => (
                    <span
                      key={level}
                      className={cn(
                        "absolute text-[11px] tabular-nums -translate-x-1/2",
                        preferences.fontSize === level
                          ? "text-foreground font-semibold"
                          : "text-muted-foreground/50"
                      )}
                      style={{ left: `${(i / 5) * 100}%` }}
                    >
                      {FONT_SIZE_MAP[level]}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-[52px] rounded-xl bg-muted animate-pulse" />
            )}

            {/* Spacing: Segmented control with text labels */}
            {hasLoaded ? (
              <div className="flex items-center gap-3 px-1">
                <span className="text-sm font-medium text-muted-foreground shrink-0">
                  Spacing
                </span>
                <div className="flex-1">
                  <SegmentedControl
                    options={[
                      { value: "tight" as LineSpacingLevel, label: "Tight" },
                      { value: "normal" as LineSpacingLevel, label: "Normal" },
                      { value: "relaxed" as LineSpacingLevel, label: "Relaxed" },
                    ]}
                    value={preferences.lineSpacing}
                    onChange={setLineSpacing}
                  />
                </div>
              </div>
            ) : (
              <div className="h-[52px] rounded-xl bg-muted animate-pulse" />
            )}

            <div className="h-px bg-border/30" />

            {/* Reset to default */}
            <button
              onClick={handleResetAll}
              disabled={!hasAnyCustomization}
              style={{ touchAction: "manipulation" }}
              className={cn(
                "w-full py-3 text-sm font-medium rounded-xl transition-all min-h-[48px]",
                "bg-muted active:scale-[0.98]",
                "disabled:opacity-40 disabled:pointer-events-none"
              )}
            >
              Reset to default
            </button>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Nested Font Drawer */}
      <Drawer open={fontDrawerOpen} onOpenChange={setFontDrawerOpen}>
        <DrawerContent className="max-h-[70vh]">
          <DrawerHeader className="pb-2">
            <DrawerTitle className="text-center text-lg font-semibold">
              Font
            </DrawerTitle>
          </DrawerHeader>

          <div
            className="px-4 pb-[max(2rem,env(safe-area-inset-bottom))]"
            data-vaul-no-drag
          >
            <div className="bg-muted rounded-xl overflow-hidden divide-y divide-border/30">
              {fonts.map((font) => {
                const isSelected = preferences.font === font.value;
                return (
                  <button
                    key={font.value}
                    onClick={() => {
                      setFont(font.value);
                      setFontDrawerOpen(false);
                    }}
                    style={{ touchAction: "manipulation" }}
                    className={cn(
                      "flex items-center justify-between w-full px-4 py-4 text-left",
                      "min-h-[52px]",
                      "transition-all duration-150 active:opacity-70"
                    )}
                  >
                    <span
                      className={cn(
                        "text-base",
                        isSelected
                          ? "text-foreground font-medium"
                          : "text-foreground/80"
                      )}
                      style={FONT_PREVIEW_STYLES[font.value]}
                    >
                      {FONT_DISPLAY_NAMES[font.value]}
                    </span>
                    {isSelected && (
                      <Check className="size-5 text-foreground" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
