"use client";

import React, { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { useArticles } from "@/lib/hooks/use-articles";
import { addArticleToHistory } from "@/lib/hooks/use-history";
import { EllipsisHorizontalIcon } from "@heroicons/react/24/outline";
import { AdSpotSidebar, AdSpotMobileBar } from "@/components/marketing/ad-spot";
import { useAuth, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import ShareButton from "@/components/features/share-button";
import { CopyPageDropdown } from "@/components/features/copy-page-dropdown";
import { buttonVariants, Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import ArrowTabs from "@/components/article/tabs";
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
  ip: string;
  initialSource?: Source;
  initialViewMode?: "markdown" | "html" | "iframe";
  initialSidebarOpen?: boolean;
}

export function ProxyContent({ url, ip }: ProxyContentProps) {
  const { results } = useArticles(url);
  const { theme, setTheme } = useTheme();
  const { isPremium, isLoading } = useIsPremium();

  const viewModes = ["markdown", "html", "iframe"] as const;

  const [query, setQuery] = useQueryStates(
    {
      url: parseAsString.withDefault(url),
      source: parseAsStringLiteral(SOURCES).withDefault("smry-fast"),
      view: parseAsStringLiteral(viewModes).withDefault("markdown"),
      sidebar: parseAsBoolean.withDefault(false),
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

  // Track if we've already saved to history for this URL
  const savedToHistoryRef = useRef<string | null>(null);

  // Save to history when first article is successfully loaded
  useEffect(() => {
    // Find the first successful source
    const firstSuccess = Object.entries(results).find(
      ([, result]) => result.isSuccess && result.data?.article?.title
    );

    if (firstSuccess && savedToHistoryRef.current !== url) {
      const [, result] = firstSuccess;
      const title = result.data?.article?.title || "Untitled Article";
      addArticleToHistory(url, title);
      savedToHistoryRef.current = url;
    }
  }, [results, url]);

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

  return (
    <div className="flex h-dvh flex-col bg-background">
      {/* Desktop Ad Spot - Left sidebar */}
      <div className="hidden xl:block fixed left-4 top-20 z-40">
        <AdSpotSidebar hidden={isLoading || isPremium} />
      </div>

      {/* Mobile Ad Spot - Bottom bar */}
      <div className="xl:hidden">
        <AdSpotMobileBar hidden={isLoading || isPremium} />
      </div>
      
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
            <div className="hidden md:flex items-center p-1 bg-muted rounded-xl">
              <button
                onClick={() => handleViewModeChange("markdown")}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-lg transition-all",
                  viewMode === "markdown"
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                )}
              >
                reader
              </button>
              <button
                onClick={() => handleViewModeChange("html")}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-lg transition-all",
                  viewMode === "html"
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                )}
              >
                original
              </button>
              <button
                onClick={() => handleViewModeChange("iframe")}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-lg transition-all",
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
              <div className="flex items-center gap-1.5 ml-1">
                <SignedIn>
                  <UserButton
                    appearance={{
                      elements: {
                        avatarBox: "size-7"
                      }
                    }}
                  />
                </SignedIn>
                <SignedOut>
                  <Link
                    href="/pricing"
                    className="px-3 py-1 text-sm font-medium rounded-full border border-border bg-background text-foreground hover:bg-accent transition-colors"
                  >
                    Get Pro
                  </Link>
                </SignedOut>
              </div>

              {/* Overflow Menu for less common actions */}
              <Menu>
                <MenuTrigger
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
                        <MoreHorizontal className="size-4" />
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
              <div className="flex items-center">
                <SignedIn>
                  <UserButton
                    appearance={{
                      elements: {
                        avatarBox: "size-7"
                      }
                    }}
                  />
                </SignedIn>
                <SignedOut>
                  <Link
                    href="/pricing"
                    className="px-2.5 py-0.5 text-xs font-medium rounded-full border border-border bg-background text-foreground"
                  >
                    Pro
                  </Link>
                </SignedOut>
              </div>
              
              <Drawer open={settingsOpen} onOpenChange={setSettingsOpen}>
                <DrawerTrigger
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
          <div className="h-full overflow-y-auto overscroll-y-none bg-card pb-20 lg:pb-0">
            <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-6 min-h-[calc(100vh-3.5rem)]">
              <ArrowTabs
                url={url}
                ip={ip}
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
