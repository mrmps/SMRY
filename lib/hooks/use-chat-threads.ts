"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getApiUrl } from "@/lib/api/config";

const THREADS_KEY = "smry-chat-threads";
const STORAGE_EVENT_NAME = "chat-threads-update";
const DEBOUNCE_MS = 1000;

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

let idCounter = 0;
function generateId(): string {
  idCounter++;
  return `${Date.now()}-${idCounter}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Hook to manage chat threads with localStorage + server sync for premium users
 */
export function useChatThreads(isPremium = false) {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);

  const { getToken, isSignedIn } = useAuth();
  const hasSyncedRef = useRef(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Server sync (premium only) ---

  const { data: serverThreads, isFetched: serverFetchComplete } = useQuery({
    queryKey: ["chat-threads"],
    queryFn: async (): Promise<ChatThread[]> => {
      const token = await getToken();
      if (!token) return [];

      const response = await fetch(getApiUrl("/api/chat-threads"), {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) return [];

      const data = await response.json();
      return data.threads || [];
    },
    enabled: !!isSignedIn && isPremium,
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
  });

  const saveMutation = useMutation({
    mutationFn: async (threadsToSave: ChatThread[]) => {
      const token = await getToken();
      if (!token) return false;

      const response = await fetch(getApiUrl("/api/chat-threads"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ threads: threadsToSave }),
      });

      return response.ok;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (threadId: string) => {
      const token = await getToken();
      if (!token) return false;

      const response = await fetch(getApiUrl(`/api/chat-threads/${threadId}`), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      return response.ok;
    },
  });

  // Sync server threads to local state on first fetch
  // Wrapped in setTimeout to avoid synchronous setState in effect (lint rule)
  useEffect(() => {
    if (!isSignedIn || !isPremium || !serverFetchComplete || hasSyncedRef.current) return;

    hasSyncedRef.current = true;

    const timer = setTimeout(() => {
      if (serverThreads && serverThreads.length > 0) {
        setThreads(serverThreads);
        try {
          window.localStorage.setItem(THREADS_KEY, JSON.stringify(serverThreads));
        } catch {
          // ignore
        }
      }
      setIsLoaded(true);
    }, 0);
    return () => clearTimeout(timer);
  }, [serverThreads, serverFetchComplete, isSignedIn, isPremium]);

  // Reset sync flag when premium status changes
  useEffect(() => {
    hasSyncedRef.current = false;
  }, [isSignedIn, isPremium]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Read initial value from localStorage (premium only, before server sync)
  useEffect(() => {
    if (!isPremium) {
      const t = setTimeout(() => {
        setThreads([]);
        setIsLoaded(true);
      }, 0);
      return () => clearTimeout(t);
    }

    const timer = setTimeout(() => {
      try {
        const item = window.localStorage.getItem(THREADS_KEY);
        if (item) {
          const parsed = JSON.parse(item) as ChatThread[];
          // Deduplicate by ID (keep first occurrence)
          const seen = new Set<string>();
          const deduped = parsed.filter((thread) => {
            if (seen.has(thread.id)) return false;
            seen.add(thread.id);
            return true;
          });
          // Save deduped list if there were duplicates
          if (deduped.length !== parsed.length) {
            window.localStorage.setItem(THREADS_KEY, JSON.stringify(deduped));
          }
          setThreads(deduped);
        }
      } catch (error) {
        console.warn("Error reading threads from localStorage:", error);
      }
      // Only mark loaded if server sync isn't going to override
      if (!isSignedIn || !isPremium) {
        setIsLoaded(true);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [isPremium, isSignedIn]);

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
    if (!isPremium) return;

    // Always save to localStorage immediately
    try {
      window.localStorage.setItem(THREADS_KEY, JSON.stringify(newThreads));
      const event = new CustomEvent<StorageEventDetail>(STORAGE_EVENT_NAME, {
        detail: { key: THREADS_KEY, value: newThreads },
      });
      window.dispatchEvent(event);
    } catch (error) {
      console.warn("Error saving threads to localStorage:", error);
    }

    // Debounced save to server for premium users
    if (isSignedIn && isPremium) {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        saveMutation.mutate(newThreads);
      }, DEBOUNCE_MS);
    }
  }, [isPremium, isSignedIn, saveMutation]);

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

      // Also delete on server for premium users
      if (isSignedIn && isPremium) {
        deleteMutation.mutate(id);
      }

      if (activeThreadId === id) {
        setActiveThreadId(null);
      }
    },
    [saveThreads, activeThreadId, isSignedIn, isPremium, deleteMutation]
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
