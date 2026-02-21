"use client";

import { useRef, useCallback, useState, useEffect, useMemo } from "react";
import { Drawer as DrawerPrimitive } from "vaul-base";
import { ArticleChat, ArticleChatHandle } from "@/components/features/article-chat";
import { ChevronLeft, Trash, History, Plus, Pin, Trash2, MessageSquare, Zap, Smartphone, Search, Loader2, X } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { useMobileKeyboard } from "@/lib/hooks/use-mobile-keyboard";
import type { GravityAd as GravityAdType } from "@/lib/hooks/use-gravity-ad";
import { type ChatThread, formatRelativeTime } from "@/lib/hooks/use-chat-threads";
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
  // Fetch full thread with messages (cross-device)
  getThreadWithMessages?: (threadId: string) => Promise<ChatThread | null>;
}

/** Single thread item for mobile history view — tap to select, trash icon to delete */
function MobileThreadItem({
  thread,
  isActive,
  onSelect,
  onDelete,
}: {
  thread: ChatThread;
  isActive: boolean;
  onSelect: () => void;
  onDelete?: () => void;
}) {
  const displayTitle = thread.title || thread.articleTitle || "New Chat";

  return (
    <div
      className={cn(
        "group flex items-center rounded-lg px-3 py-2.5 text-left select-none",
        isActive ? "bg-accent/70" : "bg-background active:bg-accent/50"
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex-1 min-w-0 text-left"
        style={{ touchAction: "manipulation" }}
      >
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
        <span className="block text-[11px] text-muted-foreground/40 tabular-nums truncate mt-0.5">
          {formatRelativeTime(thread.updatedAt)}
          {(() => { const c = thread.messages.filter(m => m.role === "user").length; return c > 0 ? ` \u00B7 ${c} message${c !== 1 ? "s" : ""}` : ""; })()}
        </span>
      </button>
      {onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="shrink-0 flex size-7 items-center justify-center rounded-md text-muted-foreground/30 active:text-destructive active:bg-destructive/10 transition-colors ml-1"
          aria-label={`Delete ${displayTitle}`}
          style={{ touchAction: "manipulation" }}
        >
          <Trash2 className="size-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

/** Premium gate shown in history view for free users */
function MobilePremiumGate() {
  const features = [
    { icon: Smartphone, text: "Synced across all your devices" },
    { icon: MessageSquare, text: "Resume any conversation later" },
    { icon: Zap, text: "Unlimited AI conversations" },
  ];

  return (
    <div className="h-full flex flex-col items-center justify-center px-6 py-8">
      <div className="w-full max-w-sm text-center">
        <div className="mb-4">
          <History className="size-10 text-muted-foreground/30 mx-auto" aria-hidden="true" />
        </div>
        <h3
          className="text-base font-semibold text-foreground mb-1.5"
          style={{ textWrap: "balance" }}
        >
          Save your chat history
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed mb-5 max-w-[260px] mx-auto">
          Keep all your conversations and access them from any device.
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

const MOBILE_KNOWN_LABELS = new Set(["Pinned", "This Article", "Today", "Yesterday", "Last 7 Days", "Last 30 Days", "Older"]);

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
  getThreadWithMessages,
}: MobileChatDrawerProps) {
  const chatRef = useRef<ArticleChatHandle>(null);
  const drawerContentRef = useRef<HTMLDivElement>(null);
  const inputContainerRef = useRef<HTMLDivElement | null>(null);
  const [hasMessages, setHasMessages] = useState(false);
  const { isOpen: isKeyboardOpen } = useMobileKeyboard();
  const [activeView, setActiveView] = useState<DrawerView>("chat");
  const [searchQuery, setSearchQuery] = useState("");

  // Async search state
  const [searchResults, setSearchResults] = useState<ChatThread[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const handleClearMessages = useCallback(() => {
    chatRef.current?.clearMessages();
  }, []);

  const handleClose = useCallback(() => {
    onOpenChange(false);
    // Reset to chat view on close
    setTimeout(() => setActiveView("chat"), 300);
  }, [onOpenChange]);

  const selectRequestRef = useRef(0);
  const handleSelectThread = useCallback(async (threadId: string) => {
    const requestId = ++selectRequestRef.current;
    onSelectThread?.(threadId);
    setActiveView("chat");

    // Try local messages first, then fetch from server if empty (cross-device)
    if (getThreadWithMessages) {
      const thread = await getThreadWithMessages(threadId);
      if (selectRequestRef.current !== requestId) return; // stale
      if (thread && thread.messages.length > 0) {
        chatRef.current?.setMessages(thread.messages as UIMessage[]);
      } else {
        chatRef.current?.clearMessages();
      }
    } else {
      const thread = threads.find((t) => t.id === threadId);
      if (thread && thread.messages.length > 0) {
        chatRef.current?.setMessages(thread.messages as UIMessage[]);
      } else {
        chatRef.current?.clearMessages();
      }
    }
  }, [onSelectThread, threads, getThreadWithMessages]);

  const handleNewChat = useCallback(() => {
    onNewChat?.();
    chatRef.current?.clearMessages();
    setActiveView("chat");
  }, [onNewChat]);

  const handleDeleteThread = useCallback((threadId: string) => {
    onDeleteThread?.(threadId);
    // If deleting the active thread, clear chat UI (hook already sets activeThreadId to null)
    if (activeThreadId === threadId) {
      chatRef.current?.clearMessages();
    }
  }, [onDeleteThread, activeThreadId]);

  const groups = useMemo(() => groupedThreads?.() ?? [], [groupedThreads]);
  const groupsRef = useRef(groups);
  useEffect(() => { groupsRef.current = groups; }, [groups]);

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
      const filtered = groupsRef.current
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
  }, [searchQuery, searchThreads]);

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
          className="fixed inset-0 z-50 bg-background"
        />

        <DrawerPrimitive.Content
          ref={drawerContentRef}
          className={cn(
            "fixed inset-x-0 top-0 z-50",
            "bg-background",
            "flex flex-col",
            "outline-none",
            "pt-[env(safe-area-inset-top,0px)]",
            "pb-[env(safe-area-inset-bottom,0px)]"
          )}
          style={{ height: "100dvh" }}
        >
          {/* Fullscreen header — drag down to dismiss */}
          {/* Touch targets: 44px minimum per iOS HIG / WCAG 2.2 */}
          <div className="shrink-0 border-b border-border/30">
            <div className="flex items-center justify-between px-2 py-2">
              {/* Left: Back button - 44px touch target */}
              <button
                type="button"
                onClick={handleClose}
                className="flex size-11 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 active:bg-muted/70 transition-colors"
                aria-label="Back"
                style={{ touchAction: "manipulation" }}
              >
                <ChevronLeft className="size-5" aria-hidden="true" />
              </button>

              {/* Center: Tab switcher - 44px height touch targets */}
              <div className="flex items-center bg-muted/60 rounded-xl p-1">
                <button
                  type="button"
                  onClick={() => setActiveView("chat")}
                  className={cn(
                    "px-4 py-2 rounded-lg text-[14px] font-medium transition-all min-h-[36px]",
                    activeView === "chat"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground active:bg-muted/40"
                  )}
                  style={{ touchAction: "manipulation" }}
                >
                  Chat
                </button>
                <button
                  type="button"
                  onClick={() => setActiveView("history")}
                  className={cn(
                    "px-4 py-2 rounded-lg text-[14px] font-medium transition-all min-h-[36px]",
                    activeView === "history"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground active:bg-muted/40"
                  )}
                  style={{ touchAction: "manipulation" }}
                >
                  History
                </button>
              </div>

              {/* Right: Context action - 44px touch target */}
              <div className="flex size-11 items-center justify-center">
                {activeView === "chat" && hasMessages ? (
                  <button
                    type="button"
                    onClick={handleClearMessages}
                    className="flex size-11 items-center justify-center rounded-lg text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/50 active:bg-muted/70 transition-colors"
                    aria-label="Clear chat"
                    style={{ touchAction: "manipulation" }}
                  >
                    <Trash className="size-4" aria-hidden="true" />
                  </button>
                ) : activeView === "history" && isPremium ? (
                  <button
                    type="button"
                    onClick={handleNewChat}
                    className="flex size-11 items-center justify-center rounded-lg text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/50 active:bg-muted/70 transition-colors"
                    aria-label="New chat"
                    style={{ touchAction: "manipulation" }}
                  >
                    <Plus className="size-5" aria-hidden="true" />
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          {/* View container — both views stay mounted so refs work; hidden via display:none */}
          {/* touch-action:pan-y overrides vaul-base's touch-action:none on [data-vaul-drawer] */}
          <div className="flex-1 min-h-0 overflow-hidden" data-vaul-no-drag style={{ touchAction: "pan-y" }}>
            {/* Chat view */}
            <div className={cn("h-full", activeView !== "chat" && "hidden")}>
              <div className="h-full mx-auto max-w-lg">
                <ArticleChat
                  ref={chatRef}
                  articleContent={articleContent}
                  articleTitle={articleTitle}
                  isOpen={true}
                  onOpenChange={onOpenChange}
                  variant="sidebar"
                  hideHeader
                  onHasMessagesChange={setHasMessages}
                  initialMessages={initialMessagesProp}
                  inputContainerRef={inputContainerRef}
                  onMessagesChange={onMessagesChange}
                  isKeyboardOpen={isKeyboardOpen}
                  headerAd={chatAd}
                  onHeaderAdVisible={onChatAdVisible}
                  onHeaderAdClick={onChatAdClick}
                />
              </div>
            </div>

            {/* History view */}
            <div className={cn("h-full bg-background", activeView !== "history" && "hidden")}>
              {isPremium ? (
                <div className="h-full flex flex-col bg-background" style={{ overscrollBehavior: "contain", touchAction: "pan-y" }}>
                  {/* Search */}
                  <div className="flex items-center gap-2 px-4 py-2 border-b border-border/30 shrink-0">
                    <Search className="size-3.5 text-muted-foreground/50 shrink-0" aria-hidden="true" />
                    <input
                      type="text"
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
                    {searchQuery && !isSearching && (
                      <button
                        onClick={() => {
                          setSearchQuery("");
                          setSearchResults(null);
                        }}
                        className="p-1 rounded text-foreground/50 hover:text-foreground transition-colors"
                        aria-label="Clear search"
                        style={{ touchAction: "manipulation" }}
                      >
                        <X className="size-4" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                  <div className="flex-1 overflow-y-auto scrollbar-hide">
                  {isSearchActive ? (
                    // Search results (flat list)
                    searchResults && searchResults.length > 0 ? (
                      <div className="px-4 py-2 space-y-1">
                        {searchResults.map((thread) => (
                          <MobileThreadItem
                            key={thread.id}
                            thread={thread}
                            isActive={activeThreadId === thread.id}
                            onSelect={() => handleSelectThread(thread.id)}
                            onDelete={onDeleteThread ? () => handleDeleteThread(thread.id) : undefined}
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
                        <div className="py-2">
                          {groups.map((group) => {
                            const isArticleGroup = !MOBILE_KNOWN_LABELS.has(group.label);
                            const articleDomain = isArticleGroup ? group.threads[0]?.articleDomain : null;
                            return (
                            <div key={group.label} className="mb-1">
                              <div className="px-4 pt-3 pb-1">
                                <span className="block text-[11px] font-medium tracking-wider text-muted-foreground/50 truncate" title={isArticleGroup ? group.label : undefined}>{group.label}</span>
                                {articleDomain && (
                                  <span className="block text-[11px] text-muted-foreground/30 truncate">{articleDomain}</span>
                                )}
                              </div>
                              <div className="px-4 space-y-1">
                                {group.threads.map((thread) => (
                                  <MobileThreadItem
                                    key={thread.id}
                                    thread={thread}
                                    isActive={activeThreadId === thread.id}
                                    onSelect={() => handleSelectThread(thread.id)}
                                    onDelete={onDeleteThread ? () => handleDeleteThread(thread.id) : undefined}
                                  />
                                ))}
                              </div>
                            </div>
                            );
                          })}
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
