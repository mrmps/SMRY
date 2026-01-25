"use client";

import { useSyncExternalStore, useState, useRef, useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, Link } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { useTheme } from "next-themes";
import {
  Search,
  MessageCircle,
  ChevronRight,
  History,
  CreditCard,
  Sun,
  Moon,
  Monitor,
  Check,
  Crown,
  BookOpen,
  Zap,
  Globe,
  ArrowUpRight,
} from "lucide-react";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
  useAuth,
} from "@clerk/nextjs";
import { storeReturnUrl } from "@/lib/hooks/use-return-url";
import {
  Popover,
  PopoverTrigger,
  PopoverPopup,
} from "@/components/ui/popover";
import { stripLocaleFromPathname } from "@/lib/i18n-pathname";
import { cn } from "@/lib/utils";

const emptySubscribe = () => () => {};

function useIsClient() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

const languageNames: Record<Locale, string> = {
  en: "English",
  pt: "Português",
  de: "Deutsch",
  zh: "中文",
  es: "Español",
  nl: "Nederlands",
};

// ============================================================================
// Language Popover (separate button)
// ============================================================================

function LanguagePopover() {
  const locale = useLocale() as Locale;
  const rawPathname = usePathname();

  // Normalize pathname because next-intl occasionally leaves the previous locale prefix in place
  const pathname = stripLocaleFromPathname(rawPathname);

  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          "flex items-center justify-center size-8 rounded-full",
          "bg-muted border border-border",
          "text-muted-foreground hover:text-foreground hover:bg-accent",
          "shadow-sm transition-all duration-150"
        )}
        aria-label="Language"
      >
        <Globe className="size-3.5" strokeWidth={1.5} />
      </PopoverTrigger>
      <PopoverPopup
        side="top"
        align="end"
        sideOffset={8}
        className="w-44 rounded-lg bg-popover border-border"
        contentClassName="p-1"
      >
        <div className="space-y-0.5">
          {routing.locales.map((loc) => (
            <Link
              key={loc}
              href={pathname}
              locale={loc}
              className={cn(
                "flex items-center justify-between rounded px-2.5 py-1.5 text-[13px] transition-colors",
                locale === loc
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <span>{languageNames[loc]}</span>
              {locale === loc && <Check className="size-3.5 text-muted-foreground" />}
            </Link>
          ))}
        </div>
      </PopoverPopup>
    </Popover>
  );
}

// ============================================================================
// Help Popover Components
// ============================================================================

function MenuItem({
  icon: Icon,
  label,
  shortcut,
  href,
  external,
  onClick,
  hasSubmenu,
  isActive,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  shortcut?: string;
  href?: string;
  external?: boolean;
  onClick?: () => void;
  hasSubmenu?: boolean;
  isActive?: boolean;
}) {
  const className = cn(
    "flex w-full items-center gap-2.5 rounded px-2.5 py-2 text-[13px] transition-colors",
    isActive
      ? "bg-accent text-foreground"
      : "text-foreground/80 hover:bg-accent hover:text-foreground"
  );

  const content = (
    <>
      <Icon className="size-4 text-muted-foreground/70" />
      <span className="flex-1">{label}</span>
      {shortcut && (
        <span className="text-[11px] text-muted-foreground/50 tracking-wide">
          {shortcut}
        </span>
      )}
      {external && <ArrowUpRight className="size-3.5 text-muted-foreground/50" />}
      {hasSubmenu && <ChevronRight className="size-3.5 text-muted-foreground/50" />}
    </>
  );

  if (href && external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {content}
      </a>
    );
  }

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <button onClick={onClick} className={className}>
      {content}
    </button>
  );
}

function WhatsNewItem({
  children,
  href,
  isNew,
}: {
  children: React.ReactNode;
  href?: string;
  isNew?: boolean;
}) {
  const Wrapper = href ? "a" : "div";
  const wrapperProps = href
    ? { href, target: "_blank", rel: "noopener noreferrer" }
    : {};

  return (
    <Wrapper
      {...wrapperProps}
      className={cn(
        "flex items-start gap-2 py-1 text-[13px]",
        href && "hover:text-foreground cursor-pointer"
      )}
    >
      <div
        className={cn(
          "mt-[7px] size-[5px] rounded-full shrink-0",
          isNew ? "bg-blue-400" : "bg-muted-foreground/50"
        )}
      />
      <span className="text-muted-foreground leading-snug">{children}</span>
      {href && <ArrowUpRight className="size-3 text-muted-foreground/50 mt-0.5 shrink-0" />}
    </Wrapper>
  );
}

function ThemeSubmenu() {
  const { theme, setTheme } = useTheme();
  const t = useTranslations("nav");

  const themes = [
    { id: "light", icon: Sun, label: t("light") },
    { id: "dark", icon: Moon, label: t("dark") },
    { id: "system", icon: Monitor, label: t("system") },
  ];

  // Get current theme icon
  const currentIcon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;

  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          "flex w-full items-center gap-2.5 rounded px-2.5 py-2 text-[13px] transition-colors",
          "text-foreground/80 hover:bg-accent hover:text-foreground"
        )}
      >
        {(() => {
          const Icon = currentIcon;
          return <Icon className="size-4 text-muted-foreground/70" />;
        })()}
        <span className="flex-1 text-left">{t("theme")}</span>
        <ChevronRight className="size-3.5 text-muted-foreground/50" />
      </PopoverTrigger>
      <PopoverPopup
        side="left"
        align="end"
        sideOffset={8}
        className="w-40 rounded-lg bg-popover border-border"
        contentClassName="p-1.5"
      >
        {themes.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setTheme(id)}
            className={cn(
              "flex w-full items-center gap-2 rounded px-2 py-1.5 text-[13px] transition-colors",
              theme === id
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <Icon className="size-3.5 text-muted-foreground/70" />
            <span className="flex-1 text-left">{label}</span>
            {theme === id && <Check className="size-3 text-muted-foreground/70" />}
          </button>
        ))}
      </PopoverPopup>
    </Popover>
  );
}

function HelpPopoverContent() {
  const t = useTranslations("nav");
  const isClient = useIsClient();
  const { has, isLoaded } = useAuth();
  const isPremium = isLoaded && (has?.({ plan: "premium" }) ?? false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => searchRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, []);

  const query = searchQuery.toLowerCase().trim();

  const menuItems = [
    { icon: MessageCircle, label: "Contact us", href: "https://smryai.userjot.com/", external: true },
    { icon: BookOpen, label: t("getStarted"), href: "/guide" },
    { icon: History, label: t("history"), href: "/history", shortcut: "G H" },
    { icon: CreditCard, label: t("pricing"), href: "/pricing" },
  ];

  const whatsNewItems = [
    { text: "Improved history with keyboard nav", isNew: true },
    { text: "Multiple view modes for history" },
    { text: "Full changelog", href: "/changelog" },
  ];

  const filteredMenuItems = query
    ? menuItems.filter((item) => item.label.toLowerCase().includes(query))
    : menuItems;

  const filteredWhatsNew = query
    ? whatsNewItems.filter((item) => item.text.toLowerCase().includes(query))
    : whatsNewItems;

  const showTheme = !query || "theme".includes(query);
  const showWhatsNew = filteredWhatsNew.length > 0;

  return (
    <div className="relative">
      {/* Search */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <Search className="size-4 text-muted-foreground/70" />
        <input
          ref={searchRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search for help..."
          className="flex-1 bg-transparent text-[13px] text-foreground/80 outline-none placeholder:text-muted-foreground/50"
        />
      </div>

      {/* Menu */}
      {(filteredMenuItems.length > 0 || showTheme) && (
        <div className="p-1.5">
          {filteredMenuItems.map((item) => (
            <MenuItem
              key={item.label}
              icon={item.icon}
              label={item.label}
              href={item.href}
              external={item.external}
              shortcut={item.shortcut}
            />
          ))}
          {showTheme && <ThemeSubmenu />}
        </div>
      )}

      {/* Divider */}
      {showWhatsNew && <div className="mx-2.5 border-t border-border" />}

      {/* What's new */}
      {showWhatsNew && (
        <div className="px-2.5 pt-2 pb-1">
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/50 mb-1.5">
            What&apos;s new
          </div>
          {filteredWhatsNew.map((item) => (
            <WhatsNewItem key={item.text} isNew={item.isNew} href={item.href}>
              {item.text}
            </WhatsNewItem>
          ))}
        </div>
      )}

      {/* Bottom bar */}
      <div className="flex items-center gap-2 border-t border-border px-2.5 py-2 mt-1">
        {isClient && (
          <>
            <SignedOut>
              <SignInButton mode="modal" fallbackRedirectUrl="/">
                <button
                  onClick={() => storeReturnUrl()}
                  className="flex items-center gap-1.5 rounded-full border border-border bg-accent px-2.5 py-1 text-[11px] font-medium text-foreground/80 hover:bg-accent transition-colors"
                >
                  <Crown className="size-3 text-amber-500" />
                  Sign in
                </button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <UserButton
                appearance={{ elements: { avatarBox: "size-6" } }}
              />
              {isPremium ? (
                <span className="flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[11px] font-medium text-amber-400">
                  <Crown className="size-3" />
                  Pro
                </span>
              ) : (
                <Link
                  href="/pricing"
                  className="flex items-center gap-1 rounded-full border border-border bg-accent px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Zap className="size-3" />
                  Free plan
                </Link>
              )}
            </SignedIn>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main Export
// ============================================================================

export function BottomCornerNav() {
  const isClient = useIsClient();

  // Prevent SSR to avoid hydration mismatch from Base UI's auto-generated IDs
  if (!isClient) {
    return (
      <div className="fixed bottom-4 right-4 z-50 flex items-center gap-1.5 md:bottom-6 md:right-6">
        <div className="size-8 rounded-full bg-muted border border-border" />
        <div className="size-8 rounded-full bg-muted border border-border" />
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-1.5 md:bottom-6 md:right-6">
      <LanguagePopover />
      <Popover>
        <PopoverTrigger
          className={cn(
            "flex items-center justify-center size-8 rounded-full",
            "bg-muted border border-border",
            "text-muted-foreground hover:text-foreground hover:bg-accent",
            "shadow-sm transition-all duration-150"
          )}
          aria-label="Help"
        >
          <span className="text-sm font-medium">?</span>
        </PopoverTrigger>
        <PopoverPopup
          side="top"
          align="end"
          sideOffset={8}
          className="w-64 !p-0 rounded-lg bg-popover border-border overflow-hidden"
        >
          <HelpPopoverContent />
        </PopoverPopup>
      </Popover>
    </div>
  );
}
