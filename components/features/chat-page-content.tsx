"use client";

import React, { useEffect, useCallback, useState, useRef, useSyncExternalStore } from "react";
import { ResizableChatLayout } from "@/components/features/chat-sidebar";
import { useChatThreads } from "@/lib/hooks/use-chat-threads";
import { useIsPremium } from "@/lib/hooks/use-is-premium";
import { cn } from "@/lib/utils";
import { ArrowUp, Square, PanelLeft, MessageSquare, Trash } from "lucide-react";
import { useRouter } from "next/navigation";
import { AuthBar } from "@/components/shared/auth-bar";
import Link from "next/link";
import Image from "next/image";
import { useChat as useAIChat } from "@ai-sdk/react";
import { DefaultChatTransport, isTextUIPart, type UIMessage } from "ai";
import { useAuth } from "@clerk/nextjs";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputActions,
  PromptInputAction,
} from "@/components/ui/prompt-input";
import { Button } from "@/components/ui/button";
import { Response } from "@/components/ai/response";

// Helper to detect client-side
const emptySubscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

function getMessageText(message: UIMessage): string {
  return message.parts
    .filter((part) => isTextUIPart(part))
    .map((part) => part.text)
    .join("");
}

// Thinking shimmer indicator (CSS in globals.css)
function ChatLoader() {
  return (
    <div className="thinking-indicator">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256">
        <rect fill="none" width="256" height="256" />
        <line fill="none" stroke="currentColor" x1="88" y1="232" x2="168" y2="232" strokeLinecap="round" strokeLinejoin="round" strokeWidth="16" />
        <line fill="none" stroke="currentColor" x1="128" y1="200" x2="128" y2="144" strokeLinecap="round" strokeLinejoin="round" strokeWidth="16" />
        <polyline fill="none" stroke="currentColor" points="96 112 128 144 160 112" strokeLinecap="round" strokeLinejoin="round" strokeWidth="16" />
        <path d="M78.7,167A79.5,79.5,0,0,1,48,104.5C47.8,61.1,82.7,25,126.1,24a80,80,0,0,1,51.3,142.9A24.2,24.2,0,0,0,168,186v6a8,8,0,0,1-8,8H96a8,8,0,0,1-8-8v-6A24.4,24.4,0,0,0,78.7,167Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="16" />
      </svg>
      <span className="thinking-text">Thinking...</span>
    </div>
  );
}

interface ChatPageContentProps {
  threadId?: string;
}

export function ChatPageContent({ threadId }: ChatPageContentProps) {
  const router = useRouter();
  const { getToken } = useAuth();
  const mounted = useSyncExternalStore(emptySubscribe, getClientSnapshot, getServerSnapshot);
  const { isPremium } = useIsPremium();

  const {
    threads,
    activeThreadId,
    setActiveThreadId,
    createThread,
    updateThread,
    deleteThread,
    togglePin,
    renameThread,
    groupedThreads,
    loadMore,
    hasMore,
    isLoadingMore,
    searchThreads,
  } = useChatThreads(isPremium);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Set active thread from URL param
  useEffect(() => {
    if (threadId) {
      setActiveThreadId(threadId);
    }
  }, [threadId, setActiveThreadId]);

  // Custom fetch with auth
  const customFetch = useCallback(
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const headers = new Headers(init?.headers);
      try {
        const token = await getToken();
        if (token) {
          headers.set("Authorization", `Bearer ${token}`);
        }
      } catch {
        // Ignore auth errors
      }
      return fetch(input, { ...init, headers });
    },
    [getToken]
  ) as typeof globalThis.fetch;

  // Chat transport
  const transport = React.useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat", // Always use Route Handler for streaming (not rewrite proxy)
        fetch: customFetch,
        prepareSendMessagesRequest: ({ messages }) => ({
          body: {
            messages,
            // No article context for standalone chat
          },
        }),
      }),
    [customFetch]
  );

  // Get active thread for initial messages
  const activeThread = threads.find((t) => t.id === activeThreadId);

  // Thread messages are already UIMessage-compatible (ThreadMessage format)
  const getInitialMessages = useCallback((): UIMessage[] => {
    if (!activeThread) return [];
    return activeThread.messages as UIMessage[];
  }, [activeThread]);

  const {
    messages,
    status,
    stop,
    setMessages,
    sendMessage,
  } = useAIChat({
    id: activeThreadId || "new",
    transport,
    messages: getInitialMessages(),
    experimental_throttle: 50,
  });

  // Ref for threads so the sync effect can read latest state without depending on it
  const threadsRef = useRef(threads);
  useEffect(() => {
    threadsRef.current = threads;
  }, [threads]);

  // Sync messages back when they change (save as ThreadMessage[] directly)
  useEffect(() => {
    if (activeThreadId && messages.length > 0) {
      const threadMessages = messages.map((m) => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        parts: m.parts
          .filter((p) => isTextUIPart(p))
          .map((p) => ({ type: "text" as const, text: (p as { text: string }).text })),
      }));

      // Generate title from first user message if needed
      const firstUserMessage = threadMessages.find((m) => m.role === "user");
      const currentThread = threadsRef.current.find((t) => t.id === activeThreadId);

      if (currentThread) {
        const updates: Parameters<typeof updateThread>[1] = {
          messages: threadMessages,
        };

        // Auto-generate title from first message if still default
        if (
          currentThread.title === "New Chat" &&
          firstUserMessage
        ) {
          const text = firstUserMessage.parts[0]?.text || "";
          if (text) {
            updates.title = text.slice(0, 50) + (text.length > 50 ? "..." : "");
          }
        }

        updateThread(activeThreadId, updates);
      }
    }
  }, [messages, activeThreadId, updateThread]);

  // Scroll to bottom when messages change
  useEffect(() => {
    const timer = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 150);
    return () => clearTimeout(timer);
  }, [messages]);

  // Handle new chat
  const handleNewChat = useCallback(() => {
    const newThread = createThread();
    setMessages([]);
    setInput("");
    router.push(`/chat/${newThread.id}`);
  }, [createThread, setMessages, router]);

  // Handle thread selection — thread messages are already UIMessage-compatible
  const handleSelectThread = useCallback(
    (id: string) => {
      setActiveThreadId(id);
      const thread = threads.find((t) => t.id === id);
      if (thread) {
        setMessages(thread.messages as UIMessage[]);
      }
      setInput("");
      router.push(`/chat/${id}`);
    },
    [setActiveThreadId, threads, setMessages, router]
  );

  // Handle form submit
  const handleSubmit = useCallback(
    (e?: { preventDefault?: () => void }) => {
      e?.preventDefault?.();
      if (!input.trim()) return;

      // Create a thread if none active
      let threadIdToUse = activeThreadId;
      if (!threadIdToUse) {
        const newThread = createThread(input.slice(0, 50));
        threadIdToUse = newThread.id;
        setActiveThreadId(newThread.id);
        router.push(`/chat/${newThread.id}`);
      }

      sendMessage({
        role: "user",
        parts: [{ type: "text", text: input.trim() }],
      });
      setInput("");
      textareaRef.current?.focus();
    },
    [input, activeThreadId, createThread, setActiveThreadId, router, sendMessage]
  );

  // Handle clear messages
  const handleClearMessages = useCallback(() => {
    setMessages([]);
    if (activeThreadId) {
      updateThread(activeThreadId, { messages: [] });
    }
  }, [setMessages, activeThreadId, updateThread]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const isLoading = status === "streaming" || status === "submitted";

  if (!mounted) {
    return <div className="h-dvh bg-background" />;
  }

  return (
    <div className="h-dvh bg-background">
      <ResizableChatLayout
        isOpen={sidebarOpen}
        onOpenChange={setSidebarOpen}
        onNewChat={handleNewChat}
        onSelectThread={handleSelectThread}
        activeThreadId={activeThreadId}
        threads={threads}
        onDeleteThread={deleteThread}
        onTogglePin={togglePin}
        onRenameThread={renameThread}
        groupedThreads={groupedThreads}
        hasMore={hasMore}
        isLoadingMore={isLoadingMore}
        onLoadMore={loadMore}
        searchThreads={searchThreads}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <header className="flex items-center justify-between h-14 px-4 border-b border-border/40 shrink-0">
            <div className="flex items-center gap-3">
              {!sidebarOpen && (
                <button
                  onClick={() => setSidebarOpen(true)}
                  className={cn(
                    "p-2 rounded-md",
                    "text-muted-foreground hover:text-foreground hover:bg-accent/50",
                    "transition-colors"
                  )}
                  aria-label="Open sidebar"
                >
                  <PanelLeft className="size-5" />
                </button>
              )}
              {!sidebarOpen && (
                <Link
                  href="/"
                  className="flex items-center transition-opacity hover:opacity-80"
                >
                  <Image
                    src="/logo.svg"
                    width={80}
                    height={80}
                    alt="smry logo"
                    className="h-6 w-auto dark:invert"
                    priority
                  />
                </Link>
              )}
            </div>
            <div className="flex items-center gap-2">
              {messages.length > 0 && (
                <button
                  onClick={handleClearMessages}
                  className={cn(
                    "p-2 rounded-md",
                    "text-muted-foreground hover:text-foreground hover:bg-accent/50",
                    "transition-colors"
                  )}
                  aria-label="Clear chat"
                >
                  <Trash className="size-4" />
                </button>
              )}
              <AuthBar variant="compact" showUpgrade={false} />
            </div>
          </header>

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto px-4 py-6">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full min-h-[50vh] text-center">
                  <div className="p-4 rounded-full bg-primary/10 mb-4">
                    <MessageSquare className="size-8 text-primary" />
                  </div>
                  <h2 className="text-xl font-semibold text-foreground mb-2">
                    How can I help you today?
                  </h2>
                  <p className="text-muted-foreground max-w-md">
                    Start a conversation or paste an article URL to get started.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {messages.map((message, index) => {
                    const messageText = getMessageText(message);
                    const isLastMessage = index === messages.length - 1;

                    return (
                      <div
                        key={message.id}
                        className={cn(
                          "group relative",
                          message.role === "user" ? "mb-4" : "",
                          message.role === "assistant" && !messageText && "!mt-0 h-0 overflow-hidden"
                        )}
                      >
                        {message.role === "user" ? (
                          <div className="rounded-[10px]">
                            <div
                              className={cn(
                                "px-3 py-2",
                                "bg-muted/40 dark:bg-muted/30",
                                "border border-border/60",
                                "rounded-[10px]"
                              )}
                            >
                              <p className="text-[14px] leading-[20px] whitespace-pre-wrap break-words overflow-hidden">
                                {messageText}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="px-2 overflow-hidden">
                            <div className="text-[14px] leading-[22.75px] overflow-x-auto">
                              <Response isAnimating={isLoading && isLastMessage}>
                                {messageText}
                              </Response>
                            </div>
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
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>
          </div>

          {/* Input area */}
          <div className="shrink-0 border-t border-border/40 bg-background">
            <div className="max-w-3xl mx-auto px-4 py-4">
              <div className="relative rounded-[10px] border border-border/60 bg-background overflow-hidden">
                <div className="bg-muted/30 dark:bg-muted/20">
                  <PromptInput
                    value={input}
                    onValueChange={setInput}
                    isLoading={isLoading}
                    onSubmit={handleSubmit}
                    className="rounded-none border-0 shadow-none bg-transparent"
                    textareaRef={textareaRef}
                  >
                    <PromptInputTextarea
                      placeholder="Send a message..."
                      className="text-[14px] min-h-[40px]"
                      onKeyDown={handleKeyDown}
                    />
                    <PromptInputActions className="justify-end px-2 pb-2">
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
                          <PromptInputAction tooltip="Send message (Enter)">
                            <Button
                              type="button"
                              size="icon"
                              disabled={!input.trim()}
                              onClick={() => {
                                handleSubmit();
                                textareaRef.current?.focus();
                              }}
                              className={cn(
                                "size-7 rounded-full transition-all duration-150",
                                input.trim()
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
            </div>
          </div>
        </div>
      </ResizableChatLayout>
    </div>
  );
}
