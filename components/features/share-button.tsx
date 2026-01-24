"use client";

import React, { useState } from "react";
import {
  Share2 as ShareIcon,
  Link as LinkIcon,
  Check as CheckIcon,
  Linkedin,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ResponsiveDrawer } from "@/components/features/responsive-drawer";

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

const XIcon = ({ className }: { className?: string }) => (
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
  articleTitle?: string;
  source?: Source;
  viewMode?: string;
  sidebarOpen?: boolean;
}

interface ShareContentProps extends ShareButtonDataProps {
  onActionComplete?: () => void;
}

interface ShareButtonProps extends ShareButtonDataProps {
  triggerVariant?: "text" | "icon";
  triggerClassName?: string;
}

// Check for native share support once at module level
const hasNativeShareSupport =
  typeof navigator !== "undefined" && "share" in navigator;

export const ShareContent: React.FC<ShareContentProps> = React.memo(
  function ShareContent({
    url,
    articleTitle = "Article",
    source = "smry-fast",
    onActionComplete,
  }) {
    const [copied, setCopied] = useState(false);

    const finalUrl = url;

    const handleCopy = async () => {
      try {
        await navigator.clipboard.writeText(finalUrl);
        setCopied(true);
        setTimeout(() => {
          setCopied(false);
          if (onActionComplete) onActionComplete();
        }, 1500);
      } catch (error) {
        console.error("Failed to copy link:", error);
      }
    };

    const handleNativeShare = async () => {
      if (navigator.share) {
        try {
          await navigator.share({
            title: articleTitle,
            text: "Check out this article on smry.ai",
            url: finalUrl,
          });
          if (onActionComplete) onActionComplete();
        } catch (error) {
          console.log("Share cancelled or error:", error);
        }
      }
    };

    const socialLinks = [
      {
        name: "X",
        icon: <XIcon className="size-3.5" />,
        href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(articleTitle)}&url=${encodeURIComponent(finalUrl)}`,
      },
      {
        name: "LinkedIn",
        icon: <Linkedin className="size-3.5" />,
        href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(finalUrl)}`,
      },
      {
        name: "Reddit",
        icon: <RedditIcon className="size-3.5" />,
        href: `https://www.reddit.com/submit?url=${encodeURIComponent(finalUrl)}&title=${encodeURIComponent(articleTitle)}`,
      },
    ];

    return (
      <div className="flex flex-col">
        {/* Article title preview - Linear-style input look */}
        <div className="flex flex-row items-start gap-1 pt-0.5">
          <div className="flex-1 self-start min-w-0 pt-0.5">
            <div className="min-h-0">
              <div
                className="text-[18px] font-semibold leading-6 text-foreground break-words"
                style={{ letterSpacing: '-0.12px' }}
              >
                {articleTitle || "Untitled article"}
              </div>
            </div>
          </div>
        </div>

        {/* Source info - Linear-style muted text */}
        <div className="pt-1.5 pb-4">
          <p
            className="text-[15px] font-[450] text-muted-foreground leading-[22.5px] break-words"
            style={{ letterSpacing: '-0.1px' }}
          >
            smry.ai · {source}
          </p>
        </div>

        {/* URL Preview - Copy button inline */}
        <div className="mb-5">
          <div className="mb-2">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
              Link
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-[5px] border-[0.5px] border-border bg-muted/30 px-3 py-2.5">
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-[450] text-muted-foreground truncate">
                {finalUrl}
              </p>
            </div>
            <button
              onClick={handleCopy}
              className="flex h-6 shrink-0 items-center justify-center gap-1.5 rounded-[5px] border-[0.5px] border-border bg-surface-1 px-2.5 text-[12px] font-medium text-foreground shadow-[0_4px_4px_-1px_rgba(0,0,0,0.06),0_1px_1px_0_rgba(0,0,0,0.12)] transition-colors hover:bg-accent"
            >
              {copied ? (
                <>
                  <CheckIcon className="size-3.5 text-green-500" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <LinkIcon className="size-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Share buttons - Linear-style toolbar */}
        <div className="mb-2">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
            Share to
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 pb-2">
          {hasNativeShareSupport && (
            <button
              onClick={handleNativeShare}
              className="flex h-6 shrink-0 items-center justify-center gap-1.5 rounded-[5px] border-[0.5px] border-border bg-surface-1 px-2.5 text-[12px] font-medium text-muted-foreground shadow-[0_4px_4px_-1px_rgba(0,0,0,0.06),0_1px_1px_0_rgba(0,0,0,0.12)] transition-colors hover:bg-accent hover:text-foreground"
            >
              <ShareIcon className="size-3.5" />
              <span>More</span>
            </button>
          )}

          {socialLinks.map((social) => (
            <a
              key={social.name}
              href={social.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onActionComplete}
              className="flex h-6 shrink-0 items-center justify-center gap-1.5 rounded-[5px] border-[0.5px] border-border bg-surface-1 px-2.5 text-[12px] font-medium text-muted-foreground shadow-[0_4px_4px_-1px_rgba(0,0,0,0.06),0_1px_1px_0_rgba(0,0,0,0.12)] transition-colors hover:bg-accent hover:text-foreground"
            >
              {social.icon}
              <span>{social.name}</span>
            </a>
          ))}
        </div>
      </div>
    );
  },
);

// Memoized trigger component - must forward all props for Base UI's render prop to work
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

// Memoized modal content
const ShareModalContent = React.memo(function ShareModalContent({
  articleTitle,
  url,
  source,
  viewMode,
  sidebarOpen,
  onClose,
}: ShareButtonDataProps & { onClose: () => void }) {
  return (
    <div className="flex h-full flex-col">
      {/* Linear-style header with row-reverse for close button positioning */}
      <div className="flex flex-row-reverse items-center px-3 pt-3 pb-1.5">
        {/* Close button group - right side */}
        <div className="flex shrink-0 items-center gap-1.5 pl-3">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-7 shrink-0 items-center justify-center rounded-[5px] border-[0.5px] border-transparent text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <span className="flex size-4 items-center justify-center" aria-hidden="true">
              <svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16">
                <path d="M2.96967 2.96967C3.26256 2.67678 3.73744 2.67678 4.03033 2.96967L8 6.939L11.9697 2.96967C12.2626 2.67678 12.7374 2.67678 13.0303 2.96967C13.3232 3.26256 13.3232 3.73744 13.0303 4.03033L9.061 8L13.0303 11.9697C13.2966 12.2359 13.3208 12.6526 13.1029 12.9462L13.0303 13.0303C12.7374 13.3232 12.2626 13.3232 11.9697 13.0303L8 9.061L4.03033 13.0303C3.73744 13.3232 3.26256 13.3232 2.96967 13.0303C2.67678 12.7374 2.67678 12.2626 2.96967 11.9697L6.939 8L2.96967 4.03033C2.7034 3.76406 2.6792 3.3474 2.89705 3.05379L2.96967 2.96967Z" />
              </svg>
            </span>
          </button>
        </div>
        {/* Title breadcrumb - left side, grows to fill */}
        <div className="flex flex-1 min-w-0 items-center gap-1.5">
          <div className="flex items-center gap-1.5">
            <span className="flex size-4 items-center justify-center text-muted-foreground">
              <ShareIcon className="size-3.5" />
            </span>
            <span className="text-[13px] font-[450] text-foreground">Share article</span>
          </div>
        </div>
      </div>
      {/* Content area */}
      <div className="flex flex-1 flex-col overflow-hidden px-1.5">
        <div className="flex flex-1 flex-col gap-1.5 px-3 max-w-full">
          <ShareContent
            url={url}
            articleTitle={articleTitle}
            source={source}
            viewMode={viewMode}
            sidebarOpen={sidebarOpen}
            onActionComplete={onClose}
          />
        </div>
      </div>

      {/* Linear-style footer divider */}
      <div className="flex w-full border-t-[0.5px] border-border" />

      {/* Footer with done button */}
      <div className="flex items-center justify-end gap-3 px-3 py-3">
        <button
          type="button"
          onClick={onClose}
          className="flex h-7 shrink-0 items-center justify-center rounded-[5px] border-[0.5px] border-glow/40 bg-glow px-3.5 text-[12px] font-medium text-white shadow-[0_4px_4px_-1px_rgba(0,0,0,0.06),0_1px_1px_0_rgba(0,0,0,0.12)] transition-colors hover:bg-glow/90"
        >
          Done
        </button>
      </div>
    </div>
  );
});

const ShareButton: React.FC<ShareButtonProps> = React.memo(
  function ShareButton({
    triggerVariant = "text",
    triggerClassName,
    ...shareProps
  }) {
    const [open, setOpen] = useState(false);

    const handleClose = React.useCallback(() => {
      setOpen(false);
    }, []);

    const trigger = React.useMemo(
      () => (
        <ShareTrigger variant={triggerVariant} className={triggerClassName} />
      ),
      [triggerVariant, triggerClassName],
    );

    return (
      <ResponsiveDrawer open={open} onOpenChange={setOpen} trigger={trigger} triggerId="share-modal-trigger">
        <ShareModalContent {...shareProps} onClose={handleClose} />
      </ResponsiveDrawer>
    );
  },
);

export default ShareButton;
