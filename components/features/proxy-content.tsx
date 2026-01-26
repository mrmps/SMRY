"use client";

import React, { useEffect, useRef, useMemo, useState, useSyncExternalStore } from "react";
import { useArticles } from "@/lib/hooks/use-articles";
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
  X,
  Check,
  ArrowLeft,
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
import { CopyPageDropdown } from "@/components/features/copy-page-dropdown";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import ArrowTabs from "@/components/article/tabs";
import { InlineSummary } from "@/components/features/inline-summary";
import { MobileBottomBar } from "@/components/features/mobile-bottom-bar";
import { SettingsDrawer } from "@/components/features/settings-drawer";
import { useIsDesktop } from "@/lib/hooks/use-media-query";
import { useGravityAd } from "@/lib/hooks/use-gravity-ad";
import { GravityAd } from "@/components/ads/gravity-ad";
import { PromoBanner } from "@/components/marketing/promo-banner";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
} from "@/components/ui/drawer";
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
import { Source, SOURCES } from "@/types/api";
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
        <div className="flex items-center gap-1 px-3 pb-1">
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
  const { results } = useArticles(url);
  const { isPremium } = useIsPremium();
  const isDesktop = useIsDesktop();

  const viewModes = ["markdown", "html", "iframe"] as const;

  const [query, setQuery] = useQueryStates(
    {
      url: parseAsString.withDefault(url),
      source: parseAsStringLiteral(SOURCES).withDefault("smry-fast"),
      view: parseAsStringLiteral(viewModes).withDefault("markdown"),
      sidebar: parseAsBoolean.withDefault(initialSidebarOpen),
    },
    {
      history: "replace",
      shallow: true,
    }
  );

  const source = query.source as Source;
  const viewMode = query.view as (typeof viewModes)[number];
  const sidebarOpen = query.sidebar as boolean;

  const activeArticle = results[source]?.data?.article;
  const articleTitle = activeArticle?.title;
  const articleTextContent = activeArticle?.textContent;

  // Track initialization state per URL
  const initializedUrlRef = useRef<string | null>(null);

  // Track timeout for fallback - after 5s use whatever we have
  const [forceUseAvailable, setForceUseAvailable] = useState(false);

  // After 5 seconds, use whatever we have
  useEffect(() => {
    const timer = setTimeout(() => {
      setForceUseAvailable(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  // Find best article for ad context
  // Priority: 1) First source with title + >400 chars, 2) Longest source, 3) After 5s use anything
  const firstSuccessfulArticle = useMemo(() => {
    const allResults = Object.values(results);

    // 1. First try: source with title AND textContent > 400 chars
    for (const result of allResults) {
      const article = result.data?.article;
      if (result.isSuccess && article?.title && (article.textContent?.length || 0) > 400) {
        return article;
      }
    }

    // 2. Fallback: use source with longest textContent
    let longestArticle = null;
    let longestLength = 0;
    for (const result of allResults) {
      const article = result.data?.article;
      if (result.isSuccess && article) {
        const len = article.textContent?.length || 0;
        if (len > longestLength) {
          longestLength = len;
          longestArticle = article;
        }
      }
    }
    if (longestArticle) {
      return longestArticle;
    }

    // 3. Timeout fallback: after 5s, use any article with a title
    if (forceUseAvailable) {
      for (const result of allResults) {
        const article = result.data?.article;
        if (article?.title) {
          return article;
        }
      }
    }

    return null;
  }, [results, forceUseAvailable]);

  // Fetch ad - pass article data for better targeting
  const { ad: gravityAd, fireImpression } = useGravityAd({
    url,
    title: firstSuccessfulArticle?.title,
    textContent: firstSuccessfulArticle?.textContent,
    isPremium,
  });

  // Handle article load: save to history
  useEffect(() => {
    if (!firstSuccessfulArticle || initializedUrlRef.current === url) return;

    initializedUrlRef.current = url;

    // Save to history
    addArticleToHistory(url, firstSuccessfulArticle.title || "Untitled Article");
  }, [firstSuccessfulArticle, url]);

  const handleViewModeChange = React.useCallback(
    (mode: (typeof viewModes)[number]) => {
      setQuery({ view: mode });
    },
    [setQuery]
  );

  const handleSidebarChange = React.useCallback(
    (next: boolean) => {
      setQuery({ sidebar: next ? true : null });
    },
    [setQuery]
  );

  const handleSourceChange = React.useCallback(
    (next: Source) => {
      setQuery({ source: next });
    },
    [setQuery]
  );

  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [adDismissed, setAdDismissed] = useState(false);
  const [mobileSummaryOpen, setMobileSummaryOpen] = useState(false);
  const mobileAdRef = useRef<HTMLAnchorElement>(null);
  const [mobileAdImpression, setMobileAdImpression] = useState(false);

  // Track mobile ad impression
  useEffect(() => {
    if (mobileAdImpression || !mobileAdRef.current || !gravityAd) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !mobileAdImpression) {
          setMobileAdImpression(true);
          fireImpression(gravityAd.impUrl);
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(mobileAdRef.current);
    return () => observer.disconnect();
  }, [mobileAdImpression, gravityAd, fireImpression]);

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
      {/* Promo Banner - above everything */}
      <PromoBanner />

      <div className="flex-1 overflow-hidden flex flex-col">
        <header className="z-30 flex h-14 shrink-0 items-center border-b border-border/40 bg-background px-4">
          {/* Mobile Header - Clean with back button */}
          <div className="md:hidden flex items-center gap-3 shrink-0">
            <button
              onClick={() => window.history.back()}
              className="size-9 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="size-5" />
            </button>
          </div>

          {/* Desktop Header - Logo */}
          <div className="hidden md:flex items-center gap-3 shrink-0">
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

            {/* View Mode Pills - Desktop: more visible with solid background */}
            <div className="hidden md:flex items-center p-1 bg-muted rounded-xl" role="group" aria-label="View mode">
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

          {/* Center: Domain on mobile, Spacer on desktop */}
          <div className="flex-1 flex items-center justify-center md:justify-start">
            {/* Mobile: Show source domain */}
            <span className="md:hidden text-sm font-medium text-muted-foreground truncate max-w-[200px]">
              {(() => {
                try {
                  return new URL(url).hostname.replace('www.', '').toUpperCase();
                } catch {
                  return '';
                }
              })()}
            </span>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            {/* Desktop Actions - Reorganized with overflow menu */}
            <div className="hidden md:flex items-center gap-1.5">
              {/* Summary button - shows when sidebar is closed */}
              {!sidebarOpen && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSidebarChange(true)}
                  className="gap-1.5"
                >
                  <PanelRightOpen className="size-4" />
                  Summary
                </Button>
              )}

              <ShareButton
                url={`https://smry.ai/proxy?url=${encodeURIComponent(url)}`}
                source={source || "smry-fast"}
                viewMode={viewMode || "markdown"}
                sidebarOpen={sidebarOpen}
                articleTitle={articleTitle}
              />

              <CopyPageDropdown
                url={url}
                articleTitle={articleTitle}
                textContent={articleTextContent}
                source={source}
                viewMode={viewMode}
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
                <MenuPopup side="bottom" align="end" className="min-w-[180px]">
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

            {/* Mobile Actions - Simplified header with summary trigger */}
            <div className="md:hidden flex items-center gap-1.5">
              {/* Summary trigger button */}
              <button
                onClick={() => setMobileSummaryOpen(true)}
                className={cn(
                  "size-9 flex items-center justify-center rounded-full transition-colors",
                  mobileSummaryOpen
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
                aria-label="Open summary"
              >
                <SummaryIcon className="size-5" />
              </button>

              {/* Settings drawer - triggered from bottom bar */}
              <SettingsDrawer
                open={settingsOpen}
                onOpenChange={setSettingsOpen}
                viewMode={viewMode}
                onViewModeChange={handleViewModeChange}
              />
            </div>
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
                  aria-label="Open summary sidebar"
                >
                  <PanelRightOpen className="size-4" />
                </button>
              )}

              <ResizablePanelGroup direction="horizontal" className="h-full">
                {/* Main content panel */}
                <ResizablePanel defaultSize={70} minSize={50}>
                  <div className="h-full overflow-y-auto bg-card">
                    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-6">
                      <ArrowTabs
                        url={url}
                        articleResults={results}
                        viewMode={viewMode}
                        activeSource={source}
                        onSourceChange={handleSourceChange}
                        summaryOpen={sidebarOpen}
                        onSummaryOpenChange={handleSidebarChange}
                        showInlineSummary={false}
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
                    <InlineSummary
                      urlProp={url}
                      articleResults={results}
                      isOpen={sidebarOpen}
                      onOpenChange={handleSidebarChange}
                      variant="sidebar"
                      ad={!isPremium ? gravityAd : null}
                      onAdVisible={gravityAd ? () => fireImpression(gravityAd.impUrl) : undefined}
                    />
                  </div>
                </ResizablePanel>
              </ResizablePanelGroup>

              {/* Fixed bottom-right ad when sidebar is closed */}
              {!sidebarOpen && !isPremium && gravityAd && (
                <div className="fixed bottom-6 right-6 z-40 w-80">
                  <GravityAd
                    ad={gravityAd}
                    onVisible={() => fireImpression(gravityAd.impUrl)}
                    className="shadow-lg shadow-black/5"
                  />
                </div>
              )}
            </div>
          ) : (
            // Mobile: Clean article-first layout with bottom bar
            <div className="h-full overflow-y-auto bg-card pb-16">
              <div className="mx-auto max-w-3xl px-4 sm:px-6 py-6">
                {/* Article content - no inline summary, it's in the drawer now */}
                <ArrowTabs
                  url={url}
                  articleResults={results}
                  viewMode={viewMode}
                  activeSource={source}
                  onSourceChange={handleSourceChange}
                  summaryOpen={false}
                  onSummaryOpenChange={() => {}}
                  showInlineSummary={false}
                />
              </div>

              {/* Summary Drawer */}
              <Drawer open={mobileSummaryOpen} onOpenChange={setMobileSummaryOpen}>
                <DrawerContent className="h-[85vh] flex flex-col">
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 pt-2 pb-3 border-b border-border shrink-0">
                    <button
                      onClick={() => setMobileSummaryOpen(false)}
                      className="size-8 flex items-center justify-center rounded-full bg-muted/60 hover:bg-muted text-muted-foreground"
                    >
                      <X className="size-4" />
                    </button>
                    <DrawerTitle className="text-lg font-semibold">Summary</DrawerTitle>
                    <div className="size-8" />
                  </div>

                  {/* Content - renders InlineSummary in drawer mode */}
                  <div className="flex-1 overflow-y-auto">
                    <InlineSummary
                      urlProp={url}
                      articleResults={results}
                      isOpen={true}
                      onOpenChange={() => setMobileSummaryOpen(false)}
                      variant="sidebar"
                      ad={!isPremium ? gravityAd : null}
                      onAdVisible={gravityAd ? () => fireImpression(gravityAd.impUrl) : undefined}
                    />
                  </div>
                </DrawerContent>
              </Drawer>

              {/* Mobile Ad Bar - minimal, above bottom nav */}
              {!isPremium && !adDismissed && gravityAd && (
                <div className="fixed inset-x-0 z-40 bottom-[calc(3.5rem+env(safe-area-inset-bottom))]">
                  <GravityAd
                    ad={gravityAd}
                    variant="bar"
                    onVisible={() => fireImpression(gravityAd.impUrl)}
                    onDismiss={() => setAdDismissed(true)}
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
                onOpenSettings={() => setSettingsOpen(true)}
                activeSource={source || "smry-fast"}
                onSourceChange={handleSourceChange}
                sourceCharCounts={{
                  "smry-fast": results["smry-fast"]?.data?.article?.textContent?.length || 0,
                  "smry-slow": results["smry-slow"]?.data?.article?.textContent?.length || 0,
                  "wayback": results["wayback"]?.data?.article?.textContent?.length || 0,
                  "jina.ai": results["jina.ai"]?.data?.article?.textContent?.length || 0,
                }}
              />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
