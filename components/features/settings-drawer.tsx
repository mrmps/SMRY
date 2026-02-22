"use client";

import * as React from "react";
import { Link } from "@/i18n/navigation";
import { useTheme } from "next-themes";
import { useLocale } from "next-intl";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
} from "@clerk/nextjs";
import {
  ChevronRight,
  User,
  BookOpen,
  FileText,
  MonitorPlay,
  Check,
  TextFont,
} from "@/components/ui/icons";
import { FeedbackIcon, LanguageIcon } from "@/components/ui/custom-icons";

import { cn } from "@/lib/utils";
import { useIsPremium } from "@/lib/hooks/use-is-premium";
import { buildUrlWithReturn, storeReturnUrl } from "@/lib/hooks/use-return-url";
import { useReaderPreferences } from "@/lib/hooks/use-reader-preferences";
import { routing, languageNames, type Locale } from "@/i18n/routing";
import { useSwitchLocale } from "@/lib/client-locale-provider";
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
  getPaletteStyle,
  mapDropdownToTheme,
  mapThemeToDropdown,
} from "@/lib/theme-config";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

type ViewMode = "markdown" | "html" | "iframe";

export interface SettingsDrawerHandle {
  open: () => void;
  close: () => void;
}

interface SettingsDrawerProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  children?: React.ReactNode;
}

// Native iOS-style card container
function Card({ children, className, ...props }: { children?: React.ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("bg-muted rounded-xl", className)} {...props}>
      {children}
    </div>
  );
}

// iOS-native segmented control
function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: React.ReactNode; icon?: React.ReactNode }[];
  className?: string;
}) {
  return (
    <Card className={cn("flex p-1 gap-1", className)} role="radiogroup">
      {options.map((option) => {
        const isSelected = value === option.value;
        return (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            role="radio"
            aria-checked={isSelected}
            aria-label={typeof option.label === 'string' ? option.label : undefined}
            style={{ touchAction: "manipulation" }}
            className={cn(
              "relative flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-[13px] font-semibold rounded-[8px]",
              "min-h-[44px]",
              "transition-all duration-150 active:scale-[0.97]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isSelected
                ? "bg-white text-foreground shadow-sm dark:bg-surface-2 dark:text-white"
                : "text-muted-foreground"
            )}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </Card>
  );
}

// List row component for settings items
function SettingsRow({
  icon,
  label,
  value,
  onClick,
  href,
  external,
  className,
  showDivider = false,
}: {
  icon?: React.ReactNode;
  label: string;
  value?: React.ReactNode;
  onClick?: () => void;
  href?: string;
  external?: boolean;
  className?: string;
  showDivider?: boolean;
}) {
  const content = (
    <>
      <span className="flex items-center gap-3">
        {icon && <span className="text-muted-foreground">{icon}</span>}
        <span className="font-medium">{label}</span>
      </span>
      <span className="flex items-center gap-1.5 text-muted-foreground">
        {value && <span className="text-sm">{value}</span>}
        <ChevronRight className="size-4" />
      </span>
    </>
  );

  const baseClass = cn(
    "flex items-center justify-between w-full px-4 py-3.5 text-left",
    "min-h-[48px]",
    "transition-all duration-150 active:scale-[0.98] active:opacity-80",
    className
  );

  const wrapper = (child: React.ReactNode) => (
    <div className="relative">
      {child}
      {showDivider && (
        <div className="absolute bottom-0 left-4 right-0 h-px bg-border/50" />
      )}
    </div>
  );

  if (href) {
    if (external) {
      return wrapper(
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={baseClass}
          onClick={onClick}
        >
          {content}
        </a>
      );
    }
    return wrapper(
      <Link href={href} className={baseClass} onClick={onClick}>
        {content}
      </Link>
    );
  }

  return wrapper(
    <button type="button" onClick={onClick} className={baseClass}>
      {content}
    </button>
  );
}

// Theme constants imported from @/lib/theme-config

// Font display names
const FONT_DISPLAY_NAMES: Record<ReaderFont, string> = {
  literata: 'Literata',
  atkinson: 'Atkinson Hyperlegible',
  inter: 'Inter',
  georgia: 'Georgia',
  merriweather: 'Merriweather',
  opendyslexic: 'OpenDyslexic',
  system: 'System Default',
};

// Font family styles for preview
const FONT_PREVIEW_STYLES: Record<ReaderFont, React.CSSProperties> = {
  literata: { fontFamily: 'var(--font-literata), Georgia, serif' },
  atkinson: { fontFamily: 'var(--font-atkinson), system-ui, sans-serif' },
  inter: { fontFamily: 'var(--font-geist-sans), Inter, system-ui, sans-serif' },
  georgia: { fontFamily: 'Georgia, Times New Roman, serif' },
  merriweather: { fontFamily: 'var(--font-merriweather), Georgia, serif' },
  opendyslexic: { fontFamily: 'OpenDyslexic, Comic Sans MS, sans-serif' },
  system: { fontFamily: 'system-ui, -apple-system, sans-serif' },
};

// Style Options Section - opens nested drawer with Theme + Style controls
function StyleOptionsSection() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const {
    preferences,
    hasLoaded,
    hasCustomPreferences,
    increaseFontSize,
    decreaseFontSize,
    canIncreaseFontSize,
    canDecreaseFontSize,
    setLineSpacing,
    setContentWidth,
    setFont,
    resetToDefaults,
  } = useReaderPreferences();

  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [fontDrawerOpen, setFontDrawerOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const [themeChanged, setThemeChanged] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Migrate "system" theme to sepia (light) on mount
  // This ensures the actual theme class is applied, not OS preference
  React.useEffect(() => {
    if (mounted && (theme === "system" || !theme)) {
      setTheme("light");
    }
  }, [mounted, theme, setTheme]);

  // Use shared theme helpers
  const isDark = isDarkTheme(theme);
  const palettes = isDark ? DARK_PALETTES : LIGHT_PALETTES;
  const selectedPalette = getPaletteForTheme(theme, isDark);

  // Check if theme is customized from the default (carbon)
  // Theme is customized if it's anything other than "carbon"
  const hasCustomTheme = mounted && theme !== undefined && theme !== DEFAULT_THEME;
  const hasAnyCustomization = hasCustomPreferences || hasCustomTheme || themeChanged;

  // Handle theme change using shared mapper
  // For the dropdown ("system"/"light"/"dark") — needs mapping to actual theme name
  const handleThemeChange = (newTheme: string) => {
    const actualTheme = mapDropdownToTheme(newTheme);
    setTheme(actualTheme);
    setThemeChanged(actualTheme !== DEFAULT_THEME);
  };

  // For palette buttons — theme value is already the actual theme name, no mapping needed
  const handlePaletteChange = (paletteTheme: string) => {
    setTheme(paletteTheme);
    setThemeChanged(paletteTheme !== DEFAULT_THEME);
  };

  // Reset ALL - theme + reader preferences
  const handleResetAll = () => {
    resetToDefaults();
    setTheme(DEFAULT_THEME);
    setThemeChanged(false);
  };

  // Full font list matching desktop
  const fonts: { value: ReaderFont; label: string }[] = [
    { value: 'literata', label: 'Literata' },
    { value: 'atkinson', label: 'Atkinson' },
    { value: 'inter', label: 'Inter' },
    { value: 'georgia', label: 'Georgia' },
    { value: 'merriweather', label: 'Merriweather' },
    { value: 'opendyslexic', label: 'OpenDyslexic' },
    { value: 'system', label: 'System' },
  ];

  const spacingOptions: { value: LineSpacingLevel; Icon: React.FC<{ className?: string }> }[] = [
    { value: 'tight', Icon: SpacingTightIcon },
    { value: 'normal', Icon: SpacingNormalIcon },
    { value: 'relaxed', Icon: SpacingRelaxedIcon },
  ];

  const widthOptions: { value: ContentWidthLevel; Icon: React.FC<{ className?: string }> }[] = [
    { value: 'narrow', Icon: WidthNarrowIcon },
    { value: 'normal', Icon: WidthNormalIcon },
  ];

  // Get display name for current theme
  const getThemeDisplayName = () => {
    if (!mounted) return "...";
    const dropdownVal = mapThemeToDropdown(theme);
    if (dropdownVal === "system") return "Auto";
    if (dropdownVal === "light") return "Light";
    if (dropdownVal === "dark") return "Dark";
    return "Auto";
  };

  return (
    <>
      {/* Style Options row that opens nested drawer */}
      <Card className="overflow-hidden">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          style={{ touchAction: "manipulation" }}
          className={cn(
            "flex items-center justify-between w-full px-4 py-3.5 text-left",
            "min-h-[52px]",
            "transition-all duration-150 active:scale-[0.98] active:opacity-80"
          )}
        >
          <span className="flex items-center gap-3">
            <span className="text-muted-foreground">
              <TextFont className="size-5" />
            </span>
            <span className="font-medium">Style Options</span>
          </span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="text-sm">{getThemeDisplayName()}</span>
            <ChevronRight className="size-4" />
          </span>
        </button>
      </Card>

      {/* Nested Style Options Drawer */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen} nested>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="pb-2">
            <DrawerTitle className="text-center text-lg font-semibold">Style Options</DrawerTitle>
          </DrawerHeader>

          <div className="px-4 pb-[max(2rem,env(safe-area-inset-bottom))] overflow-y-auto space-y-5" data-vaul-no-drag>
            {/* THEME Section */}
            <section className="space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Theme
              </h3>

              {!mounted ? (
                <div className="space-y-3">
                  <Card className="h-[52px] animate-pulse" />
                  <div className="flex gap-2">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="flex-1 h-10 rounded-lg bg-muted animate-pulse" />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Theme dropdown */}
                  <Card className="relative overflow-hidden">
                    <select
                      id="theme-select"
                      aria-label="Select theme"
                      value={mapThemeToDropdown(theme)}
                      onChange={(e) => handleThemeChange(e.target.value)}
                      style={{ touchAction: "manipulation" }}
                      className={cn(
                        "w-full appearance-none px-4 py-3.5 pr-10 text-sm font-medium",
                        "bg-transparent border-0 min-h-[52px]",
                        "focus:outline-none cursor-pointer"
                      )}
                    >
                      <option value="system">Match System</option>
                      <option value="light">Light</option>
                      <option value="dark">Dark</option>
                    </select>
                    <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none rotate-90" />
                  </Card>

                  {/* Palette buttons */}
                  <div className="flex gap-2">
                    {palettes.map((palette) => {
                      const isSelected = selectedPalette === palette.id;
                      return (
                        <button
                          key={palette.id}
                          onClick={() => handlePaletteChange(palette.theme)}
                          style={{ touchAction: "manipulation", ...getPaletteStyle(palette.id, isDark) }}
                          className={cn(
                            "flex-1 py-2.5 px-2 rounded-lg text-xs font-medium transition-all border min-h-[44px]",
                            "active:scale-[0.97]",
                            isDark ? "text-white" : "text-zinc-900",
                            isSelected && "ring-2 ring-ring ring-offset-2 ring-offset-background"
                          )}
                        >
                          {palette.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>

            {/* STYLE Section */}
            <section className="space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Style
              </h3>

              {!hasLoaded ? (
                <div className="space-y-3">
                  <div className="h-[52px] rounded-xl bg-muted animate-pulse" />
                  <div className="h-[52px] rounded-xl bg-muted animate-pulse" />
                  <div className="h-[52px] rounded-xl bg-muted animate-pulse" />
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Font selector row - opens nested drawer */}
                  <Card className="overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setFontDrawerOpen(true)}
                      style={{ touchAction: "manipulation" }}
                      className={cn(
                        "flex items-center justify-between w-full px-4 py-3.5 text-left",
                        "min-h-[52px]",
                        "transition-all duration-150 active:scale-[0.98] active:opacity-80"
                      )}
                    >
                      <span className="text-sm font-medium text-muted-foreground">Font</span>
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <span className="text-sm">{FONT_DISPLAY_NAMES[preferences.font]}</span>
                        <ChevronRight className="size-4" />
                      </span>
                    </button>
                  </Card>

                  {/* Font size and spacing row */}
                  <div className="flex gap-2">
                    {/* Font size stepper */}
                    <Card className="flex-1 flex items-center justify-between px-3 py-2 min-h-[52px]">
                      <span className="text-sm font-medium text-muted-foreground">Size</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={decreaseFontSize}
                          disabled={!canDecreaseFontSize}
                          style={{ touchAction: "manipulation" }}
                          className={cn(
                            "size-9 flex items-center justify-center rounded-lg transition-all",
                            "active:scale-[0.95]",
                            canDecreaseFontSize
                              ? "bg-background text-foreground"
                              : "text-muted-foreground/40"
                          )}
                          aria-label="Decrease font size"
                        >
                          <span className="text-sm font-medium">A</span>
                        </button>
                        <button
                          onClick={increaseFontSize}
                          disabled={!canIncreaseFontSize}
                          style={{ touchAction: "manipulation" }}
                          className={cn(
                            "size-9 flex items-center justify-center rounded-lg transition-all",
                            "active:scale-[0.95]",
                            canIncreaseFontSize
                              ? "bg-background text-foreground"
                              : "text-muted-foreground/40"
                          )}
                          aria-label="Increase font size"
                        >
                          <span className="text-lg font-medium">A</span>
                        </button>
                      </div>
                    </Card>

                    {/* Line spacing selector */}
                    <Card className="flex-1 flex items-center justify-between px-3 py-2 min-h-[52px]">
                      <span className="text-sm font-medium text-muted-foreground">Spacing</span>
                      <div className="flex items-center gap-1">
                        {spacingOptions.map(({ value, Icon }) => {
                          const isSelected = preferences.lineSpacing === value;
                          return (
                            <button
                              key={value}
                              onClick={() => setLineSpacing(value)}
                              style={{ touchAction: "manipulation" }}
                              className={cn(
                                "size-9 flex items-center justify-center rounded-lg transition-all",
                                "active:scale-[0.95]",
                                isSelected
                                  ? "bg-foreground text-background"
                                  : "bg-background text-muted-foreground"
                              )}
                              aria-label={`${value} spacing`}
                            >
                              <Icon className="size-4" />
                            </button>
                          );
                        })}
                      </div>
                    </Card>
                  </div>

                  {/* Width control row */}
                  <Card className="flex items-center justify-between px-3 py-2 min-h-[52px]">
                    <span className="text-sm font-medium text-muted-foreground">Width</span>
                    <div className="flex items-center gap-1">
                      {widthOptions.map(({ value, Icon }) => {
                        const isSelected = preferences.contentWidth === value;
                        return (
                          <button
                            key={value}
                            onClick={() => setContentWidth(value)}
                            style={{ touchAction: "manipulation" }}
                            className={cn(
                              "size-9 flex items-center justify-center rounded-lg transition-all",
                              "active:scale-[0.95]",
                              isSelected
                                ? "bg-foreground text-background"
                                : "bg-background text-muted-foreground"
                            )}
                            aria-label={`${value} width`}
                          >
                            <Icon className="size-4" />
                          </button>
                        );
                      })}
                    </div>
                  </Card>
                </div>
              )}
            </section>

            {/* Reset to default - resets BOTH theme AND preferences */}
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

      {/* Nested Font Drawer - List view */}
      <Drawer open={fontDrawerOpen} onOpenChange={setFontDrawerOpen} nested>
        <DrawerContent className="max-h-[70vh]">
          <DrawerHeader className="pb-2">
            <DrawerTitle className="text-center text-lg font-semibold">Font</DrawerTitle>
          </DrawerHeader>

          <div className="px-4 pb-[max(2rem,env(safe-area-inset-bottom))]" data-vaul-no-drag>
            <Card className="overflow-hidden divide-y divide-border/30">
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
                        isSelected ? "text-foreground font-medium" : "text-foreground/80"
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
            </Card>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}

// Inner component for language selection
function LanguageSectionInner() {
  const locale = useLocale() as Locale;
  const switchLocaleInPlace = useSwitchLocale();
  const [languageDrawerOpen, setLanguageDrawerOpen] = React.useState(false);
  const [selectedLocale, setSelectedLocale] = React.useState<Locale | null>(null);

  // Clear optimistic state once the locale context has caught up
  React.useEffect(() => {
    if (selectedLocale && selectedLocale === locale) {
      setSelectedLocale(null);
    }
  }, [locale, selectedLocale]);

  const switchLocale = React.useCallback((newLocale: Locale) => {
    if (newLocale === locale) return;
    // Optimistic: show checkmark immediately while messages load
    setSelectedLocale(newLocale);
    // Switch locale in context (no navigation — modal stays open)
    switchLocaleInPlace(newLocale);
  }, [locale, switchLocaleInPlace]);

  return (
    <>
      {/* Language row that opens nested drawer */}
      <Card className="overflow-hidden">
        <button
          type="button"
          onClick={() => setLanguageDrawerOpen(true)}
          style={{ touchAction: "manipulation" }}
          className={cn(
            "flex items-center justify-between w-full px-4 py-3.5 text-left",
            "min-h-[52px]",
            "transition-all duration-150 active:scale-[0.98] active:opacity-80"
          )}
        >
          <span className="flex items-center gap-3">
            <span className="text-muted-foreground">
              <LanguageIcon className="size-5" />
            </span>
            <span className="font-medium">Language</span>
          </span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="text-sm">{languageNames[locale]}</span>
            <ChevronRight className="size-4" />
          </span>
        </button>
      </Card>

      {/* Nested Language Drawer - List view */}
      <Drawer open={languageDrawerOpen} onOpenChange={setLanguageDrawerOpen} nested>
        <DrawerContent className="max-h-[70vh]">
          {/* Visible header with title */}
          <DrawerHeader className="pb-2">
            <DrawerTitle className="text-center text-lg font-semibold">Language</DrawerTitle>
          </DrawerHeader>

          <div className="px-4 pb-[max(2rem,env(safe-area-inset-bottom))]" data-vaul-no-drag>
            <Card className="overflow-hidden divide-y divide-border/30">
              {routing.locales.map((loc) => {
                // Show checkmark for current locale OR the newly selected one (during transition)
                const isCurrentLocale = locale === loc;
                const isNewlySelected = selectedLocale === loc;
                const showCheck = isCurrentLocale || isNewlySelected;
                const isHighlighted = isNewlySelected || (isCurrentLocale && !selectedLocale);

                return (
                  <button
                    key={loc}
                    onClick={() => switchLocale(loc)}
                    style={{ touchAction: "manipulation" }}
                    className={cn(
                      "flex items-center justify-between w-full px-4 py-4 text-left",
                      "min-h-[52px]",
                      "transition-all duration-200 active:opacity-70",
                      isNewlySelected && "bg-muted/50" // Highlight new selection
                    )}
                  >
                    <span className={cn(
                      "text-base transition-all duration-200",
                      isHighlighted ? "text-foreground font-medium" : "text-foreground/80"
                    )}>
                      {languageNames[loc]}
                    </span>
                    <div className={cn(
                      "transition-all duration-200",
                      showCheck ? "opacity-100 scale-100" : "opacity-0 scale-75"
                    )}>
                      <Check className="size-5 text-foreground" />
                    </div>
                  </button>
                );
              })}
            </Card>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}

// Language selector
function LanguageSection() {
  return (
    <React.Suspense fallback={
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between w-full px-4 py-3.5 min-h-[52px]">
          <span className="flex items-center gap-3">
            <span className="text-muted-foreground">
              <LanguageIcon className="size-5" />
            </span>
            <span className="font-medium">Language</span>
          </span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="text-sm">...</span>
            <ChevronRight className="size-4" />
          </span>
        </div>
      </Card>
    }>
      <LanguageSectionInner />
    </React.Suspense>
  );
}

// Spacing icons as SVG components
function SpacingTightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="12" viewBox="0 0 16 12" fill="currentColor">
      <rect x="0" y="0" width="16" height="2" rx="1" />
      <rect x="0" y="5" width="16" height="2" rx="1" />
      <rect x="0" y="10" width="16" height="2" rx="1" />
    </svg>
  );
}

function SpacingNormalIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="14" viewBox="0 0 16 14" fill="currentColor">
      <rect x="0" y="0" width="16" height="2" rx="1" />
      <rect x="0" y="6" width="16" height="2" rx="1" />
      <rect x="0" y="12" width="16" height="2" rx="1" />
    </svg>
  );
}

function SpacingRelaxedIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <rect x="0" y="0" width="16" height="2" rx="1" />
      <rect x="0" y="7" width="16" height="2" rx="1" />
      <rect x="0" y="14" width="16" height="2" rx="1" />
    </svg>
  );
}

// Width icons
function WidthNarrowIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="12" viewBox="0 0 14 12" fill="currentColor">
      <rect x="2" y="1" width="10" height="1.5" rx="0.5" />
      <rect x="2" y="5.25" width="10" height="1.5" rx="0.5" />
      <rect x="2" y="9.5" width="10" height="1.5" rx="0.5" />
    </svg>
  );
}

function WidthNormalIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="12" viewBox="0 0 16 12" fill="currentColor">
      <rect x="0" y="1" width="16" height="1.5" rx="0.5" />
      <rect x="0" y="5.25" width="16" height="1.5" rx="0.5" />
      <rect x="0" y="9.5" width="16" height="1.5" rx="0.5" />
    </svg>
  );
}

// Account section (compact)
function AccountSection({ onAction }: { onAction?: () => void }) {
  const { isPremium } = useIsPremium();
  const cardRef = React.useRef<HTMLDivElement>(null);
  const authRedirectUrl = typeof window !== "undefined"
    ? buildUrlWithReturn("/auth/redirect")
    : "/auth/redirect";

  const handleCardClick = () => {
    const btn = cardRef.current?.querySelector<HTMLButtonElement>("button");
    btn?.click();
  };

  return (
    <>
      <SignedIn>
        <div ref={cardRef}>
        <Card
          className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-opacity active:opacity-80"
          style={{ touchAction: "manipulation" }}
          onClick={handleCardClick}
        >
          <UserButton
            appearance={{
              elements: {
                avatarBox: "size-10",
              },
            }}
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Signed in</p>
            {!isPremium && (
              <Link
                href="/pricing"
                className="text-xs text-primary hover:underline"
                onClick={(e) => {
                  e.stopPropagation();
                  onAction?.();
                }}
              >
                Upgrade to Pro
              </Link>
            )}
            {isPremium && (
              <span className="text-xs text-muted-foreground">Pro member</span>
            )}
          </div>
        </Card>
        </div>
      </SignedIn>
      <SignedOut>
        <div className="flex gap-2">
          <SignInButton mode="modal" fallbackRedirectUrl={authRedirectUrl}>
            <button
              style={{ touchAction: "manipulation" }}
              className="flex-1 h-12 flex items-center justify-center gap-2 rounded-xl bg-muted dark:bg-surface-1 text-foreground font-medium text-sm transition-all duration-150 active:scale-[0.98]"
              onClick={() => onAction?.()}
            >
              <User className="size-4" />
              Sign in
            </button>
          </SignInButton>
          <Link
            href="/pricing"
            onClick={() => {
              storeReturnUrl();
              onAction?.();
            }}
            className="flex-1 h-12 flex items-center justify-center gap-2 rounded-xl font-semibold text-sm transition-all active:scale-[0.98]"
            style={{
              background: 'linear-gradient(to bottom, color(display-p3 1 0.88 0.5), color(display-p3 1 0.76 0.18))',
              color: 'color(display-p3 0.15 0.1 0)',
              boxShadow: 'inset 0 0 1px 1px rgba(255,255,255,0.2), 0 0 0 1px color(display-p3 0.96 0.78 0.28), 0 2px 4px rgba(0,0,0,0.08)',
              textShadow: '0 0.5px 0 rgba(255,255,255,0.4)',
            }}
          >
            Get Pro
          </Link>
        </div>
      </SignedOut>
    </>
  );
}

export const SettingsDrawer = React.forwardRef<SettingsDrawerHandle, SettingsDrawerProps>(
  function SettingsDrawer({ viewMode, onViewModeChange, children }, ref) {
    const [open, setOpen] = React.useState(false);

    React.useImperativeHandle(ref, () => ({
      open: () => setOpen(true),
      close: () => setOpen(false),
    }));

    const viewModeOptions = [
      { value: "markdown" as const, label: "Reader", icon: <BookOpen className="size-4" /> },
      { value: "html" as const, label: "Original", icon: <FileText className="size-4" /> },
      { value: "iframe" as const, label: "Frame", icon: <MonitorPlay className="size-4" /> },
    ];

    return (
      <Drawer open={open} onOpenChange={setOpen}>
        {children}
        <DrawerContent className="max-h-[85vh]">
          {/* Visually hidden but accessible header */}
          <DrawerHeader className="sr-only">
            <DrawerTitle>Settings</DrawerTitle>
          </DrawerHeader>

          <div className="px-4 space-y-5 pb-[max(2rem,env(safe-area-inset-bottom))] overflow-y-auto" data-vaul-no-drag>
            {/* READING - View Mode */}
            <section className="space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Reading
              </h3>
              <SegmentedControl
                value={viewMode}
                onChange={onViewModeChange}
                options={viewModeOptions}
              />
            </section>

            {/* PREFERENCES - Style Options + Language */}
            <section className="space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Preferences
              </h3>
              <LanguageSection />
            </section>

            {/* ACCOUNT */}
            <section className="space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Account
              </h3>
              <AccountSection onAction={() => setOpen(false)} />
            </section>

            {/* Support */}
            <Card>
              <SettingsRow
                icon={<FeedbackIcon className="size-5" />}
                label="Send Feedback"
                href="https://smryai.userjot.com/"
                external
                onClick={() => setOpen(false)}
              />
            </Card>
          </div>
        </DrawerContent>
      </Drawer>
    );
  }
);

// Export the trigger for use in parent components
export { DrawerTrigger as SettingsDrawerTrigger };
