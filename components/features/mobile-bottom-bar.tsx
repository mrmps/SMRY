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
  Code,
} from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
type ViewMode = "markdown" | "html" | "iframe";

interface MobileBottomBarProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  smryUrl: string;
  originalUrl: string;
  articleTitle?: string;
  onOpenSettings?: () => void;
  className?: string;
}

export function MobileBottomBar({
  viewMode,
  onViewModeChange,
  smryUrl,
  originalUrl,
  articleTitle,
  onOpenSettings,
  className,
}: MobileBottomBarProps) {
  const [shareDrawerOpen, setShareDrawerOpen] = React.useState(false);
  const [copiedItem, setCopiedItem] = React.useState<string | null>(null);

  const isReader = viewMode === "markdown";

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
    // Use short format without https:// for cleaner tweets
    const xShareText = `smry.ai/${originalUrl}`;
    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(xShareText)}`;
    window.open(tweetUrl, "_blank", "noopener,noreferrer");
    setShareDrawerOpen(false);
  };

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 border-t border-border/40 bg-card/98 backdrop-blur-xl",
        "pb-[env(safe-area-inset-bottom)]",
        className
      )}
    >
      <div className="flex items-center justify-around h-14 px-4">
        {/* View mode toggle - simple Reader/Original toggle */}
        <button
          onClick={() => onViewModeChange(isReader ? "html" : "markdown")}
          className={cn(
            "flex flex-col items-center justify-center gap-0.5 min-w-[64px] py-1.5 transition-colors",
            isReader ? "text-primary" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {isReader ? (
            <>
              <BookOpen className="size-5" />
              <span className="text-[10px] font-medium">Reader</span>
            </>
          ) : (
            <>
              <Code className="size-5" />
              <span className="text-[10px] font-medium">Original</span>
            </>
          )}
        </button>

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

            <div className="px-4 pt-2 pb-4 space-y-3" data-vaul-no-drag>
              {/* Top action buttons */}
              <div className="flex gap-2">
                <button
                  className="flex-1 h-12 flex items-center justify-center gap-2 rounded-xl bg-muted text-foreground font-medium text-sm transition-opacity active:opacity-70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  onClick={handleNativeShare}
                >
                  <Upload className="size-4" aria-hidden="true" />
                  Share
                </button>
                <button
                  className="flex-1 h-12 flex items-center justify-center gap-2 rounded-xl bg-muted text-foreground font-medium text-sm transition-opacity active:opacity-70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  onClick={handleTweet}
                >
                  <Twitter className="size-4" aria-hidden="true" />
                  Tweet
                </button>
              </div>

              {/* Action list card */}
              <div className="bg-muted rounded-xl overflow-hidden">
                <div className="relative">
                  <button
                    onClick={() => handleCopy(smryUrl, "smry")}
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-opacity active:opacity-70 focus-visible:bg-accent focus-visible:outline-none"
                  >
                    <Link2 className="size-5 text-muted-foreground" aria-hidden="true" />
                    <span className="flex-1">Copy smry link</span>
                    {copiedItem === "smry" && (
                      <span className="text-xs text-primary" role="status" aria-live="polite">Copied!</span>
                    )}
                  </button>
                  <div className="absolute bottom-0 left-12 right-0 h-px bg-border/50" />
                </div>

                <div className="relative">
                  <button
                    onClick={() => handleCopy(originalUrl, "original")}
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-opacity active:opacity-70 focus-visible:bg-accent focus-visible:outline-none"
                  >
                    <Copy className="size-5 text-muted-foreground" aria-hidden="true" />
                    <span className="flex-1">Copy original link</span>
                    {copiedItem === "original" && (
                      <span className="text-xs text-primary" role="status" aria-live="polite">Copied!</span>
                    )}
                  </button>
                  <div className="absolute bottom-0 left-12 right-0 h-px bg-border/50" />
                </div>

                <div className="relative">
                  <button
                    onClick={() => {
                      window.open(originalUrl, "_blank", "noopener,noreferrer");
                      setShareDrawerOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-opacity active:opacity-70 focus-visible:bg-accent focus-visible:outline-none"
                  >
                    <ExternalLink className="size-5 text-muted-foreground" aria-hidden="true" />
                    <span className="flex-1">Open original in browser</span>
                  </button>
                  <div className="absolute bottom-0 left-12 right-0 h-px bg-border/50" />
                </div>

                <button
                  onClick={() => {
                    const markdown = `[${articleTitle || "Article"}](${smryUrl})`;
                    handleCopy(markdown, "markdown");
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-opacity active:opacity-70 focus-visible:bg-accent focus-visible:outline-none"
                >
                  <FileText className="size-5 text-muted-foreground" aria-hidden="true" />
                  <span className="flex-1">Copy as markdown</span>
                  {copiedItem === "markdown" && (
                    <span className="text-xs text-primary" role="status" aria-live="polite">Copied!</span>
                  )}
                </button>
              </div>

              {/* Cancel button card */}
              <button
                className="w-full h-12 rounded-xl bg-muted text-muted-foreground font-medium transition-opacity active:opacity-70"
                onClick={() => setShareDrawerOpen(false)}
              >
                Cancel
              </button>
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
