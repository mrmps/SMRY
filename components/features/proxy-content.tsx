"use client";

import React from "react";
import dynamic from "next/dynamic";
import { useArticles } from "@/lib/hooks/use-articles";
import { EllipsisHorizontalIcon } from "@heroicons/react/24/outline";
import { AdSpotSidebar, AdSpotMobileBar } from "@/components/marketing/ad-spot";
import {
  Bug as BugIcon,
  Sparkles as SparklesIcon,
  Sun,
  Moon,
  Laptop,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import ShareButton from "@/components/features/share-button";
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
  useQueryStates,
  parseAsStringLiteral,
  parseAsBoolean,
  parseAsString,
} from "nuqs";
import { Source, SOURCES } from "@/types/api";
import { ResizableModal } from "./resizable-modal";

const ModeToggle = dynamic(
  () => import("@/components/shared/mode-toggle").then((mod) => mod.ModeToggle),
  { ssr: false, loading: () => <div className="size-9" /> }
);


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
  const articleImage = activeArticle?.image;

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

  const content = (
    <div className="flex h-dvh flex-col bg-background">
      {/* Desktop Ad Spot - Left sidebar */}
      <div className="hidden lg:block fixed left-4 top-20 z-40">
        <AdSpotSidebar />
      </div>
      
      {/* Mobile Ad Spot - Bottom bar */}
      <div className="lg:hidden">
        <AdSpotMobileBar />
      </div>
      
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-border/40 bg-background/80 px-4 backdrop-blur-xl supports-backdrop-filter:bg-background/60">
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

        {/* Desktop Control Pills - Hidden on Mobile */}
        <div className="hidden md:flex items-center p-0.5 bg-accent rounded-lg absolute left-1/2 -translate-x-1/2">
          <button
            onClick={() => handleViewModeChange("markdown")}
            className={cn(
              "px-3 py-1 text-xs font-medium rounded-[6px] transition-all",
              viewMode === "markdown"
                ? "bg-card shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            reader
          </button>
          <button
            onClick={() => handleViewModeChange("html")}
            className={cn(
              "px-3 py-1 text-xs font-medium rounded-[6px] transition-all",
              viewMode === "html"
                ? "bg-card shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            original
          </button>
          <button
            onClick={() => handleViewModeChange("iframe")}
            className={cn(
              "px-3 py-1 text-xs font-medium rounded-[6px] transition-all",
              viewMode === "iframe"
                ? "bg-card shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            iframe
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-1">
            <ModeToggle />
            <Button
              variant={sidebarOpen ? "secondary" : "outline"}
              size="sm"
              className="h-8 text-xs font-medium"
              onClick={() => handleSidebarChange(!sidebarOpen)}
            >
              <SparklesIcon className="mr-1.5 size-3.5" />
              Summary
            </Button>
            <ShareButton
              url={`https://smry.ai/${url}`}
              source={source || "smry-fast"}
              viewMode={viewMode || "markdown"}
              sidebarOpen={sidebarOpen}
              articleTitle={articleTitle}
              articleImage={articleImage}
            />
            <a
              href="https://smryai.userjot.com/"
              target="_blank"
              rel="noreferrer"
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                "h-8 text-xs font-medium text-muted-foreground hover:text-foreground"
              )}
            >
              <BugIcon className="mr-1.5 size-3.5" />
              Report Bug
            </a>
          </div>

          {/* Mobile Summary Trigger */}
          <div className="md:hidden flex items-center gap-2">
             <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 rounded-lg text-xs font-medium hover:bg-accent px-2.5"
              onClick={() => handleSidebarChange(!sidebarOpen)}
            >
              <SparklesIcon className="size-4" />
              <span className="sr-only">Summary</span>
            </Button>

            <ShareButton
              url={`https://smry.ai/${url}`}
              source={source || "smry-fast"}
              viewMode={viewMode || "markdown"}
              sidebarOpen={sidebarOpen}
              articleTitle={articleTitle}
              articleImage={articleImage}
              triggerVariant="icon"
            />
            
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
        {/* lg:pl-52 xl:pl-64 leaves room for the fixed ad spot on the left */}
        <div className="h-full overflow-y-auto bg-card lg:pl-52 xl:pl-64">
          <div className="mx-auto max-w-3xl p-6 min-h-[calc(100vh-3.5rem)]">
            <ArrowTabs
              url={url}
              articleResults={results}
              viewMode={viewMode}
              activeSource={source}
              onSourceChange={handleSourceChange}
            />
          </div>
        </div>
      </main>
    </div>
  );

  return (
    <ResizableModal
      url={url}
      ip={ip}
      articleResults={results}
      sidebarOpen={sidebarOpen}
      setSidebarOpen={handleSidebarChange}
    >
      {content}
    </ResizableModal>
  );
}
