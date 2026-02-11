"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getApiUrl } from "@/lib/api/config";
import {
  getAllThreads as idbGetAll,
  putThread as idbPutThread,
  putThreads as idbPutThreads,
  deleteThread as idbDeleteThread,
  clearAllThreads as idbClearAll,
  searchThreads as idbSearchThreads,
  migrateFromLocalStorage,
} from "@/lib/storage/thread-db";

export { normalizeThreadMessages } from "@/lib/storage/thread-db";

const DEBOUNCE_MS = 1000;
const BROADCAST_CHANNEL = "smry-threads";
const DEFAULT_PAGE_SIZE = 20;

export interface ThreadMessage {
  id: string;
  role: "user" | "assistant";
  parts: Array<{ type: "text"; text: string }>;
}

export interface ChatThread {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  isPinned: boolean;
  articleUrl?: string;
  articleTitle?: string;
  articleDomain?: string;
  messages: ThreadMessage[];
}

export interface ChatThreadMetadata {
  articleUrl?: string;
  articleTitle?: string;
  articleDomain?: string;
}

/**
 * Format a date as a relative time string (e.g. "now", "5m", "2h", "3d")
 */
export function formatRelativeTime(date: string | Date): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  const diffWeek = Math.floor(diffDay / 7);
  const diffMonth = Math.floor(diffDay / 30);

  if (diffSec < 60) return "now";
  if (diffMin < 60) return `${diffMin}m`;
  if (diffHr < 24) return `${diffHr}h`;
  if (diffDay < 7) return `${diffDay}d`;
  if (diffWeek < 4) return `${diffWeek}w`;
  return `${diffMonth}mo`;
}

let idCounter = 0;
function generateId(): string {
  idCounter++;
  return `${Date.now()}-${idCounter}-${Math.random().toString(36).substring(2, 9)}`;
}

// --- Server API helpers ---

interface ThreadListResponse {
  threads: any[];
  nextCursor: string | null;
}

async function fetchThreadList(
  token: string,
  limit: number,
  cursor?: string | null
): Promise<ThreadListResponse> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set("cursor", cursor);

  const res = await fetch(getApiUrl(`/api/chat-threads?${params}`), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return { threads: [], nextCursor: null };
  return res.json();
}

async function createThreadOnServer(
  token: string,
  thread: ChatThread
): Promise<boolean> {
  const res = await fetch(getApiUrl("/api/chat-threads"), {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ thread }),
  });
  return res.ok;
}

async function patchThreadOnServer(
  token: string,
  threadId: string,
  thread: ChatThread
): Promise<boolean> {
  const res = await fetch(getApiUrl(`/api/chat-threads/${threadId}`), {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ thread }),
  });
  return res.ok;
}

async function deleteThreadOnServer(
  token: string,
  threadId: string
): Promise<boolean> {
  const res = await fetch(getApiUrl(`/api/chat-threads/${threadId}`), {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.ok;
}

/**
 * Hook to manage chat threads with IndexedDB (offline-first) + server sync for premium users.
 */
export function useChatThreads(isPremium = false, articleUrl?: string) {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);

  // Pagination state
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const { getToken, isSignedIn } = useAuth();
  const hasSyncedRef = useRef(false);
  const threadsRef = useRef(threads);
  threadsRef.current = threads;

  // Debounce tracking per thread
  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const pendingPatches = useRef<Set<string>>(new Set());

  // BroadcastChannel for cross-tab sync
  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    try {
      channelRef.current = new BroadcastChannel(BROADCAST_CHANNEL);
      channelRef.current.onmessage = async () => {
        // Another tab updated threads — refresh from IDB
        const fresh = await idbGetAll();
        setThreads(fresh);
      };
    } catch {
      // BroadcastChannel not supported (e.g., some older browsers)
    }
    return () => {
      channelRef.current?.close();
    };
  }, []);

  const notifyOtherTabs = useCallback(() => {
    try {
      channelRef.current?.postMessage("updated");
    } catch {
      // Ignore
    }
  }, []);

  // --- Initialization: IDB → state, then background server sync ---

  useEffect(() => {
    let cancelled = false;

    async function init() {
      // Step 1: Migrate from localStorage (one-time)
      await migrateFromLocalStorage();

      // Step 2: Load from IDB → instant UI
      const local = await idbGetAll();
      if (!cancelled) {
        if (isPremium) {
          setThreads(local);
        } else {
          setThreads([]);
        }
        setIsLoaded(true);
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [isPremium]);

  // --- Server sync (premium only): fetch first page, merge into IDB ---

  const { data: serverData, isFetched: serverFetchComplete } = useQuery({
    queryKey: ["chat-threads"],
    queryFn: async (): Promise<ThreadListResponse> => {
      const token = await getToken();
      if (!token) return { threads: [], nextCursor: null };
      return fetchThreadList(token, DEFAULT_PAGE_SIZE);
    },
    enabled: !!isSignedIn && isPremium,
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
  });

  // Merge server response into IDB + state
  useEffect(() => {
    if (!isSignedIn || !isPremium || !serverFetchComplete || hasSyncedRef.current) return;
    if (!serverData) return;

    hasSyncedRef.current = true;

    const timer = setTimeout(async () => {
      const serverThreads = serverData.threads || [];
      setCursor(serverData.nextCursor);
      setHasMore(!!serverData.nextCursor);

      if (serverThreads.length > 0) {
        // Merge: server wins on updatedAt conflicts
        const localThreads = await idbGetAll();
        const localMap = new Map(localThreads.map((t) => [t.id, t]));

        // Upsert server threads (metadata only — fetch full on demand)
        // Server list response has no messages, so keep local messages if available
        const merged: ChatThread[] = [];
        const serverIds = new Set<string>();

        for (const st of serverThreads) {
          serverIds.add(st.id);
          const local = localMap.get(st.id);
          if (local) {
            // Server has newer or equal data — merge metadata, keep local messages
            const serverTime = new Date(st.updatedAt).getTime();
            const localTime = new Date(local.updatedAt).getTime();
            if (serverTime >= localTime) {
              merged.push({ ...local, ...st, messages: local.messages });
            } else {
              merged.push(local);
            }
            localMap.delete(st.id);
          } else {
            // New from server — no messages in list view, will fetch on demand
            merged.push({ ...st, messages: st.messages || [] });
          }
        }

        // Add remaining local threads that aren't on the server's first page
        for (const [, local] of localMap) {
          merged.push(local);
        }

        // Sort by updatedAt descending
        merged.sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );

        await idbPutThreads(merged);
        setThreads(merged);
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [serverData, serverFetchComplete, isSignedIn, isPremium]);

  // Reset sync flag when premium/auth changes
  useEffect(() => {
    hasSyncedRef.current = false;
  }, [isSignedIn, isPremium]);

  // --- Per-thread PATCH mutation (debounced) ---

  const patchMutation = useMutation({
    mutationFn: async ({ threadId, thread }: { threadId: string; thread: ChatThread }) => {
      const token = await getToken();
      if (!token) return false;
      return patchThreadOnServer(token, threadId, thread);
    },
  });

  const patchMutateRef = useRef(patchMutation.mutate);
  patchMutateRef.current = patchMutation.mutate;

  const createMutation = useMutation({
    mutationFn: async (thread: ChatThread) => {
      const token = await getToken();
      if (!token) return false;
      return createThreadOnServer(token, thread);
    },
  });

  const createMutateRef = useRef(createMutation.mutate);
  createMutateRef.current = createMutation.mutate;

  const deleteMutation = useMutation({
    mutationFn: async (threadId: string) => {
      const token = await getToken();
      if (!token) return false;
      return deleteThreadOnServer(token, threadId);
    },
  });

  const deleteMutateRef = useRef(deleteMutation.mutate);
  deleteMutateRef.current = deleteMutation.mutate;

  // Debounced PATCH for a specific thread
  const debouncedPatch = useCallback(
    (threadId: string, thread: ChatThread) => {
      if (!isSignedIn || !isPremium) return;

      const existing = debounceTimers.current.get(threadId);
      if (existing) clearTimeout(existing);

      pendingPatches.current.add(threadId);

      debounceTimers.current.set(
        threadId,
        setTimeout(() => {
          debounceTimers.current.delete(threadId);
          pendingPatches.current.delete(threadId);
          patchMutateRef.current({ threadId, thread });
        }, DEBOUNCE_MS)
      );
    },
    [isSignedIn, isPremium]
  );

  // Flush all pending patches immediately
  const flushToServer = useCallback(() => {
    if (!isSignedIn || !isPremium) return;

    for (const [threadId, timer] of debounceTimers.current) {
      clearTimeout(timer);
      debounceTimers.current.delete(threadId);
      pendingPatches.current.delete(threadId);
      const thread = threadsRef.current.find((t) => t.id === threadId);
      if (thread) {
        patchMutateRef.current({ threadId, thread });
      }
    }
  }, [isSignedIn, isPremium]);

  // Safety net: flush on beforeunload and visibilitychange
  useEffect(() => {
    if (!isSignedIn || !isPremium) return;

    const handleBeforeUnload = () => flushToServer();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") flushToServer();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isSignedIn, isPremium, flushToServer]);

  // Cleanup debounce timers on unmount
  useEffect(() => {
    const timers = debounceTimers.current;
    return () => {
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
    };
  }, []);

  // --- Thread operations ---

  const createThread = useCallback(
    (title?: string, metadata?: ChatThreadMetadata): ChatThread => {
      const now = new Date().toISOString();
      const newThread: ChatThread = {
        id: generateId(),
        title: title || "New Chat",
        createdAt: now,
        updatedAt: now,
        isPinned: false,
        articleUrl: metadata?.articleUrl,
        articleTitle: metadata?.articleTitle,
        articleDomain: metadata?.articleDomain,
        messages: [],
      };

      const updated = [newThread, ...threadsRef.current];
      setThreads(updated);
      setActiveThreadId(newThread.id);

      // Write to IDB
      idbPutThread(newThread);
      notifyOtherTabs();

      // Immediate server create (not debounced)
      if (isSignedIn && isPremium) {
        createMutateRef.current(newThread);
      }

      return newThread;
    },
    [isSignedIn, isPremium, notifyOtherTabs]
  );

  const updateThread = useCallback(
    (id: string, updates: Partial<Omit<ChatThread, "id" | "createdAt">>) => {
      const updated = threadsRef.current.map((thread) =>
        thread.id === id
          ? { ...thread, ...updates, updatedAt: new Date().toISOString() }
          : thread
      );
      setThreads(updated);

      // Write to IDB
      const updatedThread = updated.find((t) => t.id === id);
      if (updatedThread) {
        idbPutThread(updatedThread);
        notifyOtherTabs();
        // Debounced PATCH to server
        debouncedPatch(id, updatedThread);
      }
    },
    [debouncedPatch, notifyOtherTabs]
  );

  const deleteThread = useCallback(
    (id: string) => {
      const updated = threadsRef.current.filter((thread) => thread.id !== id);
      setThreads(updated);

      // Remove from IDB
      idbDeleteThread(id);
      notifyOtherTabs();

      // Cancel any pending debounced patch for this thread
      const timer = debounceTimers.current.get(id);
      if (timer) {
        clearTimeout(timer);
        debounceTimers.current.delete(id);
        pendingPatches.current.delete(id);
      }

      // Immediate server delete
      if (isSignedIn && isPremium) {
        deleteMutateRef.current(id);
      }

      if (activeThreadId === id) {
        setActiveThreadId(null);
      }
    },
    [activeThreadId, isSignedIn, isPremium, notifyOtherTabs]
  );

  const togglePin = useCallback(
    (id: string) => {
      const updated = threadsRef.current.map((thread) =>
        thread.id === id ? { ...thread, isPinned: !thread.isPinned } : thread
      );
      updated.sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
      setThreads(updated);

      const toggledThread = updated.find((t) => t.id === id);
      if (toggledThread) {
        idbPutThread(toggledThread);
        notifyOtherTabs();
        debouncedPatch(id, toggledThread);
      }
    },
    [debouncedPatch, notifyOtherTabs]
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
    idbClearAll();
    notifyOtherTabs();
  }, [notifyOtherTabs]);

  // --- Pagination: loadMore ---

  const loadMore = useCallback(async () => {
    if (!isSignedIn || !isPremium || !cursor || isLoadingMore) return;

    setIsLoadingMore(true);
    try {
      const token = await getToken();
      if (!token) return;

      const data = await fetchThreadList(token, DEFAULT_PAGE_SIZE, cursor);
      const newThreads = data.threads || [];
      setCursor(data.nextCursor);
      setHasMore(!!data.nextCursor);

      if (newThreads.length > 0) {
        // Merge with existing — avoid duplicates
        const existingIds = new Set(threadsRef.current.map((t) => t.id));
        const fresh = newThreads
          .filter((t: any) => !existingIds.has(t.id))
          .map((t: any) => ({ ...t, messages: t.messages || [] }));

        if (fresh.length > 0) {
          const merged = [...threadsRef.current, ...fresh];
          setThreads(merged);
          await idbPutThreads(fresh);
        }
      }
    } catch (error) {
      console.warn("[use-chat-threads] loadMore failed:", error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isSignedIn, isPremium, cursor, isLoadingMore, getToken]);

  // --- Search: delegates to IDB ---

  const searchThreadsFn = useCallback(
    async (query: string): Promise<ChatThread[]> => {
      return idbSearchThreads(query);
    },
    []
  );

  // --- Group threads by date ---

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

    const seen = new Set<string>();
    const dedupedThreads = threads.filter((thread) => {
      if (seen.has(thread.id)) return false;
      seen.add(thread.id);
      return true;
    });

    dedupedThreads.forEach((thread) => {
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

  // Auto-load thread matching articleUrl
  useEffect(() => {
    if (!articleUrl || !isLoaded || activeThreadId) return;
    const match = threads.find((t) => t.articleUrl === articleUrl);
    if (match) {
      setActiveThreadId(match.id);
    }
  }, [articleUrl, isLoaded, activeThreadId, threads]);

  const findThreadByArticleUrl = useCallback(
    (url: string) => threads.find((t) => t.articleUrl === url) || null,
    [threads]
  );

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
    flushToServer,
    findThreadByArticleUrl,
    // New: pagination
    loadMore,
    hasMore,
    isLoadingMore,
    // New: search
    searchThreads: searchThreadsFn,
  };
}
