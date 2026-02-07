"use client";

import React, { useState, useRef, useEffect } from "react";
import { Search, Pin, X, LogIn, PanelLeftClose } from "lucide-react";
import { cn } from "@/lib/utils";
import { useChatThreads, type ChatThread } from "@/lib/hooks/use-chat-threads";
import Link from "next/link";
import Image from "next/image";
import { useAuth, SignInButton } from "@clerk/nextjs";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ImperativePanelHandle } from "react-resizable-panels";
import { buildUrlWithReturn } from "@/lib/hooks/use-return-url";

interface ChatSidebarProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onNewChat: () => void;
  onSelectThread: (threadId: string) => void;
  activeThreadId?: string | null;
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

  return (
    <div className="group relative px-2">
      <button
        onClick={onSelect}
        onDoubleClick={() => {
          setEditValue(thread.title);
          setIsEditing(true);
        }}
        className={cn(
          "flex items-center w-full rounded-lg overflow-hidden",
          "py-2 px-2 text-left transition-colors",
          isActive ? "bg-accent" : "hover:bg-accent/50"
        )}
      >
        <div className="flex-1 min-w-0 relative">
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
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
              className="w-full bg-background rounded px-1.5 py-0.5 text-sm text-foreground border border-border focus:outline-none focus:ring-1 focus:ring-primary"
              aria-label="Thread title"
            />
          ) : (
            <span
              className="block truncate text-sm text-foreground/80"
              title={thread.title}
            >
              {thread.title}
            </span>
          )}
        </div>
      </button>

      {/* Action buttons - visible on hover */}
      {!isEditing && (
        <div
          className={cn(
            "absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5",
            "opacity-0 group-hover:opacity-100 transition-opacity z-10"
          )}
        >
          {/* Gradient fade for text truncation */}
          <div
            className={cn(
              "absolute -left-6 w-6 h-8 pointer-events-none",
              isActive
                ? "bg-gradient-to-l from-accent to-transparent"
                : "bg-gradient-to-l from-card to-transparent group-hover:from-accent/50"
            )}
          />
          <button
            onClick={(e) => {
              e.stopPropagation();
              onTogglePin();
            }}
            className={cn(
              "p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent",
              thread.isPinned && "text-primary"
            )}
            aria-label={thread.isPinned ? "Unpin" : "Pin"}
          >
            <Pin className="size-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent"
            aria-label="Delete"
          >
            <X className="size-3.5" />
          </button>
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
    <div className="mb-1">
      <div className="px-4 py-2">
        <span className="text-xs font-medium text-primary/70">{label}</span>
      </div>
      <div className="space-y-0.5">
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

export function ChatSidebar({
  isOpen,
  onOpenChange,
  onNewChat,
  onSelectThread,
  activeThreadId,
}: ChatSidebarProps) {
  const { isSignedIn } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const { groupedThreads, deleteThread, togglePin, renameThread } =
    useChatThreads();

  const groups = groupedThreads();

  // Filter threads by search query
  const filteredGroups = searchQuery.trim()
    ? groups
        .map((group) => ({
          ...group,
          threads: group.threads.filter((t) =>
            t.title.toLowerCase().includes(searchQuery.toLowerCase())
          ),
        }))
        .filter((g) => g.threads.length > 0)
    : groups;

  return (
    <div className="flex flex-col h-full bg-card border-r border-border/40">
      {/* Header */}
      <div className="flex flex-col gap-2 p-2">
        {/* Logo and close button */}
        <div className="flex items-center justify-between px-2 py-1">
          <Link
            href="/"
            className="flex items-center transition-opacity hover:opacity-80"
          >
            <Image
              src="/logo.svg"
              width={65}
              height={14}
              alt="smry logo"
              className="h-3.5 w-auto dark:invert"
              priority
            />
          </Link>
          <button
            onClick={() => onOpenChange(false)}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            aria-label="Close sidebar"
          >
            <PanelLeftClose className="size-4" />
          </button>
        </div>

        {/* New Chat button */}
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-center h-9 rounded-lg text-sm font-semibold bg-primary/10 text-primary border border-primary/20 transition-colors hover:bg-primary/20"
        >
          New Chat
        </button>

        {/* Search */}
        <div className="flex items-center gap-3 px-3 py-2 border-b border-border/40">
          <Search className="size-4 text-muted-foreground/50 shrink-0" />
          <input
            type="search"
            role="searchbox"
            aria-label="Search threads"
            placeholder="Search your threads..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
          />
        </div>
      </div>

      {/* Thread list */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-1 scrollbar-hide">
        {filteredGroups.length > 0 ? (
          filteredGroups.map((group) => (
            <ThreadGroup
              key={group.label}
              label={group.label}
              threads={group.threads}
              activeThreadId={activeThreadId}
              onSelect={onSelectThread}
              onDelete={deleteThread}
              onTogglePin={togglePin}
              onRename={renameThread}
            />
          ))
        ) : (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-muted-foreground/50">
              {searchQuery ? "No matching threads" : "No chat history yet"}
            </p>
          </div>
        )}
      </div>

      {/* Footer - Login prompt for unauthenticated users */}
      {!isSignedIn && (
        <div className="p-2 border-t border-border/40">
          <SignInButton
            mode="modal"
            fallbackRedirectUrl={buildUrlWithReturn("/auth/redirect")}
          >
            <button
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors text-sm"
              aria-label="Login"
            >
              <LogIn className="size-4" />
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
