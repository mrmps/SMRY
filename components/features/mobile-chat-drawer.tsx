"use client";

import { useRef, useCallback, useState, useEffect } from "react";
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
import { useMobileKeyboard } from "@/lib/hooks/use-mobile-keyboard";
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
  const drawerContentRef = useRef<HTMLDivElement>(null);
  const inputContainerRef = useRef<HTMLDivElement | null>(null);
  const [hasMessages, setHasMessages] = useState(false);
  const { isOpen: isKeyboardOpen, viewportHeight } = useMobileKeyboard();
  const wasKeyboardOpenRef = useRef(false);

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

  useEffect(() => {
    if (isKeyboardOpen && inputContainerRef.current && drawerContentRef.current) {
      const timer = setTimeout(() => {
        if (inputContainerRef.current) {
          inputContainerRef.current.scrollIntoView({
            behavior: "smooth",
            block: "end",
            inline: "nearest",
          });
        }
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isKeyboardOpen]);

  useEffect(() => {
    const wasOpen = wasKeyboardOpenRef.current;
    wasKeyboardOpenRef.current = isKeyboardOpen;

    if (wasOpen && !isKeyboardOpen && hasMessages) {
      const timer = setTimeout(() => {
        const messagesContainer = drawerContentRef.current?.querySelector('.overflow-y-auto');
        if (messagesContainer) {
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
        const messagesEnd = messagesContainer?.querySelector('[data-messages-end]') || 
                            messagesContainer?.lastElementChild;
        if (messagesEnd) {
          messagesEnd.scrollIntoView({ behavior: "smooth", block: "end" });
        }
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [isKeyboardOpen, hasMessages]);

  const getDrawerHeight = () => {
    if (isKeyboardOpen && viewportHeight > 0) {
      const minHeight = typeof window !== "undefined" ? window.innerHeight * 0.5 : 400;
      return `${Math.max(viewportHeight, minHeight)}px`;
    }
    return "85vh";
  };

  const drawerHeight = getDrawerHeight();

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
          ref={drawerContentRef}
          className={cn(
            "fixed inset-x-0 bottom-0 z-50",
            "rounded-t-[20px]",
            "bg-background",
            "flex flex-col",
            "outline-none",
            "shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.12)]",
            "dark:shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.35)]",
            "transition-all duration-200 ease-out",
            "pb-[env(safe-area-inset-bottom,0px)]"
          )}
          style={{
            height: drawerHeight,
            maxHeight: drawerHeight,
            minHeight: isKeyboardOpen ? "50vh" : undefined,
          }}
        >
          {/* Drag handle area - subtle */}
          <div className="flex justify-center pt-3 pb-1 shrink-0">
            <div className="w-8 h-1 rounded-full bg-muted-foreground/20" />
          </div>

          {/* Header - Cursor-style clean minimal design */}
          <div className="flex items-center justify-between px-4 py-2 shrink-0 bg-muted/20 border-b border-border/30">
            {/* Left: Title */}
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold text-foreground">
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
                  className="flex size-7 items-center justify-center rounded-md text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/50 transition-colors"
                  aria-label="Clear chat"
                >
                  <Trash className="size-3" />
                </button>
              )}

              {/* Language selector */}
              <Select
                value={preferredLanguage}
                onValueChange={handleLanguageChange}
              >
                <SelectTrigger className="h-6 w-auto min-w-0 gap-1 rounded-md border-0 bg-muted/50 px-2 text-[11px] font-medium shadow-none hover:bg-muted/70 transition-colors">
                  <LanguageIcon className="size-2.5" />
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
                className="flex size-7 items-center justify-center rounded-md text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/50 transition-colors"
                aria-label="Close chat"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          {/* Ad inside drawer - subtle placement */}
          {chatAd && (
            <div className="px-4 py-2 shrink-0 bg-muted/10 border-b border-border/20">
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
              inputContainerRef={inputContainerRef}
            />
          </div>
        </DrawerPrimitive.Content>
      </DrawerPrimitive.Portal>
    </DrawerPrimitive.Root>
  );
}
