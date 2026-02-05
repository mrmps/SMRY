/**
 * Highlights Routes - Persist article highlights for signed-in users
 */

import { Elysia, t } from "elysia";
import { redis } from "@/lib/redis";
import { compressAsync, decompressAsync } from "@/lib/redis-compression";
import { getAuthInfo } from "../middleware/auth";

// Redis key prefix for highlights
const HIGHLIGHTS_PREFIX = "highlights:";
// TTL: 365 days (highlights are more permanent than chat)
const HIGHLIGHTS_TTL = 60 * 60 * 24 * 365;

// Generate highlight key from user ID and article hash
function getHighlightKey(userId: string, articleHash: string): string {
  return `${HIGHLIGHTS_PREFIX}${userId}:${articleHash}`;
}

// Index key for all articles with highlights
function getUserHighlightsIndexKey(userId: string): string {
  return `${HIGHLIGHTS_PREFIX}${userId}:index`;
}

export const highlightsRoutes = new Elysia({ prefix: "/api" })
  /**
   * GET /api/highlights - Get all highlights for export
   */
  .get(
    "/highlights",
    async ({ request, set }) => {
      const authInfo = await getAuthInfo(request);
      if (!authInfo.userId) {
        set.status = 401;
        return [];
      }

      try {
        const indexKey = getUserHighlightsIndexKey(authInfo.userId);
        const articleHashes = await redis.smembers(indexKey);

        if (!articleHashes || articleHashes.length === 0) {
          return [];
        }

        // Fetch all highlights in parallel
        const results = await Promise.all(
          articleHashes.map(async (hash) => {
            const key = getHighlightKey(authInfo.userId!, hash);
            const compressed = await redis.get(key);
            if (!compressed) return null;
            return decompressAsync(compressed);
          })
        );

        return results.filter(Boolean);
      } catch (error) {
        console.error("[highlights] Error fetching all:", error);
        return [];
      }
    }
  )
  /**
   * GET /api/highlights/:articleHash - Load highlights for an article
   */
  .get(
    "/highlights/:articleHash",
    async ({ params, request, set }) => {
      const { articleHash } = params;

      const authInfo = await getAuthInfo(request);
      if (!authInfo.userId) {
        set.status = 401;
        return { error: "Unauthorized", highlights: [] };
      }

      const key = getHighlightKey(authInfo.userId, articleHash);

      try {
        const compressed = await redis.get(key);
        if (!compressed) {
          return { highlights: [] };
        }

        const data = await decompressAsync(compressed);
        return data || { highlights: [] };
      } catch (error) {
        console.error("[highlights] Error loading:", error);
        return { highlights: [] };
      }
    },
    {
      params: t.Object({
        articleHash: t.String(),
      }),
    }
  )
  /**
   * POST /api/highlights/:articleHash - Save highlights for an article
   */
  .post(
    "/highlights/:articleHash",
    async ({ params, body, request, set }) => {
      const { articleHash } = params;
      const { articleUrl, articleTitle, highlights } = body;

      const authInfo = await getAuthInfo(request);
      if (!authInfo.userId) {
        set.status = 401;
        return { error: "Unauthorized", success: false };
      }

      const key = getHighlightKey(authInfo.userId, articleHash);
      const indexKey = getUserHighlightsIndexKey(authInfo.userId);

      try {
        const data = {
          articleUrl,
          articleTitle,
          highlights,
          updatedAt: new Date().toISOString(),
        };

        // Compress and store with TTL
        const compressed = await compressAsync(data);
        await redis.set(key, compressed, { ex: HIGHLIGHTS_TTL });

        // Update index
        if (highlights.length > 0) {
          await redis.sadd(indexKey, articleHash);
        } else {
          await redis.srem(indexKey, articleHash);
        }

        return { success: true };
      } catch (error) {
        console.error("[highlights] Error saving:", error);
        set.status = 500;
        return { error: "Failed to save", success: false };
      }
    },
    {
      params: t.Object({
        articleHash: t.String(),
      }),
      body: t.Object({
        articleUrl: t.String(),
        articleTitle: t.Optional(t.String()),
        highlights: t.Array(t.Any()),
      }),
    }
  )
  /**
   * DELETE /api/highlights/:articleHash - Clear highlights for an article
   */
  .delete(
    "/highlights/:articleHash",
    async ({ params, request, set }) => {
      const { articleHash } = params;

      const authInfo = await getAuthInfo(request);
      if (!authInfo.userId) {
        set.status = 401;
        return { error: "Unauthorized", success: false };
      }

      const key = getHighlightKey(authInfo.userId, articleHash);
      const indexKey = getUserHighlightsIndexKey(authInfo.userId);

      try {
        await redis.del(key);
        await redis.srem(indexKey, articleHash);
        return { success: true };
      } catch (error) {
        console.error("[highlights] Error deleting:", error);
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
