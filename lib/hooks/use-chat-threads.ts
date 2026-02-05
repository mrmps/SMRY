"use client";

import { useCallback, useEffect, useState } from "react";

const THREADS_KEY = "smry-chat-threads";
const STORAGE_EVENT_NAME = "chat-threads-update";

export interface ChatThread {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  isPinned: boolean;
  messages: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
}

interface StorageEventDetail {
  key: string;
  value: ChatThread[];
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Hook to manage chat threads in localStorage
 */
export function useChatThreads() {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);

  // Read initial value from localStorage (using setTimeout to avoid sync setState in effect)
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const item = window.localStorage.getItem(THREADS_KEY);
        if (item) {
          const parsed = JSON.parse(item) as ChatThread[];
          setThreads(parsed);
        }
      } catch (error) {
        console.warn("Error reading threads from localStorage:", error);
      }
      setIsLoaded(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Listen for changes from other tabs
  useEffect(() => {
    const handleStorageChange = (event: Event) => {
      const customEvent = event as CustomEvent<StorageEventDetail>;
      if (customEvent.detail.key === THREADS_KEY) {
        setThreads(customEvent.detail.value);
      }
    };

    window.addEventListener(STORAGE_EVENT_NAME, handleStorageChange);

    const handleNativeStorage = (event: StorageEvent) => {
      if (event.key === THREADS_KEY && event.newValue) {
        try {
          setThreads(JSON.parse(event.newValue));
        } catch (error) {
          console.warn("Error parsing threads from storage event:", error);
        }
      }
    };
    window.addEventListener("storage", handleNativeStorage);

    return () => {
      window.removeEventListener(STORAGE_EVENT_NAME, handleStorageChange);
      window.removeEventListener("storage", handleNativeStorage);
    };
  }, []);

  const saveThreads = useCallback((newThreads: ChatThread[]) => {
    try {
      window.localStorage.setItem(THREADS_KEY, JSON.stringify(newThreads));
      const event = new CustomEvent<StorageEventDetail>(STORAGE_EVENT_NAME, {
        detail: { key: THREADS_KEY, value: newThreads },
      });
      window.dispatchEvent(event);
    } catch (error) {
      console.warn("Error saving threads to localStorage:", error);
    }
  }, []);

  const createThread = useCallback(
    (title?: string): ChatThread => {
      const now = new Date().toISOString();
      const newThread: ChatThread = {
        id: generateId(),
        title: title || "New Chat",
        createdAt: now,
        updatedAt: now,
        isPinned: false,
        messages: [],
      };

      setThreads((prev) => {
        const updated = [newThread, ...prev];
        saveThreads(updated);
        return updated;
      });

      setActiveThreadId(newThread.id);
      return newThread;
    },
    [saveThreads]
  );

  const updateThread = useCallback(
    (id: string, updates: Partial<Omit<ChatThread, "id" | "createdAt">>) => {
      setThreads((prev) => {
        const updated = prev.map((thread) =>
          thread.id === id
            ? { ...thread, ...updates, updatedAt: new Date().toISOString() }
            : thread
        );
        saveThreads(updated);
        return updated;
      });
    },
    [saveThreads]
  );

  const deleteThread = useCallback(
    (id: string) => {
      setThreads((prev) => {
        const updated = prev.filter((thread) => thread.id !== id);
        saveThreads(updated);
        return updated;
      });

      if (activeThreadId === id) {
        setActiveThreadId(null);
      }
    },
    [saveThreads, activeThreadId]
  );

  const togglePin = useCallback(
    (id: string) => {
      setThreads((prev) => {
        const updated = prev.map((thread) =>
          thread.id === id ? { ...thread, isPinned: !thread.isPinned } : thread
        );
        // Sort: pinned first, then by updatedAt
        updated.sort((a, b) => {
          if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        });
        saveThreads(updated);
        return updated;
      });
    },
    [saveThreads]
  );

  const renameThread = useCallback(
    (id: string, title: string) => {
      updateThread(id, { title });
    },
    [updateThread]
  );

  const clearAllThreads = useCallback(() => {
    setThreads([]);
    setActiveThreadId(null);
    saveThreads([]);
  }, [saveThreads]);

  // Group threads by date
  const groupedThreads = useCallback(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const lastMonth = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    const groups: { label: string; threads: ChatThread[] }[] = [
      { label: "Pinned", threads: [] },
      { label: "Today", threads: [] },
      { label: "Yesterday", threads: [] },
      { label: "Last 7 Days", threads: [] },
      { label: "Last 30 Days", threads: [] },
      { label: "Older", threads: [] },
    ];

    threads.forEach((thread) => {
      if (thread.isPinned) {
        groups[0].threads.push(thread);
        return;
      }

      const date = new Date(thread.updatedAt);
      if (date >= today) {
        groups[1].threads.push(thread);
      } else if (date >= yesterday) {
        groups[2].threads.push(thread);
      } else if (date >= lastWeek) {
        groups[3].threads.push(thread);
      } else if (date >= lastMonth) {
        groups[4].threads.push(thread);
      } else {
        groups[5].threads.push(thread);
      }
    });

    return groups.filter((g) => g.threads.length > 0);
  }, [threads]);

  const activeThread = threads.find((t) => t.id === activeThreadId) || null;

  return {
    threads,
    activeThread,
    activeThreadId,
    setActiveThreadId,
    groupedThreads,
    isLoaded,
    createThread,
    updateThread,
    deleteThread,
    togglePin,
    renameThread,
    clearAllThreads,
  };
}
