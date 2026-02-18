"use client";

import React, { useState, forwardRef, useImperativeHandle, useRef } from "react";
import { cn } from "@/lib/utils";
import { ChatGpt, History } from "@/components/ui/icons";
import { ArticleChat, ArticleChatHandle } from "@/components/features/article-chat";
import { ChatSidebar } from "@/components/features/chat-sidebar";
import type { ChatThread } from "@/lib/hooks/use-chat-threads";
import type { GravityAd as GravityAdType } from "@/lib/hooks/use-gravity-ad";
import type { UIMessage } from "ai";

export type SidebarTab = "chat" | "history";

export interface TabbedSidebarHandle extends ArticleChatHandle {
  setActiveTab: (tab: SidebarTab) => void;
  activeTab: SidebarTab;
}

interface TabbedSidebarProps {
  // Chat props
  articleContent: string;
  articleTitle?: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  isPremium?: boolean;
  initialMessages?: UIMessage[];
  onMessagesChange?: (messages: UIMessage[]) => void;
  activeThreadTitle?: string;
  // Ads
  headerAd?: GravityAdType | null;
  onHeaderAdVisible?: () => void;
  onHeaderAdClick?: () => void;
  microAd?: GravityAdType | null;
  onMicroAdVisible?: () => void;
  onMicroAdClick?: () => void;
  // History props
  threads?: ChatThread[];
  activeThreadId?: string | null;
  onNewChat: () => void;
  onSelectThread: (threadId: string) => void;
  onDeleteThread?: (id: string) => void;
  onTogglePin?: (id: string) => void;
  onRenameThread?: (id: string, title: string) => void;
  groupedThreads?: () => { label: string; threads: ChatThread[] }[];
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  searchThreads?: (query: string) => Promise<ChatThread[]>;
  // Tab control
  defaultTab?: SidebarTab;
  onTabChange?: (tab: SidebarTab) => void;
}

export const TabbedSidebar = forwardRef<TabbedSidebarHandle, TabbedSidebarProps>(
  function TabbedSidebar(
    {
      // Chat props
      articleContent,
      articleTitle,
      isOpen,
      onOpenChange,
      isPremium = false,
      initialMessages,
      onMessagesChange,
      activeThreadTitle,
      // Ads
      headerAd,
      onHeaderAdVisible,
      onHeaderAdClick,
      microAd,
      onMicroAdVisible,
      onMicroAdClick,
      // History props
      threads,
      activeThreadId,
      onNewChat,
      onSelectThread,
      onDeleteThread,
      onTogglePin,
      onRenameThread,
      groupedThreads,
      hasMore,
      isLoadingMore,
      onLoadMore,
      searchThreads,
      // Tab control
      defaultTab = "chat",
      onTabChange,
    },
    ref
  ) {
    const [activeTab, setActiveTabInternal] = useState<SidebarTab>(defaultTab);

    // Use a ref to always have the latest activeTab value available
    // Updated synchronously in setActiveTab to avoid stale reads
    const activeTabRef = useRef<SidebarTab>(defaultTab);

    // Wrapper to also notify parent when tab changes
    // Updates ref synchronously so get activeTab() returns current value immediately
    const setActiveTab = (tab: SidebarTab) => {
      activeTabRef.current = tab; // Update ref synchronously BEFORE state
      setActiveTabInternal(tab);
      onTabChange?.(tab);
    };
    const chatRef = useRef<ArticleChatHandle>(null);

    // Expose chat methods + tab control to parent
    // Using a getter ensures we always return the current value
    useImperativeHandle(ref, () => ({
      clearMessages: () => chatRef.current?.clearMessages(),
      setMessages: (messages: UIMessage[]) => chatRef.current?.setMessages(messages),
      get hasMessages() { return chatRef.current?.hasMessages ?? false; },
      focusInput: () => chatRef.current?.focusInput(),
      stopGeneration: () => chatRef.current?.stopGeneration(),
      copyLastResponse: () => chatRef.current?.copyLastResponse(),
      setActiveTab,
      get activeTab() { return activeTabRef.current; },
    }));

    // Handle thread selection - switch to chat tab
    const handleSelectThread = (threadId: string) => {
      onSelectThread(threadId);
      setActiveTab("chat");
    };

    // Handle new chat - switch to chat tab
    const handleNewChat = () => {
      onNewChat();
      setActiveTab("chat");
    };

    // Don't return null when closed - keep mounted to preserve chat state
    // Only hide with CSS so chat messages persist across open/close cycles
    return (
      <div className={cn(
        "flex h-full w-full flex-col bg-background",
        !isOpen && "hidden"
      )}>
        {/* Compact Tab Header */}
        <div className="shrink-0 flex items-center justify-center px-3 py-1.5 border-b border-border/40">
          <div className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-muted/60">
            <button
              onClick={() => setActiveTab("chat")}
              className={cn(
                "flex items-center justify-center gap-1.5 px-5 py-1.5 rounded-md text-xs font-medium transition-all min-w-[80px]",
                activeTab === "chat"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <ChatGpt className="size-3.5" />
              <span>Chat</span>
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={cn(
                "flex items-center justify-center gap-1.5 px-5 py-1.5 rounded-md text-xs font-medium transition-all min-w-[80px]",
                activeTab === "history"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <History className="size-3.5" />
              <span>History</span>
            </button>
          </div>
        </div>

        {/* Tab Content - Both tabs stay mounted to preserve state */}
        <div className="flex-1 min-h-0 overflow-hidden relative">
          <div className={cn(
            "absolute inset-0",
            activeTab === "chat" ? "visible" : "invisible pointer-events-none"
          )}>
            <ArticleChat
              ref={chatRef}
              articleContent={articleContent}
              articleTitle={articleTitle}
              isOpen={isOpen}
              onOpenChange={onOpenChange}
              variant="sidebar"
              isPremium={isPremium}
              initialMessages={initialMessages}
              onMessagesChange={onMessagesChange}
              activeThreadTitle={activeThreadTitle}
              headerAd={headerAd}
              onHeaderAdVisible={onHeaderAdVisible}
              onHeaderAdClick={onHeaderAdClick}
              microAd={microAd}
              onMicroAdVisible={onMicroAdVisible}
              onMicroAdClick={onMicroAdClick}
            />
          </div>
          <div className={cn(
            "absolute inset-0",
            activeTab === "history" ? "visible" : "invisible pointer-events-none"
          )}>
            <ChatSidebar
              isOpen={true}
              onOpenChange={onOpenChange}
              onNewChat={handleNewChat}
              onSelectThread={handleSelectThread}
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
              hideHeader
            />
          </div>
        </div>
      </div>
    );
  }
);
