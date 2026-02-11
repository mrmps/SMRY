"use client";

import { openDB, type IDBPDatabase } from "idb";
import type { ChatThread } from "@/lib/hooks/use-chat-threads";

const DB_NAME = "smry-chat";
const DB_VERSION = 1;
const STORE_NAME = "threads";
const LS_KEY = "smry-chat-threads";

type ThreadDB = IDBPDatabase;

let dbPromise: Promise<ThreadDB> | null = null;

/**
 * Open (or create) the IndexedDB database. Reuses a singleton promise.
 */
export function openThreadDB(): Promise<ThreadDB> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
          store.createIndex("articleUrl", "articleUrl", { unique: false });
          store.createIndex("updatedAt", "updatedAt", { unique: false });
        }
      },
      blocked() {
        console.warn("[thread-db] Database blocked by older version");
      },
      blocking() {
        // Close and reopen to unblock
        dbPromise = null;
      },
    });
  }
  return dbPromise;
}

/**
 * Get all threads sorted by updatedAt DESC.
 */
export async function getAllThreads(): Promise<ChatThread[]> {
  try {
    const db = await openThreadDB();
    const all = await db.getAll(STORE_NAME);
    // Sort by updatedAt descending
    all.sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
    return all as ChatThread[];
  } catch (e) {
    console.warn("[thread-db] getAllThreads failed:", e);
    return [];
  }
}

/**
 * Get a single thread by ID.
 */
export async function getThread(
  id: string
): Promise<ChatThread | undefined> {
  try {
    const db = await openThreadDB();
    return (await db.get(STORE_NAME, id)) as ChatThread | undefined;
  } catch (e) {
    console.warn("[thread-db] getThread failed:", e);
    return undefined;
  }
}

/**
 * Upsert a single thread.
 */
export async function putThread(thread: ChatThread): Promise<void> {
  try {
    const db = await openThreadDB();
    await db.put(STORE_NAME, thread);
  } catch (e) {
    console.warn("[thread-db] putThread failed:", e);
  }
}

/**
 * Bulk upsert threads in a single transaction.
 */
export async function putThreads(threads: ChatThread[]): Promise<void> {
  try {
    const db = await openThreadDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    for (const thread of threads) {
      tx.store.put(thread);
    }
    await tx.done;
  } catch (e) {
    console.warn("[thread-db] putThreads failed:", e);
  }
}

/**
 * Delete a single thread by ID.
 */
export async function deleteThread(id: string): Promise<void> {
  try {
    const db = await openThreadDB();
    await db.delete(STORE_NAME, id);
  } catch (e) {
    console.warn("[thread-db] deleteThread failed:", e);
  }
}

/**
 * Wipe the entire threads store.
 */
export async function clearAllThreads(): Promise<void> {
  try {
    const db = await openThreadDB();
    await db.clear(STORE_NAME);
  } catch (e) {
    console.warn("[thread-db] clearAllThreads failed:", e);
  }
}

/**
 * Full-text search across thread title, articleTitle, articleDomain, and message text.
 * Case-insensitive. O(n) scan via IDB cursor — fast for <1000 threads.
 */
export async function searchThreads(
  query: string
): Promise<ChatThread[]> {
  if (!query.trim()) return [];

  const lower = query.toLowerCase();

  try {
    const db = await openThreadDB();
    const all = await db.getAll(STORE_NAME);
    const results: ChatThread[] = [];

    for (const thread of all as ChatThread[]) {
      // Check metadata fields
      if (
        thread.title?.toLowerCase().includes(lower) ||
        thread.articleTitle?.toLowerCase().includes(lower) ||
        thread.articleDomain?.toLowerCase().includes(lower)
      ) {
        results.push(thread);
        continue;
      }

      // Check message text
      let matched = false;
      for (const msg of thread.messages) {
        for (const part of msg.parts) {
          if (part.type === "text" && part.text.toLowerCase().includes(lower)) {
            matched = true;
            break;
          }
        }
        if (matched) break;
      }
      if (matched) {
        results.push(thread);
      }
    }

    // Sort by updatedAt DESC
    results.sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    return results;
  } catch (e) {
    console.warn("[thread-db] searchThreads failed:", e);
    return [];
  }
}

/**
 * Normalize old {role, content} message format to {role, parts} format.
 * Exported for use in migration.
 */
export function normalizeThreadMessages(
  messages: any[]
): ChatThread["messages"] {
  return messages.map((msg, i) => {
    if (msg.parts && Array.isArray(msg.parts)) {
      return { id: msg.id || `legacy-${i}`, role: msg.role, parts: msg.parts };
    }
    return {
      id: msg.id || `legacy-${i}`,
      role: msg.role,
      parts: [{ type: "text" as const, text: msg.content || "" }],
    };
  });
}

/**
 * One-time migration from localStorage to IndexedDB.
 * Reads `smry-chat-threads`, normalizes messages, writes to IDB, removes localStorage key.
 * Idempotent — returns true if migration happened, false if nothing to migrate.
 */
export async function migrateFromLocalStorage(): Promise<boolean> {
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return false;

    const parsed = JSON.parse(raw) as any[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      window.localStorage.removeItem(LS_KEY);
      return false;
    }

    // Deduplicate by ID
    const seen = new Set<string>();
    const deduped = parsed.filter((t) => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });

    // Normalize messages
    const normalized: ChatThread[] = deduped.map((t) => ({
      ...t,
      messages: normalizeThreadMessages(t.messages || []),
    }));

    await putThreads(normalized);
    window.localStorage.removeItem(LS_KEY);
    return true;
  } catch (e) {
    console.warn("[thread-db] migrateFromLocalStorage failed:", e);
    return false;
  }
}
