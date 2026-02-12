/**
 * Chat Threads Routes — Per-thread Redis storage with cursor-based pagination
 *
 * Redis key design:
 *   chat:thread:{userId}:{threadId}  — compressed individual thread (with messages)
 *   chat:threadmeta:{userId}         — Sorted Set (score = updatedAt ms, member = threadId)
 *
 * Legacy key (migrated lazily):
 *   chat:threads:{userId}            — compressed blob of all threads
 */

import { Elysia, t } from "elysia";
import { redis } from "@/lib/redis";
import { compressAsync, decompressAsync } from "@/lib/redis-compression";
import { getAuthInfo } from "../middleware/auth";

// TTL: 30 days
const TTL = 60 * 60 * 24 * 30;
const DEFAULT_PAGE_SIZE = 20;

// Key helpers
function threadKey(userId: string, threadId: string): string {
  return `chat:thread:${userId}:${threadId}`;
}
function metaKey(userId: string): string {
  return `chat:threadmeta:${userId}`;
}
function legacyKey(userId: string): string {
  return `chat:threads:${userId}`;
}

// In-flight migration locks (per-userId) to prevent duplicate work
const migrationInFlight = new Set<string>();

/**
 * Lazy migration from old single-blob format to per-thread keys.
 * Called at the start of every handler. After first run, `exists` returns 0 (~1ms no-op).
 */
async function migrateIfNeeded(userId: string): Promise<void> {
  const oldKey = legacyKey(userId);

  // Quick check — avoids full migration path on every request
  const exists = await redis.exists(oldKey);
  if (!exists) return;

  // Prevent concurrent migration for the same user
  if (migrationInFlight.has(userId)) return;
  migrationInFlight.add(userId);

  try {
    const compressed = await redis.get(oldKey);
    if (!compressed) {
      await redis.del(oldKey);
      return;
    }

    const threads = (await decompressAsync(compressed)) as any[];
    if (!Array.isArray(threads) || threads.length === 0) {
      await redis.del(oldKey);
      return;
    }

    const meta = metaKey(userId);
    const pipe = redis.pipeline();

    for (const thread of threads) {
      if (!thread.id) continue;
      const key = threadKey(userId, thread.id);
      const compressedThread = await compressAsync(thread);
      pipe.set(key, compressedThread, { ex: TTL });
      const score = new Date(thread.updatedAt || thread.createdAt).getTime() || Date.now();
      pipe.zadd(meta, { score, member: thread.id });
    }

    pipe.expire(meta, TTL);
    // Delete old blob only after writing new keys
    pipe.del(oldKey);
    await pipe.exec();
  } catch (error) {
    console.error("[chat-threads] Migration error:", error);
    // Don't delete old key on failure — migration is idempotent
  } finally {
    migrationInFlight.delete(userId);
  }
}

/**
 * Strip messages from a thread — return metadata only for list view.
 */
function toMetadata(thread: any) {
  return {
    id: thread.id,
    title: thread.title,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
    isPinned: thread.isPinned,
    articleUrl: thread.articleUrl,
    articleTitle: thread.articleTitle,
    articleDomain: thread.articleDomain,
    messageCount: Array.isArray(thread.messages) ? thread.messages.length : 0,
  };
}

export const chatThreadsRoutes = new Elysia({ prefix: "/api" })
  /**
   * GET /api/chat-threads?limit=20&cursor=<iso_date>
   * Paginated list of thread metadata (no messages).
   */
  .get(
    "/chat-threads",
    async ({ request, query, set }) => {
      const authInfo = await getAuthInfo(request);
      if (!authInfo.userId || !authInfo.isPremium) {
        set.status = 401;
        return { error: "Unauthorized", threads: [], nextCursor: null };
      }

      const userId = authInfo.userId;
      await migrateIfNeeded(userId);

      const limit = Math.min(Math.max(query.limit ?? DEFAULT_PAGE_SIZE, 1), 50);
      const cursor = query.cursor;

      try {
        const meta = metaKey(userId);

        // Determine score bounds for pagination
        const maxScore = cursor
          ? new Date(cursor).getTime() - 1 // exclusive: skip the cursor item
          : "+inf";

        // Fetch threadIds sorted by updatedAt descending
        const threadIds = (await redis.zrange(meta, maxScore, 0, {
          byScore: true,
          rev: true,
          count: limit,
          offset: 0,
        })) as string[];

        if (!threadIds || threadIds.length === 0) {
          return { threads: [], nextCursor: null };
        }

        // Batch-fetch individual threads via pipeline
        const pipe = redis.pipeline();
        for (const id of threadIds) {
          pipe.get(threadKey(userId, id));
        }
        const results = await pipe.exec();

        const threads: any[] = [];
        for (const result of results) {
          if (!result) continue;
          try {
            const thread = await decompressAsync(result);
            if (thread) threads.push(toMetadata(thread));
          } catch {
            // Skip corrupt entries
          }
        }

        // Determine next cursor
        const nextCursor =
          threads.length === limit && threads.length > 0
            ? threads[threads.length - 1].updatedAt
            : null;

        return { threads, nextCursor };
      } catch (error) {
        console.error("[chat-threads] Error loading:", error);
        return { threads: [], nextCursor: null };
      }
    },
    {
      query: t.Object({
        limit: t.Optional(t.Number()),
        cursor: t.Optional(t.String()),
      }),
    }
  )

  /**
   * GET /api/chat-threads/:threadId — Full thread with messages
   */
  .get(
    "/chat-threads/:threadId",
    async ({ params, request, set }) => {
      const authInfo = await getAuthInfo(request);
      if (!authInfo.userId || !authInfo.isPremium) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const userId = authInfo.userId;
      await migrateIfNeeded(userId);

      try {
        const compressed = await redis.get(threadKey(userId, params.threadId));
        if (!compressed) {
          set.status = 404;
          return { error: "Thread not found" };
        }

        const thread = await decompressAsync(compressed);
        return { thread };
      } catch (error) {
        console.error("[chat-threads] Error loading thread:", error);
        set.status = 500;
        return { error: "Failed to load thread" };
      }
    },
    {
      params: t.Object({
        threadId: t.String(),
      }),
    }
  )

  /**
   * POST /api/chat-threads — Create a new thread
   */
  .post(
    "/chat-threads",
    async ({ body, request, set }) => {
      const authInfo = await getAuthInfo(request);
      if (!authInfo.userId || !authInfo.isPremium) {
        set.status = 401;
        return { error: "Unauthorized", success: false };
      }

      const userId = authInfo.userId;
      const { thread } = body;

      if (!thread?.id) {
        set.status = 400;
        return { error: "Thread must have an id", success: false };
      }

      try {
        const compressed = await compressAsync(thread);
        const score = new Date(thread.updatedAt || thread.createdAt).getTime() || Date.now();
        const meta = metaKey(userId);

        const pipe = redis.pipeline();
        pipe.set(threadKey(userId, thread.id), compressed, { ex: TTL });
        pipe.zadd(meta, { score, member: thread.id });
        pipe.expire(meta, TTL);
        await pipe.exec();

        return { success: true };
      } catch (error) {
        console.error("[chat-threads] Error creating:", error);
        set.status = 500;
        return { error: "Failed to create thread", success: false };
      }
    },
    {
      body: t.Object({
        thread: t.Any(),
      }),
    }
  )

  /**
   * PATCH /api/chat-threads/:threadId — Update a single thread (full replacement)
   */
  .patch(
    "/chat-threads/:threadId",
    async ({ params, body, request, set }) => {
      const authInfo = await getAuthInfo(request);
      if (!authInfo.userId || !authInfo.isPremium) {
        set.status = 401;
        return { error: "Unauthorized", success: false };
      }

      const userId = authInfo.userId;
      const { thread } = body;

      // Ensure the thread id in the body matches the URL param
      if (thread.id && thread.id !== params.threadId) {
        set.status = 400;
        return { error: "Thread ID mismatch", success: false };
      }

      try {
        const compressed = await compressAsync(thread);
        const score = new Date(thread.updatedAt || thread.createdAt).getTime() || Date.now();
        const meta = metaKey(userId);

        const pipe = redis.pipeline();
        pipe.set(threadKey(userId, params.threadId), compressed, { ex: TTL });
        pipe.zadd(meta, { score, member: params.threadId });
        pipe.expire(meta, TTL);
        await pipe.exec();

        return { success: true };
      } catch (error) {
        console.error("[chat-threads] Error updating:", error);
        set.status = 500;
        return { error: "Failed to update thread", success: false };
      }
    },
    {
      params: t.Object({
        threadId: t.String(),
      }),
      body: t.Object({
        thread: t.Any(),
      }),
    }
  )

  /**
   * DELETE /api/chat-threads/:threadId — Delete a single thread
   */
  .delete(
    "/chat-threads/:threadId",
    async ({ params, request, set }) => {
      const authInfo = await getAuthInfo(request);
      if (!authInfo.userId || !authInfo.isPremium) {
        set.status = 401;
        return { error: "Unauthorized", success: false };
      }

      const userId = authInfo.userId;

      try {
        const pipe = redis.pipeline();
        pipe.del(threadKey(userId, params.threadId));
        pipe.zrem(metaKey(userId), params.threadId);
        await pipe.exec();

        return { success: true };
      } catch (error) {
        console.error("[chat-threads] Error deleting:", error);
        set.status = 500;
        return { error: "Failed to delete", success: false };
      }
    },
    {
      params: t.Object({
        threadId: t.String(),
      }),
    }
  );
