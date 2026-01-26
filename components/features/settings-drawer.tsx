"use client";

import * as React from "react";
import Link from "next/link";
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
  Sun,
  Moon,
  Laptop,
  ChevronRight,
  Check,
  User,
  BookOpen,
  FileText,
  MonitorPlay,
} from "lucide-react";
import { LanguageIcon, FeedbackIcon } from "@/components/ui/custom-icons";

import { cn } from "@/lib/utils";
import { useIsPremium } from "@/lib/hooks/use-is-premium";
import { storeReturnUrl } from "@/lib/hooks/use-return-url";
import { routing, type Locale } from "@/i18n/routing";
import { useRouter, usePathname } from "@/i18n/navigation";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

type ViewMode = "markdown" | "html" | "iframe";

const languageNames: Record<Locale, string> = {
  en: "English",
  pt: "Português",
  de: "Deutsch",
  zh: "中文",
  es: "Español",
  nl: "Nederlands",
};

interface SettingsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  children?: React.ReactNode;
}

// Native iOS-style card container
function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("bg-muted rounded-xl", className)}>
      {children}
    </div>
  );
}

// Segmented control component for native feel
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
    <Card className={cn("flex p-1 gap-1", className)}>
      {options.map((option) => {
        const isSelected = value === option.value;
        return (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium rounded-lg transition-all",
              "focus-visible:outline-none",
              isSelected
                ? "bg-white text-[color(display-p3_0.13_0.13_0.14)] shadow-sm dark:bg-[color(display-p3_0.32_0.33_0.36)] dark:text-white"
                : "text-muted-foreground active:opacity-70"
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
    "transition-opacity active:opacity-70",
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

// Language selection sub-drawer
function LanguageDrawer({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect?: () => void;
}) {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const rawPathname = usePathname();
  const searchParams = useSearchParams();

  const switchLocale = (newLocale: Locale) => {
    const currentPath = rawPathname;
    const queryString = searchParams.toString();
    const pathWithQuery = queryString ? `${currentPath}?${queryString}` : currentPath;
    router.replace(pathWithQuery, { locale: newLocale });
    onSelect?.();
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} nested>
      <DrawerContent>
        <DrawerHeader className="pb-2">
          <DrawerTitle className="text-center">Language</DrawerTitle>
        </DrawerHeader>
        <div className="px-4 pb-4">
          <Card>
            {routing.locales.map((loc, index) => (
              <div key={loc} className="relative">
                <button
                  onClick={() => switchLocale(loc)}
                  className="flex items-center justify-between w-full px-4 py-3.5 text-left transition-opacity active:opacity-70"
                >
                  <span className="font-medium">{languageNames[loc]}</span>
                  {locale === loc && (
                    <Check className="size-5 text-primary" />
                  )}
                </button>
                {index < routing.locales.length - 1 && (
                  <div className="absolute bottom-0 left-4 right-0 h-px bg-border/50" />
                )}
              </div>
            ))}
          </Card>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

// Theme picker with card-like buttons
function ThemePicker({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className={cn("flex gap-2", className)}>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex-1 h-[68px] rounded-xl bg-muted animate-pulse"
          />
        ))}
      </div>
    );
  }

  const options = [
    { value: "light", icon: Sun, label: "Light" },
    { value: "dark", icon: Moon, label: "Dark" },
    { value: "system", icon: Laptop, label: "Auto" },
  ] as const;

  return (
    <div className={cn("flex gap-2", className)}>
      {options.map((option) => {
        const Icon = option.icon;
        const isSelected = theme === option.value;
        return (
          <button
            key={option.value}
            onClick={() => setTheme(option.value)}
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-1.5 py-4 rounded-xl transition-all",
              "focus-visible:outline-none",
              isSelected
                ? "bg-white text-[color(display-p3_0.13_0.13_0.14)] shadow-sm dark:bg-[color(display-p3_0.32_0.33_0.36)] dark:text-white"
                : "bg-muted text-muted-foreground active:opacity-70"
            )}
          >
            <Icon className="size-5" />
            <span className="text-xs font-medium">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// Account section that adapts to auth state
function AccountSection({ onAction }: { onAction?: () => void }) {
  const isPremium = useIsPremium();

  return (
    <>
      <SignedIn>
        <Card className="flex items-center gap-3 px-4 py-3">
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
                onClick={onAction}
              >
                Upgrade to Pro
              </Link>
            )}
            {isPremium && (
              <span className="text-xs text-muted-foreground">Pro member</span>
            )}
          </div>
        </Card>
      </SignedIn>
      <SignedOut>
        <div className="flex gap-2">
          <SignInButton mode="modal" fallbackRedirectUrl="/">
            <button
              className="flex-1 h-12 flex items-center justify-center gap-2 rounded-xl bg-muted text-foreground font-medium text-sm transition-opacity active:opacity-70"
              onClick={() => {
                storeReturnUrl();
                onAction?.();
              }}
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

export function SettingsDrawer({
  open,
  onOpenChange,
  viewMode,
  onViewModeChange,
  children,
}: SettingsDrawerProps) {
  const locale = useLocale() as Locale;
  const [languageOpen, setLanguageOpen] = React.useState(false);

  const viewModeOptions = [
    { value: "markdown" as const, label: "Reader", icon: <BookOpen className="size-4" /> },
    { value: "html" as const, label: "Original", icon: <FileText className="size-4" /> },
    { value: "iframe" as const, label: "Frame", icon: <MonitorPlay className="size-4" /> },
  ];

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      {children}
      <DrawerContent className="max-h-[85vh]">
        {/* Visually hidden but accessible header */}
        <DrawerHeader className="sr-only">
          <DrawerTitle>Settings</DrawerTitle>
        </DrawerHeader>

        <div className="px-4 pt-2 pb-8 space-y-6 overflow-y-auto">
          {/* Reading Section */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Reading
            </h3>

            {/* View Mode */}
            <SegmentedControl
              value={viewMode}
              onChange={onViewModeChange}
              options={viewModeOptions}
            />

            {/* Theme */}
            <ThemePicker />
          </section>

          {/* Preferences Section */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Preferences
            </h3>

            <Card>
              <SettingsRow
                icon={<LanguageIcon className="size-5" />}
                label="Language"
                value={languageNames[locale]}
                onClick={() => setLanguageOpen(true)}
              />
            </Card>
          </section>

          {/* Account Section */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Account
            </h3>
            <AccountSection onAction={() => onOpenChange(false)} />
          </section>

          {/* Support Section */}
          <section>
            <Card>
              <SettingsRow
                icon={<FeedbackIcon className="size-5" />}
                label="Send Feedback"
                href="https://smryai.userjot.com/"
                external
                onClick={() => onOpenChange(false)}
              />
            </Card>
          </section>
        </div>

        {/* Language Sub-drawer */}
        <LanguageDrawer
          open={languageOpen}
          onOpenChange={setLanguageOpen}
          onSelect={() => {
            setLanguageOpen(false);
          }}
        />
      </DrawerContent>
    </Drawer>
  );
}

// Export the trigger for use in parent components
export { DrawerTrigger as SettingsDrawerTrigger };
