"use client";

import { useRef, useCallback, useState } from "react";
import { Drawer as DrawerPrimitive } from "vaul-base";
import { ArticleChat, ArticleChatHandle } from "@/components/features/article-chat";
import { X, Trash } from "lucide-react";
import { LanguageIcon } from "@/components/ui/custom-icons";
import { cn } from "@/lib/utils";
import { LANGUAGES } from "@/types/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import useLocalStorage from "@/lib/hooks/use-local-storage";
import { GravityAd } from "@/components/ads/gravity-ad";
import type { GravityAd as GravityAdType } from "@/lib/hooks/use-gravity-ad";

interface MobileChatDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  articleContent: string;
  articleTitle?: string;
  /** Ad shown in the header area */
  chatAd?: GravityAdType | null;
  onChatAdVisible?: () => void;
  onChatAdClick?: () => void;
  onChatAdDismiss?: () => void;
}

export function MobileChatDrawer({
  open,
  onOpenChange,
  articleContent,
  articleTitle,
  chatAd,
  onChatAdVisible,
  onChatAdClick,
  onChatAdDismiss,
}: MobileChatDrawerProps) {
  const chatRef = useRef<ArticleChatHandle>(null);
  const [hasMessages, setHasMessages] = useState(false);

  const [preferredLanguage, setPreferredLanguage] = useLocalStorage(
    "chat-language",
    "en"
  );

  const handleLanguageChange = useCallback(
    (newLang: string | null) => {
      if (newLang) setPreferredLanguage(newLang);
    },
    [setPreferredLanguage]
  );

  const handleClearMessages = useCallback(() => {
    chatRef.current?.clearMessages();
  }, []);

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <DrawerPrimitive.Root
      open={open}
      onOpenChange={onOpenChange}
      shouldScaleBackground={false}
      modal={true}
    >
      <DrawerPrimitive.Portal>
        <DrawerPrimitive.Overlay
          className="fixed inset-0 z-50 bg-black/40"
          onClick={handleClose}
        />

        <DrawerPrimitive.Content
          className={cn(
            "fixed inset-x-0 bottom-0 z-50",
            "h-[85vh] max-h-[85vh]",
            "rounded-t-[20px]",
            "bg-background",
            "flex flex-col",
            "outline-none",
            "shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.12)]",
            "dark:shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.35)]"
          )}
        >
          {/* Drag handle area with subtle background */}
          <div className="flex justify-center pt-3 pb-2 shrink-0 bg-muted/20">
            <div className="w-9 h-1 rounded-full bg-muted-foreground/25" />
          </div>

          {/* Header - clean minimal design with muted background */}
          <div className="flex items-center justify-between px-4 py-2.5 shrink-0 bg-muted/30">
            {/* Left: Title */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">
                Chat
              </span>
            </div>

            {/* Right: Controls */}
            <div className="flex items-center gap-1">
              {/* Clear messages - only show when there are messages */}
              {hasMessages && (
                <button
                  type="button"
                  onClick={handleClearMessages}
                  className="flex size-8 items-center justify-center rounded-full text-muted-foreground/70 hover:text-muted-foreground hover:bg-muted transition-colors"
                  aria-label="Clear chat"
                >
                  <Trash className="size-3.5" />
                </button>
              )}

              {/* Language selector */}
              <Select
                value={preferredLanguage}
                onValueChange={handleLanguageChange}
              >
                <SelectTrigger className="h-7 w-auto min-w-0 gap-1 rounded-full border-0 bg-muted px-2.5 text-xs font-medium shadow-none hover:bg-muted/80 transition-colors">
                  <LanguageIcon className="size-3" />
                  <span className="truncate text-muted-foreground">
                    {LANGUAGES.find((l) => l.code === preferredLanguage)?.name || "English"}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((lang) => (
                    <SelectItem key={lang.code} value={lang.code}>
                      {lang.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Close button */}
              <button
                type="button"
                onClick={handleClose}
                className="flex size-8 items-center justify-center rounded-full text-muted-foreground/70 hover:text-foreground hover:bg-muted transition-colors"
                aria-label="Close chat"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          {/* Ad inside drawer - subtle placement with muted bg */}
          {chatAd && (
            <div className="px-4 py-2.5 shrink-0 bg-muted/20 border-b border-border/30">
              <GravityAd
                ad={chatAd}
                variant="compact"
                onVisible={onChatAdVisible ?? (() => {})}
                onClick={onChatAdClick}
                onDismiss={onChatAdDismiss}
              />
            </div>
          )}

          {/* Chat content */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <ArticleChat
              ref={chatRef}
              articleContent={articleContent}
              articleTitle={articleTitle}
              isOpen={true}
              onOpenChange={onOpenChange}
              variant="sidebar"
              hideHeader
              language={preferredLanguage}
              onLanguageChange={setPreferredLanguage}
              onHasMessagesChange={setHasMessages}
            />
          </div>
        </DrawerPrimitive.Content>
      </DrawerPrimitive.Portal>
    </DrawerPrimitive.Root>
  );
}
