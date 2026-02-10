/**
 * Chat Threads Routes - Persist chat thread list for premium users
 */

import { Elysia, t } from "elysia";
import { redis } from "@/lib/redis";
import { compressAsync, decompressAsync } from "@/lib/redis-compression";
import { getAuthInfo } from "../middleware/auth";

// Redis key prefix for chat threads
const CHAT_THREADS_PREFIX = "chat:threads:";
// TTL: 30 days
const CHAT_THREADS_TTL = 60 * 60 * 24 * 30;

function getThreadsKey(userId: string): string {
  return `${CHAT_THREADS_PREFIX}${userId}`;
}

export const chatThreadsRoutes = new Elysia({ prefix: "/api" })
  /**
   * GET /api/chat-threads - Load all threads for the user
   */
  .get(
    "/chat-threads",
    async ({ request, set }) => {
      const authInfo = await getAuthInfo(request);
      if (!authInfo.userId || !authInfo.isPremium) {
        set.status = 401;
        return { error: "Unauthorized", threads: [] };
      }

      const key = getThreadsKey(authInfo.userId);

      try {
        const compressed = await redis.get(key);
        if (!compressed) {
          return { threads: [] };
        }

        const threads = await decompressAsync(compressed);
        return { threads: threads || [] };
      } catch (error) {
        console.error("[chat-threads] Error loading:", error);
        return { threads: [] };
      }
    }
  )
  /**
   * POST /api/chat-threads - Save all threads for the user
   */
  .post(
    "/chat-threads",
    async ({ body, request, set }) => {
      const { threads } = body;

      const authInfo = await getAuthInfo(request);
      if (!authInfo.userId || !authInfo.isPremium) {
        set.status = 401;
        return { error: "Unauthorized", success: false };
      }

      const key = getThreadsKey(authInfo.userId);

      try {
        const compressed = await compressAsync(threads);
        await redis.set(key, compressed, { ex: CHAT_THREADS_TTL });
        return { success: true };
      } catch (error) {
        console.error("[chat-threads] Error saving:", error);
        set.status = 500;
        return { error: "Failed to save", success: false };
      }
    },
    {
      body: t.Object({
        threads: t.Array(t.Any()),
      }),
    }
  )
  /**
   * DELETE /api/chat-threads/:threadId - Remove a single thread
   */
  .delete(
    "/chat-threads/:threadId",
    async ({ params, request, set }) => {
      const { threadId } = params;

      const authInfo = await getAuthInfo(request);
      if (!authInfo.userId || !authInfo.isPremium) {
        set.status = 401;
        return { error: "Unauthorized", success: false };
      }

      const key = getThreadsKey(authInfo.userId);

      try {
        const compressed = await redis.get(key);
        if (!compressed) {
          return { success: true };
        }

        const threads = (await decompressAsync(compressed)) as Array<{ id: string }>;
        const filtered = (threads || []).filter((t) => t.id !== threadId);
        const recompressed = await compressAsync(filtered);
        await redis.set(key, recompressed, { ex: CHAT_THREADS_TTL });
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
