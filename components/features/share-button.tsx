"use client";

import React, { useState } from 'react';
import { Share2 as ShareIcon, Link as LinkIcon, ExternalLink, Check as CheckIcon } from 'lucide-react';
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Button, buttonVariants } from "@/components/ui/button";

import { Source } from "@/types/api";

interface ShareButtonProps {
    url: string;
    source?: Source;
    viewMode?: string;
    sidebarOpen?: boolean;
}

const ShareButton: React.FC<ShareButtonProps> = ({ url, source = "smry-fast", viewMode = "markdown", sidebarOpen = true }) => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hasNativeShare, setHasNativeShare] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 768px)");

  React.useEffect(() => {
    setHasNativeShare(typeof navigator !== 'undefined' && 'share' in navigator);
  }, []);

  const getShareUrl = () => {
    const shareUrl = new URL(url);
    if (source) shareUrl.searchParams.set("source", source);
    if (viewMode) shareUrl.searchParams.set("view", viewMode);
    if (sidebarOpen !== undefined) shareUrl.searchParams.set("sidebar", String(sidebarOpen));
    return shareUrl.toString();
  };

  const finalUrl = getShareUrl();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(finalUrl);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        setOpen(false);
      }, 1500);
    } catch (error) {
      console.error('Failed to copy link:', error);
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Share Article',
          text: 'Check out this article',
          url: url,
        });
        setOpen(false);
      } catch (error) {
        console.log('Share cancelled or error:', error);
      }
    }
  };

  const shareContent = (
    <div className="p-0.5 bg-accent rounded-[14px]">
      <div className="bg-card rounded-xl p-2 flex flex-col gap-1">
        <Button
          variant="ghost"
          className="group flex h-auto w-full items-center justify-start gap-3.5 rounded-lg px-3.5 py-3 transition-colors hover:bg-accent"
          onClick={handleCopy}
        >
          <div className={`flex size-9 items-center justify-center rounded-md ${copied ? 'bg-green-500/10' : 'bg-accent'} transition-colors`}>
            {copied ? (
              <CheckIcon className="size-4 text-green-600" />
            ) : (
              <LinkIcon className="size-4 text-muted-foreground" />
            )}
          </div>
          <div className="flex flex-col text-left">
            <span className="text-sm font-medium text-foreground">
              {copied ? 'Copied!' : 'Copy link'}
            </span>
            {!copied && (
              <span className="text-xs text-muted-foreground">
                {source} • {viewMode === 'markdown' ? 'reader' : viewMode === 'html' ? 'original' : viewMode} • {sidebarOpen ? 'sidebar' : 'no sidebar'}
              </span>
            )}
          </div>
        </Button>
        
        {hasNativeShare && (
          <Button
            variant="ghost"
            className="group flex h-auto w-full items-center justify-start gap-3.5 rounded-lg px-3.5 py-3 transition-colors hover:bg-accent"
            onClick={handleNativeShare}
          >
            <div className="flex size-9 items-center justify-center rounded-md bg-accent">
              <ExternalLink className="size-4 text-muted-foreground" />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-sm font-medium text-foreground">More options</span>
              <span className="text-xs text-muted-foreground">
                Share via apps and services
              </span>
            </div>
          </Button>
        )}
      </div>
    </div>
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-8 text-xs font-medium text-muted-foreground hover:text-foreground")}>
            <ShareIcon className="mr-1.5 size-3.5" />
            Share
        </DialogTrigger>
        <DialogContent className="gap-0 p-0 sm:max-w-[400px]">
          <DialogHeader className="border-b border-border px-5 pb-4 pt-5">
            <DialogTitle className="text-base font-semibold text-foreground">Share article</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Share this article with others
            </DialogDescription>
          </DialogHeader>
          <div className="px-5 py-4">
            {shareContent}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-8 text-xs font-medium text-muted-foreground hover:text-foreground")}>
          <ShareIcon className="mr-1.5 size-3.5" />
          Share
      </DrawerTrigger>
      <DrawerContent className="border-t border-border">
        <DrawerHeader className="border-b border-border px-5 pb-4 pt-5 text-left">
          <DrawerTitle className="text-base font-semibold text-foreground">Share article</DrawerTitle>
          <DrawerDescription className="text-sm text-muted-foreground">
            Share this article with others
          </DrawerDescription>
        </DrawerHeader>
        <div className="pb-safe px-5 py-4">
          {shareContent}
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default ShareButton;

