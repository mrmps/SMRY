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
  ArrowUpRight,
  Bookmark,
} from "@/components/ui/icons";
import { LanguageIcon } from "@/components/ui/custom-icons";
import type { DragEvent, MouseEvent } from "react";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
  useAuth,
} from "@clerk/nextjs";
import { buildUrlWithReturn } from "@/lib/hooks/use-return-url";
import {
  Popover,
  PopoverTrigger,
  PopoverPopup,
} from "@/components/ui/popover";
import { stripLocaleFromPathname } from "@/lib/i18n-pathname";
import { cn } from "@/lib/utils";
import { getRecentChanges } from "@/lib/changelog";
import { useIsMobile } from "@/hooks/use-mobile";

const emptySubscribe = () => () => {};

// Bookmarklet button - draggable to bookmarks bar (desktop only)
function BookmarkletButton({ t }: { t: (key: string) => string }) {
  const bookmarklet = `javascript:void(function(){var url=window.location.href;window.open('https://smry.ai/proxy?url='+encodeURIComponent(url)+'&utm_source=bookmarklet','_blank');}());`;
  const linkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (linkRef.current) {
      linkRef.current.setAttribute("href", bookmarklet);
    }
  }, [bookmarklet]);

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
  };

  const handleDragStart = (event: DragEvent<HTMLAnchorElement>) => {
    event.dataTransfer.setData("text/uri-list", bookmarklet);
    event.dataTransfer.setData("text/plain", "SMRY");
    event.dataTransfer.setData(
      "text/html",
      `<a href="${bookmarklet}" title="SMRY">SMRY</a>`
    );
    event.dataTransfer.effectAllowed = "copyLink";
  };

  return (
    <a
      ref={linkRef}
      draggable="true"
      onDragStart={handleDragStart}
      onClick={handleClick}
      title={t("dragToBookmarksBar")}
      className="inline-flex cursor-grab items-center gap-1.5 rounded-md border border-border bg-accent px-2 py-1 text-[11px] font-medium text-muted-foreground transition-all hover:text-foreground active:scale-95 active:cursor-grabbing"
    >
      <Bookmark className="size-3" strokeWidth={2} />
      <span>SMRY</span>
    </a>
  );
}

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
        <LanguageIcon className="size-3.5" />
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
  showArrow,
}: {
  children: React.ReactNode;
  href?: string;
  isNew?: boolean;
  showArrow?: boolean;
}) {
  if (href) {
    return (
      <Link
        href={href}
        className="flex items-start gap-2 py-1 text-[13px] hover:text-foreground cursor-pointer"
      >
        <div
          className={cn(
            "mt-[7px] size-[5px] rounded-full shrink-0",
            isNew ? "bg-blue-400" : "bg-muted-foreground/50"
          )}
        />
        <span className="text-muted-foreground leading-snug">{children}</span>
        {showArrow && <ArrowUpRight className="size-3 text-muted-foreground/50 mt-0.5 shrink-0" />}
      </Link>
    );
  }

  return (
    <div className="flex items-start gap-2 py-1 text-[13px]">
      <div
        className={cn(
          "mt-[7px] size-[5px] rounded-full shrink-0",
          isNew ? "bg-blue-400" : "bg-muted-foreground/50"
        )}
      />
      <span className="text-muted-foreground leading-snug">{children}</span>
    </div>
  );
}

function ThemeSubmenu({ inline = false }: { inline?: boolean }) {
  const { theme, setTheme } = useTheme();
  const t = useTranslations("nav");

  const themes = [
    { id: "light", icon: Sun, label: t("light") },
    { id: "dark", icon: Moon, label: t("dark") },
    { id: "system", icon: Monitor, label: t("system") },
  ];

  // Get current theme icon
  const currentIcon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;

  // Inline mode: show all three options in a row (better for mobile)
  if (inline) {
    return (
      <div className="flex w-full items-center gap-2.5 rounded px-2.5 py-2">
        {(() => {
          const Icon = currentIcon;
          return <Icon className="size-4 text-muted-foreground/70" />;
        })()}
        <span className="flex-1 text-[13px] text-foreground/80">{t("theme")}</span>
        <div className="flex items-center gap-1 rounded-full bg-muted p-0.5">
          {themes.map(({ id, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTheme(id)}
              className={cn(
                "flex items-center justify-center size-7 rounded-full transition-colors",
                theme === id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              aria-label={themes.find((themeItem) => themeItem.id === id)?.label}
            >
              <Icon className="size-3.5" />
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Desktop: nested popover
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
  const tEntries = useTranslations("changelogEntries");
  const isClient = useIsClient();
  const isMobile = useIsMobile();
  const { has, isLoaded } = useAuth();
  const isPremium = isLoaded && (has?.({ plan: "premium" }) ?? false);
  const authRedirectUrl = isClient ? buildUrlWithReturn("/auth/redirect") : "/auth/redirect";
  const [searchQuery, setSearchQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Don't auto-focus on mobile - opens keyboard unexpectedly
    if (!isMobile) {
      const timer = setTimeout(() => searchRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [isMobile]);

  const query = searchQuery.toLowerCase().trim();

  const menuItems = [
    { icon: MessageCircle, label: t("contactUs"), href: "https://smryai.userjot.com/", external: true },
    { icon: BookOpen, label: t("getStarted"), href: "/guide" },
    { icon: History, label: t("history"), href: "/history" },
    { icon: CreditCard, label: t("pricing"), href: "/pricing" },
  ];

  const recentChanges = getRecentChanges(2);
  const whatsNewItems: { text: string; isNew?: boolean; href?: string; showArrow?: boolean }[] = [
    ...recentChanges.map((change, i) => ({
      text: tEntries(change.textKey),
      isNew: i === 0,
      href: "/changelog",
    })),
    { text: t("fullChangelog"), href: "/changelog", showArrow: true },
  ];

  const filteredMenuItems = query
    ? menuItems.filter((item) => item.label.toLowerCase().includes(query))
    : menuItems;

  const filteredWhatsNew = query
    ? whatsNewItems.filter((item) => item.text.toLowerCase().includes(query))
    : whatsNewItems;

  const showTheme = !query || "theme".includes(query);
  const showWhatsNew = filteredWhatsNew.length > 0;
  // Bookmarklet only makes sense on desktop - can't drag to bookmarks bar on mobile
  const showBookmarklet = !isMobile;

  return (
    <div className="relative">
      {/* Search - hidden on mobile since menu is small and keyboard is annoying */}
      {!isMobile && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
          <Search className="size-4 text-muted-foreground/70" />
          <input
            ref={searchRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="flex-1 bg-transparent text-[13px] text-foreground/80 outline-none placeholder:text-muted-foreground/50"
          />
        </div>
      )}

      {/* Menu */}
      {(filteredMenuItems.length > 0 || showTheme) && (
        <div className={cn("p-1.5", isMobile && "py-2")}>
          {filteredMenuItems.map((item) => (
            <MenuItem
              key={item.label}
              icon={item.icon}
              label={item.label}
              href={item.href}
              external={"external" in item ? item.external : undefined}
            />
          ))}
          {showTheme && <ThemeSubmenu inline={isMobile} />}
        </div>
      )}

      {/* Bookmarklet - desktop only (can't drag to bookmarks bar on mobile) */}
      {showBookmarklet && (
        <>
          <div className="mx-2.5 border-t border-border" />
          <div className="px-2.5 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[12px] font-medium text-foreground/80">{t("bookmarkletSection")}</p>
                <p className="text-[11px] text-muted-foreground/60">{t("dragToBookmarksBar")}</p>
              </div>
              <BookmarkletButton t={t} />
            </div>
          </div>
        </>
      )}

      {/* Divider */}
      {showWhatsNew && <div className="mx-2.5 border-t border-border" />}

      {/* What's new */}
      {showWhatsNew && (
        <div className="px-2.5 pt-2 pb-1">
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/50 mb-1.5">
            {t("whatsNew")}
          </div>
          {filteredWhatsNew.map((item) => (
            <WhatsNewItem key={item.text} isNew={item.isNew} href={item.href} showArrow={item.showArrow}>
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
              <SignInButton mode="modal" fallbackRedirectUrl={authRedirectUrl}>
                <button
                  className="flex items-center gap-1.5 rounded-full border border-border bg-accent px-2.5 py-1 text-[11px] font-medium text-foreground/80 hover:bg-accent transition-colors"
                >
                  <Crown className="size-3 text-amber-500" />
                  {t("signIn")}
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
                  {t("proBadge")}
                </span>
              ) : (
                <Link
                  href="/pricing"
                  className="flex items-center gap-1 rounded-full border border-border bg-accent px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Crown className="size-3" />
                  {t("freePlanBadge")}
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
