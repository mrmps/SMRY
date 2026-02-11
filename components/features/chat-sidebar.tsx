"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Search, Pin, MoreHorizontal, Trash2, Pencil, LogIn, PanelLeftClose, MessageSquare, Sparkles, Smartphone, Plus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { type ChatThread } from "@/lib/hooks/use-chat-threads";
import Link from "next/link";
import { useAuth, SignInButton } from "@clerk/nextjs";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ImperativePanelHandle } from "react-resizable-panels";
import { buildUrlWithReturn } from "@/lib/hooks/use-return-url";
import {
  Popover,
  PopoverTrigger,
  PopoverPopup,
  PopoverClose,
} from "@/components/ui/popover";

interface ChatSidebarProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onNewChat: () => void;
  onSelectThread: (threadId: string) => void;
  activeThreadId?: string | null;
  isPremium?: boolean;
  threads?: ChatThread[];
  onDeleteThread?: (id: string) => void;
  onTogglePin?: (id: string) => void;
  onRenameThread?: (id: string, title: string) => void;
  groupedThreads?: () => { label: string; threads: ChatThread[] }[];
  // Pagination
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  // Search
  searchThreads?: (query: string) => Promise<ChatThread[]>;
}

function ThreadItem({
  thread,
  isActive,
  onSelect,
  onDelete,
  onTogglePin,
  onRename,
}: {
  thread: ChatThread;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
  onRename: (title: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(thread.title);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSubmitRename = () => {
    if (editValue.trim() && editValue !== thread.title) {
      onRename(editValue.trim());
    } else {
      setEditValue(thread.title);
    }
    setIsEditing(false);
  };

  const handleDelete = useCallback(() => {
    if (confirmDelete) {
      onDelete();
      setConfirmDelete(false);
    } else {
      setConfirmDelete(true);
      // Auto-reset after 3s
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  }, [confirmDelete, onDelete]);

  const displayTitle = thread.title || thread.articleTitle || "New Chat";

  return (
    <div className="group relative">
      <button
        onClick={onSelect}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors",
          isActive
            ? "bg-accent/70"
            : "hover:bg-accent/30"
        )}
      >
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              name="thread-title"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleSubmitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmitRename();
                if (e.key === "Escape") {
                  setEditValue(thread.title);
                  setIsEditing(false);
                }
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-full bg-background rounded px-1.5 py-0.5 text-[13px] text-foreground border border-border focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
              aria-label="Thread title"
            />
          ) : (
            <span
              className={cn(
                "block truncate text-[13px]",
                isActive ? "text-foreground" : "text-foreground/70"
              )}
              title={displayTitle}
            >
              {displayTitle}
            </span>
          )}
        </div>
      </button>

      {/* More menu - visible on hover */}
      {!isEditing && (
        <div
          className={cn(
            "absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center",
            "opacity-0 group-hover:opacity-100 transition-opacity z-10"
          )}
        >
          {/* Gradient fade */}
          <div
            className={cn(
              "absolute -left-5 w-5 h-full pointer-events-none",
              isActive
                ? "bg-gradient-to-l from-accent/70 to-transparent"
                : "bg-gradient-to-l from-card to-transparent group-hover:from-accent/30"
            )}
          />
          <Popover>
            <PopoverTrigger
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
              aria-label="Thread options"
            >
              <MoreHorizontal className="size-3.5" aria-hidden="true" />
            </PopoverTrigger>
            <PopoverPopup
              side="right"
              align="start"
              sideOffset={4}
              className="min-w-[160px] !w-auto"
            >
              <div className="py-1">
                <PopoverClose
                  onClick={(e: React.MouseEvent) => {
                    e.stopPropagation();
                    handleDelete();
                  }}
                  className={cn(
                    "flex w-full items-center gap-2.5 px-3 py-2 text-[13px] transition-colors cursor-pointer",
                    confirmDelete
                      ? "text-destructive bg-destructive/10 hover:bg-destructive/15"
                      : "text-foreground/80 hover:bg-accent/50"
                  )}
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                  {confirmDelete ? "Confirm delete?" : "Delete"}
                </PopoverClose>
                <PopoverClose
                  onClick={(e: React.MouseEvent) => {
                    e.stopPropagation();
                    setEditValue(thread.title);
                    setIsEditing(true);
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-[13px] text-foreground/80 hover:bg-accent/50 transition-colors cursor-pointer"
                >
                  <Pencil className="size-3.5" aria-hidden="true" />
                  Rename
                </PopoverClose>
                <PopoverClose
                  onClick={(e: React.MouseEvent) => {
                    e.stopPropagation();
                    onTogglePin();
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-[13px] text-foreground/80 hover:bg-accent/50 transition-colors cursor-pointer"
                >
                  <Pin className="size-3.5" aria-hidden="true" />
                  {thread.isPinned ? "Unpin" : "Pin"}
                </PopoverClose>
              </div>
            </PopoverPopup>
          </Popover>
        </div>
      )}
    </div>
  );
}

function ThreadGroup({
  label,
  threads,
  activeThreadId,
  onSelect,
  onDelete,
  onTogglePin,
  onRename,
}: {
  label: string;
  threads: ChatThread[];
  activeThreadId?: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string) => void;
  onRename: (id: string, title: string) => void;
}) {
  if (threads.length === 0) return null;

  return (
    <div className="mb-0.5">
      <div className="px-3 pt-3 pb-1">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/50">{label}</span>
      </div>
      <div className="px-1.5 space-y-px">
        {threads.map((thread) => (
          <ThreadItem
            key={thread.id}
            thread={thread}
            isActive={activeThreadId === thread.id}
            onSelect={() => onSelect(thread.id)}
            onDelete={() => onDelete(thread.id)}
            onTogglePin={() => onTogglePin(thread.id)}
            onRename={(title) => onRename(thread.id, title)}
          />
        ))}
      </div>
    </div>
  );
}

/** Upgrade prompt shown to free users in desktop sidebar */
function PremiumGate() {
  const features = [
    { icon: Smartphone, text: "Synced across all devices" },
    { icon: MessageSquare, text: "Resume any conversation" },
    { icon: Sparkles, text: "Unlimited AI chats" },
  ];

  return (
    <div className="flex-1 flex flex-col px-3 pt-4 pb-3">
      <div className="rounded-xl border border-border/60 bg-accent/30 p-4">
        <h3
          className="text-[13px] font-semibold text-foreground mb-1"
          style={{ textWrap: "balance" }}
        >
          Don&apos;t lose this conversation
        </h3>
        <p className="text-[11px] text-muted-foreground leading-relaxed mb-4">
          Your chats vanish when you leave. Keep them forever with Pro.
        </p>

        <div className="space-y-2.5 mb-4">
          {features.map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-2">
              <div className="flex size-4 shrink-0 items-center justify-center rounded-md bg-primary/10">
                <Icon className="size-2.5 text-primary" aria-hidden="true" />
              </div>
              <span className="text-[11px] text-foreground/80">{text}</span>
            </div>
          ))}
        </div>

        <Link
          href="/pricing"
          className="flex items-center justify-center w-full h-9 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Start free trial
        </Link>
        <p className="text-[10px] text-muted-foreground/60 text-center mt-2">
          7 days free &middot; Cancel anytime
        </p>
      </div>
    </div>
  );
}

export function ChatSidebar({
  isOpen: _isOpen,
  onOpenChange,
  onNewChat,
  onSelectThread,
  activeThreadId,
  isPremium = false,
  onDeleteThread,
  onTogglePin,
  onRenameThread,
  groupedThreads,
  hasMore,
  isLoadingMore,
  onLoadMore,
  searchThreads,
}: ChatSidebarProps) {
  const { isSignedIn } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Async search state
  const [searchResults, setSearchResults] = useState<ChatThread[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const groups = groupedThreads?.() ?? [];

  // Auto-focus search input when revealed
  useEffect(() => {
    if (showSearch) {
      searchInputRef.current?.focus();
    }
  }, [showSearch]);

  // Debounced async search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      setIsSearching(false);
      return;
    }

    if (!searchThreads) {
      // Fallback to synchronous filtering if no async search provided
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

  // Determine what to display
  const isSearchActive = searchQuery.trim().length > 0;
  const displayGroups = isSearchActive ? [] : groups;

  return (
    <div className="flex flex-col h-full bg-card border-r border-border/40">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/30">
        <h2 className="text-[13px] font-semibold text-foreground">History</h2>
        <div className="flex items-center gap-0.5">
          {isPremium && (
            <>
              <button
                onClick={() => { setShowSearch(!showSearch); if (showSearch) { setSearchQuery(""); setSearchResults(null); } }}
                className={cn(
                  "p-1.5 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
                  showSearch
                    ? "text-foreground bg-accent/50"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                )}
                aria-label="Search threads"
                aria-expanded={showSearch}
              >
                <Search className="size-3.5" aria-hidden="true" />
              </button>
              <button
                onClick={onNewChat}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                aria-label="New chat"
              >
                <Plus className="size-3.5" aria-hidden="true" />
              </button>
            </>
          )}
          <button
            onClick={() => onOpenChange(false)}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
            aria-label="Close sidebar"
          >
            <PanelLeftClose className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Search - toggleable */}
      {isPremium && showSearch && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border/30">
          <Search className="size-3.5 text-muted-foreground/50 shrink-0" aria-hidden="true" />
          <input
            ref={searchInputRef}
            type="search"
            name="thread-search"
            role="searchbox"
            aria-label="Search threads"
            placeholder="Search messages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setSearchQuery("");
                setSearchResults(null);
                setShowSearch(false);
              }
            }}
            className="flex-1 bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground/40 focus-visible:outline-none"
          />
          {isSearching && (
            <Loader2 className="size-3 animate-spin text-muted-foreground/50 shrink-0" aria-hidden="true" />
          )}
        </div>
      )}

      {/* Thread list (premium only) */}
      {isPremium ? (
        <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide">
          {isSearchActive ? (
            // Search results (flat list, not grouped)
            searchResults && searchResults.length > 0 ? (
              <div className="px-1.5 py-1 space-y-px">
                {searchResults.map((thread) => (
                  <ThreadItem
                    key={thread.id}
                    thread={thread}
                    isActive={activeThreadId === thread.id}
                    onSelect={() => onSelectThread(thread.id)}
                    onDelete={() => onDeleteThread?.(thread.id)}
                    onTogglePin={() => onTogglePin?.(thread.id)}
                    onRename={(title) => onRenameThread?.(thread.id, title)}
                  />
                ))}
              </div>
            ) : (
              <div className="px-4 py-8 text-center">
                <p className="text-[13px] text-muted-foreground/40">
                  {isSearching ? "Searching..." : "No matching threads"}
                </p>
              </div>
            )
          ) : (
            // Normal grouped view
            <>
              {displayGroups.length > 0 ? (
                displayGroups.map((group) => (
                  <ThreadGroup
                    key={group.label}
                    label={group.label}
                    threads={group.threads}
                    activeThreadId={activeThreadId}
                    onSelect={onSelectThread}
                    onDelete={onDeleteThread ?? (() => {})}
                    onTogglePin={onTogglePin ?? (() => {})}
                    onRename={onRenameThread ?? (() => {})}
                  />
                ))
              ) : (
                <div className="px-4 py-8 text-center">
                  <p className="text-[13px] text-muted-foreground/40">
                    No chat history yet
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
      ) : (
        <PremiumGate />
      )}

      {/* Footer - Login prompt for unauthenticated users */}
      {!isSignedIn && (
        <div className="p-2 border-t border-border/30">
          <SignInButton
            mode="modal"
            fallbackRedirectUrl={buildUrlWithReturn("/auth/redirect")}
          >
            <button
              className="flex items-center gap-3 w-full px-3 py-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors text-[13px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
              aria-label="Login"
            >
              <LogIn className="size-3.5" aria-hidden="true" />
              <span>Login</span>
            </button>
          </SignInButton>
        </div>
      )}
    </div>
  );
}

// Resizable wrapper for the sidebar
interface ResizableChatSidebarProps extends ChatSidebarProps {
  children: React.ReactNode;
}

export function ResizableChatLayout({
  isOpen,
  onOpenChange,
  onNewChat,
  onSelectThread,
  activeThreadId,
  isPremium,
  threads,
  onDeleteThread,
  onTogglePin,
  onRenameThread,
  groupedThreads,
  hasMore,
  isLoadingMore,
  onLoadMore,
  searchThreads,
  children,
}: ResizableChatSidebarProps) {
  const sidebarPanelRef = useRef<ImperativePanelHandle>(null);

  // Sync panel with isOpen state
  useEffect(() => {
    const panel = sidebarPanelRef.current;
    if (!panel) return;

    const isExpanded = panel.getSize() > 0;
    if (isOpen === isExpanded) return;

    if (isOpen) {
      panel.expand(20);
    } else {
      panel.collapse();
    }
  }, [isOpen]);

  return (
    <ResizablePanelGroup direction="horizontal" className="h-full">
      {/* Left sidebar panel */}
      <ResizablePanel
        ref={sidebarPanelRef}
        defaultSize={isOpen ? 20 : 0}
        minSize={15}
        maxSize={30}
        collapsible
        collapsedSize={0}
        onCollapse={() => {
          if (isOpen) onOpenChange(false);
        }}
        onExpand={() => {
          if (!isOpen) onOpenChange(true);
        }}
      >
        <ChatSidebar
          isOpen={isOpen}
          onOpenChange={onOpenChange}
          onNewChat={onNewChat}
          onSelectThread={onSelectThread}
          activeThreadId={activeThreadId}
          isPremium={isPremium}
          threads={threads}
          onDeleteThread={onDeleteThread}
          onTogglePin={onTogglePin}
          onRenameThread={onRenameThread}
          groupedThreads={groupedThreads}
          hasMore={hasMore}
          isLoadingMore={isLoadingMore}
          onLoadMore={onLoadMore}
          searchThreads={searchThreads}
        />
      </ResizablePanel>

      {/* Resize handle */}
      <ResizableHandle
        withToggle
        isCollapsed={!isOpen}
        onToggle={() => onOpenChange(!isOpen)}
        panelPosition="left"
        className={cn(
          "transition-opacity duration-150",
          !isOpen && "opacity-0 hover:opacity-100"
        )}
      />

      {/* Main content */}
      <ResizablePanel defaultSize={isOpen ? 80 : 100} minSize={50}>
        {children}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
