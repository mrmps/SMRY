'use client';

import { useChat as useAIChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useCallback, useState, useRef, useMemo, useEffect } from "react";
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

// Storage key for chat messages (localStorage fallback)
const CHAT_STORAGE_PREFIX = "article-chat-";

// Load chat history from server (for signed-in users)
async function loadChatFromServer(
  articleHash: string,
  getToken: () => Promise<string | null>
): Promise<UIMessage[] | null> {
  try {
    const token = await getToken();
    if (!token) return null;

    const response = await fetch(getApiUrl(`/api/chat-history/${articleHash}`), {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) return null;

    const data = await response.json();
    return data.messages || null;
  } catch {
    return null;
  }
}

// Save chat history to server (for signed-in users)
async function saveChatToServer(
  articleHash: string,
  messages: UIMessage[],
  getToken: () => Promise<string | null>
): Promise<boolean> {
  try {
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
  } catch {
    return false;
  }
}

// Delete chat history from server
async function deleteChatFromServer(
  articleHash: string,
  getToken: () => Promise<string | null>
): Promise<boolean> {
  try {
    const token = await getToken();
    if (!token) return false;

    const response = await fetch(getApiUrl(`/api/chat-history/${articleHash}`), {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    return response.ok;
  } catch {
    return false;
  }
}

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
  onUsageUpdate?: (usage: UsageData) => void;
}

export function useArticleChat({
  articleContent,
  articleTitle,
  language = "en",
  onUsageUpdate,
}: UseArticleChatOptions) {
  const { getToken, isSignedIn } = useAuth();
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [input, setInput] = useState("");
  const [serverMessages, setServerMessages] = useState<UIMessage[] | null>(null);
  const [_isLoadingHistory, setIsLoadingHistory] = useState(false);
  const onUsageUpdateRef = useRef(onUsageUpdate);

  useEffect(() => {
    onUsageUpdateRef.current = onUsageUpdate;
  }, [onUsageUpdate]);

  // Generate chat ID based on article content for persistence
  const chatId = useMemo(() => generateChatId(articleContent), [articleContent]);
  const articleHash = chatId.replace("chat-", ""); // Just the hash part
  const storageKey = `${CHAT_STORAGE_PREFIX}${chatId}`;

  // Load chat history from server for signed-in users
  useEffect(() => {
    if (!isSignedIn) return;

    setIsLoadingHistory(true);
    loadChatFromServer(articleHash, getToken)
      .then((messages) => {
        if (messages && messages.length > 0) {
          setServerMessages(messages);
        }
      })
      .finally(() => setIsLoadingHistory(false));
  }, [isSignedIn, articleHash, getToken]);

  // Load initial messages - prefer server for signed-in, localStorage for anonymous
  const initialMessages = useMemo(() => {
    // If we have server messages, use those
    if (serverMessages && serverMessages.length > 0) {
      return serverMessages;
    }

    // Fallback to localStorage
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        return JSON.parse(stored) as UIMessage[];
      }
    } catch {
      // Ignore parse errors
    }
    return [];
  }, [storageKey, serverMessages]);

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

  /* eslint-disable react-hooks/refs -- ref in customFetch is accessed in async callback, not during render */
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: getApiUrl("/api/chat"),
        fetch: customFetch,
        prepareSendMessagesRequest: ({ messages }) => {
          return {
            body: {
              messages,
              articleContent,
              articleTitle,
              language,
            },
          };
        },
      }),
    [customFetch, articleContent, articleTitle, language],
  );
  /* eslint-enable react-hooks/refs */

  const chat = useAIChat({
    id: chatId,
    messages: initialMessages,
    transport,
    onError: (error: Error) => {
      console.error("Chat error:", error);
    },
  });

  // Sync server messages to chat state when they load
  // This is needed because useAIChat only uses initialMessages on first render
  useEffect(() => {
    if (serverMessages && serverMessages.length > 0 && chat.messages.length === 0) {
      chat.setMessages(serverMessages);
    }
  }, [serverMessages, chat]);

  // Persist messages when they change
  // - Signed-in users: save to server (Redis)
  // - Anonymous users: save to localStorage
  const lastSavedRef = useRef<string>("");

  useEffect(() => {
    if (chat.messages.length === 0) return;

    // Avoid duplicate saves
    const messagesJson = JSON.stringify(chat.messages);
    if (messagesJson === lastSavedRef.current) return;
    lastSavedRef.current = messagesJson;

    if (isSignedIn) {
      // Save to server for signed-in users
      saveChatToServer(articleHash, chat.messages, getToken);
    } else {
      // Save to localStorage for anonymous users
      try {
        localStorage.setItem(storageKey, messagesJson);
      } catch {
        // Ignore storage errors
      }
    }
  }, [chat.messages, isSignedIn, articleHash, getToken, storageKey]);

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

    if (isSignedIn) {
      // Clear from server for signed-in users
      deleteChatFromServer(articleHash, getToken);
    }
    // Always clear localStorage too
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // Ignore storage errors
    }
  }, [chat, storageKey, isSignedIn, articleHash, getToken]);

  return {
    messages: chat.messages,
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
