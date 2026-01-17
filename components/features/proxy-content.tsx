"use client";

import React, { useEffect, useRef, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useArticles } from "@/lib/hooks/use-articles";
import { addArticleToHistory } from "@/lib/hooks/use-history";
import { EllipsisHorizontalIcon } from "@heroicons/react/24/outline";
import { useAuth, SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
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
  MessageSquare,
  PanelRightOpen,
  X,
  Zap,
  LogIn,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import ShareButton from "@/components/features/share-button";
import { CopyPageDropdown } from "@/components/features/copy-page-dropdown";
import { buttonVariants, Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import ArrowTabs from "@/components/article/tabs";
import { InlineSummary } from "@/components/features/inline-summary";
import { useIsDesktop } from "@/lib/hooks/use-media-query";
import { useGravityAd } from "@/lib/hooks/use-gravity-ad";
import { GravityAd } from "@/components/ads/gravity-ad";
import { PromoBanner } from "@/components/marketing/promo-banner";
import { storeReturnUrl } from "@/lib/hooks/use-return-url";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  Menu,
  MenuTrigger,
  MenuPopup,
  MenuItem,
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

const ModeToggle = dynamic(
  () => import("@/components/shared/mode-toggle").then((mod) => mod.ModeToggle),
  { ssr: false, loading: () => <div className="size-9" /> }
);

// History button that links to /history for signed-in users, /pricing for signed-out
function HistoryButton({ variant = "desktop" }: { variant?: "desktop" | "mobile" }) {
  const { isSignedIn, isLoaded } = useAuth();
  
  const isDesktop = variant === "desktop";
  const href = isSignedIn ? "/history" : "/pricing";
  const showBadge = isLoaded && !isSignedIn;
  
  return (
    <Link
      href={href}
      className={cn(
        buttonVariants({ variant: "ghost", size: "icon" }),
        isDesktop
          ? "h-9 w-9 text-muted-foreground hover:text-foreground relative"
          : "h-8 w-8 rounded-lg hover:bg-accent text-muted-foreground relative"
      )}
      title={isSignedIn ? "History" : "History (Premium)"}
    >
      <HistoryIcon className="size-4" />
      {!isDesktop && <span className="sr-only">History</span>}
      {/* Premium badge for non-signed-in users - always reserve space to prevent shift */}
      {/* suppressHydrationWarning: auth state differs between server/client */}
      <span
        className={cn(
          "absolute -bottom-0.5 -right-0.5 flex size-3.5 items-center justify-center rounded-full text-[8px] font-bold text-white shadow-sm transition-opacity",
          showBadge
            ? "bg-linear-to-r from-amber-400 to-orange-500 opacity-100"
            : "opacity-0 pointer-events-none"
        )}
        aria-hidden={!showBadge}
        suppressHydrationWarning
      >
        ★
      </span>
    </Link>
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
  const { theme, setTheme } = useTheme();
  const { isPremium } = useIsPremium();
  const isDesktop = useIsDesktop();

  // Fetch ad immediately - never cached
  const { ad: gravityAd, fireImpression } = useGravityAd({ url, isPremium });

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

  // Find first successful article result
  const firstSuccessfulArticle = useMemo(() => {
    const entry = Object.entries(results).find(
      ([, result]) => result.isSuccess && result.data?.article?.title
    );
    return entry ? entry[1].data?.article : null;
  }, [results]);

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
          {/* Left: Logo */}
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

          {/* Center: Spacer */}
          <div className="flex-1" />

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
                url={`https://smry.ai/${url}`}
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

              {/* Separator */}
              <div className="w-px h-5 bg-border/60 mx-1" />

              {/* Secondary Actions */}
              <HistoryButton variant="desktop" />
              <ModeToggle />

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
                <MenuPopup side="bottom" align="end">
                  <MenuItem
                    render={(props) => {
                      const { key, ...rest } = props as typeof props & { key?: React.Key };
                      return (
                        <a
                          key={key}
                          {...rest}
                          href="https://smryai.userjot.com/"
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-2 w-full"
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
                      const { key, ...rest } = props as typeof props & { key?: React.Key };
                      return (
                        <a
                          key={key}
                          {...rest}
                          href="https://smryai.userjot.com/"
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-2 w-full"
                        >
                          <MessageSquare className="size-4" />
                          <span className="flex-1">Send Feedback</span>
                          <ExternalLink className="size-3 opacity-50 shrink-0" />
                        </a>
                      );
                    }}
                  />
                </MenuPopup>
              </Menu>
            </div>

            {/* Mobile Actions */}
            <div className="md:hidden flex items-center gap-1.5">
              <ShareButton
                url={`https://smry.ai/${url}`}
                source={source || "smry-fast"}
                viewMode={viewMode || "markdown"}
                sidebarOpen={sidebarOpen}
                articleTitle={articleTitle}
                triggerVariant="icon"
              />

              <CopyPageDropdown
                url={url}
                articleTitle={articleTitle}
                textContent={articleTextContent}
                source={source}
                viewMode={viewMode}
                triggerVariant="icon"
              />

              <HistoryButton variant="mobile" />
              
              <Drawer open={settingsOpen} onOpenChange={setSettingsOpen}>
                <DrawerTrigger
                  id="settings-drawer-trigger"
                  render={(renderProps) => {
                    const { className, ...triggerProps } = renderProps;
                    const { key, ...restProps } = triggerProps as typeof triggerProps & {
                      key?: React.Key;
                    };
                    return (
                      <Button
                        {...restProps}
                        key={key}
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "h-8 w-8 rounded-lg hover:bg-accent",
                          className
                        )}
                      >
                        <EllipsisHorizontalIcon key={"settings-icon"} className="size-6 text-muted-foreground" />
                        <span key={"settings-text"} className="sr-only">Settings</span>
                      </Button>
                    );
                  }}
                />
                <DrawerContent>
                  <DrawerHeader className="text-left border-b border-border pb-4">
                    <DrawerTitle>Settings</DrawerTitle>
                    <DrawerDescription>
                      Customize view and appearance
                    </DrawerDescription>
                  </DrawerHeader>
                  <div className="p-4 space-y-6 pb-8">
                    {/* Account Section */}
                    <div className="space-y-3">
                      <label className="text-sm font-medium text-muted-foreground">
                        Account
                      </label>
                      <SignedIn>
                        <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                          <UserButton
                            appearance={{
                              elements: {
                                avatarBox: "size-9",
                              },
                            }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">Signed in</p>
                            {!isPremium && (
                              <Link
                                href="/pricing"
                                className="text-xs text-primary hover:underline"
                                onClick={() => setSettingsOpen(false)}
                              >
                                Upgrade to Pro
                              </Link>
                            )}
                          </div>
                        </div>
                      </SignedIn>
                      <SignedOut>
                        <div className="grid grid-cols-2 gap-2">
                          <SignInButton mode="modal" fallbackRedirectUrl="/">
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full gap-2"
                              onClick={() => {
                                storeReturnUrl();
                                setSettingsOpen(false);
                              }}
                            >
                              <LogIn className="size-4" />
                              Sign In
                            </Button>
                          </SignInButton>
                          <Link
                            href="/pricing"
                            onClick={() => {
                              storeReturnUrl();
                              setSettingsOpen(false);
                            }}
                            className={cn(
                              buttonVariants({ variant: "default", size: "sm" }),
                              "w-full gap-2"
                            )}
                          >
                            <Zap className="size-4" />
                            Get Pro
                          </Link>
                        </div>
                      </SignedOut>
                    </div>

                    {/* View Mode Section */}
                    <div className="space-y-3">
                      <label className="text-sm font-medium text-muted-foreground">
                        View Mode
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        <Button
                          variant={
                            viewMode === "markdown" ? "secondary" : "outline"
                          }
                          size="sm"
                          onClick={() => {
                            handleViewModeChange("markdown");
                            setSettingsOpen(false);
                          }}
                          className="w-full"
                        >
                          Reader
                        </Button>
                        <Button
                          variant={viewMode === "html" ? "secondary" : "outline"}
                          size="sm"
                          onClick={() => {
                            handleViewModeChange("html");
                            setSettingsOpen(false);
                          }}
                          className="w-full"
                        >
                          Original
                        </Button>
                        <Button
                          variant={
                            viewMode === "iframe" ? "secondary" : "outline"
                          }
                          size="sm"
                          onClick={() => {
                            handleViewModeChange("iframe");
                            setSettingsOpen(false);
                          }}
                          className="w-full"
                        >
                          Iframe
                        </Button>
                      </div>
                    </div>

                    {/* Appearance Section */}
                    <div className="space-y-3">
                      <label className="text-sm font-medium text-muted-foreground">
                        Appearance
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        <Button
                          variant={theme === "light" ? "secondary" : "outline"}
                          size="sm"
                          onClick={() => setTheme("light")}
                          className="w-full"
                        >
                          <Sun className="mr-2 size-4" />
                          Light
                        </Button>
                        <Button
                          variant={theme === "dark" ? "secondary" : "outline"}
                          size="sm"
                          onClick={() => setTheme("dark")}
                          className="w-full"
                        >
                          <Moon className="mr-2 size-4" />
                          Dark
                        </Button>
                        <Button
                          variant={theme === "system" ? "secondary" : "outline"}
                          size="sm"
                          onClick={() => setTheme("system")}
                          className="w-full"
                        >
                          <Laptop className="mr-2 size-4" />
                          System
                        </Button>
                      </div>
                    </div>

                    {/* Support Section */}
                    <div className="space-y-3">
                      <label className="text-sm font-medium text-muted-foreground">
                        Support
                      </label>
                      <a
                        href="https://smryai.userjot.com/"
                        target="_blank"
                        rel="noreferrer"
                        className={cn(
                          buttonVariants({ variant: "outline", size: "sm" }),
                          "w-full justify-start gap-2"
                        )}
                        onClick={() => setSettingsOpen(false)}
                      >
                        <BugIcon className="size-4" />
                        Report Bug / Feedback
                      </a>
                    </div>
                  </div>
                </DrawerContent>
              </Drawer>
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
                  <div className="rounded-xl border border-border/60 bg-card/95 backdrop-blur-sm p-4">
                    <GravityAd
                      ad={gravityAd}
                      onVisible={() => fireImpression(gravityAd.impUrl)}
                      className="!mt-0"
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            // Mobile: Simple layout with floating bottom ad
            <div className="h-full overflow-y-auto bg-card pb-20">
              <div className="mx-auto max-w-3xl px-4 sm:px-6 py-6">
                <InlineSummary
                  urlProp={url}
                  articleResults={results}
                  isOpen={sidebarOpen}
                  onOpenChange={handleSidebarChange}
                  variant="inline"
                />
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

              {/* Floating bottom ad */}
              {!isPremium && gravityAd && !adDismissed && (
                <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/60 bg-card/95 backdrop-blur-sm safe-area-bottom">
                  <div className="mx-auto max-w-3xl px-4 py-3">
                    <div className="flex items-start gap-3">
                      <a
                        href={gravityAd.clickUrl}
                        target="_blank"
                        rel="sponsored noopener"
                        className="group flex flex-1 items-start gap-3 min-w-0"
                        ref={mobileAdRef}
                      >
                        {/* Favicon from external ad provider - unoptimized for external domains */}
                        {gravityAd.favicon && (
                          <Image
                            src={gravityAd.favicon}
                            alt=""
                            width={36}
                            height={36}
                            className="size-9 rounded-lg shrink-0"
                            unoptimized
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50 mb-1">
                            Sponsored
                          </p>
                          <p className="text-sm font-medium text-foreground leading-snug group-hover:text-primary transition-colors line-clamp-2">
                            {gravityAd.title}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {gravityAd.brandName}
                          </p>
                        </div>
                      </a>
                      <button
                        onClick={() => setAdDismissed(true)}
                        className="shrink-0 p-1 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-muted/50 transition-colors"
                        aria-label="Dismiss ad"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
