"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Share2,
  Upload,
  Link2,
  ExternalLink,
  Twitter,
  FileText,
  Copy,
  Settings,
  BookOpen,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Source } from "@/types/api";

type ViewMode = "markdown" | "html" | "iframe";

const SOURCE_LABELS: Record<Source, string> = {
  "smry-fast": "Fast",
  "smry-slow": "Slow",
  "wayback": "Wayback",
  "jina.ai": "Jina",
};

const SOURCE_ORDER: Source[] = ["smry-fast", "smry-slow", "wayback", "jina.ai"];

interface MobileBottomBarProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  smryUrl: string;
  originalUrl: string;
  articleTitle?: string;
  onOpenSettings?: () => void;
  // Source navigation (for Original mode)
  activeSource?: Source;
  onSourceChange?: (source: Source) => void;
  sourceCharCounts?: Record<Source, number>;
  className?: string;
}

export function MobileBottomBar({
  viewMode,
  onViewModeChange,
  smryUrl,
  originalUrl,
  articleTitle,
  onOpenSettings,
  activeSource = "smry-fast",
  onSourceChange,
  sourceCharCounts,
  className,
}: MobileBottomBarProps) {
  const [shareDrawerOpen, setShareDrawerOpen] = React.useState(false);
  const [sourceDrawerOpen, setSourceDrawerOpen] = React.useState(false);
  const [copiedItem, setCopiedItem] = React.useState<string | null>(null);

  const isReader = viewMode === "markdown";

  // Get current source index and navigate
  const currentIndex = SOURCE_ORDER.indexOf(activeSource);

  const goToPrevSource = () => {
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : SOURCE_ORDER.length - 1;
    onSourceChange?.(SOURCE_ORDER[prevIndex]);
  };

  const goToNextSource = () => {
    const nextIndex = currentIndex < SOURCE_ORDER.length - 1 ? currentIndex + 1 : 0;
    onSourceChange?.(SOURCE_ORDER[nextIndex]);
  };

  const handleCopy = async (text: string, item: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedItem(item);
      setTimeout(() => setCopiedItem(null), 2000);
    } catch {
      // Fallback for older browsers
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: articleTitle || "Article",
          url: smryUrl,
        });
        setShareDrawerOpen(false);
      } catch {
        // User cancelled or error
      }
    }
  };

  const handleTweet = () => {
    const tweetUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(smryUrl)}&text=${encodeURIComponent(articleTitle || "")}`;
    window.open(tweetUrl, "_blank");
    setShareDrawerOpen(false);
  };

  const charCount = sourceCharCounts?.[activeSource];
  const charCountDisplay = charCount ? `${(charCount / 1000).toFixed(1)}K` : null;

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 border-t border-border/40 bg-card/98 backdrop-blur-xl",
        "pb-[env(safe-area-inset-bottom)]",
        className
      )}
    >
      <div className="flex items-center justify-around h-14 px-4">
        {/* First slot: Reader toggle OR Source navigation */}
        {isReader ? (
          // Reader mode: Show toggle to switch to Original
          <button
            onClick={() => onViewModeChange("html")}
            className="flex flex-col items-center justify-center gap-0.5 min-w-[64px] py-1.5 text-muted-foreground hover:text-foreground transition-colors"
          >
            <BookOpen className="size-5" />
            <span className="text-[10px] font-medium">Reader</span>
          </button>
        ) : (
          // Original mode: Show source navigation
          <div className="flex items-center gap-1">
            <button
              onClick={goToPrevSource}
              className="size-8 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Previous source"
            >
              <ChevronLeft className="size-5" />
            </button>

            <Drawer open={sourceDrawerOpen} onOpenChange={setSourceDrawerOpen}>
              <DrawerTrigger
                render={(props) => {
                  const { key, ...rest } = props as typeof props & { key?: React.Key };
                  return (
                    <button
                      {...rest}
                      key={key}
                      className="flex flex-col items-center justify-center gap-0.5 min-w-[64px] py-1 text-foreground"
                    >
                      <span key="source-name" className="text-xs font-medium">
                        {SOURCE_LABELS[activeSource]}
                        {charCountDisplay && (
                          <span className="ml-1 text-muted-foreground">{charCountDisplay}</span>
                        )}
                      </span>
                      <span key="source-hint" className="text-[9px] text-muted-foreground">Tap for all</span>
                    </button>
                  );
                }}
              />
              <DrawerContent className="pb-safe">
                <DrawerHeader className="border-b border-border pb-3">
                  <DrawerTitle>Select Source</DrawerTitle>
                </DrawerHeader>
                <div className="p-4 space-y-2">
                  {SOURCE_ORDER.map((source) => {
                    const count = sourceCharCounts?.[source];
                    const countDisplay = count ? `${(count / 1000).toFixed(1)}K` : "—";
                    const isActive = source === activeSource;

                    return (
                      <button
                        key={source}
                        onClick={() => {
                          onSourceChange?.(source);
                          setSourceDrawerOpen(false);
                        }}
                        className={cn(
                          "w-full flex items-center justify-between p-3 rounded-lg text-left transition-colors",
                          isActive ? "bg-primary/10 text-primary" : "hover:bg-muted"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "size-5 rounded-full border-2 flex items-center justify-center shrink-0",
                            isActive ? "border-primary bg-primary" : "border-muted-foreground/30"
                          )}>
                            {isActive && <div className="size-2 rounded-full bg-white" />}
                          </div>
                          <span className="font-medium">{SOURCE_LABELS[source]}</span>
                        </div>
                        <span className={cn(
                          "text-sm",
                          isActive ? "text-primary" : "text-muted-foreground"
                        )}>
                          {countDisplay}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {/* Back to Reader button */}
                <div className="p-4 pt-0 border-t border-border mt-2">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      onViewModeChange("markdown");
                      setSourceDrawerOpen(false);
                    }}
                  >
                    <BookOpen className="size-4 mr-2" />
                    Back to Reader
                  </Button>
                </div>
              </DrawerContent>
            </Drawer>

            <button
              onClick={goToNextSource}
              className="size-8 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Next source"
            >
              <ChevronRight className="size-5" />
            </button>
          </div>
        )}

        {/* Share */}
        <Drawer open={shareDrawerOpen} onOpenChange={setShareDrawerOpen}>
          <DrawerTrigger
            render={(props) => {
              const { key, ...rest } = props as typeof props & { key?: React.Key };
              return (
                <button
                  {...rest}
                  key={key}
                  className="flex flex-col items-center justify-center gap-0.5 min-w-[64px] py-1.5 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Share2 key="share-icon" className="size-5" />
                  <span key="share-label" className="text-[10px] font-medium">Share</span>
                </button>
              );
            }}
          />
          <DrawerContent className="pb-safe">
            <DrawerHeader className="sr-only">
              <DrawerTitle>Share</DrawerTitle>
            </DrawerHeader>

            {/* Top action buttons */}
            <div className="flex gap-3 px-4 pt-2 pb-4">
              <Button
                variant="outline"
                className="flex-1 h-12 gap-2"
                onClick={handleNativeShare}
              >
                <Upload className="size-4" />
                Share
              </Button>
              <Button
                variant="outline"
                className="flex-1 h-12 gap-2"
                onClick={handleTweet}
              >
                <Twitter className="size-4" />
                Tweet
              </Button>
            </div>

            {/* Action list */}
            <div className="border-t border-border">
              <button
                onClick={() => handleCopy(smryUrl, "smry")}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-muted transition-colors"
              >
                <Link2 className="size-5 text-muted-foreground" />
                <span className="flex-1">Copy smry link</span>
                {copiedItem === "smry" && (
                  <span className="text-xs text-primary">Copied!</span>
                )}
              </button>

              <button
                onClick={() => handleCopy(originalUrl, "original")}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-muted transition-colors"
              >
                <Copy className="size-5 text-muted-foreground" />
                <span className="flex-1">Copy original link</span>
                {copiedItem === "original" && (
                  <span className="text-xs text-primary">Copied!</span>
                )}
              </button>

              <button
                onClick={() => {
                  window.open(originalUrl, "_blank");
                  setShareDrawerOpen(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-muted transition-colors"
              >
                <ExternalLink className="size-5 text-muted-foreground" />
                <span className="flex-1">Open original in browser</span>
              </button>

              <button
                onClick={() => {
                  const markdown = `[${articleTitle || "Article"}](${smryUrl})`;
                  handleCopy(markdown, "markdown");
                }}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-muted transition-colors"
              >
                <FileText className="size-5 text-muted-foreground" />
                <span className="flex-1">Copy as markdown</span>
                {copiedItem === "markdown" && (
                  <span className="text-xs text-primary">Copied!</span>
                )}
              </button>
            </div>

            <div className="p-4 pt-2 border-t border-border">
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => setShareDrawerOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </DrawerContent>
        </Drawer>

        {/* Settings */}
        <button
          onClick={onOpenSettings}
          className="flex flex-col items-center justify-center gap-0.5 min-w-[64px] py-1.5 text-muted-foreground hover:text-foreground transition-colors"
        >
          <Settings className="size-5" />
          <span className="text-[10px] font-medium">Settings</span>
        </button>
      </div>
    </div>
  );
}
