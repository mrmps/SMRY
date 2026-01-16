"use client";

import React, { useEffect, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import { useArticles } from "@/lib/hooks/use-articles";
import { addArticleToHistory } from "@/lib/hooks/use-history";
import { EllipsisHorizontalIcon } from "@heroicons/react/24/outline";
// TODO: Re-enable ad spots when ready
// import { AdSpotSidebar, AdSpotMobileBar } from "@/components/marketing/ad-spot";
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
  MessageSquare,
  PanelRightOpen,
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
import { PromoBanner } from "@/components/marketing/promo-banner";
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
      <span 
        className={cn(
          "absolute -bottom-0.5 -right-0.5 flex size-3.5 items-center justify-center rounded-full text-[8px] font-bold text-white shadow-sm transition-opacity",
          showBadge 
            ? "bg-linear-to-r from-amber-400 to-orange-500 opacity-100" 
            : "opacity-0 pointer-events-none"
        )}
        aria-hidden={!showBadge}
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
  const { isPremium, isLoading } = useIsPremium();

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

  // Handle article load: save to history + auto-expand for free users
  useEffect(() => {
    if (!firstSuccessfulArticle || initializedUrlRef.current === url) return;

    initializedUrlRef.current = url;

    // Save to history
    addArticleToHistory(url, firstSuccessfulArticle.title || "Untitled Article");

    // Auto-expand sidebar for free users (after premium status loads)
    if (!isLoading && !isPremium && !sidebarOpen) {
      setQuery({ sidebar: true });
    }
  }, [firstSuccessfulArticle, url, isLoading, isPremium, sidebarOpen, setQuery]);

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

  // Resizable panel state
  const summaryPanelRef = useRef<ImperativePanelHandle>(null);
  const [isAnimating, setIsAnimating] = React.useState(false);
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync panel state with sidebarOpen
  useEffect(() => {
    const panel = summaryPanelRef.current;
    if (!panel) return;

    const isExpanded = panel.getSize() > 0;
    if (sidebarOpen === isExpanded) return;

    // Clear any existing timeout
    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current);
    }

    // Use RAF to batch DOM updates and avoid synchronous state in effect
    const rafId = requestAnimationFrame(() => {
      setIsAnimating(true);
      if (sidebarOpen) {
        panel.expand(25);
      } else {
        panel.collapse();
      }

      animationTimeoutRef.current = setTimeout(() => {
        setIsAnimating(false);
        animationTimeoutRef.current = null;
      }, 300);
    });

    return () => {
      cancelAnimationFrame(rafId);
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
    };
  }, [sidebarOpen]);

  return (
    <div className="flex h-dvh flex-col bg-background">
      {/* Promo Banner - above everything */}
      <PromoBanner />

      {/* TODO: Re-enable ad spots
      <div className="hidden xl:block fixed left-4 top-20 z-40">
        <AdSpotSidebar hidden={isLoading || isPremium} />
      </div>

      <div className="xl:hidden">
        <AdSpotMobileBar hidden={isLoading || isPremium} />
      </div>
      */}
      
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
            <div className="md:hidden flex items-center gap-1">
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

              {/* User Section */}
              <AuthBar variant="compact" showUpgrade={false} />
              
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

        {/* Content Area */}
        <main className="flex-1 overflow-hidden">
          {/* Desktop: Resizable panels */}
          <div className="hidden lg:block h-full relative">
            {/* Collapsed sidebar expand button */}
            {!sidebarOpen && (
              <button
                onClick={() => handleSidebarChange(true)}
                className="absolute right-0 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-6 h-12 bg-muted/80 hover:bg-muted border border-border border-r-0 rounded-l-md text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Open summary sidebar"
              >
                <PanelRightOpen className="size-4" />
              </button>
            )}
            <ResizablePanelGroup
              direction="horizontal"
              className="h-full w-full"
            >
              <ResizablePanel defaultSize={70} minSize={40}>
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
                    />
                  </div>
                </div>
              </ResizablePanel>

              <ResizableHandle
                withHandle
                className={cn(
                  "transition-opacity duration-200",
                  !sidebarOpen && "opacity-0 pointer-events-none w-0"
                )}
              />

              <ResizablePanel
                ref={summaryPanelRef}
                defaultSize={sidebarOpen ? 25 : 0}
                minSize={20}
                maxSize={50}
                collapsible
                collapsedSize={0}
                className={cn(
                  "bg-card overflow-hidden",
                  "transition-[flex-grow,flex-basis] duration-300 ease-out",
                  !sidebarOpen && "pointer-events-none"
                )}
                onCollapse={() => {
                  if (sidebarOpen) handleSidebarChange(false);
                }}
                onExpand={() => {
                  if (!sidebarOpen) handleSidebarChange(true);
                }}
              >
                <div
                  className="h-full overflow-y-auto border-l border-border p-4"
                  style={{
                    minWidth: !sidebarOpen || isAnimating ? "280px" : "100%"
                  }}
                >
                  <InlineSummary
                    urlProp={url}
                    articleResults={results}
                    isOpen={sidebarOpen}
                    onOpenChange={handleSidebarChange}
                    variant="sidebar"
                  />
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>

          {/* Mobile: Simple scrollable layout */}
          <div className="lg:hidden h-full bg-card pb-20 overflow-y-auto">
            <div className="mx-auto max-w-3xl px-4 sm:px-6 py-6">
              <ArrowTabs
                url={url}
                articleResults={results}
                viewMode={viewMode}
                activeSource={source}
                onSourceChange={handleSourceChange}
                summaryOpen={sidebarOpen}
                onSummaryOpenChange={handleSidebarChange}
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
