"use client";

import React, { useState } from "react";
import {
  Share2 as ShareIcon,
  Link2,
  Check,
  Linkedin,
  X,
  Copy,
  ShareIos,
  ArrowLeft,
  ChevronRight,
} from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { generateShareUrls } from "@/lib/share-urls";
import { Button } from "@/components/ui/button";
import { ResponsiveDrawer } from "@/components/features/responsive-drawer";
import { ExportArticleContent, type ArticleExportData } from "@/components/features/export-article";

import { Source } from "@/types/api";

// Reddit SVG
const RedditIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z" />
  </svg>
);

const XTwitterIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

interface ShareButtonDataProps {
  url: string;
  originalUrl?: string;
  articleTitle?: string;
  source?: Source;
  viewMode?: string;
  sidebarOpen?: boolean;
  articleExportData?: ArticleExportData;
}

interface ShareButtonProps extends ShareButtonDataProps {
  triggerVariant?: "text" | "icon";
  triggerClassName?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

// Check for native share support once at module level
const hasNativeShareSupport =
  typeof navigator !== "undefined" && "share" in navigator;

// Memoized modal content
const ShareModalContent = React.memo(function ShareModalContent({
  articleTitle,
  url,
  originalUrl,
  source: _source,
  articleExportData,
  onClose,
}: ShareButtonDataProps & { onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const [view, setView] = useState<"share" | "export">("share");

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy link:", error);
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ url });
        onClose();
      } catch (error) {
        console.log("Share cancelled:", error);
      }
    }
  };

  const shareUrls = generateShareUrls(originalUrl || "");

  // Export view
  if (view === "export" && articleExportData) {
    return (
      <div className="flex flex-col">
        {/* Header with back button */}
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setView("share")}
              className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors -ml-1"
              aria-label="Back to share"
            >
              <ArrowLeft className="size-4" />
            </button>
            <h2 className="text-base font-semibold text-foreground">Export Article</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors -mr-1"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Export content */}
        <div className="px-4 pb-6">
          <ExportArticleContent data={articleExportData} />
        </div>
      </div>
    );
  }

  // Share view (default)
  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <h2 className="text-base font-semibold text-foreground">Share</h2>
        <button
          type="button"
          onClick={onClose}
          className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors -mr-1"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Content */}
      <div className="px-4 pb-6">
        {/* Article Preview Card */}
        <div className="rounded-xl border border-border bg-muted/30 p-4 mb-5">
          <p className="text-[15px] font-medium text-foreground leading-snug line-clamp-2 mb-1.5">
            {articleTitle || "Untitled article"}
          </p>
          <p className="text-xs text-muted-foreground">
            via smry.ai
          </p>
        </div>

        {/* Copy Link Section */}
        <div className="mb-5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">
            Link
          </label>
          <div className="flex gap-2">
            <div className="flex-1 flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2.5 min-w-0">
              <Link2 className="size-4 text-muted-foreground shrink-0" />
              <span className="text-sm text-muted-foreground truncate">
                {url}
              </span>
            </div>
            <button
              onClick={handleCopy}
              className={cn(
                "shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all",
                copied
                  ? "bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              )}
            >
              {copied ? (
                <>
                  <Check className="size-4" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="size-4" />
                  Copy
                </>
              )}
            </button>
          </div>
        </div>

        {/* Share Options */}
        <div className="mb-5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">
            Share to
          </label>
          <div className="flex flex-wrap gap-1.5">
            {hasNativeShareSupport && (
              <button
                onClick={handleNativeShare}
                className="flex h-6 shrink-0 items-center justify-center gap-1.5 rounded-[5px] border-[0.5px] border-border bg-surface-1 px-2.5 text-[12px] font-medium text-muted-foreground shadow-[0_4px_4px_-1px_rgba(0,0,0,0.06),0_1px_1px_0_rgba(0,0,0,0.12)] transition-colors hover:bg-accent hover:text-foreground"
              >
                <ShareIcon className="size-3.5" />
                <span>More</span>
              </button>
            )}

            <a
              href={shareUrls.x}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-6 shrink-0 items-center justify-center gap-1.5 rounded-[5px] border-[0.5px] border-border bg-surface-1 px-2.5 text-[12px] font-medium text-muted-foreground shadow-[0_4px_4px_-1px_rgba(0,0,0,0.06),0_1px_1px_0_rgba(0,0,0,0.12)] transition-colors hover:bg-accent hover:text-foreground"
            >
              <XTwitterIcon className="size-3.5" />
              <span>X</span>
            </a>

            <a
              href={shareUrls.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-6 shrink-0 items-center justify-center gap-1.5 rounded-[5px] border-[0.5px] border-border bg-surface-1 px-2.5 text-[12px] font-medium text-muted-foreground shadow-[0_4px_4px_-1px_rgba(0,0,0,0.06),0_1px_1px_0_rgba(0,0,0,0.12)] transition-colors hover:bg-accent hover:text-foreground"
            >
              <Linkedin className="size-3.5" />
              <span>LinkedIn</span>
            </a>

            <a
              href={shareUrls.reddit}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-6 shrink-0 items-center justify-center gap-1.5 rounded-[5px] border-[0.5px] border-border bg-surface-1 px-2.5 text-[12px] font-medium text-muted-foreground shadow-[0_4px_4px_-1px_rgba(0,0,0,0.06),0_1px_1px_0_rgba(0,0,0,0.12)] transition-colors hover:bg-accent hover:text-foreground"
            >
              <RedditIcon className="size-3.5" />
              <span>Reddit</span>
            </a>
          </div>
        </div>

        {/* Export Article — prominent separate section */}
        {articleExportData && (
          <button
            onClick={() => setView("export")}
            className="w-full flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-muted/50 transition-colors group text-left"
          >
            <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <ShareIos className="size-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Export article</p>
              <p className="text-xs text-muted-foreground">Notion, Obsidian, Markdown &amp; more</p>
            </div>
            <ChevronRight className="size-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
          </button>
        )}
      </div>
    </div>
  );
});

// Memoized trigger component
const ShareTrigger = React.memo(
  React.forwardRef<
    HTMLButtonElement,
    {
      variant: "text" | "icon";
      className?: string;
    } & React.ButtonHTMLAttributes<HTMLButtonElement>
  >(function ShareTrigger({ variant, className, ...props }, ref) {
    return (
      <Button
        ref={ref}
        variant="ghost"
        size={variant === "icon" ? "icon" : "sm"}
        className={cn(
          variant === "icon"
            ? "h-8 w-8 rounded-lg text-muted-foreground hover:bg-accent"
            : "h-8 gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground",
          className,
        )}
        aria-label="Share article"
        {...props}
      >
        <ShareIcon
          className={cn(variant === "icon" ? "size-5" : "mr-1.5 size-3.5")}
        />
        {variant === "icon" ? <span className="sr-only">Share</span> : "Share"}
      </Button>
    );
  }),
);

const ShareButton: React.FC<ShareButtonProps> = React.memo(
  function ShareButton({
    triggerVariant = "text",
    triggerClassName,
    open: controlledOpen,
    onOpenChange: controlledOnOpenChange,
    ...shareProps
  }) {
    const [internalOpen, setInternalOpen] = useState(false);

    // Support both controlled and uncontrolled modes
    const isControlled = controlledOpen !== undefined;
    const open = isControlled ? controlledOpen : internalOpen;
    const setOpen = isControlled ? (controlledOnOpenChange ?? (() => {})) : setInternalOpen;

    const handleClose = React.useCallback(() => {
      setOpen(false);
    }, [setOpen]);

    const trigger = React.useMemo(
      () => (
        <ShareTrigger variant={triggerVariant} className={triggerClassName} />
      ),
      [triggerVariant, triggerClassName],
    );

    return (
      <ResponsiveDrawer
        open={open}
        onOpenChange={setOpen}
        trigger={trigger}
        triggerId="share-modal-trigger"
        showCloseButton={false}
      >
        <ShareModalContent {...shareProps} onClose={handleClose} />
      </ResponsiveDrawer>
    );
  },
);

export default ShareButton;

// Export ShareContent for use elsewhere if needed
export const ShareContent = ShareModalContent;
