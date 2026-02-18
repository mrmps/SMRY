'use client';

import { useChat as useAIChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useCallback, useState, useRef, useMemo, useEffect, useId } from "react";
import { useAuth } from "@clerk/nextjs";

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
  initialMessages?: UIMessage[];
}

export function useArticleChat({
  articleContent,
  articleTitle,
  language = "en",
  isPremium: _isPremium = false,
  onUsageUpdate,
  initialMessages,
}: UseArticleChatOptions) {
  const { getToken } = useAuth();
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [input, setInput] = useState("");
  const onUsageUpdateRef = useRef(onUsageUpdate);

  useEffect(() => {
    onUsageUpdateRef.current = onUsageUpdate;
  }, [onUsageUpdate]);

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

  // Stable unique ID for chat instance
  const chatId = useId();

  /* eslint-disable react-hooks/refs -- refs accessed in prepareSendMessagesRequest callback, not during render */
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

  // Throttle for smooth streaming - 50ms = 20 updates/second
  const throttleMs = 50;

  const chat = useAIChat({
    id: chatId,
    messages: initialMessages ?? [],
    transport,
    experimental_throttle: throttleMs,
    onError: (error: Error) => {
      console.error("Chat error:", error);
    },
  });

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
  }, [chat]);

  return {
    messages: chat.messages,
    setMessages: chat.setMessages,
    input,
    setInput,
    handleInputChange,
    handleSubmit,
    isLoading: chat.status === "streaming" || chat.status === "submitted",
    error: chat.error,
    stop: chat.stop,
    reload: chat.regenerate,
    sendMessage,
    clearMessages,
    usageData,
  };
}
