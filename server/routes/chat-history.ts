/**
 * Chat History Routes - Persist chat messages for signed-in users
 */

import { Elysia, t } from "elysia";
import { redis } from "@/lib/redis";
import { compressAsync, decompressAsync } from "@/lib/redis-compression";
import { getAuthInfo } from "../middleware/auth";

// Redis key prefix for chat history
const CHAT_HISTORY_PREFIX = "chat:history:";
// TTL: 30 days
const CHAT_HISTORY_TTL = 60 * 60 * 24 * 30;

// Generate chat key from user ID and article hash
function getChatKey(userId: string, articleHash: string): string {
  return `${CHAT_HISTORY_PREFIX}${userId}:${articleHash}`;
}

export const chatHistoryRoutes = new Elysia({ prefix: "/api" })
  /**
   * GET /api/chat-history/:articleHash - Load chat history
   */
  .get(
    "/chat-history/:articleHash",
    async ({ params, request, set }) => {
      const { articleHash } = params;

      // Verify authentication
      const authInfo = await getAuthInfo(request);
      if (!authInfo.userId) {
        set.status = 401;
        return { error: "Unauthorized", messages: [] };
      }

      const key = getChatKey(authInfo.userId, articleHash);

      try {
        const compressed = await redis.get(key);
        if (!compressed) {
          return { messages: [] };
        }

        const messages = await decompressAsync(compressed);
        return { messages: messages || [] };
      } catch (error) {
        console.error("[chat-history] Error loading:", error);
        return { messages: [] };
      }
    },
    {
      params: t.Object({
        articleHash: t.String(),
      }),
    }
  )
  /**
   * POST /api/chat-history/:articleHash - Save chat history
   */
  .post(
    "/chat-history/:articleHash",
    async ({ params, body, request, set }) => {
      const { articleHash } = params;
      const { messages } = body;

      // Verify authentication
      const authInfo = await getAuthInfo(request);
      if (!authInfo.userId) {
        set.status = 401;
        return { error: "Unauthorized", success: false };
      }

      const key = getChatKey(authInfo.userId, articleHash);

      try {
        // Compress and store with TTL
        const compressed = await compressAsync(messages);
        await redis.set(key, compressed, { ex: CHAT_HISTORY_TTL });
        return { success: true };
      } catch (error) {
        console.error("[chat-history] Error saving:", error);
        set.status = 500;
        return { error: "Failed to save", success: false };
      }
    },
    {
      params: t.Object({
        articleHash: t.String(),
      }),
      body: t.Object({
        messages: t.Array(t.Any()),
      }),
    }
  )
  /**
   * DELETE /api/chat-history/:articleHash - Clear chat history
   */
  .delete(
    "/chat-history/:articleHash",
    async ({ params, request, set }) => {
      const { articleHash } = params;

      // Verify authentication
      const authInfo = await getAuthInfo(request);
      if (!authInfo.userId) {
        set.status = 401;
        return { error: "Unauthorized", success: false };
      }

      const key = getChatKey(authInfo.userId, articleHash);

      try {
        await redis.del(key);
        return { success: true };
      } catch (error) {
        console.error("[chat-history] Error deleting:", error);
        set.status = 500;
        return { error: "Failed to delete", success: false };
      }
    },
    {
      params: t.Object({
        articleHash: t.String(),
      }),
    }
  );
