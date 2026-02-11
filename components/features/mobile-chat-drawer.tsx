"use client";

import { useRef, useCallback, useState, useEffect } from "react";
import { Drawer as DrawerPrimitive } from "vaul-base";
import { ArticleChat, ArticleChatHandle } from "@/components/features/article-chat";
import { X, Trash, History, Plus, Pin, Trash2, MessageSquare, Sparkles, Smartphone, Search, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import useLocalStorage from "@/lib/hooks/use-local-storage";
import { useMobileKeyboard } from "@/lib/hooks/use-mobile-keyboard";
import type { GravityAd as GravityAdType } from "@/lib/hooks/use-gravity-ad";
import { type ChatThread } from "@/lib/hooks/use-chat-threads";
import Link from "next/link";
import type { UIMessage } from "ai";

type DrawerView = "chat" | "history";

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
  // Thread/history props
  isPremium?: boolean;
  initialMessages?: UIMessage[];
  threads?: ChatThread[];
  activeThreadId?: string | null;
  onSelectThread?: (threadId: string) => void;
  onNewChat?: () => void;
  onDeleteThread?: (threadId: string) => void;
  groupedThreads?: () => { label: string; threads: ChatThread[] }[];
  onMessagesChange?: (messages: UIMessage[]) => void;
  // Pagination
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  // Search
  searchThreads?: (query: string) => Promise<ChatThread[]>;
}

/** Single thread item for mobile history view */
function MobileThreadItem({
  thread,
  isActive,
  onSelect,
  onDelete,
  onTogglePin,
}: {
  thread: ChatThread;
  isActive: boolean;
  onSelect: () => void;
  onDelete?: () => void;
  onTogglePin?: () => void;
}) {
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showActions, setShowActions] = useState(false);

  const handleTouchStart = useCallback(() => {
    longPressTimer.current = setTimeout(() => {
      try { navigator.vibrate?.(10); } catch {}
      setShowActions(true);
    }, 500);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
    };
  }, []);

  const displayTitle = thread.title || thread.articleTitle || "New Chat";

  return (
    <>
      <button
        onClick={onSelect}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onContextMenu={(e) => e.preventDefault()}
        className={cn(
          "flex w-full rounded-lg px-3 py-2.5 text-left transition-colors",
          isActive ? "bg-accent/70" : "active:bg-accent/50"
        )}
        style={{ touchAction: "manipulation" }}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {thread.isPinned && (
              <Pin className="size-2.5 text-primary shrink-0" aria-hidden="true" />
            )}
            <span className={cn(
              "flex-1 truncate text-[14px]",
              isActive ? "text-foreground font-medium" : "text-foreground/80"
            )}>
              {displayTitle}
            </span>
          </div>
        </div>
      </button>

      {/* Long-press action sheet overlay */}
      {showActions && (
        <div
          className="fixed inset-0 z-[60] bg-black/40 flex items-end justify-center"
          onClick={() => setShowActions(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Thread actions"
        >
          <div
            className="w-full max-w-sm bg-background rounded-t-2xl pb-[env(safe-area-inset-bottom,8px)] animate-in slide-in-from-bottom duration-200"
            style={{ overscrollBehavior: "contain" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-8 h-1 rounded-full bg-muted-foreground/20" />
            </div>
            <div className="px-4 py-2">
              <p className="text-sm font-medium text-foreground truncate">{displayTitle}</p>
            </div>
            <div className="px-2 pb-2 space-y-0.5">
              {onTogglePin && (
                <button
                  onClick={() => { onTogglePin(); setShowActions(false); }}
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm text-foreground hover:bg-muted/50 transition-colors"
                  style={{ touchAction: "manipulation" }}
                >
                  <Pin className="size-4" aria-hidden="true" />
                  {thread.isPinned ? "Unpin" : "Pin"}
                </button>
              )}
              {onDelete && (
                <button
                  onClick={() => { onDelete(); setShowActions(false); }}
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm text-destructive hover:bg-destructive/10 transition-colors"
                  style={{ touchAction: "manipulation" }}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                  Delete
                </button>
              )}
              <button
                onClick={() => setShowActions(false)}
                className="flex items-center justify-center w-full px-4 py-3 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted/50 transition-colors mt-1"
                style={{ touchAction: "manipulation" }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Premium gate shown in history view for free users */
function MobilePremiumGate() {
  const features = [
    { icon: Smartphone, text: "Synced across all your devices" },
    { icon: MessageSquare, text: "Resume any conversation later" },
    { icon: Sparkles, text: "Unlimited AI conversations" },
  ];

  return (
    <div className="h-full flex flex-col items-center justify-center px-5">
      <div className="w-full max-w-sm rounded-2xl border border-border/60 bg-accent/30 p-6 text-center">
        <h3
          className="text-base font-semibold text-foreground mb-1.5"
          style={{ textWrap: "balance" }}
        >
          Don&apos;t lose this conversation
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed mb-5 max-w-[260px] mx-auto">
          Your chats vanish when you leave. Keep them forever with Pro.
        </p>

        <div className="space-y-3 mb-6 text-left max-w-[260px] mx-auto">
          {features.map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-3">
              <div className="flex size-5 shrink-0 items-center justify-center rounded-md bg-primary/10">
                <Icon className="size-3 text-primary" aria-hidden="true" />
              </div>
              <span className="text-[13px] text-foreground/80">{text}</span>
            </div>
          ))}
        </div>

        <Link
          href="/pricing"
          className="flex items-center justify-center w-full h-11 rounded-xl text-sm font-semibold bg-primary text-primary-foreground active:bg-primary/90 transition-colors shadow-sm"
        >
          Start free trial
        </Link>
        <p className="text-[11px] text-muted-foreground/60 mt-2.5">
          7 days free &middot; Cancel anytime
        </p>
      </div>
    </div>
  );
}

export function MobileChatDrawer({
  open,
  onOpenChange,
  articleContent,
  articleTitle,
  chatAd,
  onChatAdVisible,
  onChatAdClick,
  onChatAdDismiss: _onChatAdDismiss,
  isPremium = false,
  initialMessages: initialMessagesProp,
  threads = [],
  activeThreadId,
  onSelectThread,
  onNewChat,
  onDeleteThread,
  groupedThreads,
  onMessagesChange,
  hasMore,
  isLoadingMore,
  onLoadMore,
  searchThreads,
}: MobileChatDrawerProps) {
  const chatRef = useRef<ArticleChatHandle>(null);
  const drawerContentRef = useRef<HTMLDivElement>(null);
  const inputContainerRef = useRef<HTMLDivElement | null>(null);
  const [hasMessages, setHasMessages] = useState(false);
  const { isOpen: isKeyboardOpen, viewportHeight, offsetTop } = useMobileKeyboard();
  const wasKeyboardOpenRef = useRef(false);
  const [activeView, setActiveView] = useState<DrawerView>("chat");
  const [searchQuery, setSearchQuery] = useState("");

  // Async search state
  const [searchResults, setSearchResults] = useState<ChatThread[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const [preferredLanguage, setPreferredLanguage] = useLocalStorage(
    "chat-language",
    "en"
  );

  const handleClearMessages = useCallback(() => {
    chatRef.current?.clearMessages();
  }, []);

  const handleClose = useCallback(() => {
    onOpenChange(false);
    // Reset to chat view on close
    setTimeout(() => setActiveView("chat"), 300);
  }, [onOpenChange]);

  const handleSelectThread = useCallback((threadId: string) => {
    onSelectThread?.(threadId);
    // Thread messages are already UIMessage-compatible (ThreadMessage format)
    const thread = threads.find((t) => t.id === threadId);
    if (thread && thread.messages.length > 0) {
      chatRef.current?.setMessages(thread.messages as UIMessage[]);
    } else {
      chatRef.current?.clearMessages();
    }
    setActiveView("chat");
  }, [onSelectThread, threads]);

  const handleNewChat = useCallback(() => {
    onNewChat?.();
    chatRef.current?.clearMessages();
    setActiveView("chat");
  }, [onNewChat]);

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
      }, 350);
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

  const keyboardActive = isKeyboardOpen && viewportHeight > 0;

  const groups = groupedThreads?.() ?? [];

  // Debounced async search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      setIsSearching(false);
      return;
    }

    if (!searchThreads) {
      // Fallback to synchronous filtering
      const lower = searchQuery.toLowerCase();
      const filtered = groups
        .flatMap((g) => g.threads)
        .filter(
          (t) =>
            t.title.toLowerCase().includes(lower) ||
            t.articleTitle?.toLowerCase().includes(lower) ||
            t.articleDomain?.toLowerCase().includes(lower)
        );
      setSearchResults(filtered);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const results = await searchThreads(searchQuery);
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, searchThreads]); // eslint-disable-line react-hooks/exhaustive-deps

  // Infinite scroll sentinel
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isLoadingMore) onLoadMore?.();
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, onLoadMore]);

  const isSearchActive = searchQuery.trim().length > 0;

  return (
    <DrawerPrimitive.Root
      open={open}
      onOpenChange={onOpenChange}
      shouldScaleBackground={false}
      modal={true}
      repositionInputs={false}
    >
      <DrawerPrimitive.Portal>
        <DrawerPrimitive.Overlay
          className="fixed inset-0 z-50 bg-black/40"
          onClick={handleClose}
        />

        <DrawerPrimitive.Content
          ref={drawerContentRef}
          className={cn(
            "fixed inset-x-0 z-50",
            !keyboardActive && "bottom-0",
            "rounded-t-[20px]",
            "bg-background",
            "flex flex-col",
            "outline-none",
            "shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.12)]",
            "dark:shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.35)]",
            !keyboardActive && "pb-[env(safe-area-inset-bottom,0px)]"
          )}
          style={
            keyboardActive
              ? { top: `${offsetTop}px`, height: `${viewportHeight}px`, maxHeight: `${viewportHeight}px` }
              : { height: "85vh", maxHeight: "85vh" }
          }
        >
          {/* Drag handle area */}
          <div className={cn("flex justify-center shrink-0", isKeyboardOpen ? "pt-1.5 pb-0.5" : "pt-3 pb-1")}>
            <div className="w-8 h-1 rounded-full bg-muted-foreground/20" />
          </div>

          {/* Header with tabs + actions */}
          <div className="shrink-0 bg-muted/20 border-b border-border/30">
            <div className="flex items-center justify-between px-3 py-1.5">
              {/* Tab switcher */}
              <div className="flex items-center bg-muted/60 rounded-lg p-0.5">
                <button
                  type="button"
                  onClick={() => setActiveView("chat")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-all",
                    activeView === "chat"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  style={{ touchAction: "manipulation" }}
                >
                  Chat
                </button>
                <button
                  type="button"
                  onClick={() => setActiveView("history")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-all",
                    activeView === "history"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  style={{ touchAction: "manipulation" }}
                >
                  <History className="size-3" aria-hidden="true" />
                  History
                </button>
              </div>

              {/* Right actions */}
              <div className="flex items-center gap-1">
                {activeView === "chat" && hasMessages && (
                  <button
                    type="button"
                    onClick={handleClearMessages}
                    className="flex size-7 items-center justify-center rounded-md text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/50 transition-colors"
                    aria-label="Clear chat"
                    style={{ touchAction: "manipulation" }}
                  >
                    <Trash className="size-3" aria-hidden="true" />
                  </button>
                )}
                {activeView === "history" && isPremium && (
                  <button
                    type="button"
                    onClick={handleNewChat}
                    className="flex size-7 items-center justify-center rounded-md text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/50 transition-colors"
                    aria-label="New chat"
                    style={{ touchAction: "manipulation" }}
                  >
                    <Plus className="size-4" aria-hidden="true" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex size-7 items-center justify-center rounded-md text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/50 transition-colors"
                  aria-label="Close"
                  style={{ touchAction: "manipulation" }}
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>

          {/* View container with slide transitions */}
          <div className="flex-1 min-h-0 overflow-hidden relative">
            {/* Chat view */}
            <div
              className={cn(
                "absolute inset-0 transition-transform duration-250 ease-out",
                activeView === "chat" ? "translate-x-0" : "-translate-x-full"
              )}
            >
              <div className="h-full mx-auto max-w-lg">
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
                  initialMessages={initialMessagesProp}
                  inputContainerRef={inputContainerRef}
                  onMessagesChange={onMessagesChange}
                  isKeyboardOpen={isKeyboardOpen}
                  ad={chatAd}
                  onAdVisible={onChatAdVisible}
                  onAdClick={onChatAdClick}
                />
              </div>
            </div>

            {/* History view */}
            <div
              className={cn(
                "absolute inset-0 transition-transform duration-250 ease-out",
                activeView === "history" ? "translate-x-0" : "translate-x-full"
              )}
            >
              {isPremium ? (
                <div className="h-full flex flex-col" style={{ overscrollBehavior: "contain" }}>
                  {/* Search */}
                  <div className="flex items-center gap-2 px-4 py-2 border-b border-border/30 shrink-0">
                    <Search className="size-3.5 text-muted-foreground/50 shrink-0" aria-hidden="true" />
                    <input
                      type="search"
                      name="mobile-thread-search"
                      aria-label="Search threads"
                      placeholder="Search messages..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="flex-1 bg-transparent text-base text-foreground placeholder:text-muted-foreground/40 focus-visible:outline-none"
                    />
                    {isSearching && (
                      <Loader2 className="size-3.5 animate-spin text-muted-foreground/50 shrink-0" aria-hidden="true" />
                    )}
                  </div>
                  <div className="flex-1 overflow-y-auto">
                  {isSearchActive ? (
                    // Search results (flat list)
                    searchResults && searchResults.length > 0 ? (
                      <div className="px-2 py-2 space-y-px">
                        {searchResults.map((thread) => (
                          <MobileThreadItem
                            key={thread.id}
                            thread={thread}
                            isActive={activeThreadId === thread.id}
                            onSelect={() => handleSelectThread(thread.id)}
                            onDelete={onDeleteThread ? () => onDeleteThread(thread.id) : undefined}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full px-6 text-center">
                        <p className="text-sm text-muted-foreground/60">
                          {isSearching ? "Searching..." : "No matching threads"}
                        </p>
                      </div>
                    )
                  ) : (
                    // Normal grouped view
                    <>
                      {groups.length > 0 ? (
                        <div className="px-2 py-2">
                          {groups.map((group) => (
                            <div key={group.label} className="mb-1">
                              <div className="px-3 pt-3 pb-1">
                                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/50">{group.label}</span>
                              </div>
                              <div className="space-y-px">
                                {group.threads.map((thread) => (
                                  <MobileThreadItem
                                    key={thread.id}
                                    thread={thread}
                                    isActive={activeThreadId === thread.id}
                                    onSelect={() => handleSelectThread(thread.id)}
                                    onDelete={onDeleteThread ? () => onDeleteThread(thread.id) : undefined}
                                  />
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full px-6 text-center">
                          <History className="size-8 text-muted-foreground/30 mb-3" aria-hidden="true" />
                          <p className="text-sm text-muted-foreground/60">
                            No chat history yet
                          </p>
                          <p className="text-xs text-muted-foreground/40 mt-1">
                            Start a conversation to see it here
                          </p>
                        </div>
                      )}

                      {/* Infinite scroll sentinel */}
                      {hasMore && (
                        <div ref={sentinelRef} className="h-8 flex items-center justify-center">
                          {isLoadingMore && (
                            <Loader2 className="size-4 animate-spin text-muted-foreground/40" aria-hidden="true" />
                          )}
                        </div>
                      )}
                    </>
                  )}
                  </div>
                </div>
              ) : (
                <MobilePremiumGate />
              )}
            </div>
          </div>
        </DrawerPrimitive.Content>
      </DrawerPrimitive.Portal>
    </DrawerPrimitive.Root>
  );
}
