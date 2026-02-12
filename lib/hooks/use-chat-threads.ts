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

function generateId(): string {
  return crypto.randomUUID();
}

// --- Server API helpers ---

interface ThreadListResponse {
  threads: any[];
  nextCursor: string | null;
}

async function fetchFullThread(
  token: string,
  threadId: string
): Promise<ChatThread | null> {
  try {
    const res = await fetch(getApiUrl(`/api/chat-threads/${threadId}`), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.thread ?? null;
  } catch {
    return null;
  }
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
): Promise<void> {
  const res = await fetch(getApiUrl("/api/chat-threads"), {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ thread }),
  });
  if (!res.ok) throw new Error(`Create thread failed: ${res.status}`);
}

async function patchThreadOnServer(
  token: string,
  threadId: string,
  thread: ChatThread
): Promise<void> {
  const res = await fetch(getApiUrl(`/api/chat-threads/${threadId}`), {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ thread }),
  });
  if (!res.ok) throw new Error(`Patch thread failed: ${res.status}`);
}

async function deleteThreadOnServer(
  token: string,
  threadId: string
): Promise<void> {
  const res = await fetch(getApiUrl(`/api/chat-threads/${threadId}`), {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Delete thread failed: ${res.status}`);
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
  const lastServerDataRef = useRef<ThreadListResponse | null>(null);
  const threadsRef = useRef(threads);
  threadsRef.current = threads;
  const activeThreadIdRef = useRef<string | null>(null);
  activeThreadIdRef.current = activeThreadId;

  // Cached auth token for synchronous flush on page unload
  const cachedTokenRef = useRef<string | null>(null);

  // Debounce tracking per thread
  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const pendingPatches = useRef<Set<string>>(new Set());

  // Track recently deleted thread IDs so server sync doesn't re-add them
  const recentlyDeletedRef = useRef<Set<string>>(new Set());

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

  // Keep auth token cached for synchronous beforeunload flush
  useEffect(() => {
    if (!isSignedIn) {
      cachedTokenRef.current = null;
      return;
    }
    let cancelled = false;
    getToken().then((token) => {
      if (!cancelled) cachedTokenRef.current = token;
    });
    return () => { cancelled = true; };
  }, [isSignedIn, getToken]);

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
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
  });

  // Merge server response into IDB + state
  // Guard: React Query structural sharing returns same reference when data is unchanged,
  // so this effect only runs when the server actually returns different data.
  useEffect(() => {
    if (!isSignedIn || !isPremium || !serverFetchComplete || !serverData) return;
    // Same object reference = same data, skip (structural sharing)
    if (lastServerDataRef.current === serverData) return;
    lastServerDataRef.current = serverData;

    let cancelled = false;

    const timer = setTimeout(async () => {
      const serverThreads = serverData.threads || [];
      setCursor(serverData.nextCursor);
      setHasMore(!!serverData.nextCursor);

      // If server is empty and returned all pages, all threads were deleted remotely
      if (serverThreads.length === 0 && !serverData.nextCursor) {
        if (threadsRef.current.length > 0) {
          await idbClearAll();
          if (!cancelled) setThreads([]);
        }
        return;
      }
      if (serverThreads.length === 0) return;

      // Server returned all threads (no more pages) — we can detect remote deletions
      const serverIsComplete = !serverData.nextCursor;
      const serverIdSet = new Set(serverThreads.map((t: any) => t.id));

      // Fast path: compare server with in-memory state to avoid unnecessary IDB I/O
      const inMemory = threadsRef.current;
      const inMemoryMap = new Map(inMemory.map((t) => [t.id, t]));
      let hasChanges = false;
      for (const st of serverThreads) {
        const local = inMemoryMap.get(st.id);
        if (!local || new Date(st.updatedAt).getTime() > new Date(local.updatedAt).getTime()) {
          hasChanges = true;
          break;
        }
      }
      // Check if server has threads we don't have locally
      if (!hasChanges) {
        for (const st of serverThreads) {
          if (!inMemoryMap.has(st.id)) { hasChanges = true; break; }
        }
      }
      // Check if local has threads the server doesn't (possible remote deletion)
      if (!hasChanges && serverIsComplete) {
        for (const local of inMemory) {
          if (!serverIdSet.has(local.id)) { hasChanges = true; break; }
        }
      }
      if (!hasChanges) return; // Nothing new — skip IDB entirely

      if (cancelled) return;

      const localThreads = await idbGetAll();
      if (cancelled) return;
      const localMap = new Map(localThreads.map((t) => [t.id, t]));

      const merged: ChatThread[] = [];
      const needsFetch: string[] = [];

      for (const st of serverThreads) {
        // Skip threads that were just deleted locally (server hasn't confirmed yet)
        if (recentlyDeletedRef.current.has(st.id)) continue;

        const local = localMap.get(st.id);
        if (local) {
          const serverTime = new Date(st.updatedAt).getTime();
          const localTime = new Date(local.updatedAt).getTime();
          if (serverTime > localTime) {
            // Server is newer — merge metadata, keep local messages temporarily, queue full fetch
            merged.push({ ...local, ...st, messages: local.messages });
            needsFetch.push(st.id);
          } else {
            merged.push(local);
          }
          localMap.delete(st.id);
        } else {
          merged.push({ ...st, messages: st.messages || [] });
          needsFetch.push(st.id);
        }
      }

      // Keep local-only threads ONLY if server has more pages (thread might be on a later page).
      // If server returned everything (no nextCursor), local-only threads were deleted remotely — drop them.
      if (!serverIsComplete) {
        for (const [, local] of localMap) {
          merged.push(local);
        }
      } else {
        // Clean up deleted threads from IDB
        for (const [id] of localMap) {
          idbDeleteThread(id);
        }
      }

      merged.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );

      if (cancelled) return;
      await idbPutThreads(merged);
      if (cancelled) return;
      setThreads(merged);

      // Background-fetch full threads for new + stale threads
      if (needsFetch.length > 0) {
        const token = await getToken();
        if (!token || cancelled) return;

        for (let i = 0; i < needsFetch.length; i += 5) {
          if (cancelled) return;
          const batch = needsFetch.slice(i, i + 5);
          const results = await Promise.allSettled(
            batch.map((id) => fetchFullThread(token, id))
          );
          if (cancelled) return;

          const filled: ChatThread[] = [];
          for (const result of results) {
            if (result.status === "fulfilled" && result.value) {
              const full = result.value;
              filled.push({
                ...full,
                messages: (full.messages || []).map((msg: any, idx: number) => {
                  if (msg.parts && Array.isArray(msg.parts)) {
                    return { id: msg.id || `srv-${idx}`, role: msg.role, parts: msg.parts };
                  }
                  return {
                    id: msg.id || `srv-${idx}`,
                    role: msg.role,
                    parts: [{ type: "text" as const, text: msg.content || "" }],
                  };
                }),
              });
            }
          }

          if (filled.length > 0 && !cancelled) {
            await idbPutThreads(filled);
            if (cancelled) return;
            const filledMap = new Map(filled.map((t) => [t.id, t]));
            setThreads((prev) =>
              prev.map((t) => filledMap.get(t.id) ?? t)
            );
          }
        }
      }
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [serverData, serverFetchComplete, isSignedIn, isPremium, getToken]);

  // --- Per-thread PATCH mutation (debounced) ---

  const patchMutation = useMutation({
    mutationFn: async ({ threadId, thread }: { threadId: string; thread: ChatThread }) => {
      const token = await getToken();
      if (!token) throw new Error("No auth token");
      return patchThreadOnServer(token, threadId, thread);
    },
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
  });

  const patchMutateRef = useRef(patchMutation.mutate);
  patchMutateRef.current = patchMutation.mutate;

  const createMutation = useMutation({
    mutationFn: async (thread: ChatThread) => {
      const token = await getToken();
      if (!token) throw new Error("No auth token");
      return createThreadOnServer(token, thread);
    },
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
  });

  const createMutateRef = useRef(createMutation.mutate);
  createMutateRef.current = createMutation.mutate;

  const deleteMutation = useMutation({
    mutationFn: async (threadId: string) => {
      const token = await getToken();
      if (!token) throw new Error("No auth token");
      return deleteThreadOnServer(token, threadId);
    },
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
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

  // Flush all pending patches immediately using keepalive fetch (survives page unload)
  const flushToServer = useCallback(() => {
    if (!isSignedIn || !isPremium) return;

    const token = cachedTokenRef.current;
    if (!token) return;

    for (const [threadId, timer] of debounceTimers.current) {
      clearTimeout(timer);
      debounceTimers.current.delete(threadId);
      pendingPatches.current.delete(threadId);
      const thread = threadsRef.current.find((t) => t.id === threadId);
      if (thread) {
        // Use keepalive: true so the browser keeps the request alive after page destruction
        try {
          fetch(getApiUrl(`/api/chat-threads/${threadId}`), {
            method: "PATCH",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ thread }),
            keepalive: true,
          });
        } catch {
          // Best-effort on page unload
        }
      }
    }
  }, [isSignedIn, isPremium]);

  // Flush pending patches on page hide/close (React Query handles refetch on focus via refetchOnWindowFocus)
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
    (title?: string, metadata?: ChatThreadMetadata, initialMessages?: ThreadMessage[]): ChatThread => {
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
        messages: initialMessages || [],
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

      // Prevent server sync from re-adding this thread before DELETE completes
      recentlyDeletedRef.current.add(id);
      setTimeout(() => recentlyDeletedRef.current.delete(id), 30_000);

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

  // --- Group threads by date (standalone) or by article (article page) ---

  const groupedThreads = useCallback(() => {
    const seen = new Set<string>();
    const dedupedThreads = threads.filter((thread) => {
      if (seen.has(thread.id)) return false;
      seen.add(thread.id);
      return true;
    });

    // Pinned threads always come first
    const pinned = dedupedThreads.filter((t) => t.isPinned);
    const unpinned = dedupedThreads.filter((t) => !t.isPinned);

    // Article page: group by article
    if (articleUrl) {
      const thisArticle: ChatThread[] = [];
      const otherByArticle = new Map<string, ChatThread[]>();

      for (const thread of unpinned) {
        if (thread.articleUrl === articleUrl) {
          thisArticle.push(thread);
        } else {
          const key = thread.articleUrl || "__no_article__";
          const group = otherByArticle.get(key);
          if (group) {
            group.push(thread);
          } else {
            otherByArticle.set(key, [thread]);
          }
        }
      }

      // Sort each group by recency
      thisArticle.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

      const groups: { label: string; threads: ChatThread[] }[] = [];

      if (pinned.length > 0) {
        groups.push({ label: "Pinned", threads: pinned });
      }
      if (thisArticle.length > 0) {
        groups.push({ label: "This Article", threads: thisArticle });
      }

      // Sort other article groups by most recent thread in each group
      const otherGroups = Array.from(otherByArticle.entries())
        .map(([url, groupThreads]) => {
          groupThreads.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
          // Label: use articleTitle from the most recent thread, fall back to articleDomain
          const representative = groupThreads[0];
          const label = representative.articleTitle || representative.articleDomain || "Other";
          return { label, threads: groupThreads, mostRecent: new Date(groupThreads[0].updatedAt).getTime() };
        })
        .sort((a, b) => b.mostRecent - a.mostRecent);

      for (const g of otherGroups) {
        groups.push({ label: g.label, threads: g.threads });
      }

      return groups;
    }

    // Standalone /chat page: date-based grouping
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const lastMonth = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    const groups: { label: string; threads: ChatThread[] }[] = [
      { label: "Pinned", threads: pinned },
      { label: "Today", threads: [] },
      { label: "Yesterday", threads: [] },
      { label: "Last 7 Days", threads: [] },
      { label: "Last 30 Days", threads: [] },
      { label: "Older", threads: [] },
    ];

    unpinned.forEach((thread) => {
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
  }, [threads, articleUrl]);

  // --- Fetch full thread with messages (for cross-device where IDB is empty) ---

  const getThreadWithMessages = useCallback(
    async (threadId: string, forceServer = false): Promise<ChatThread | null> => {
      // Check if we already have messages locally (skip if forceServer)
      const local = threadsRef.current.find((t) => t.id === threadId);
      if (!forceServer && local && local.messages.length > 0) {
        return local;
      }

      // Fetch full thread from server
      if (!isSignedIn || !isPremium) return local ?? null;

      try {
        const token = await getToken();
        if (!token) return local ?? null;

        const full = await fetchFullThread(token, threadId);
        if (!full) return local ?? null;

        // Normalize messages
        const normalized: ChatThread = {
          ...full,
          messages: (full.messages || []).map((msg: any, i: number) => {
            if (msg.parts && Array.isArray(msg.parts)) {
              return { id: msg.id || `srv-${i}`, role: msg.role, parts: msg.parts };
            }
            return {
              id: msg.id || `srv-${i}`,
              role: msg.role,
              parts: [{ type: "text" as const, text: msg.content || "" }],
            };
          }),
        };

        // Update IDB and state with the full thread
        await idbPutThread(normalized);
        setThreads((prev) =>
          prev.map((t) => (t.id === threadId ? normalized : t))
        );

        return normalized;
      } catch (error) {
        console.warn("[use-chat-threads] getThreadWithMessages failed:", error);
        return local ?? null;
      }
    },
    [isSignedIn, isPremium, getToken]
  );

  const getThreadWithMessagesRef = useRef(getThreadWithMessages);
  getThreadWithMessagesRef.current = getThreadWithMessages;

  // Refresh active thread on visibility change (cross-device sync)
  useEffect(() => {
    if (!isSignedIn || !isPremium) return;

    const handleActiveThreadRefresh = () => {
      if (document.visibilityState === "visible") {
        const activeId = activeThreadIdRef.current;
        if (activeId) {
          getThreadWithMessagesRef.current(activeId, true);
        }
      }
    };

    document.addEventListener("visibilitychange", handleActiveThreadRefresh);
    return () => {
      document.removeEventListener("visibilitychange", handleActiveThreadRefresh);
    };
  }, [isSignedIn, isPremium]);

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
    // New: fetch full thread with messages (cross-device)
    getThreadWithMessages,
  };
}
