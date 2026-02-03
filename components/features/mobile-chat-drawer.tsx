"use client";

import { useRef, useCallback, useState } from "react";
import {
  Drawer,
  DrawerClose,
  DrawerOverlay,
  DrawerPortal,
} from "@/components/ui/drawer";
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

interface MobileChatDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  articleContent: string;
  articleTitle?: string;
}

export function MobileChatDrawer({
  open,
  onOpenChange,
  articleContent,
  articleTitle,
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

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerPortal>
        <DrawerOverlay className="bg-black/40" />
        <DrawerPrimitive.Content
          className={cn(
            "fixed inset-x-0 bottom-0 z-50",
            "h-[85vh] max-h-[85vh]",
            "rounded-t-[16px]",
            "bg-background",
            "flex flex-col",
            "outline-none"
          )}
        >
          {/* Drag handle - inside the card */}
          <div className="flex justify-center pt-3 pb-2 touch-none cursor-grab active:cursor-grabbing">
            <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-4 pb-3 shrink-0">
            {/* Left: Title */}
            <div className="flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 18 18"
                className="size-5 text-primary"
              >
                <g fill="currentColor">
                  <path
                    d="M5.658,2.99l-1.263-.421-.421-1.263c-.137-.408-.812-.408-.949,0l-.421,1.263-1.263,.421c-.204,.068-.342,.259-.342,.474s.138,.406,.342,.474l1.263,.421,.421,1.263c.068,.204,.26,.342,.475,.342s.406-.138,.475-.342l.421-1.263,1.263-.421c.204-.068,.342-.259,.342-.474s-.138-.406-.342-.474Z"
                    fill="currentColor"
                  />
                  <polygon
                    points="9.5 2.75 11.412 7.587 16.25 9.5 11.412 11.413 9.5 16.25 7.587 11.413 2.75 9.5 7.587 7.587 9.5 2.75"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.5"
                  />
                </g>
              </svg>
              <span className="text-base font-semibold text-foreground">
                Assistant
              </span>
            </div>

            {/* Right: Controls */}
            <div className="flex items-center gap-1">
              {/* Clear messages - only show when there are messages */}
              {hasMessages && (
                <button
                  onClick={handleClearMessages}
                  className="group flex size-8 items-center justify-center rounded-lg hover:bg-muted transition-colors"
                  aria-label="Clear chat"
                >
                  <Trash className="size-4 text-gray-500 group-hover:text-gray-700 dark:group-hover:text-gray-300" />
                </button>
              )}

              {/* Language selector */}
              <Select
                value={preferredLanguage}
                onValueChange={handleLanguageChange}
              >
                <SelectTrigger className="h-8 w-auto min-w-0 gap-1 rounded-lg border border-border bg-background px-2 text-xs font-medium shadow-none">
                  <LanguageIcon className="size-3.5" />
                  <span className="truncate">
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

              {/* Close */}
              <DrawerClose className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                <X className="size-[18px]" />
                <span className="sr-only">Close</span>
              </DrawerClose>
            </div>
          </div>

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
      </DrawerPortal>
    </Drawer>
  );
}
