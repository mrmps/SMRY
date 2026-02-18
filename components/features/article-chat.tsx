"use client";

import React, { useState, useRef, useEffect, useCallback, memo, forwardRef, useImperativeHandle } from "react";
import Link from "next/link";
import { useIsMobile } from "@/hooks/use-mobile";
import { useChatLanguage } from "@/lib/hooks/use-chat-language";
import { useArticleChat, UsageData } from "@/lib/hooks/use-chat";
import { Response } from "../ai/response";
import { isTextUIPart, UIMessage } from "ai";
import {
  ArrowUp,
  ArrowDown,
  Square,
  Zap,
  Trash,
  X,
  Copy,
  Check,
  ReloadIcon,
} from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputActions,
  PromptInputAction,
} from "@/components/ui/prompt-input";
import { Button } from "@/components/ui/button";
import { ChatSuggestions, Suggestion } from "@/components/ui/chat-suggestions";
import { Logo } from "@/components/shared/logo";
import {
  SlashCommands,
  useSlashCommands,
} from "@/components/ui/slash-commands";
import { GravityAd } from "@/components/ads/gravity-ad";
import type { GravityAd as GravityAdType } from "@/lib/hooks/use-gravity-ad";

const RTL_LANGUAGES = new Set(["ar", "he", "fa", "ur"]);

// Default suggestions for article chat - Cursor-style concise prompts
const DEFAULT_SUGGESTIONS: Suggestion[] = [
  { text: "Summarize this" },
  { text: "Key takeaways" },
  { text: "Important facts" },
];

// Pulsing dot indicator (CSS in globals.css)
function ChatLoader() {
  return (
    <div className="flex items-center h-6 py-1">
      <span className="thinking-pulse" />
    </div>
  );
}

function getMessageText(message: UIMessage): string {
  return message.parts
    .filter((part) => isTextUIPart(part))
    .map((part) => part.text)
    .join("");
}

export interface ArticleChatHandle {
  clearMessages: () => void;
  setMessages: (messages: import("ai").UIMessage[]) => void;
  hasMessages: boolean;
  focusInput: () => void;
  stopGeneration: () => void;
  copyLastResponse: () => void;
}

interface ArticleChatProps {
  articleContent: string;
  articleTitle?: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  variant?: "inline" | "sidebar";
  hideHeader?: boolean;
  onHasMessagesChange?: (hasMessages: boolean) => void;
  isPremium?: boolean;
  onMessagesChange?: (messages: import("ai").UIMessage[]) => void;
  initialMessages?: import("ai").UIMessage[];
  // Header ad (compact variant - shows at top of chat on desktop)
  headerAd?: GravityAdType | null;
  onHeaderAdVisible?: () => void;
  onHeaderAdClick?: () => void;
  // Inline ad after messages
  ad?: GravityAdType | null;
  onAdVisible?: () => void;
  onAdClick?: () => void;
  onAdDismiss?: () => void;
  // Micro ad below input
  microAd?: GravityAdType | null;
  onMicroAdVisible?: () => void;
  onMicroAdClick?: () => void;
  // Ref for input container (used for mobile keyboard scrolling)
  inputContainerRef?: React.RefObject<HTMLDivElement | null>;
  // Thread indicator - shows which history thread is loaded
  activeThreadTitle?: string;
  // Mobile keyboard state - used to adapt layout when keyboard is open
  isKeyboardOpen?: boolean;
}

export const ArticleChat = memo(forwardRef<ArticleChatHandle, ArticleChatProps>(function ArticleChat({
  articleContent,
  articleTitle,
  isOpen,
  onOpenChange,
  variant = "inline",
  hideHeader = false,
  onHasMessagesChange,
  isPremium: isPremiumProp = false,
  onMessagesChange,
  initialMessages: initialMessagesProp,
  headerAd,
  onHeaderAdVisible,
  onHeaderAdClick,
  ad,
  onAdVisible,
  onAdClick,
  onAdDismiss: _onAdDismiss,
  microAd,
  onMicroAdVisible,
  onMicroAdClick,
  inputContainerRef,
  activeThreadTitle: _activeThreadTitle,
  isKeyboardOpen = false,
}, ref) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isMobile = useIsMobile();
  const floatingInput = isMobile && variant === "sidebar";
  // Track whether user has manually scrolled away from the bottom
  const isUserScrolledUpRef = useRef(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const rafIdRef = useRef<number>(0);
  // Track programmatic scrolling to avoid race conditions with scroll handler
  const isProgrammaticScrollRef = useRef(false);

  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const isPremium = usageData?.isPremium ?? false;
  const showUsageCounter = usageData?.limit != null && usageData.limit > 0;
  const isLimitReached = !isPremium && usageData?.remaining === 0;

  const { language: preferredLanguage } = useChatLanguage();

  const {
    messages,
    setMessages,
    input,
    setInput,
    handleSubmit,
    isLoading,
    stop,
    clearMessages,
    reload,
    sendMessage,
  } = useArticleChat({
    articleContent,
    articleTitle,
    language: preferredLanguage,
    isPremium: isPremiumProp,
    onUsageUpdate: setUsageData,
    initialMessages: initialMessagesProp,
  });


  // Copy state for messages
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  const handleCopyMessage = useCallback(async (messageId: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }, []);

  const handleReload = useCallback(() => {
    reload();
  }, [reload]);

  const handleSuggestionClick = useCallback((suggestion: string) => {
    sendMessage(suggestion);
  }, [sendMessage]);

  // Slash commands hook
  const {
    isOpen: isSlashMenuOpen,
    filter: slashFilter,
    selectedIndex: slashSelectedIndex,
    handleClose: handleSlashClose,
    handleSelect: handleSlashSelect,
    handleKeyDown: handleSlashKeyDown,
    setSelectedIndex: setSlashSelectedIndex,
  } = useSlashCommands({
    input,
    onSendMessage: sendMessage,
    onInputChange: setInput,
  });

  // Handle textarea key down - integrate slash commands
  const handleTextareaKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Let slash commands handle keyboard events when menu is open
      handleSlashKeyDown(e);
      
      // Handle Enter key from mobile keyboard
      if (e.key === "Enter" && !e.shiftKey && !isSlashMenuOpen && input.trim()) {
        isUserScrolledUpRef.current = false;
        if (isMobile) {
          // Blur textarea to close keyboard on mobile
          setTimeout(() => {
            textareaRef.current?.blur();
          }, 100);
        }
      }
    },
    [handleSlashKeyDown, isSlashMenuOpen, input, isMobile]
  );

  // Refs for imperative handle methods (avoids changing dep array size)
  const messagesRef = useRef(messages);
  const isLoadingRef = useRef(isLoading);
  const stopRef = useRef(stop);
  useEffect(() => {
    messagesRef.current = messages;
    isLoadingRef.current = isLoading;
    stopRef.current = stop;
  });

  // Expose clearMessages, setMessages, and hasMessages to parent via ref
  useImperativeHandle(ref, () => ({
    clearMessages,
    setMessages,
    hasMessages: messages.length > 0,
    focusInput: () => {
      textareaRef.current?.focus();
    },
    stopGeneration: () => {
      if (isLoadingRef.current) stopRef.current();
    },
    copyLastResponse: () => {
      const msgs = messagesRef.current;
      const lastAssistant = [...msgs].reverse().find((m) => m.role === "assistant");
      if (!lastAssistant) return;
      const text = getMessageText(lastAssistant);
      if (!text) return;
      navigator.clipboard.writeText(text).then(() => {
        toast.success("Copied AI response to clipboard");
      });
    },
  }), [clearMessages, setMessages, messages.length]);

  // Notify parent when hasMessages changes
  useEffect(() => {
    onHasMessagesChange?.(messages.length > 0);
  }, [messages.length, onHasMessagesChange]);

  // Ref for callback to avoid effect re-firing when callback reference changes
  const onMessagesChangeRef = useRef(onMessagesChange);
  useEffect(() => {
    onMessagesChangeRef.current = onMessagesChange;
  }, [onMessagesChange]);

  // Notify parent when messages change (for thread syncing)
  useEffect(() => {
    onMessagesChangeRef.current?.(messages);
  }, [messages]);

  // Track user scroll: if they scroll up, pause auto-scroll and show scroll-to-bottom button
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const handleScroll = () => {
      // Skip during programmatic scroll to avoid race conditions
      if (isProgrammaticScrollRef.current) return;

      const { scrollTop, scrollHeight, clientHeight } = container;
      // Floating input adds ~120px of bottom padding/spacer that sits below the last message.
      // Use a larger threshold so the user is considered "at bottom" even when they haven't
      // scrolled past all the padding beneath the content.
      const threshold = floatingInput ? 150 : 80;
      const scrolledUp = scrollHeight - scrollTop - clientHeight > threshold;
      isUserScrolledUpRef.current = scrolledUp;
      setShowScrollButton(scrolledUp);
    };
    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [floatingInput]);

  // During streaming: auto-scroll when at bottom, show arrow button when scrolled up
  useEffect(() => {
    if (!isLoading) return;
    const threshold = floatingInput ? 150 : 80;
    const tick = () => {
      const container = scrollContainerRef.current;
      if (container) {
        const { scrollTop, scrollHeight, clientHeight } = container;
        const isAtBottom = scrollHeight - scrollTop - clientHeight <= threshold;
        if (isAtBottom && !isUserScrolledUpRef.current) {
          container.scrollTop = scrollHeight - clientHeight;
        } else {
          // Content is growing below the viewport — show the arrow
          setShowScrollButton(true);
        }
      }
      rafIdRef.current = requestAnimationFrame(tick);
    };
    rafIdRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafIdRef.current);
  }, [isLoading, floatingInput]);

  // Auto-focus textarea when chat opens
  useEffect(() => {
    if (isOpen && !isMobile) {
      // Small delay to ensure the DOM is ready
      const timer = setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, isMobile]);

  // Don't render if closed in sidebar mode
  if (!isOpen && variant === "sidebar") {
    return null;
  }

  // Collapsed inline state
  if (!isOpen && variant === "inline") {
    return (
      <div className="mb-6">
        <button
          onClick={() => onOpenChange(true)}
          disabled={!articleContent}
          style={{ touchAction: "manipulation" }}
          className={cn(
            "flex w-full items-center justify-between rounded-xl px-4 py-3 min-h-[48px] transition-all",
            "bg-card hover:bg-muted/50 active:bg-muted/70 active:scale-[0.99]",
            "border border-border shadow-sm",
            "text-sm font-medium text-foreground",
            !articleContent && "cursor-not-allowed opacity-50",
          )}
        >
          <span className="flex items-center gap-2">
            <span className="font-semibold">Ask AI</span>
            <span className="text-xs text-muted-foreground">about this article</span>
          </span>
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "overflow-hidden",
        variant === "sidebar"
          ? cn("flex h-full w-full flex-col", floatingInput && "relative")
          : "rounded-xl border border-border bg-surface-1 shadow-sm mb-6",
      )}
    >
      {/* Header - only show for non-sidebar variant (sidebar moves controls to footer) */}
      {!hideHeader && variant !== "sidebar" && (
        <div className="relative z-10 flex items-center justify-between gap-2 px-3 py-2 shrink-0 border-b border-border/50 bg-muted/30">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-foreground">Chat</span>
          </div>

          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                onClick={clearMessages}
                className="flex size-9 items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-muted/50 hover:text-muted-foreground active:bg-muted/70"
                style={{ touchAction: "manipulation" }}
                aria-label="Clear chat"
              >
                <Trash className="size-4" />
              </button>
            )}

            <button
              type="button"
              onClick={() => onOpenChange(false)}
              onPointerDown={(e) => {
                e.stopPropagation();
              }}
              className="ml-0.5 flex size-9 items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-muted/50 hover:text-muted-foreground active:bg-muted/70 cursor-pointer select-none"
              style={{ touchAction: 'manipulation' }}
              aria-label="Close chat"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* Header ad - desktop sidebar only (mobile has its own header ad in drawer) */}
      {headerAd && variant === "sidebar" && !isMobile && (
        <div className="shrink-0 border-b border-border/30 px-3 py-1.5">
          <GravityAd
            ad={headerAd}
            variant="compact"
            onVisible={onHeaderAdVisible ?? (() => {})}
            onClick={onHeaderAdClick}
          />
        </div>
      )}

      {/* Messages - Mobile-first conversation container */}
      <div className="relative flex-1 min-h-0 overflow-hidden bg-background">
        <div
          ref={scrollContainerRef}
          className={cn(
            "h-full overflow-y-auto scrollbar-hide bg-background",
            variant !== "sidebar" && "max-h-[300px] sm:max-h-[400px]",
            floatingInput && "pb-[88px]",
          )}
        >
        {messages.length === 0 ? (
          <div className={cn(
            "flex h-full flex-col px-3 sm:px-4",
            isKeyboardOpen && isMobile ? "py-2" : "py-4 sm:py-6",
            !(isMobile && variant === "sidebar") && "min-h-[200px]",
            floatingInput && "pb-12"
          )}>
            {/* Logo/branding - hidden when keyboard is open on mobile to maximize space */}
            {!(isKeyboardOpen && isMobile) && (
              <div className="flex-1 flex flex-col items-center justify-center text-center mb-3 sm:mb-6">
                <div className="relative mb-3">
                  <div className="absolute inset-0 bg-primary/5 blur-2xl rounded-full scale-150" />
                  <Logo size="lg" className="text-primary/70 relative" />
                </div>
                <p className="text-[13px] text-muted-foreground/60">
                  Ask anything about this article
                </p>
              </div>
            )}
            {isKeyboardOpen && isMobile && <div className="flex-1" />}
            <ChatSuggestions
              suggestions={DEFAULT_SUGGESTIONS}
              onSuggestionClick={handleSuggestionClick}
              variant="default"
            />
          </div>
        ) : (
          <div className="px-3 py-1 sm:px-4 sm:py-2 space-y-2 overflow-x-hidden">
            {messages.map((message, messageIndex) => {
              const messageText = getMessageText(message);
              const isLastMessage = messageIndex === messages.length - 1;
              const isAssistant = message.role === "assistant";
              const showActions = isAssistant && messageText && !(isLoading && isLastMessage);

              return (
                <div
                  key={message.id}
                  className={cn(
                    "group relative",
                    isAssistant && !messageText && "!mt-0 h-0 overflow-hidden",
                  )}
                >
                  {/* User message - Cursor-style with border and semi-transparent bg */}
                  {message.role === "user" ? (
                    <div className="rounded-[10px]">
                      <div
                        className={cn(
                          "px-3 py-2",
                          "bg-muted/40 dark:bg-muted/30",
                          "border border-border/60",
                          "rounded-[10px]",
                        )}
                      >
                        <p className="font-sans text-[15px] leading-[1.6] whitespace-pre-wrap break-words overflow-hidden">
                          {messageText}
                        </p>
                      </div>
                    </div>
                  ) : (
                    /* Assistant message - Cursor-style clean content */
                    <div className="px-2 overflow-hidden">
                      <div className="font-sans text-[17px] sm:text-[15px] leading-[1.65] overflow-x-auto">
                        <Response
                          dir={RTL_LANGUAGES.has(preferredLanguage) ? "rtl" : "ltr"}
                          lang={preferredLanguage}
                          isAnimating={isLoading && isLastMessage}
                        >
                          {messageText}
                        </Response>
                      </div>

                      {/* Action buttons - Cursor-style subtle actions with 44px touch targets */}
                      {isAssistant && messageText && (
                        <div className={cn(
                          "flex items-center gap-0 -ml-2 mt-1 transition-opacity",
                          showActions ? "opacity-100 md:opacity-0 md:group-hover:opacity-100" : "opacity-0 pointer-events-none"
                        )}>
                          <button
                            type="button"
                            onClick={() => handleCopyMessage(message.id, messageText)}
                            className="flex size-9 items-center justify-center rounded-md text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/40 active:bg-muted/60 transition-colors"
                            style={{ touchAction: "manipulation" }}
                            aria-label="Copy message"
                          >
                            {copiedMessageId === message.id ? (
                              <Check className="size-4 text-green-500" />
                            ) : (
                              <Copy className="size-4" />
                            )}
                          </button>
                          {isLastMessage && (
                            <button
                              type="button"
                              onClick={handleReload}
                              className="flex size-9 items-center justify-center rounded-md text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/40 active:bg-muted/60 transition-colors"
                              style={{ touchAction: "manipulation" }}
                              aria-label="Regenerate response"
                            >
                              <ReloadIcon className="size-4" />
                            </button>
                          )}
                        </div>
                      )}

                      {/* Inline ad after last assistant message - elegant sponsored suggestion */}
                      {isLastMessage && !isLoading && ad && variant === "sidebar" && (
                        <div className="mt-3">
                          <GravityAd
                            ad={ad}
                            variant="inline-chat"
                            onVisible={onAdVisible ?? (() => {})}
                            onClick={onAdClick}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {/* Loading indicator - show when waiting for response or empty assistant message */}
            {isLoading && messages.length > 0 && (
              messages[messages.length - 1]?.role === "user" ||
              (messages[messages.length - 1]?.role === "assistant" && !getMessageText(messages[messages.length - 1]))
            ) && (
              <div className="px-2">
                <ChatLoader />
              </div>
            )}
            {/* Upgrade card when daily limit is reached */}
            {isLimitReached && (
              <div className="mx-1 my-4 rounded-xl border border-border/60 bg-muted/30 dark:bg-muted/20 p-4">
                <p className="text-[15px] font-medium text-foreground">
                  Want unlimited summaries?
                </p>
                <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                  Pro readers get unlimited AI conversations, premium models, and ad-free reading.
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <Link
                    href="/pricing"
                    className="inline-flex items-center justify-center rounded-lg bg-foreground px-3.5 py-1.5 text-[13px] font-medium text-background transition-colors hover:bg-foreground/90"
                  >
                    Try Pro free for 7 days
                  </Link>
                  <span className="text-[11px] text-muted-foreground/60">
                    Cancel anytime
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} data-messages-end />
            {floatingInput && <div className="h-8" aria-hidden="true" />}
          </div>
        )}
        </div>
        {/* Fog effect at bottom (hidden when input floats — it has its own gradient) */}
        {!floatingInput && (
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-background to-background/0" />
        )}
      </div>

      {/* Input area - floating on mobile, static on desktop */}
      <div
        className={cn(
          "bg-background",
          floatingInput
            ? "absolute bottom-0 inset-x-0 z-10"
            : "shrink-0"
        )}
        ref={inputContainerRef}
        data-vaul-no-drag
      >
        {/* Scroll to bottom button - shows on both mobile and desktop */}
        {showScrollButton && messages.length > 0 && (
          <div className="flex justify-center pb-2">
            <button
              type="button"
              onClick={() => {
                const container = scrollContainerRef.current;
                if (container) {
                  // Prevent race condition with scroll handler during smooth scroll
                  isProgrammaticScrollRef.current = true;
                  container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
                  // Re-enable scroll detection after animation completes (~400ms for smooth scroll)
                  setTimeout(() => {
                    isProgrammaticScrollRef.current = false;
                  }, 400);
                }
                isUserScrolledUpRef.current = false;
                setShowScrollButton(false);
              }}
              className="flex size-8 items-center justify-center transition-all active:scale-95"
              style={{ touchAction: "manipulation" }}
              aria-label="Scroll to bottom"
            >
              <ArrowDown className="size-4 text-foreground/70" />
            </button>
          </div>
        )}
        <div
          className={cn(
            "px-3 pt-1 sm:px-4 bg-background",
            floatingInput ? "pb-3" : (isMobile && variant === "sidebar" ? "pb-5" : "pb-3 sm:pb-4")
          )}
          data-vaul-no-drag
        >
          {/* Input container */}
          <div
            className="relative rounded-2xl border border-border overflow-hidden bg-background"
            style={{ touchAction: "pan-x pan-y" }}
          >
            {/* Slash Commands Menu - inside the container */}
            {isSlashMenuOpen && !isLoading && (
              <div className="px-2 pt-2 bg-background">
                <SlashCommands
                  isOpen={true}
                  onClose={handleSlashClose}
                  onSelect={handleSlashSelect}
                  filter={slashFilter}
                  selectedIndex={slashSelectedIndex}
                  onSelectedIndexChange={setSlashSelectedIndex}
                  className="relative bottom-auto mb-0"
                />
              </div>
            )}

            {/* Inner content wrapper */}
            <div className="bg-background">
              <PromptInput
                value={input}
                onValueChange={setInput}
                isLoading={isLoading}
                onSubmit={isSlashMenuOpen ? undefined : handleSubmit}
                disabled={isLimitReached}
                className="rounded-none border-0 shadow-none bg-transparent"
                maxHeight={isMobile ? 120 : 240}
                textareaRef={textareaRef}
              >
                <PromptInputTextarea
                  placeholder={isLimitReached ? "Daily limit reached" : "Ask anything..."}
                  className="text-base sm:text-[14px] min-h-[40px] bg-transparent"
                  onKeyDown={handleTextareaKeyDown}
                />
                <PromptInputActions className="justify-between px-2 pb-2">
                  {/* Left side - usage counter on mobile */}
                  <div className="flex items-center gap-1 text-[11px] font-mono tracking-tight text-muted-foreground/50">
                    {isMobile && !isPremium && showUsageCounter && usageData && (
                      <>
                        <span className={cn(usageData.remaining === 0 ? "text-destructive/60" : "")}>
                          {usageData.limit - usageData.remaining}/{usageData.limit}
                        </span>
                        <Link
                          href="/pricing"
                          className={cn(
                            "font-sans text-[11px] font-medium transition-colors",
                            usageData.remaining === 0
                              ? "rounded-sm bg-primary px-1.5 py-0.5 text-primary-foreground hover:bg-primary/90"
                              : "text-primary/70 hover:text-primary hover:underline"
                          )}
                        >
                          Upgrade
                        </Link>
                      </>
                    )}
                    {isMobile && isPremium && usageData?.model && (
                      <span className="flex items-center gap-1">
                        <Zap className="size-2" />
                        {usageData.model}
                      </span>
                    )}
                  </div>

                  {/* Right side - submit button */}
                  <div className="flex items-center">
                    {isLoading ? (
                      <PromptInputAction tooltip="Stop generating">
                        <Button
                          type="button"
                          size="icon"
                          onClick={stop}
                          className="size-7 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          <Square className="size-3.5" />
                        </Button>
                      </PromptInputAction>
                    ) : (
                      <PromptInputAction tooltip={isLimitReached ? "Daily limit reached" : "Send message (Enter)"}>
                        <Button
                          type="button"
                          size="icon"
                          disabled={!input.trim() || isLimitReached || isSlashMenuOpen}
                          onClick={() => {
                            handleSubmit();
                            textareaRef.current?.focus();
                          }}
                          className={cn(
                            "size-7 rounded-full transition-all duration-150",
                            input.trim() && !isLimitReached && !isSlashMenuOpen
                              ? "bg-foreground/90 text-background hover:bg-foreground shadow-sm"
                              : "bg-foreground/10 text-muted-foreground pointer-events-none opacity-50"
                          )}
                        >
                          <ArrowUp className="size-4" strokeWidth={2.5} />
                        </Button>
                      </PromptInputAction>
                    )}
                  </div>
                </PromptInputActions>
              </PromptInput>
            </div>
          </div>

          {/* Micro ad below input - subtle text ad (desktop sidebar only) */}
          {microAd && variant === "sidebar" && (
            <div className="pt-1 px-1">
              <GravityAd
                ad={microAd}
                variant="micro"
                onVisible={onMicroAdVisible ?? (() => {})}
                onClick={onMicroAdClick}
              />
            </div>
          )}
        </div>
      </div>

      {/* Footer - controls + usage counter (hidden on mobile to save space) */}
      {!isMobile && (variant === "sidebar" || isPremium || showUsageCounter) && (
        <div
          className={cn(
            "px-3 py-2 shrink-0 bg-background",
            variant === "sidebar"
              ? "border-t border-border/20"
              : "border-t border-border/50",
          )}
        >
          <div className="flex items-center gap-2 text-[11px] font-mono tracking-tight text-muted-foreground/50">
            {/* Controls for sidebar variant */}
            {variant === "sidebar" && messages.length > 0 && (
              <div className="flex items-center gap-0.5 mr-auto">
                <button
                  onClick={clearMessages}
                  className="flex size-6 items-center justify-center rounded text-muted-foreground/40 transition-colors hover:bg-muted/50 hover:text-muted-foreground"
                  aria-label="Clear chat"
                  title="Clear chat"
                >
                  <Trash className="size-3" />
                </button>
              </div>
            )}

            {/* Model info for premium */}
            {isPremium && usageData?.model && (
              <span className={cn("flex items-center gap-1", variant !== "sidebar" && "mr-auto")}>
                <Zap className="size-2" />
                {usageData.model}
              </span>
            )}

            {/* Usage counter for free users */}
            {!isPremium && showUsageCounter && usageData && (
              <>
                <span className={cn(usageData.remaining === 0 ? "text-destructive/60" : "", variant !== "sidebar" && !isPremium && "ml-auto")}>
                  {usageData.limit - usageData.remaining}/{usageData.limit}
                </span>
                <Link
                  href="/pricing"
                  className={cn(
                    "font-sans text-[11px] font-medium transition-colors",
                    usageData.remaining === 0
                      ? "rounded-sm bg-primary px-1.5 py-0.5 text-primary-foreground hover:bg-primary/90"
                      : "text-primary/70 hover:text-primary hover:underline"
                  )}
                >
                  Upgrade
                </Link>
              </>
            )}

            {/* Free user hint - saved history upsell */}
            {!isPremiumProp && !showUsageCounter && messages.length > 0 && variant === "sidebar" && (
              <Link
                href="/pricing"
                className="ml-auto font-sans text-[11px] text-muted-foreground/40 hover:text-primary/70 transition-colors"
              >
                Pro users get saved history
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}));
