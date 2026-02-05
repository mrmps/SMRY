"use client";

import React, { useEffect, useCallback, useState, useRef, useSyncExternalStore } from "react";
import { ResizableChatLayout } from "@/components/features/chat-sidebar";
import { useChatThreads } from "@/lib/hooks/use-chat-threads";
import { cn } from "@/lib/utils";
import { ArrowUp, Square, PanelLeft, Sparkles, Trash } from "lucide-react";
import { useRouter } from "next/navigation";
import { AuthBar } from "@/components/shared/auth-bar";
import Link from "next/link";
import Image from "next/image";
import { useChat as useAIChat } from "@ai-sdk/react";
import { DefaultChatTransport, isTextUIPart, type UIMessage } from "ai";
import { getApiUrl } from "@/lib/api/config";
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

interface ChatPageContentProps {
  threadId?: string;
}

export function ChatPageContent({ threadId }: ChatPageContentProps) {
  const router = useRouter();
  const { getToken } = useAuth();
  const mounted = useSyncExternalStore(emptySubscribe, getClientSnapshot, getServerSnapshot);

  const {
    threads,
    activeThreadId,
    setActiveThreadId,
    createThread,
    updateThread,
  } = useChatThreads();

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
        api: getApiUrl("/api/chat"),
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

  // Convert stored messages to UIMessage format
  const getInitialMessages = useCallback((): UIMessage[] => {
    if (!activeThread) return [];
    return activeThread.messages.map((m, i) => ({
      id: `${activeThread.id}-${i}`,
      role: m.role as "user" | "assistant",
      parts: [{ type: "text" as const, text: m.content }],
    }));
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

  // Sync messages back when they change
  useEffect(() => {
    if (activeThreadId && messages.length > 0) {
      const simplifiedMessages = messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: getMessageText(m),
      }));

      // Generate title from first user message if needed
      const firstUserMessage = messages.find((m) => m.role === "user");
      const currentThread = threads.find((t) => t.id === activeThreadId);

      if (currentThread) {
        const updates: Parameters<typeof updateThread>[1] = {
          messages: simplifiedMessages,
        };

        // Auto-generate title from first message if still default
        if (
          currentThread.title === "New Chat" &&
          firstUserMessage
        ) {
          const text = getMessageText(firstUserMessage);
          if (text) {
            updates.title = text.slice(0, 50) + (text.length > 50 ? "..." : "");
          }
        }

        updateThread(activeThreadId, updates);
      }
    }
  }, [messages, activeThreadId, updateThread, threads]);

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

  // Handle thread selection
  const handleSelectThread = useCallback(
    (id: string) => {
      setActiveThreadId(id);
      const thread = threads.find((t) => t.id === id);
      if (thread) {
        const msgs: UIMessage[] = thread.messages.map((m, i) => ({
          id: `${id}-${i}`,
          role: m.role as "user" | "assistant",
          parts: [{ type: "text" as const, text: m.content }],
        }));
        setMessages(msgs);
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
                    <Sparkles className="size-8 text-primary" />
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
                          message.role === "user" ? "mb-4" : ""
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
                              onClick={() => handleSubmit()}
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
