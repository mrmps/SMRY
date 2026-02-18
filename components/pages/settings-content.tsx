"use client";

import * as React from "react";
import { Link, useRouter, usePathname } from "@/i18n/navigation";
import { useLocale } from "next-intl";
import { useTheme } from "next-themes";
import { useSearchParams } from "next/navigation";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
} from "@clerk/nextjs";
import {
  ArrowLeft,
  User,
  Check,
  ChevronRight,
  Crown,
} from "@/components/ui/icons";
import { LanguageIcon, FeedbackIcon } from "@/components/ui/custom-icons";
import { cn } from "@/lib/utils";
import { useIsPremium } from "@/lib/hooks/use-is-premium";
import { useReaderPreferences } from "@/lib/hooks/use-reader-preferences";
import { buildUrlWithReturn, storeReturnUrl } from "@/lib/hooks/use-return-url";
import { routing, languageNames, type Locale } from "@/i18n/routing";
import {
  type ReaderFont,
  type LineSpacingLevel,
  type ContentWidthLevel,
  FONT_DISPLAY_NAMES,
  FONT_DESCRIPTIONS,
} from "@/types/reader-preferences";
import { THEME_OPTIONS } from "@/lib/theme-config";
// =============================================================================
// SIDEBAR NAVIGATION
// =============================================================================

type SettingsSection = "appearance" | "typography" | "language" | "account" | "support";

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  section: SettingsSection;
  activeSection: SettingsSection;
  onClick: (section: SettingsSection) => void;
}

function NavItem({ icon, label, section, activeSection, onClick }: NavItemProps) {
  const isActive = activeSection === section;
  return (
    <button
      onClick={() => onClick(section)}
      className={cn(
        "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-left transition-all",
        "hover:bg-accent/50",
        isActive
          ? "bg-accent text-foreground font-medium"
          : "text-muted-foreground"
      )}
    >
      <span className="flex-shrink-0">{icon}</span>
      <span className="text-sm">{label}</span>
    </button>
  );
}

function SettingsSidebar({
  activeSection,
  onSectionChange,
}: {
  activeSection: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
}) {
  return (
    <nav className="space-y-1">
      <NavItem
        icon={<PaletteIcon className="size-5" />}
        label="Appearance"
        section="appearance"
        activeSection={activeSection}
        onClick={onSectionChange}
      />
      <NavItem
        icon={<TypographyIcon className="size-5" />}
        label="Typography"
        section="typography"
        activeSection={activeSection}
        onClick={onSectionChange}
      />
      <NavItem
        icon={<LanguageIcon className="size-5" />}
        label="Language"
        section="language"
        activeSection={activeSection}
        onClick={onSectionChange}
      />
      <NavItem
        icon={<User className="size-5" />}
        label="Account"
        section="account"
        activeSection={activeSection}
        onClick={onSectionChange}
      />
      <NavItem
        icon={<FeedbackIcon className="size-5" />}
        label="Support"
        section="support"
        activeSection={activeSection}
        onClick={onSectionChange}
      />
    </nav>
  );
}

// =============================================================================
// ICONS
// =============================================================================

function PaletteIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="8" r="2" fill="currentColor" />
      <circle cx="8" cy="14" r="2" fill="currentColor" />
      <circle cx="16" cy="14" r="2" fill="currentColor" />
    </svg>
  );
}

function TypographyIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M4 20h3" />
      <path d="M5.5 20V8h3" />
      <path d="M8.5 13H5.5" />
      <path d="M13 20l3-8 3 8" />
      <path d="M14.5 17h5" />
    </svg>
  );
}

// =============================================================================
// SETTING ROW COMPONENTS
// =============================================================================

function SettingCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("bg-card border border-border rounded-xl p-4", className)}>
      {children}
    </div>
  );
}

function SettingRow({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-4 py-3", className)}>
      <div className="flex items-start gap-3 min-w-0">
        {icon && (
          <div className="flex-shrink-0 p-2 rounded-lg bg-muted">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{title}</p>
          {description && (
            <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
      </div>
      <div className="flex-shrink-0">{action}</div>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h2 className="text-lg font-semibold text-foreground mb-4">{title}</h2>
  );
}

// =============================================================================
// THEME SELECTOR
// =============================================================================

function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {THEME_OPTIONS.map((option) => {
        const isSelected = theme === option.value;
        return (
          <button
            key={option.value}
            onClick={() => setTheme(option.value)}
            className={cn(
              "relative flex flex-col rounded-xl border-2 p-3 text-left transition-all",
              "hover:border-primary/50",
              isSelected
                ? "border-primary bg-primary/5"
                : "border-border bg-card"
            )}
          >
            {/* Theme Preview */}
            <div
              className="w-full h-10 rounded-lg mb-2 border border-border/50"
              style={{ background: option.preview.bg }}
            >
              <div className="flex items-center justify-center h-full gap-1">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: option.preview.accent }}
                />
                <div
                  className="w-8 h-1 rounded-full opacity-60"
                  style={{ backgroundColor: option.preview.text }}
                />
              </div>
            </div>

            {/* Label */}
            <span className="text-xs font-medium truncate">{option.label}</span>

            {/* Checkmark */}
            {isSelected && (
              <div className="absolute top-2 right-2">
                <Check className="size-4 text-primary" />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

// =============================================================================
// TYPOGRAPHY SETTINGS
// =============================================================================

function FontSelector({
  currentFont,
  onSelectFont,
}: {
  currentFont: ReaderFont;
  onSelectFont: (font: ReaderFont) => void;
}) {
  const fonts: ReaderFont[] = [
    'literata',
    'atkinson',
    'inter',
    'system',
    'georgia',
    'merriweather',
    'opendyslexic',
  ];

  const getFontPreviewStyle = (font: ReaderFont): React.CSSProperties => {
    const families: Record<ReaderFont, string> = {
      literata: 'var(--font-literata), Georgia, serif',
      atkinson: 'var(--font-atkinson), system-ui, sans-serif',
      inter: 'var(--font-geist-sans), Inter, system-ui, sans-serif',
      system: 'system-ui, -apple-system, sans-serif',
      opendyslexic: '"OpenDyslexic", Comic Sans MS, sans-serif',
      georgia: 'Georgia, "Times New Roman", serif',
      merriweather: 'var(--font-merriweather), Georgia, serif',
    };
    return { fontFamily: families[font] };
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {fonts.map((font) => {
        const isSelected = currentFont === font;
        return (
          <button
            key={font}
            onClick={() => onSelectFont(font)}
            className={cn(
              "relative flex items-center justify-between px-4 py-3 rounded-lg border transition-all text-left",
              isSelected
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50"
            )}
          >
            <div className="min-w-0">
              <span
                className="block text-sm font-medium truncate"
                style={getFontPreviewStyle(font)}
              >
                {FONT_DISPLAY_NAMES[font]}
              </span>
              <span className="text-xs text-muted-foreground">
                {FONT_DESCRIPTIONS[font]}
              </span>
            </div>
            {isSelected && <Check className="size-4 text-primary flex-shrink-0 ml-2" />}
          </button>
        );
      })}
    </div>
  );
}

function FontSizeSlider({
  currentSize,
  canDecrease,
  canIncrease,
  onDecrease,
  onIncrease,
}: {
  currentSize: number;
  canDecrease: boolean;
  canIncrease: boolean;
  onDecrease: () => void;
  onIncrease: () => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={onDecrease}
        disabled={!canDecrease}
        className={cn(
          "flex items-center justify-center w-10 h-10 rounded-lg border transition-all",
          canDecrease
            ? "border-border hover:bg-accent text-foreground"
            : "border-border/50 text-muted-foreground cursor-not-allowed"
        )}
        aria-label="Decrease font size"
      >
        <span className="text-sm font-medium">A</span>
      </button>

      <div className="flex items-center justify-center min-w-[60px] px-3 py-2 rounded-lg bg-muted">
        <span className="text-sm font-semibold tabular-nums">{currentSize}px</span>
      </div>

      <button
        onClick={onIncrease}
        disabled={!canIncrease}
        className={cn(
          "flex items-center justify-center w-10 h-10 rounded-lg border transition-all",
          canIncrease
            ? "border-border hover:bg-accent text-foreground"
            : "border-border/50 text-muted-foreground cursor-not-allowed"
        )}
        aria-label="Increase font size"
      >
        <span className="text-lg font-medium">A</span>
      </button>
    </div>
  );
}

function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="inline-flex bg-muted rounded-lg p-1 gap-1">
      {options.map((option) => {
        const isSelected = value === option.value;
        return (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-md transition-all",
              isSelected
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

// =============================================================================
// LANGUAGE SETTINGS
// =============================================================================

function LanguageSelector() {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const rawPathname = usePathname();
  const searchParams = useSearchParams();

  const switchLocale = (newLocale: Locale) => {
    const currentPath = rawPathname;
    const queryString = searchParams.toString();
    const pathWithQuery = queryString ? `${currentPath}?${queryString}` : currentPath;
    router.replace(pathWithQuery, { locale: newLocale });
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
      {routing.locales.map((loc) => {
        const isSelected = locale === loc;
        return (
          <button
            key={loc}
            onClick={() => switchLocale(loc)}
            className={cn(
              "relative flex items-center justify-between px-4 py-3 rounded-lg border transition-all",
              isSelected
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50"
            )}
          >
            <span className="text-sm font-medium">{languageNames[loc]}</span>
            {isSelected && <Check className="size-4 text-primary" />}
          </button>
        );
      })}
    </div>
  );
}

// =============================================================================
// ACCOUNT SECTION
// =============================================================================

function AccountSection() {
  const { isPremium } = useIsPremium();
  const authRedirectUrl = typeof window !== "undefined"
    ? buildUrlWithReturn("/auth/redirect")
    : "/auth/redirect";

  return (
    <div className="space-y-4">
      <SignedIn>
        <SettingCard>
          <div className="flex items-center gap-4">
            <UserButton
              appearance={{
                elements: {
                  avatarBox: "size-12",
                },
              }}
            />
            <div className="flex-1 min-w-0">
              <p className="font-medium">Signed in</p>
              {isPremium ? (
                <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Crown className="size-4 text-amber-500" />
                  Pro member
                </span>
              ) : (
                <Link
                  href="/pricing"
                  className="text-sm text-primary hover:underline"
                >
                  Upgrade to Pro
                </Link>
              )}
            </div>
          </div>
        </SettingCard>

        {!isPremium && (
          <SettingCard className="border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-transparent">
            <SettingRow
              icon={<Crown className="size-5 text-amber-500" />}
              title="Upgrade to Pro"
              description="Unlimited summaries, no ads, and more features"
              action={
                <Link
                  href="/pricing"
                  onClick={() => storeReturnUrl()}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all"
                  style={{
                    background: 'linear-gradient(to bottom, color(display-p3 1 0.88 0.5), color(display-p3 1 0.76 0.18))',
                    color: 'color(display-p3 0.15 0.1 0)',
                  }}
                >
                  Get Pro
                  <ChevronRight className="size-4" />
                </Link>
              }
            />
          </SettingCard>
        )}
      </SignedIn>

      <SignedOut>
        <SettingCard>
          <SettingRow
            icon={<User className="size-5" />}
            title="Sign in"
            description="Save your preferences and unlock Pro features"
            action={
              <SignInButton mode="modal" fallbackRedirectUrl={authRedirectUrl}>
                <button className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:opacity-90 transition-opacity">
                  Sign in
                  <ChevronRight className="size-4" />
                </button>
              </SignInButton>
            }
          />
        </SettingCard>

        <SettingCard className="border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-transparent">
          <SettingRow
            icon={<Crown className="size-5 text-amber-500" />}
            title="Get Pro"
            description="Unlimited summaries, no ads, and more features"
            action={
              <Link
                href="/pricing"
                onClick={() => storeReturnUrl()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all"
                style={{
                  background: 'linear-gradient(to bottom, color(display-p3 1 0.88 0.5), color(display-p3 1 0.76 0.18))',
                  color: 'color(display-p3 0.15 0.1 0)',
                }}
              >
                Get Pro
                <ChevronRight className="size-4" />
              </Link>
            }
          />
        </SettingCard>
      </SignedOut>
    </div>
  );
}

// =============================================================================
// SUPPORT SECTION
// =============================================================================

function SupportSection() {
  return (
    <div className="space-y-4">
      <SettingCard>
        <SettingRow
          icon={<FeedbackIcon className="size-5" />}
          title="Send Feedback"
          description="Help us improve SMRY with your suggestions"
          action={
            <a
              href="https://smryai.userjot.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-muted hover:bg-accent rounded-lg font-medium text-sm transition-colors"
            >
              Open
              <ChevronRight className="size-4" />
            </a>
          }
        />
      </SettingCard>
    </div>
  );
}

// =============================================================================
// MAIN SETTINGS CONTENT
// =============================================================================

export function SettingsContent() {
  const [activeSection, setActiveSection] = React.useState<SettingsSection>("appearance");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = React.useState(false);

  const {
    preferences,
    hasLoaded,
    hasCustomPreferences,
    currentFontSize,
    setFont,
    increaseFontSize,
    decreaseFontSize,
    canIncreaseFontSize,
    canDecreaseFontSize,
    setLineSpacing,
    setContentWidth,
    resetToDefaults,
  } = useReaderPreferences();

  const lineSpacingOptions: { value: LineSpacingLevel; label: string }[] = [
    { value: "tight", label: "Tight" },
    { value: "normal", label: "Normal" },
    { value: "relaxed", label: "Relaxed" },
  ];

  const contentWidthOptions: { value: ContentWidthLevel; label: string }[] = [
    { value: "narrow", label: "Narrow" },
    { value: "normal", label: "Normal" },
  ];

  const renderContent = () => {
    switch (activeSection) {
      case "appearance":
        return (
          <div className="space-y-6">
            <div>
              <SectionHeader title="Appearance" />
              <p className="text-sm text-muted-foreground mb-4">
                Select your preferred color scheme
              </p>
              <ThemeSelector />
            </div>
          </div>
        );

      case "typography":
        return (
          <div className="space-y-6">
            <SectionHeader title="Typography" />

            {/* Font Selection */}
            <div>
              <h3 className="text-sm font-medium mb-3">Font</h3>
              {hasLoaded && (
                <FontSelector
                  currentFont={preferences.font}
                  onSelectFont={setFont}
                />
              )}
            </div>

            {/* Font Size */}
            <div>
              <h3 className="text-sm font-medium mb-3">Font Size</h3>
              {hasLoaded && (
                <FontSizeSlider
                  currentSize={currentFontSize}
                  canDecrease={canDecreaseFontSize}
                  canIncrease={canIncreaseFontSize}
                  onDecrease={decreaseFontSize}
                  onIncrease={increaseFontSize}
                />
              )}
            </div>

            {/* Line Spacing */}
            <div>
              <h3 className="text-sm font-medium mb-3">Line Spacing</h3>
              {hasLoaded && (
                <SegmentedControl
                  value={preferences.lineSpacing}
                  onChange={setLineSpacing}
                  options={lineSpacingOptions}
                />
              )}
            </div>

            {/* Content Width */}
            <div>
              <h3 className="text-sm font-medium mb-3">Content Width</h3>
              {hasLoaded && (
                <SegmentedControl
                  value={preferences.contentWidth}
                  onChange={setContentWidth}
                  options={contentWidthOptions}
                />
              )}
            </div>

            {/* Reset */}
            {hasLoaded && hasCustomPreferences && (
              <div className="pt-2">
                <button
                  onClick={resetToDefaults}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors underline"
                >
                  Reset to defaults
                </button>
              </div>
            )}
          </div>
        );

      case "language":
        return (
          <div className="space-y-6">
            <div>
              <SectionHeader title="Language" />
              <p className="text-sm text-muted-foreground mb-4">
                Select your preferred interface language
              </p>
              <LanguageSelector />
            </div>
          </div>
        );

      case "account":
        return (
          <div className="space-y-6">
            <SectionHeader title="Account" />
            <AccountSection />
          </div>
        );

      case "support":
        return (
          <div className="space-y-6">
            <SectionHeader title="Support" />
            <SupportSection />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-5" />
            <span className="sr-only">Back</span>
          </Link>
          <h1 className="text-lg font-semibold">Settings</h1>

          {/* Mobile section selector */}
          <button
            onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
            className="ml-auto md:hidden flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted text-sm"
          >
            {activeSection.charAt(0).toUpperCase() + activeSection.slice(1)}
            <ChevronRight className={cn("size-4 transition-transform", isMobileSidebarOpen && "rotate-90")} />
          </button>
        </div>
      </header>

      {/* Mobile Navigation Dropdown */}
      {isMobileSidebarOpen && (
        <div className="md:hidden border-b border-border bg-background px-4 py-3">
          <SettingsSidebar
            activeSection={activeSection}
            onSectionChange={(section) => {
              setActiveSection(section);
              setIsMobileSidebarOpen(false);
            }}
          />
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex gap-8">
          {/* Desktop Sidebar */}
          <aside className="hidden md:block w-56 flex-shrink-0">
            <div className="sticky top-20">
              <SettingsSidebar
                activeSection={activeSection}
                onSectionChange={setActiveSection}
              />
            </div>
          </aside>

          {/* Content Area */}
          <main className="flex-1 min-w-0 max-w-2xl">
            {renderContent()}
          </main>
        </div>
      </div>
    </div>
  );
}
