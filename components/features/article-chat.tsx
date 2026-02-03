"use client";

import React, { useState, useRef, useEffect, useCallback, memo, forwardRef, useImperativeHandle } from "react";
import Link from "next/link";
import { LANGUAGES } from "@/types/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import useLocalStorage from "@/lib/hooks/use-local-storage";
import { useArticleChat, UsageData } from "@/lib/hooks/use-chat";
import { Response } from "../ai/response";
import { isTextUIPart, UIMessage } from "ai";
import {
  ArrowUp,
  Square,
  Zap,
  PanelRightClose,
  Trash,
  X,
  Copy,
  Check,
  RotateCcw,
} from "lucide-react";
import { LanguageIcon } from "@/components/ui/custom-icons";
import { cn } from "@/lib/utils";
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

const RTL_LANGUAGES = new Set(["ar", "he", "fa", "ur"]);

// Default suggestions for article chat
const DEFAULT_SUGGESTIONS: Suggestion[] = [
  { text: "Summarize the article" },
  { text: "what are the key takeaways?" },
  { text: "what are the important facts mentioned?" }
];

// Bouncing dots loader (CSS in globals.css)
function ChatLoader() {
  return <div className="chat-loader text-muted-foreground/60" />;
}

function getMessageText(message: UIMessage): string {
  return message.parts
    .filter((part) => isTextUIPart(part))
    .map((part) => part.text)
    .join("");
}

export interface ArticleChatHandle {
  clearMessages: () => void;
  hasMessages: boolean;
}

interface ArticleChatProps {
  articleContent: string;
  articleTitle?: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  variant?: "inline" | "sidebar";
  hideHeader?: boolean;
  language?: string;
  onLanguageChange?: (language: string) => void;
  onHasMessagesChange?: (hasMessages: boolean) => void;
}

export const ArticleChat = memo(forwardRef<ArticleChatHandle, ArticleChatProps>(function ArticleChat({
  articleContent,
  articleTitle,
  isOpen,
  onOpenChange,
  variant = "inline",
  hideHeader = false,
  language: languageProp,
  onLanguageChange,
  onHasMessagesChange,
}, ref) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const isPremium = usageData?.isPremium ?? false;
  const showUsageCounter = usageData?.limit != null && usageData.limit > 0;
  const isLimitReached = !isPremium && usageData?.remaining === 0;

  const [storedLanguage, setStoredLanguage] = useLocalStorage(
    "chat-language",
    "en",
  );

  // Use prop if provided, otherwise use localStorage
  const preferredLanguage = languageProp ?? storedLanguage;
  const setPreferredLanguage = onLanguageChange ?? setStoredLanguage;

  const {
    messages,
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
    onUsageUpdate: setUsageData,
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
    },
    [handleSlashKeyDown]
  );

  // Expose clearMessages and hasMessages to parent via ref
  useImperativeHandle(ref, () => ({
    clearMessages,
    hasMessages: messages.length > 0,
  }), [clearMessages, messages.length]);

  // Notify parent when hasMessages changes
  useEffect(() => {
    onHasMessagesChange?.(messages.length > 0);
  }, [messages.length, onHasMessagesChange]);

  // Get the last message text for scroll dependency
  const lastMessageText = messages.length > 0
    ? getMessageText(messages[messages.length - 1])
    : "";

  // Auto-scroll to bottom when messages change or during streaming
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, lastMessageText, isLoading]);

  // Auto-focus textarea when chat opens
  useEffect(() => {
    if (isOpen) {
      // Small delay to ensure the DOM is ready
      const timer = setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleLanguageChange = useCallback(
    (newLang: string | null) => {
      if (newLang) setPreferredLanguage(newLang);
    },
    [setPreferredLanguage],
  );

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
          className={cn(
            "flex w-full items-center justify-between rounded-xl px-3 py-2.5 transition-all",
            "bg-card hover:bg-muted/50",
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
          ? "flex h-full w-full flex-col"
          : "rounded-xl border border-border bg-card shadow-sm mb-6",
      )}
    >
      {/* Header */}
      {!hideHeader && (
        <div
          className={cn(
            "flex items-center justify-between gap-2 overflow-hidden px-3 py-2.5",
            variant !== "sidebar" && "border-b border-border bg-muted/50",
          )}
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">Chat</span>
          </div>

          <div className="flex min-w-0 items-center gap-1.5">
            {messages.length > 0 && (
              <button
                onClick={clearMessages}
                className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Clear chat"
              >
                <Trash className="size-3.5" />
              </button>
            )}

            <Select
              value={preferredLanguage}
              onValueChange={handleLanguageChange}
              disabled={isLoading}
            >
              <SelectTrigger className="h-7 w-auto min-w-0 gap-1 rounded-md border border-border bg-background px-2 text-xs font-medium shadow-sm">
                <LanguageIcon className="size-3" />
                <span className="truncate">
                  {LANGUAGES.find((l) => l.code === preferredLanguage)?.name ||
                    "Lang"}
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

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenChange(false);
              }}
              className="ml-1 flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground z-10"
              aria-label="Close chat"
            >
              {variant === "sidebar" ? (
                <PanelRightClose className="size-4" />
              ) : (
                <X className="size-4" />
              )}
            </button>
          </div>
        </div>
      )}

      {/* Messages - Mobile-first conversation container */}
      <div className="relative flex-1 min-h-0">
        <div
          className={cn(
            "h-full overflow-y-auto",
            variant !== "sidebar" && "max-h-[300px] sm:max-h-[400px]",
          )}
        >
        {messages.length === 0 ? (
          <div className="flex h-full flex-col px-3 py-4 sm:px-4 sm:py-6">
            <div className="flex-1 flex flex-col items-center justify-center text-center mb-4">
              <Logo size="lg" className="text-primary/80 mb-2" />
              <p className="text-sm text-muted-foreground">
                Ask anything about this article
              </p>
            </div>
            <ChatSuggestions
              suggestions={DEFAULT_SUGGESTIONS}
              onSuggestionClick={handleSuggestionClick}
            />
          </div>
        ) : (
          <div className="px-3 py-3 sm:px-4 sm:py-4 space-y-3 sm:space-y-4">
            {messages.map((message, messageIndex) => {
              const messageText = getMessageText(message);
              const isLastMessage = messageIndex === messages.length - 1;
              const isAssistant = message.role === "assistant";
              const showActions = isAssistant && messageText && !isLoading;

              return (
                <div
                  key={message.id}
                  className={cn(
                    "group flex flex-col gap-1",
                    message.role === "user" ? "items-end" : "items-start",
                  )}
                >
                  <div
                    className={cn(
                      "px-3 py-2 sm:px-4 sm:py-3",
                      message.role === "user"
                        ? "max-w-[90%] sm:max-w-[85%] bg-muted rounded-2xl"
                        : "w-full",
                    )}
                  >
                    {isAssistant ? (
                      <div className="text-sm leading-relaxed">
                        <Response
                          dir={RTL_LANGUAGES.has(preferredLanguage) ? "rtl" : "ltr"}
                          lang={preferredLanguage}
                          isAnimating={isLoading && isLastMessage}
                        >
                          {messageText}
                        </Response>
                      </div>
                    ) : (
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{messageText}</p>
                    )}
                  </div>

                  {/* Action buttons for assistant messages */}
                  {showActions && (
                    <div className="flex items-center gap-1 px-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => handleCopyMessage(message.id, messageText)}
                        className="flex size-7 items-center justify-center rounded-md text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/50 transition-colors"
                        aria-label="Copy message"
                      >
                        {copiedMessageId === message.id ? (
                          <Check className="size-3.5 text-green-500" />
                        ) : (
                          <Copy className="size-3.5" />
                        )}
                      </button>
                      {isLastMessage && (
                        <button
                          type="button"
                          onClick={handleReload}
                          className="flex size-7 items-center justify-center rounded-md text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/50 transition-colors"
                          aria-label="Regenerate response"
                        >
                          <RotateCcw className="size-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {/* Loading indicator - show when waiting for assistant response */}
            {isLoading && messages.length > 0 && messages[messages.length - 1]?.role === "user" && (
              <div className="flex justify-start px-1">
                <ChatLoader />
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
        </div>
        {/* Fog effect at bottom */}
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-8 bg-linear-to-t from-background to-transparent" />
      </div>

      {/* Input area */}
      <div className="shrink-0">
        <div className="p-3 sm:p-4">
          <div className="relative">
            {/* Slash Commands Menu */}
            <SlashCommands
              isOpen={isSlashMenuOpen && !isLoading}
              onClose={handleSlashClose}
              onSelect={handleSlashSelect}
              filter={slashFilter}
              selectedIndex={slashSelectedIndex}
              onSelectedIndexChange={setSlashSelectedIndex}
            />

            <PromptInput
              value={input}
              onValueChange={setInput}
              isLoading={isLoading}
              onSubmit={isSlashMenuOpen ? undefined : handleSubmit}
              disabled={isLimitReached}
              className="rounded-2xl"
              textareaRef={textareaRef}
            >
              <PromptInputTextarea
                placeholder={isLimitReached ? "Daily limit reached" : "Ask anything, / for actions..."}
                className="text-sm"
                onKeyDown={handleTextareaKeyDown}
              />
              <PromptInputActions className="justify-end px-2 pb-2">
                {isLoading ? (
                  <PromptInputAction tooltip="Stop generating">
                    <Button
                      type="button"
                      size="icon"
                      onClick={stop}
                      className="size-[30px] rounded-[10px] bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      <Square className="size-4" />
                    </Button>
                  </PromptInputAction>
                ) : (
                  <PromptInputAction tooltip={isLimitReached ? "Daily limit reached" : "Send message (Enter)"}>
                      <Button
                        type="button"
                        size="icon"
                        disabled={!input.trim() || isLimitReached || isSlashMenuOpen}
                        onClick={() => handleSubmit()}
                        className={cn(
                          "size-[30px] rounded-[10px] transition-all duration-200",
                          input.trim() && !isLimitReached && !isSlashMenuOpen
                            ? "bg-primary text-primary-foreground shadow-[0_1px_2px_0_rgba(0,0,0,0.10)] hover:shadow-[0_2px_4px_1px_rgba(0,0,0,0.12)]"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        <ArrowUp className="size-3.5" />
                      </Button>
                    </PromptInputAction>
                )}
              </PromptInputActions>
            </PromptInput>
          </div>
        </div>
      </div>


      {/* Footer usage counter */}
      {(isPremium || showUsageCounter) && (
        <div
          className={cn(
            "border-t border-border px-3 py-2 text-center",
            variant === "sidebar" && "shrink-0",
          )}
        >
          {isPremium && usageData?.model && (
            <div className="text-[10px] text-muted-foreground/60">
              <Zap className="mr-1 inline-block size-2.5" />
              {usageData.model}
            </div>
          )}
          {!isPremium && showUsageCounter && usageData && (
            <>
              {usageData.remaining > 0 ? (
                <div className="flex items-center justify-center gap-2 text-[10px] text-muted-foreground/60">
                  <span>
                    {usageData.limit - usageData.remaining}/{usageData.limit} messages used
                  </span>
                  <Link
                    href="/pricing"
                    className="rounded-sm bg-primary/10 px-1.5 py-0.5 font-medium text-primary hover:bg-primary/20"
                  >
                    Upgrade
                  </Link>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1.5 py-1">
                  <span className="text-xs text-muted-foreground">
                    Daily limit reached ({usageData.limit}/{usageData.limit})
                  </span>
                  <div className="flex items-center gap-2">
                    <Link
                      href="/pricing"
                      className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                    >
                      Upgrade for unlimited
                    </Link>
                    <span className="text-[10px] text-muted-foreground/60">
                      or try again in 24 hours
                    </span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}));
