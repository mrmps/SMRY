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
  Crown,
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
import { Button } from "@/components/ui/button";

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
    <div
      className={cn(
        "relative flex p-1 bg-muted rounded-xl",
        className
      )}
    >
      {options.map((option) => {
        const isSelected = value === option.value;
        return (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              isSelected
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
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
}: {
  icon: React.ReactNode;
  label: string;
  value?: React.ReactNode;
  onClick?: () => void;
  href?: string;
  external?: boolean;
  className?: string;
}) {
  const content = (
    <>
      <span className="flex items-center gap-3">
        <span className="text-muted-foreground">{icon}</span>
        <span className="font-medium">{label}</span>
      </span>
      <span className="flex items-center gap-1 text-muted-foreground">
        {value && <span className="text-sm">{value}</span>}
        <ChevronRight className="size-4" />
      </span>
    </>
  );

  const baseClass = cn(
    "flex items-center justify-between w-full px-4 py-3.5 text-left",
    "transition-colors hover:bg-muted/50 active:bg-muted",
    "first:rounded-t-xl last:rounded-b-xl",
    className
  );

  if (href) {
    if (external) {
      return (
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
    return (
      <Link href={href} className={baseClass} onClick={onClick}>
        {content}
      </Link>
    );
  }

  return (
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
        <DrawerHeader className="border-b border-border pb-3">
          <DrawerTitle>Language</DrawerTitle>
        </DrawerHeader>
        <div className="p-2">
          {routing.locales.map((loc) => (
            <button
              key={loc}
              onClick={() => switchLocale(loc)}
              className={cn(
                "flex items-center justify-between w-full px-4 py-3.5 rounded-xl",
                "transition-colors hover:bg-muted/50 active:bg-muted",
                locale === loc && "bg-primary/5"
              )}
            >
              <span className="font-medium">{languageNames[loc]}</span>
              {locale === loc && (
                <Check className="size-5 text-primary" />
              )}
            </button>
          ))}
        </div>
        <div className="p-4 pt-2">
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

// Compact theme picker with icons
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
            className="flex-1 h-11 rounded-xl bg-muted animate-pulse"
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
              "flex-1 flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl",
              "transition-all duration-200",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isSelected
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
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
        <div className="flex items-center gap-3 px-4 py-3 bg-muted/30 rounded-xl">
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
        </div>
      </SignedIn>
      <SignedOut>
        <div className="flex gap-2">
          <SignInButton mode="modal" fallbackRedirectUrl="/">
            <Button
              variant="outline"
              className="flex-1 h-12 gap-2"
              onClick={() => {
                storeReturnUrl();
                onAction?.();
              }}
            >
              <User className="size-4" />
              Sign in
            </Button>
          </SignInButton>
          <Link
            href="/pricing"
            onClick={() => {
              storeReturnUrl();
              onAction?.();
            }}
            className="flex-1"
          >
            <Button className="w-full h-12 gap-2">
              <Crown className="size-4" />
              Get Pro
            </Button>
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
          {/* Reading Section - Most frequently used */}
          <section className="space-y-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
              Reading
            </h3>

            {/* View Mode */}
            <div className="space-y-2">
              <SegmentedControl
                value={viewMode}
                onChange={onViewModeChange}
                options={viewModeOptions}
              />
            </div>

            {/* Theme */}
            <div className="space-y-2">
              <ThemePicker />
            </div>
          </section>

          {/* Preferences Section */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
              Preferences
            </h3>

            <div className="bg-muted/30 rounded-xl divide-y divide-border/50">
              <SettingsRow
                icon={<LanguageIcon className="size-5" />}
                label="Language"
                value={languageNames[locale]}
                onClick={() => setLanguageOpen(true)}
              />
            </div>
          </section>

          {/* Account Section */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
              Account
            </h3>
            <AccountSection onAction={() => onOpenChange(false)} />
          </section>

          {/* Support Section */}
          <section className="space-y-3">
            <div className="bg-muted/30 rounded-xl">
              <SettingsRow
                icon={<FeedbackIcon className="size-5" />}
                label="Send Feedback"
                href="https://smryai.userjot.com/"
                external
                onClick={() => onOpenChange(false)}
              />
            </div>
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
