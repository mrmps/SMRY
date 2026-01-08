"use client";

import React, { useState } from "react";
import {
  Share2 as ShareIcon,
  Link as LinkIcon,
  Check as CheckIcon,
  Linkedin,
  FileText,
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
    viewMode = "markdown",
    sidebarOpen = true,
    onActionComplete,
  }) {
    const [copied, setCopied] = useState(false);

    const getShareUrl = () => {
      const shareUrl = new URL(url);
      if (source) shareUrl.searchParams.set("source", source);
      if (viewMode) shareUrl.searchParams.set("view", viewMode);
      if (sidebarOpen !== undefined)
        shareUrl.searchParams.set("sidebar", String(sidebarOpen));
      return shareUrl.toString();
    };

    const finalUrl = getShareUrl();

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
        icon: <XIcon className="size-5" />,
        href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(articleTitle)}&url=${encodeURIComponent(finalUrl)}`,
      },
      {
        name: "LinkedIn",
        icon: <Linkedin className="size-5" />,
        href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(finalUrl)}`,
      },
      {
        name: "Reddit",
        icon: <RedditIcon className="size-5" />,
        href: `https://www.reddit.com/submit?url=${encodeURIComponent(finalUrl)}&title=${encodeURIComponent(articleTitle)}`,
      },
    ];

    return (
      <div className="flex flex-col gap-6">
        {/* Preview Card - Simple, no external images */}
        <div className="rounded-xl bg-zinc-100 dark:bg-zinc-900 p-4 border border-border">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-background border border-border">
              <FileText className="size-5 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-base leading-snug text-foreground line-clamp-2">
                {articleTitle}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                smry.ai · {source}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-5 gap-2 sm:flex sm:items-center sm:justify-center sm:gap-8 px-2">
          <button
            onClick={handleCopy}
            className="flex flex-col items-center gap-2 text-muted-foreground hover:text-foreground transition-colors group col-span-1"
          >
            <div className="size-12 rounded-full bg-secondary flex items-center justify-center group-hover:bg-accent group-hover:scale-110 transition-all duration-200">
              {copied ? (
                <CheckIcon className="size-5 text-green-600" />
              ) : (
                <LinkIcon className="size-5" />
              )}
            </div>
            <span className="text-xs font-medium text-center w-full truncate">
              {copied ? "Copied" : "Copy"}
            </span>
          </button>

          {hasNativeShareSupport && (
            <button
              onClick={handleNativeShare}
              className="flex flex-col items-center gap-2 text-muted-foreground hover:text-foreground transition-colors group col-span-1"
            >
              <div className="size-12 rounded-full bg-secondary flex items-center justify-center group-hover:bg-accent group-hover:scale-110 transition-all duration-200">
                <ShareIcon className="size-5" />
              </div>
              <span className="text-xs font-medium text-center w-full truncate">
                More
              </span>
            </button>
          )}

          {socialLinks.map((social) => (
            <a
              key={social.name}
              href={social.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-2 text-muted-foreground hover:text-foreground transition-colors group col-span-1"
              onClick={onActionComplete}
            >
              <div className="size-12 rounded-full bg-secondary flex items-center justify-center group-hover:bg-accent group-hover:scale-110 transition-all duration-200">
                {social.icon}
              </div>
              <span className="text-xs font-medium text-center w-full truncate">
                {social.name}
              </span>
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
    <div className="flex h-full flex-col bg-card">
      <div className="border-b border-border px-6 py-4">
        <h2 className="text-base font-semibold text-foreground">
          {articleTitle || "Share article"}
        </h2>
        <p className="text-sm text-muted-foreground">
          Share this summary with others
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
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
      <ResponsiveDrawer open={open} onOpenChange={setOpen} trigger={trigger}>
        <ShareModalContent {...shareProps} onClose={handleClose} />
      </ResponsiveDrawer>
    );
  },
);

export default ShareButton;
