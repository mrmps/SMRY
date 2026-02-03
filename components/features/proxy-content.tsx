"use client";

import React, { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useArticleAuto } from "@/lib/hooks/use-articles";
import { addArticleToHistory } from "@/lib/hooks/use-history";
import { useAuth } from "@clerk/nextjs";
import { AuthBar } from "@/components/shared/auth-bar";
import { useIsPremium } from "@/lib/hooks/use-is-premium";
import {
  Bug as BugIcon,
  Sun,
  Moon,
  Laptop,
  History as HistoryIcon,
  MoreHorizontal,
  ExternalLink,
  PanelRightOpen,
  Check,
  ArrowLeft,
  Copy,
  ArrowUpRight,
} from "lucide-react";
import { FeedbackIcon, SummaryIcon } from "@/components/ui/custom-icons";
import { cn } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { stripLocaleFromPathname } from "@/lib/i18n-pathname";
import ShareButton from "@/components/features/share-button";
import { OpenAIIcon, ClaudeIcon } from "@/components/features/copy-page-dropdown";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import { ArticleContent } from "@/components/article/content";
import { ArticleChat } from "@/components/features/article-chat";
import { MobileChatDrawer } from "@/components/features/mobile-chat-drawer";
import { MobileBottomBar } from "@/components/features/mobile-bottom-bar";
import { SettingsDrawer, type SettingsDrawerHandle } from "@/components/features/settings-drawer";
import { useIsDesktop } from "@/lib/hooks/use-media-query";
import { useGravityAd } from "@/lib/hooks/use-gravity-ad";
import { GravityAd } from "@/components/ads/gravity-ad";
import { PromoBanner } from "@/components/marketing/promo-banner";
import { UpdateBanner } from "@/components/marketing/update-banner";
import {
  Menu,
  MenuTrigger,
  MenuPopup,
  MenuItem,
  MenuSeparator,
  MenuGroup,
  MenuGroupLabel,
} from "@/components/ui/menu";
import {
  useQueryStates,
  parseAsStringLiteral,
  parseAsBoolean,
  parseAsString,
} from "nuqs";
import { Source } from "@/types/api";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ImperativePanelHandle } from "react-resizable-panels";

// Helper to detect client-side rendering without setState in effect
const emptySubscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

// History menu item for the More dropdown
function HistoryMenuItem() {
  const { isSignedIn, isLoaded } = useAuth();
  const mounted = useSyncExternalStore(emptySubscribe, getClientSnapshot, getServerSnapshot);

  const href = isSignedIn ? "/history" : "/pricing";
  const showBadge = mounted && isLoaded && !isSignedIn;

  return (
    <MenuItem
      render={(props) => {
        const { key, className, ...rest } = props as typeof props & {
          key?: React.Key;
          className?: string;
        };
        return (
          <Link
            key={key}
            {...rest}
            href={href}
            className={cn(className, "flex items-center gap-2 w-full px-3")}
          >
            <HistoryIcon className="size-4" />
            <span className="flex-1">History</span>
            {showBadge && (
              <span className="text-[10px] font-medium text-amber-500">PRO</span>
            )}
          </Link>
        );
      }}
    />
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

// Locale switching using next-intl's router (preserves query params)
function useLocaleSwitch() {
  const router = useRouter();
  const rawPathname = usePathname();
  const searchParams = useSearchParams();

  return (newLocale: Locale) => {
    // Strip any existing locale prefix to get the bare pathname
    const pathname = stripLocaleFromPathname(rawPathname);
    // Build path with query params
    const search = searchParams.toString();
    const fullPath = `${pathname}${search ? `?${search}` : ''}`;

    // Use next-intl's router to properly switch locales
    router.replace(fullPath, { locale: newLocale });
  };
}

// Language menu items for the More dropdown
function LanguageMenuItems() {
  const locale = useLocale() as Locale;
  const switchLocale = useLocaleSwitch();

  return (
    <>
      <MenuSeparator />
      <MenuGroup>
        <MenuGroupLabel>Language</MenuGroupLabel>
        <div className="px-1 pb-1 space-y-0.5">
          {routing.locales.map((loc) => (
            <MenuItem
              key={loc}
              onClick={() => switchLocale(loc)}
              className={cn(
                "flex items-center justify-between w-full px-2 rounded cursor-pointer",
                locale === loc && "bg-accent"
              )}
            >
              <span>{languageNames[loc]}</span>
              {locale === loc && <Check className="size-3.5 text-muted-foreground" />}
            </MenuItem>
          ))}
        </div>
      </MenuGroup>
    </>
  );
}


// Theme menu items for the More dropdown
function ThemeMenuItems() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const mounted = useSyncExternalStore(emptySubscribe, getClientSnapshot, getServerSnapshot);

  if (!mounted) return null;

  const isDark = resolvedTheme === "dark" || resolvedTheme === "magic-blue" || resolvedTheme === "classic-dark";

  return (
    <>
      <MenuSeparator />
      <MenuGroup>
        <MenuGroupLabel>Theme</MenuGroupLabel>
        <div className="flex items-center gap-1 px-3 pb-1.5">
          <button
            onClick={() => setTheme("light")}
            className={cn(
              "flex items-center justify-center rounded-md p-1.5 transition-colors",
              theme === "light" || (theme === "system" && !isDark)
                ? "bg-accent text-accent-foreground"
                : "hover:bg-accent/50 text-muted-foreground"
            )}
            title="Light"
          >
            <Sun className="size-4" />
          </button>
          <button
            onClick={() => setTheme("dark")}
            className={cn(
              "flex items-center justify-center rounded-md p-1.5 transition-colors",
              theme === "dark" || theme === "magic-blue" || theme === "classic-dark"
                ? "bg-accent text-accent-foreground"
                : "hover:bg-accent/50 text-muted-foreground"
            )}
            title="Dark"
          >
            <Moon className="size-4" />
          </button>
          <button
            onClick={() => setTheme("system")}
            className={cn(
              "flex items-center justify-center rounded-md p-1.5 transition-colors",
              theme === "system"
                ? "bg-accent text-accent-foreground"
                : "hover:bg-accent/50 text-muted-foreground"
            )}
            title="System"
          >
            <Laptop className="size-4" />
          </button>
        </div>
      </MenuGroup>
    </>
  );
}


interface ProxyContentProps {
  url: string;
  initialSource?: Source;
  initialViewMode?: "markdown" | "html" | "iframe";
  initialSidebarOpen?: boolean;
}

export function ProxyContent({ url, initialSidebarOpen = false }: ProxyContentProps) {
  // Use the new auto endpoint - single request, races all sources server-side
  const articleQuery = useArticleAuto(url);
  const { isPremium } = useIsPremium();
  const isDesktop = useIsDesktop();
  const showDesktopPromo = isDesktop !== false;
  const showMobilePromo = isDesktop === false;

  // Get the source that was actually used by the auto endpoint
  const source = articleQuery.data?.source || "smry-fast";


  const viewModes = ["markdown", "html", "iframe"] as const;

  const [query, setQuery] = useQueryStates(
    {
      url: parseAsString.withDefault(url),
      view: parseAsStringLiteral(viewModes).withDefault("markdown"),
      sidebar: parseAsBoolean.withDefault(initialSidebarOpen),
    },
    {
      history: "replace",
      shallow: true,
    }
  );
  const viewMode = query.view as (typeof viewModes)[number];
  const sidebarOpen = query.sidebar as boolean;

  const activeArticle = articleQuery.data?.article;
  const articleTitle = activeArticle?.title;
  const articleTextContent = activeArticle?.textContent;

  // Copy page state and handlers
  const [copied, setCopied] = useState(false);

  const handleCopyPage = async () => {
    try {
      let markdown = `# ${articleTitle || "Article"}\n\n`;
      markdown += `**Source:** ${url}\n\n`;
      if (articleTextContent) {
        markdown += `---\n\n${articleTextContent}\n\n`;
      }
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const handleOpenInAI = (service: "chatgpt" | "claude") => {
    const proxyUrlObj = new URL("https://www.smry.ai/proxy");
    proxyUrlObj.searchParams.set("url", url);
    if (source) {
      proxyUrlObj.searchParams.set("source", source);
    }
    const smryUrl = proxyUrlObj.toString();
    let aiUrl: string;
    if (service === "chatgpt") {
      const prompt = `Read from '${smryUrl}' so I can ask questions about it.`;
      aiUrl = `https://chatgpt.com/?hints=search&prompt=${encodeURIComponent(prompt)}`;
    } else {
      const prompt = `Read from '${smryUrl}' so I can ask questions about it.`;
      aiUrl = `https://claude.ai/new?q=${encodeURIComponent(prompt)}`;
    }
    window.open(aiUrl, "_blank", "noopener,noreferrer");
  };

  // Track initialization state per URL
  const initializedUrlRef = useRef<string | null>(null);

  // With the auto endpoint, we get a single result - no need for complex selection logic
  const firstSuccessfulArticle = articleQuery.data?.article || null;

  // Fetch ad - pass article data for better targeting
  // Ads refresh every 45 seconds for users who stay on the page
  const { ads: gravityAds, fireImpression, fireClick, fireDismiss } = useGravityAd({
    url,
    title: firstSuccessfulArticle?.title,
    textContent: firstSuccessfulArticle?.textContent,
    isPremium,
    // Additional metadata for better ad targeting
    byline: firstSuccessfulArticle?.byline,
    siteName: firstSuccessfulArticle?.siteName,
    publishedTime: firstSuccessfulArticle?.publishedTime,
    lang: firstSuccessfulArticle?.lang,
  });

  // Ad distribution: sidebar + inline ad + footer ad
  // Gravity returns: [0]=right_response (sidebar), [1]=inline_response, [2]=below_response (footer)
  const sidebarAd = gravityAds[0] ?? null;
  const inlineAd = gravityAds[1] ?? null;
  const footerAd = gravityAds[2] ?? null;

  // Handle article load: save to history
  useEffect(() => {
    if (!firstSuccessfulArticle || initializedUrlRef.current === url) return;

    initializedUrlRef.current = url;

    // Save to history
    addArticleToHistory(url, firstSuccessfulArticle.title || "Untitled Article");
  }, [firstSuccessfulArticle, url]);

  const settingsDrawerRef = React.useRef<SettingsDrawerHandle>(null);
  const [mobileSummaryOpen, setMobileSummaryOpen] = useState(false);
  const [mobileAdDismissed, setMobileAdDismissed] = useState(false);
  const [desktopAdDismissed, setDesktopAdDismissed] = useState(false);
  // Default to fullscreen for html/iframe views
  const [isFullScreen, setIsFullScreen] = useState(viewMode === "html" || viewMode === "iframe");

  const handleViewModeChange = React.useCallback(
    (mode: (typeof viewModes)[number]) => {
      setQuery({ view: mode });
      // Auto-enable fullscreen for html/iframe views
      if (mode === "html" || mode === "iframe") {
        setIsFullScreen(true);
      }
    },
    [setQuery]
  );

  const handleSidebarChange = React.useCallback(
    (next: boolean) => {
      setQuery({ sidebar: next ? true : null });
    },
    [setQuery]
  );

  // Mobile header hide-on-scroll state
  const [mobileHeaderVisible, setMobileHeaderVisible] = useState(true);
  const mobileScrollRef = useRef<HTMLDivElement>(null);
  const lastScrollY = useRef(0);
  const scrollDeltaAccum = useRef(0);
  const headerVisibleRef = useRef(true);
  const lastToggleTime = useRef(0); // Cooldown to prevent mid-animation reversal

  // Track scroll direction to hide/show mobile header (like X/Twitter)
  useEffect(() => {
    const scrollEl = mobileScrollRef.current;
    if (!scrollEl || isDesktop !== false) return;

    const handleScroll = () => {
      const currentY = scrollEl.scrollTop;
      const delta = currentY - lastScrollY.current;
      const now = Date.now();
      lastScrollY.current = currentY;

      // Cooldown: ignore state changes for 300ms after last toggle (animation duration)
      const inCooldown = now - lastToggleTime.current < 300;

      // Always show at top (bypass cooldown for this)
      if (currentY < 50) {
        if (!headerVisibleRef.current) {
          headerVisibleRef.current = true;
          setMobileHeaderVisible(true);
          lastToggleTime.current = now;
        }
        scrollDeltaAccum.current = 0;
        return;
      }

      // Accumulate scroll in same direction, reset on direction change
      if ((delta > 0 && scrollDeltaAccum.current < 0) || (delta < 0 && scrollDeltaAccum.current > 0)) {
        scrollDeltaAccum.current = 0;
      }
      scrollDeltaAccum.current += delta;

      // Skip state changes during cooldown
      if (inCooldown) return;

      // Trigger after accumulating ~60px in one direction (hysteresis)
      if (scrollDeltaAccum.current > 60 && headerVisibleRef.current) {
        headerVisibleRef.current = false;
        setMobileHeaderVisible(false);
        scrollDeltaAccum.current = 0;
        lastToggleTime.current = now;
      } else if (scrollDeltaAccum.current < -60 && !headerVisibleRef.current) {
        headerVisibleRef.current = true;
        setMobileHeaderVisible(true);
        scrollDeltaAccum.current = 0;
        lastToggleTime.current = now;
      }
    };

    scrollEl.addEventListener("scroll", handleScroll, { passive: true });
    return () => scrollEl.removeEventListener("scroll", handleScroll);
  }, [isDesktop]);

  // Resizable panel ref
  const summaryPanelRef = useRef<ImperativePanelHandle>(null);

  // Sync panel with sidebarOpen state
  useEffect(() => {
    const panel = summaryPanelRef.current;
    if (!panel) return;

    const isExpanded = panel.getSize() > 0;
    if (sidebarOpen === isExpanded) return;

    if (sidebarOpen) {
      panel.expand(25);
    } else {
      panel.collapse();
    }
  }, [sidebarOpen]);

  return (
    <div className="flex h-dvh flex-col bg-background">
      {/* Promo Banner - desktop/tablet */}
      {showDesktopPromo && <PromoBanner />}
      <UpdateBanner className="hidden md:block" />

      <div className="flex-1 overflow-hidden flex flex-col">
        <header className="z-30 hidden md:flex h-14 shrink-0 items-center border-b border-border/40 bg-background px-4">
          {/* Desktop Header - Logo */}
          <div className="flex items-center gap-3 shrink-0">
            <Link
              href="/"
              className="flex items-center gap-2 transition-opacity hover:opacity-80"
            >
              <Image
                src="/logo.svg"
                width={80}
                height={80}
                alt="smry logo"
                className="h-6 w-auto dark:invert"
                priority
              />
            </Link>

            {/* View Mode Pills */}
            <div className="flex items-center p-1 bg-muted rounded-xl" role="group" aria-label="View mode">
              <button
                onClick={() => handleViewModeChange("markdown")}
                aria-label="Reader view mode"
                aria-pressed={viewMode === "markdown"}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors",
                  viewMode === "markdown"
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                )}
              >
                reader
              </button>
              <button
                onClick={() => handleViewModeChange("html")}
                aria-label="Original HTML view mode"
                aria-pressed={viewMode === "html"}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors",
                  viewMode === "html"
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                )}
              >
                original
              </button>
              <button
                onClick={() => handleViewModeChange("iframe")}
                aria-label="Iframe view mode"
                aria-pressed={viewMode === "iframe"}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors",
                  viewMode === "iframe"
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                )}
              >
                iframe
              </button>
            </div>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Right: Actions */}
          <div className="flex items-center gap-1.5">
              {/* Chat button - shows when sidebar is closed */}
              {!sidebarOpen && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSidebarChange(true)}
                  className="gap-1.5"
                >
                  <PanelRightOpen className="size-4" />
                  Chat
                </Button>
              )}

              <ShareButton
                url={`https://smry.ai/proxy?url=${encodeURIComponent(url)}`}
                originalUrl={url}
                source={source || "smry-fast"}
                viewMode={viewMode || "markdown"}
                sidebarOpen={sidebarOpen}
                articleTitle={articleTitle}
              />

              {/* User Section */}
              <AuthBar variant="compact" showUpgrade={false} className="ml-1" />

              {/* Overflow Menu for less common actions */}
              <Menu>
                <MenuTrigger
                  id="proxy-more-options-menu"
                  render={(props) => {
                    const { key, ...rest } = props as typeof props & { key?: React.Key };
                    return (
                      <Button
                        key={key}
                        {...rest}
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      >
                        <MoreHorizontal className="size-4" aria-hidden="true" />
                        <span className="sr-only">More options</span>
                      </Button>
                    );
                  }}
                />
                <MenuPopup side="bottom" align="end" className="min-w-[220px]">
                  {/* Copy & AI actions */}
                  <MenuItem
                    onClick={handleCopyPage}
                    className="flex items-center gap-2 px-3"
                  >
                    {copied ? (
                      <Check className="size-4 text-green-600" />
                    ) : (
                      <Copy className="size-4" />
                    )}
                    <span className="flex-1">{copied ? "Copied!" : "Copy page"}</span>
                  </MenuItem>
                  <MenuItem
                    onClick={() => handleOpenInAI("chatgpt")}
                    className="flex items-center gap-2 px-3"
                  >
                    <OpenAIIcon className="size-4" />
                    <span className="flex-1">Open in ChatGPT</span>
                    <ArrowUpRight className="size-3 opacity-50 shrink-0" />
                  </MenuItem>
                  <MenuItem
                    onClick={() => handleOpenInAI("claude")}
                    className="flex items-center gap-2 px-3"
                  >
                    <ClaudeIcon className="size-4" />
                    <span className="flex-1">Open in Claude</span>
                    <ArrowUpRight className="size-3 opacity-50 shrink-0" />
                  </MenuItem>
                  <MenuSeparator />
                  <HistoryMenuItem />
                  <LanguageMenuItems />
                  <ThemeMenuItems />
                  <MenuSeparator />
                  <MenuItem
                    render={(props) => {
                      const { key, className, ...rest } = props as typeof props & {
                        key?: React.Key;
                        className?: string;
                      };
                      return (
                        <a
                          key={key}
                          {...rest}
                          href="https://smryai.userjot.com/"
                          target="_blank"
                          rel="noreferrer"
                          className={cn(className, "flex items-center gap-2 w-full px-3")}
                        >
                          <BugIcon className="size-4" />
                          <span className="flex-1">Report Bug</span>
                          <ExternalLink className="size-3 opacity-50 shrink-0" />
                        </a>
                      );
                    }}
                  />
                  <MenuItem
                    render={(props) => {
                      const { key, className, ...rest } = props as typeof props & {
                        key?: React.Key;
                        className?: string;
                      };
                      return (
                        <a
                          key={key}
                          {...rest}
                          href="https://smryai.userjot.com/"
                          target="_blank"
                          rel="noreferrer"
                          className={cn(className, "flex items-center gap-2 w-full px-3")}
                        >
                          <FeedbackIcon className="size-4" />
                          <span className="flex-1">Send Feedback</span>
                          <ExternalLink className="size-3 opacity-50 shrink-0" />
                        </a>
                      );
                    }}
                  />
                </MenuPopup>
              </Menu>
          </div>
        </header>

        {/* Content Area - conditionally render desktop or mobile layout */}
        <main className="flex-1 overflow-hidden">
          {isDesktop === null ? (
            // SSR/hydration: render nothing to avoid layout shift
            // The layout will render on client after hydration
            <div className="h-full bg-card" />
          ) : isDesktop ? (
            // Desktop: Resizable panels with sidebar
            <div className="h-full relative">
              {/* Expand button when collapsed */}
              {!sidebarOpen && (
                <button
                  onClick={() => handleSidebarChange(true)}
                  className="absolute right-0 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-6 h-12 bg-muted/80 hover:bg-muted border border-border border-r-0 rounded-l-md text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Open chat sidebar"
                >
                  <PanelRightOpen className="size-4" />
                </button>
              )}

              <ResizablePanelGroup direction="horizontal" className="h-full">
                {/* Main content panel */}
                <ResizablePanel defaultSize={70} minSize={50}>
                  <div className="h-full overflow-y-auto bg-card">
                    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-6">
                      <ArticleContent
                        data={articleQuery.data}
                        isLoading={articleQuery.isLoading}
                        isError={articleQuery.isError}
                        error={articleQuery.error}
                        source={source}
                        url={url}
                        viewMode={viewMode}
                        isFullScreen={isFullScreen}
                        onFullScreenChange={setIsFullScreen}
                        inlineAd={!isPremium ? inlineAd : null}
                        onInlineAdVisible={inlineAd ? () => fireImpression(inlineAd) : undefined}
                        onInlineAdClick={inlineAd ? () => fireClick(inlineAd) : undefined}
                        showInlineAd={!isPremium}
                        footerAd={!isPremium ? footerAd : null}
                        onFooterAdVisible={footerAd ? () => fireImpression(footerAd) : undefined}
                        onFooterAdClick={footerAd ? () => fireClick(footerAd) : undefined}
                      />
                    </div>
                  </div>
                </ResizablePanel>

                {/* Resize handle */}
                <ResizableHandle
                  withHandle
                  className={cn(
                    "transition-opacity duration-150",
                    !sidebarOpen && "opacity-0 pointer-events-none"
                  )}
                />

                {/* Summary sidebar panel - resizable between 18-40% for flexibility.
                    Unlike resizable-modal which uses fixed 25%, this allows users to adjust based on content. */}
                <ResizablePanel
                  ref={summaryPanelRef}
                  defaultSize={sidebarOpen ? 25 : 0}
                  minSize={18}
                  maxSize={40}
                  collapsible
                  collapsedSize={0}
                  className="bg-card"
                  onCollapse={() => {
                    if (sidebarOpen) handleSidebarChange(false);
                  }}
                  onExpand={() => {
                    if (!sidebarOpen) handleSidebarChange(true);
                  }}
                >
                  <div className="h-full border-l border-border">
                    <ArticleChat
                      articleContent={articleTextContent || ""}
                      articleTitle={articleTitle}
                      isOpen={sidebarOpen}
                      onOpenChange={handleSidebarChange}
                      variant="sidebar"
                    />
                  </div>
                </ResizablePanel>
              </ResizablePanelGroup>

              {/* Fixed bottom-right ad when sidebar is closed */}
              {!sidebarOpen && !isPremium && sidebarAd && !desktopAdDismissed && (
                <div className="fixed bottom-4 right-4 z-40 w-[280px] lg:w-[320px] xl:w-[360px] max-w-[calc(100vw-2rem)]">
                  <GravityAd
                    ad={sidebarAd}
                    onVisible={() => fireImpression(sidebarAd)}
                    onClick={() => fireClick(sidebarAd)}
                    onDismiss={() => {
                      fireDismiss(sidebarAd);
                      setDesktopAdDismissed(true);
                    }}
                  />
                </div>
              )}
            </div>
          ) : (
            // Mobile: Clean article-first layout with bottom bar
            <div className="h-full relative">
              {/* Scrollable content area */}
              <div
                ref={mobileScrollRef}
                className="h-full overflow-y-auto bg-card pb-16 touch-pan-y"
              >
                {/* Mobile promo + header stack with safe-area support */}
                <div
                  className={cn(
                    "sticky top-0 z-40 bg-background transition-transform duration-300 ease-out",
                    !mobileHeaderVisible && "-translate-y-full"
                  )}
                >
                  {showMobilePromo && <PromoBanner className="md:hidden" />}
                  <UpdateBanner className="md:hidden" />
                  <header className="flex h-14 items-center bg-background px-4">
                    <div className="flex items-center gap-3 shrink-0">
                      <button
                        onClick={() => window.history.back()}
                        className="size-9 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        aria-label="Go back"
                      >
                        <ArrowLeft className="size-5" />
                      </button>
                    </div>
                    <div className="flex-1 flex items-center justify-center">
                      <span className="text-sm font-medium text-muted-foreground truncate max-w-[200px]">
                        {(() => {
                          try {
                            return new URL(url).hostname.replace('www.', '').toUpperCase();
                          } catch {
                            return '';
                          }
                        })()}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setMobileSummaryOpen(true)}
                        className={cn(
                          "size-9 flex items-center justify-center rounded-full transition-colors",
                          mobileSummaryOpen
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        )}
                        aria-label="Open chat"
                      >
                        <SummaryIcon className="size-5" />
                      </button>
                      <SettingsDrawer
                        ref={settingsDrawerRef}
                        viewMode={viewMode}
                        onViewModeChange={handleViewModeChange}
                      />
                    </div>
                  </header>
                </div>

                <div className={cn(
                  viewMode === "html"
                    ? "min-h-full px-2 pt-2" // Near-fullscreen with small margins for HTML mode
                    : "mx-auto max-w-3xl px-4 sm:px-6 py-4" // Padded for reader mode
                )}>
                  {/* Article content */}
                  <ArticleContent
                    data={articleQuery.data}
                    isLoading={articleQuery.isLoading}
                    isError={articleQuery.isError}
                    error={articleQuery.error}
                    source={source}
                    url={url}
                    viewMode={viewMode}
                    isFullScreen={isFullScreen}
                    onFullScreenChange={setIsFullScreen}
                    inlineAd={!isPremium ? inlineAd : null}
                    onInlineAdVisible={inlineAd ? () => fireImpression(inlineAd) : undefined}
                    onInlineAdClick={inlineAd ? () => fireClick(inlineAd) : undefined}
                    showInlineAd={!isPremium}
                    footerAd={!isPremium ? footerAd : null}
                    onFooterAdVisible={footerAd ? () => fireImpression(footerAd) : undefined}
                    onFooterAdClick={footerAd ? () => fireClick(footerAd) : undefined}
                  />
                </div>
              </div>

              {/* Elements below are OUTSIDE scroll container to prevent Vaul scroll lock interference */}

              {/* Mobile Chat Drawer */}
              <MobileChatDrawer
                open={mobileSummaryOpen}
                onOpenChange={setMobileSummaryOpen}
                articleContent={articleTextContent || ""}
                articleTitle={articleTitle}
              />

              {/* Fixed ad above bottom bar - responsive CSS handles phone vs tablet sizing */}
              {!isPremium && sidebarAd && !mobileAdDismissed && (
                <div
                  className="fixed left-0 right-0 z-20"
                  style={{ bottom: 'calc(3.5rem + env(safe-area-inset-bottom, 0px))' }}
                >
                  <GravityAd
                    ad={sidebarAd}
                    variant="mobile"
                    onVisible={() => fireImpression(sidebarAd)}
                    onClick={() => fireClick(sidebarAd)}
                    onDismiss={() => {
                      fireDismiss(sidebarAd);
                      setMobileAdDismissed(true);
                    }}
                  />
                </div>
              )}

              {/* Mobile Bottom Bar */}
              <MobileBottomBar
                viewMode={viewMode || "markdown"}
                onViewModeChange={handleViewModeChange}
                smryUrl={`https://smry.ai/proxy?url=${encodeURIComponent(url)}`}
                originalUrl={url}
                articleTitle={articleTitle}
                onOpenSettings={() => settingsDrawerRef.current?.open()}
              />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
