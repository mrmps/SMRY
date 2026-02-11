'use client';

import { useChat as useAIChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useCallback, useState, useRef, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiUrl } from "@/lib/api/config";
import { useAuth } from "@clerk/nextjs";

// Generate a simple hash for the article to use as chat ID
function generateChatId(content: string): string {
  const sample = content.slice(0, 200).trim();
  let hash = 0;
  for (let i = 0; i < sample.length; i++) {
    const char = sample.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `chat-${Math.abs(hash).toString(36)}`;
}

// Query key factory for chat history
const chatHistoryKeys = {
  all: ['chat-history'] as const,
  byArticle: (articleHash: string) => ['chat-history', articleHash] as const,
};

export interface UsageData {
  remaining: number;
  limit: number;
  isPremium: boolean;
  model?: string;
}

export interface UseArticleChatOptions {
  articleContent: string;
  articleTitle?: string;
  language?: string;
  isPremium?: boolean;
  onUsageUpdate?: (usage: UsageData) => void;
}

export function useArticleChat({
  articleContent,
  articleTitle,
  language = "en",
  isPremium = false,
  onUsageUpdate,
}: UseArticleChatOptions) {
  const { getToken, isSignedIn } = useAuth();
  const queryClient = useQueryClient();
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [input, setInput] = useState("");
  const onUsageUpdateRef = useRef(onUsageUpdate);

  useEffect(() => {
    onUsageUpdateRef.current = onUsageUpdate;
  }, [onUsageUpdate]);

  // Generate chat ID based on article content for persistence
  const chatId = useMemo(() => generateChatId(articleContent), [articleContent]);
  const articleHash = chatId.replace("chat-", ""); // Just the hash part

  // React Query: Fetch chat history from server (for signed-in users)
  const {
    data: serverMessages,
    isLoading: isLoadingHistory,
    isFetched: serverFetchComplete,
  } = useQuery({
    queryKey: chatHistoryKeys.byArticle(articleHash),
    queryFn: async (): Promise<UIMessage[]> => {
      const token = await getToken();
      if (!token) return [];

      const response = await fetch(getApiUrl(`/api/chat-history/${articleHash}`), {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) return [];

      const data = await response.json();
      return data.messages || [];
    },
    enabled: !!isSignedIn && isPremium, // Only fetch for premium signed-in users
    staleTime: 0, // Always refetch on mount for fresh data
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  });

  // React Query: Save chat history mutation
  const saveMutation = useMutation({
    mutationFn: async (messages: UIMessage[]) => {
      const token = await getToken();
      if (!token) return false;

      const response = await fetch(getApiUrl(`/api/chat-history/${articleHash}`), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages }),
      });

      return response.ok;
    },
    onSuccess: () => {
      // Invalidate to keep cache in sync
      queryClient.invalidateQueries({ queryKey: chatHistoryKeys.byArticle(articleHash) });
    },
  });

  // React Query: Delete chat history mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      if (!token) return false;

      const response = await fetch(getApiUrl(`/api/chat-history/${articleHash}`), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      return response.ok;
    },
    onSuccess: () => {
      // Clear the cache immediately
      queryClient.setQueryData(chatHistoryKeys.byArticle(articleHash), []);
    },
  });

  // Load initial messages - only for premium users
  const initialMessages = useMemo(() => {
    // Non-premium users get no persistence
    if (!isPremium) return [];

    // For premium signed-in users, use server messages from React Query cache
    if (isSignedIn) {
      return serverMessages ?? [];
    }

    return [];
  }, [serverMessages, isSignedIn, isPremium]);

  const customFetch = useCallback(
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const headers = new Headers(init?.headers);
      try {
        const token = await getToken();
        if (token) {
          headers.set("Authorization", `Bearer ${token}`);
        }
      } catch {
      }
      const response = await fetch(input, { ...init, headers });

      const remaining = response.headers.get("X-Usage-Remaining");
      const limit = response.headers.get("X-Usage-Limit");
      const premium = response.headers.get("X-Is-Premium");
      const model = response.headers.get("X-Model");

      if (remaining !== null && limit !== null) {
        const usage: UsageData = {
          remaining: parseInt(remaining, 10),
          limit: parseInt(limit, 10),
          isPremium: premium === "true",
          model: model ?? undefined,
        };
        setUsageData(usage);
        onUsageUpdateRef.current?.(usage);
      }

      return response;
    },
    [getToken],
  ) as typeof globalThis.fetch;

  // Use refs for dynamic values that need to be current at request time
  const languageRef = useRef(language);
  const articleContentRef = useRef(articleContent);
  const articleTitleRef = useRef(articleTitle);

  // Keep refs updated
  useEffect(() => {
    languageRef.current = language;
    articleContentRef.current = articleContent;
    articleTitleRef.current = articleTitle;
  }, [language, articleContent, articleTitle]);

  /* eslint-disable react-hooks/refs -- refs are accessed in async callback, not during render */
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat", // Always use Route Handler for streaming (not rewrite proxy)
        fetch: customFetch,
        prepareSendMessagesRequest: ({ messages }) => {
          return {
            body: {
              messages,
              articleContent: articleContentRef.current,
              articleTitle: articleTitleRef.current,
              language: languageRef.current,
            },
          };
        },
      }),
    [customFetch],
  );
  /* eslint-enable react-hooks/refs */

  const chat = useAIChat({
    id: chatId,
    messages: initialMessages,
    transport,
    experimental_throttle: 50, // Throttle updates to 50ms for smooth token-level streaming
    onError: (error: Error) => {
      console.error("Chat error:", error);
    },
  });

  // Refs for tracking sync state
  const hasSyncedRef = useRef(false);
  const lastSavedRef = useRef<string>("");

  // Sync server messages to chat state when React Query fetches complete
  // This is needed because useAIChat only uses initialMessages on first render
  useEffect(() => {
    // Only sync once per server fetch completion for signed-in users
    if (!isSignedIn || !serverFetchComplete || hasSyncedRef.current || isLoadingHistory) return;

    // Mark as synced to prevent duplicate syncs
    hasSyncedRef.current = true;

    // Server is source of truth for signed-in users
    if (serverMessages && serverMessages.length > 0) {
      chat.setMessages(serverMessages);
      lastSavedRef.current = JSON.stringify(serverMessages);
    }
  }, [serverMessages, serverFetchComplete, isSignedIn, isLoadingHistory, chat]);

  // Reset sync flag when article changes or user signs out
  useEffect(() => {
    hasSyncedRef.current = false;
  }, [articleHash, isSignedIn]);

  // Persist messages when they change (premium only)
  useEffect(() => {
    if (!isPremium || chat.messages.length === 0) return;

    // Avoid duplicate saves
    const messagesJson = JSON.stringify(chat.messages);
    if (messagesJson === lastSavedRef.current) return;
    lastSavedRef.current = messagesJson;

    if (isSignedIn) {
      // Save to server via React Query mutation
      saveMutation.mutate(chat.messages);
    }
  }, [chat.messages, isSignedIn, isPremium, saveMutation]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setInput(e.target.value);
    },
    [],
  );

  const handleSubmit = useCallback(
    (e?: { preventDefault?: () => void }) => {
      e?.preventDefault?.();
      if (!input.trim() || chat.status === "streaming" || chat.status === "submitted") {
        return;
      }
      chat.sendMessage({
        role: "user",
        parts: [{ type: "text", text: input.trim() }],
      });
      setInput("");
    },
    [input, chat],
  );

  const sendMessage = useCallback(
    (content: string) => {
      if (!content.trim() || chat.status === "streaming" || chat.status === "submitted") {
        return;
      }
      chat.sendMessage({
        role: "user",
        parts: [{ type: "text", text: content }],
      });
    },
    [chat],
  );

  const clearMessages = useCallback(() => {
    chat.setMessages([]);
    lastSavedRef.current = "";
    hasSyncedRef.current = true; // Prevent re-population

    if (isPremium && isSignedIn) {
      // Delete from server via React Query mutation
      deleteMutation.mutate();
    }
  }, [chat, isPremium, isSignedIn, deleteMutation]);

  return {
    messages: chat.messages,
    setMessages: chat.setMessages,
    input,
    setInput,
    handleInputChange,
    handleSubmit,
    isLoading: chat.status === "streaming" || chat.status === "submitted",
    isLoadingHistory,
    error: chat.error,
    stop: chat.stop,
    reload: chat.regenerate,
    sendMessage,
    clearMessages,
    usageData,
  };
}
