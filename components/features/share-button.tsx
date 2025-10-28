"use client";

import React, { useState } from 'react';
import { Share2 as ShareIcon, Link as LinkIcon, ExternalLink, Check as CheckIcon } from 'lucide-react';
import { useMediaQuery } from "@/lib/hooks/use-media-query";
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
import { Button } from "@/components/ui/button";

interface ShareButtonProps {
    url: string;    
}

const ShareButton: React.FC<ShareButtonProps> = ({ url }) => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hasNativeShare, setHasNativeShare] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 768px)");

  React.useEffect(() => {
    setHasNativeShare(typeof navigator !== 'undefined' && 'share' in navigator);
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
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
    <div className="space-y-1.5">
      <button
        className="w-full flex items-center gap-3.5 px-3.5 py-3 rounded-lg hover:bg-slate-50 transition-colors group"
        onClick={handleCopy}
      >
        <div className={`flex items-center justify-center w-9 h-9 rounded-md ${copied ? 'bg-green-50' : 'bg-slate-100'} transition-colors`}>
          {copied ? (
            <CheckIcon className="h-4 w-4 text-green-600" />
          ) : (
            <LinkIcon className="h-4 w-4 text-slate-600" />
          )}
        </div>
        <div className="flex flex-col text-left">
          <span className="text-sm font-medium text-slate-900">
            {copied ? 'Copied!' : 'Copy link'}
          </span>
          {!copied && (
            <span className="text-xs text-slate-500">
              Copy URL to clipboard
            </span>
          )}
        </div>
      </button>
      
      {hasNativeShare && (
        <button
          className="w-full flex items-center gap-3.5 px-3.5 py-3 rounded-lg hover:bg-slate-50 transition-colors group"
          onClick={handleNativeShare}
        >
          <div className="flex items-center justify-center w-9 h-9 rounded-md bg-slate-100">
            <ExternalLink className="h-4 w-4 text-slate-600" />
          </div>
          <div className="flex flex-col text-left">
            <span className="text-sm font-medium text-slate-900">More options</span>
            <span className="text-xs text-slate-500">
              Share via apps and services
            </span>
          </div>
        </button>
      )}
    </div>
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <button className="flex items-center rounded-full border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 px-4 py-2 transition-all">
            <ShareIcon className="h-3 w-3 text-slate-600" />
            <span className="ml-2 text-sm font-medium text-slate-700">Share</span>
          </button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[400px] p-0 gap-0">
          <DialogHeader className="px-5 pt-5 pb-4 border-b border-slate-100">
            <DialogTitle className="text-base font-semibold text-slate-900">Share article</DialogTitle>
            <DialogDescription className="text-sm text-slate-500">
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
      <DrawerTrigger asChild>
        <button className="flex items-center rounded-full border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 px-4 py-2 transition-all">
          <ShareIcon className="h-3 w-3 text-slate-600" />
          <span className="ml-2 text-sm font-medium text-slate-700">Share</span>
        </button>
      </DrawerTrigger>
      <DrawerContent className="border-t border-slate-200">
        <DrawerHeader className="text-left px-5 pt-5 pb-4 border-b border-slate-100">
          <DrawerTitle className="text-base font-semibold text-slate-900">Share article</DrawerTitle>
          <DrawerDescription className="text-sm text-slate-500">
            Share this article with others
          </DrawerDescription>
        </DrawerHeader>
        <div className="px-5 py-4 pb-safe">
          {shareContent}
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default ShareButton;

