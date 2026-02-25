/**
 * TTS Routes - POST /api/tts, GET /api/tts/voices
 *
 * /api/tts - Generates speech audio via ElevenLabs TTS API.
 *            Returns JSON: { audioBase64, alignment, durationMs }
 *            All chunks generated in parallel, merged server-side.
 * /api/tts/voices - Returns available voice list.
 *
 * Scalability design (30K DAU, 100+ concurrent):
 * - Server-side per-chunk LRU cache: SHA-256(text+voice) → audio + alignment
 *   Cache hit = instant, no ElevenLabs call, no concurrency slot
 * - Parallel chunk generation via Promise.all (uncached chunks only)
 * - Bounded concurrency: max 20 global connections, max 2 per user
 * - Memory tracking: all operations instrumented via memory-tracker
 * - Client disconnect cleanup: AbortSignal propagated to ElevenLabs request
 * - Rate limiting: per-IP via in-memory sliding window + daily Redis quota
 * - Audio size cap: max 50KB text (~30 min audio, ~50MB buffer)
 * - Graceful error handling with explicit cleanup
 *
 * Free users: 3 articles/day. Premium users: unlimited.
 */

import { Elysia, t } from "elysia";
import {
  initElevenLabsTTS,
  generateSpeechForChunk,
  DEFAULT_VOICE_ID,
  VOICE_PRESETS,
  isVoiceAllowed,
  type ChunkAlignment,
} from "../../lib/elevenlabs-tts";
import { TTSRedisCache } from "../../lib/tts-redis-cache";
import { getAuthInfo } from "../middleware/auth";
import { createLogger } from "../../lib/logger";
import { startMemoryTrack } from "../../lib/memory-tracker";
import {
  acquireTTSSlot,
  releaseTTSSlot,
  TTSSlotTimeoutError,
  TTSUserLimitError,
} from "../../lib/tts-concurrency";
import { Redis } from "@upstash/redis";
import { env } from "../env";
import {
  cleanTextForTTS,
  splitTTSChunks,
  computeChunkKeySync,
} from "../../lib/tts-chunk";

const isDev = env.NODE_ENV === "development";

const logger = createLogger("api:tts");

// ─── Server-side per-chunk LRU cache for TTS ───
// Key: SHA-256(chunkText + voice). Value: audio buffer + alignment.
// Per-chunk caching: each ~5000-char chunk is independently cached.
// Cache hit = instant replay per chunk, no ElevenLabs call.
// 300 MB cap, 1 hour TTL, Map-based LRU (insertion order = access order).

interface ChunkCacheEntry {
  audio: Buffer;
  alignment: ChunkAlignment | null;
  durationMs: number;
  size: number;
  createdAt: number;
}

const TTS_CACHE_MAX_BYTES = 300 * 1024 * 1024; // 300 MB
const TTS_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

class ChunkLRUCache {
  private cache = new Map<string, ChunkCacheEntry>();
  private totalSize = 0;

  get(key: string): ChunkCacheEntry | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.createdAt > TTS_CACHE_TTL_MS) {
      this.delete(key);
      return null;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry;
  }

  set(key: string, entry: ChunkCacheEntry): void {
    if (this.cache.has(key)) {
      this.delete(key);
    }

    while (this.totalSize + entry.size > TTS_CACHE_MAX_BYTES && this.cache.size > 0) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.delete(oldestKey);
    }

    this.cache.set(key, entry);
    this.totalSize += entry.size;
  }

  delete(key: string): void {
    const entry = this.cache.get(key);
    if (entry) {
      this.totalSize -= entry.size;
      this.cache.delete(key);
    }
  }

  get stats() {
    return {
      entries: this.cache.size,
      totalSizeMB: Math.round(this.totalSize / 1024 / 1024 * 10) / 10,
      maxSizeMB: Math.round(TTS_CACHE_MAX_BYTES / 1024 / 1024),
    };
  }
}

const chunkCache = new ChunkLRUCache();

// ─── Article-level combined result cache ───
// Key: SHA-256(fullCleanedText + voice). Stores final merged audio + alignment.
// Eliminates chunking, per-chunk lookups, and buffer merging for exact replays.
// 200 MB cap, 2 hour TTL. Separate from chunk cache.

interface ArticleCacheEntry {
  audioBuffer: Buffer;
  alignment: MergedAlignment;
  durationMs: number;
  size: number;
  createdAt: number;
}

const ARTICLE_CACHE_MAX_BYTES = 200 * 1024 * 1024; // 200 MB
const ARTICLE_CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

class ArticleLRUCache {
  private cache = new Map<string, ArticleCacheEntry>();
  private totalSize = 0;

  get(key: string): ArticleCacheEntry | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.createdAt > ARTICLE_CACHE_TTL_MS) {
      this.delete(key);
      return null;
    }
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry;
  }

  set(key: string, entry: ArticleCacheEntry): void {
    if (this.cache.has(key)) this.delete(key);
    while (this.totalSize + entry.size > ARTICLE_CACHE_MAX_BYTES && this.cache.size > 0) {
      const oldest = this.cache.keys().next().value;
      if (oldest) this.delete(oldest);
    }
    this.cache.set(key, entry);
    this.totalSize += entry.size;
  }

  delete(key: string): void {
    const entry = this.cache.get(key);
    if (entry) {
      this.totalSize -= entry.size;
      this.cache.delete(key);
    }
  }

  get stats() {
    return {
      entries: this.cache.size,
      totalSizeMB: Math.round(this.totalSize / 1024 / 1024 * 10) / 10,
      maxSizeMB: Math.round(ARTICLE_CACHE_MAX_BYTES / 1024 / 1024),
    };
  }
}

const articleCache = new ArticleLRUCache();

// Initialize ElevenLabs TTS with validated env vars (optional — TTS disabled when absent)
if (env.ELEVENLABS_API_KEY) {
  initElevenLabsTTS(env.ELEVENLABS_API_KEY);
} else {
  logger.warn("ElevenLabs API key not set — TTS routes will return 503");
}

// Free user daily limit
const FREE_TTS_LIMIT = 3;

// Rate limiter: per-IP sliding window
const ipRateLimiter = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 10; // 10 TTS requests per minute per IP
const IP_RATE_LIMITER_MAX_SIZE = 10_000;

// Periodic cleanup of IP rate limiter
const rateLimiterCleanup = setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of ipRateLimiter.entries()) {
    if (entry.resetAt <= now) ipRateLimiter.delete(ip);
  }
}, 30_000);
rateLimiterCleanup.unref();

// Redis for server-side usage tracking (optional — gracefully degrades)
let redis: Redis | null = null;
try {
  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    redis = new Redis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
} catch {
  logger.warn("Redis not available for TTS usage tracking");
}

// Redis-backed TTS chunk cache (L3 — survives restarts)
let ttsRedisCache: TTSRedisCache | null = null;
if (redis) {
  ttsRedisCache = new TTSRedisCache(redis);
}

// In-memory fallback for daily limits when Redis is down
const memoryUsageCache = new Map<string, { count: number; day: string }>();
const MEMORY_CACHE_MAX = 5000;

function getDayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function extractClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function checkIpRateLimit(ip: string): boolean {
  if (isDev) return true;

  const now = Date.now();
  const entry = ipRateLimiter.get(ip);

  if (!entry || entry.resetAt <= now) {
    if (ipRateLimiter.size >= IP_RATE_LIMITER_MAX_SIZE) {
      const oldest = ipRateLimiter.entries().next().value;
      if (oldest) ipRateLimiter.delete(oldest[0]);
    }
    ipRateLimiter.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) return false;

  entry.count++;
  return true;
}

/**
 * Check TTS usage for a user (read-only — does NOT increment).
 * Free users: 3 plays per day. Premium: unlimited.
 * Uses Redis with in-memory fallback when Redis is down.
 * Call `incrementTtsUsage()` only after successful generation.
 */
async function checkTtsUsage(
  userId: string | null,
  isPremium: boolean,
): Promise<{ allowed: boolean; count: number; limit: number }> {
  if (isDev) return { allowed: true, count: 0, limit: Infinity };
  if (isPremium) return { allowed: true, count: 0, limit: Infinity };
  if (!userId) return { allowed: false, count: 0, limit: FREE_TTS_LIMIT };

  const dayKey = getDayKey();

  if (redis) {
    const redisKey = `tts-usage:${userId}:${dayKey}`;
    try {
      const current = (await redis.get<number>(redisKey)) || 0;
      if (current >= FREE_TTS_LIMIT) {
        return { allowed: false, count: current, limit: FREE_TTS_LIMIT };
      }
      return { allowed: true, count: current, limit: FREE_TTS_LIMIT };
    } catch (error) {
      logger.warn({ error, userId }, "Redis TTS usage check failed, falling back to memory");
    }
  }

  const memKey = `${userId}:${dayKey}`;
  const memEntry = memoryUsageCache.get(memKey);
  if (memEntry && memEntry.day === dayKey) {
    if (memEntry.count >= FREE_TTS_LIMIT) {
      return { allowed: false, count: memEntry.count, limit: FREE_TTS_LIMIT };
    }
    return { allowed: true, count: memEntry.count, limit: FREE_TTS_LIMIT };
  }

  return { allowed: true, count: 0, limit: FREE_TTS_LIMIT };
}

/**
 * Increment TTS usage counter after successful generation.
 * Called ONLY after audio is generated/replayed — never on failure.
 */
async function incrementTtsUsage(
  userId: string | null,
  isPremium: boolean,
): Promise<void> {
  if (isDev || isPremium || !userId) return;

  const dayKey = getDayKey();

  if (redis) {
    const redisKey = `tts-usage:${userId}:${dayKey}`;
    try {
      await redis.incr(redisKey);
      await redis.expire(redisKey, 90000); // 25 hours
      return;
    } catch (error) {
      logger.warn({ error, userId }, "Redis TTS usage increment failed, falling back to memory");
    }
  }

  const memKey = `${userId}:${dayKey}`;
  const memEntry = memoryUsageCache.get(memKey);
  if (memEntry && memEntry.day === dayKey) {
    memEntry.count++;
  } else {
    if (memoryUsageCache.size >= MEMORY_CACHE_MAX) {
      const first = memoryUsageCache.keys().next().value;
      if (first) memoryUsageCache.delete(first);
    }
    memoryUsageCache.set(memKey, { count: 1, day: dayKey });
  }
}

// ─── Alignment merging ───

interface MergedAlignment {
  characters: string[];
  characterStartTimesSeconds: number[];
  characterEndTimesSeconds: number[];
}

/**
 * Merge per-chunk character alignments into a single alignment.
 * Adjusts time offsets so each chunk's times are relative to global audio start.
 * Inserts a space character between chunks to separate words at chunk boundaries.
 */
function mergeChunkAlignments(
  chunkAlignments: (ChunkAlignment | null)[],
  chunkDurationsMs: number[],
): MergedAlignment {
  const merged: MergedAlignment = {
    characters: [],
    characterStartTimesSeconds: [],
    characterEndTimesSeconds: [],
  };

  let cumulativeTimeS = 0;

  for (let i = 0; i < chunkAlignments.length; i++) {
    const alignment = chunkAlignments[i];
    const durationMs = chunkDurationsMs[i] || 0;

    if (alignment && alignment.characters.length > 0) {
      // Space separator between chunks (not before first)
      if (i > 0 && merged.characters.length > 0) {
        const lastEnd = merged.characterEndTimesSeconds[merged.characterEndTimesSeconds.length - 1] || cumulativeTimeS;
        merged.characters.push(" ");
        merged.characterStartTimesSeconds.push(lastEnd);
        merged.characterEndTimesSeconds.push(Math.max(lastEnd, cumulativeTimeS));
      }

      for (let j = 0; j < alignment.characters.length; j++) {
        merged.characters.push(alignment.characters[j]);
        merged.characterStartTimesSeconds.push(
          (alignment.characterStartTimesSeconds[j] || 0) + cumulativeTimeS
        );
        merged.characterEndTimesSeconds.push(
          (alignment.characterEndTimesSeconds[j] || 0) + cumulativeTimeS
        );
      }
    }

    cumulativeTimeS += durationMs / 1000;
  }

  return merged;
}

// ElevenLabs concurrent request limit varies by plan.
// Use 3 to leave headroom and avoid 429s from race conditions.
const ELEVENLABS_MAX_CONCURRENT = 3;

// Cross-chunk context for prosody continuity (chars from adjacent chunks)
const CONTEXT_CHARS = 250;

/**
 * Run async tasks with bounded concurrency.
 * Preserves result order (results[i] corresponds to tasks[i]).
 */
async function pooled<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number,
): Promise<T[]> {
  const results = new Array<T>(tasks.length);
  let nextIdx = 0;

  async function worker() {
    while (nextIdx < tasks.length) {
      const idx = nextIdx++;
      results[idx] = await tasks[idx]();
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, tasks.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}

interface ChunkGenResult {
  audio: Buffer;
  alignment: ChunkAlignment | null;
  durationMs: number;
  fromCache: boolean;
}

/**
 * Generate chunks with bounded concurrency and return combined audio + alignment.
 * Each chunk is checked against server-side LRU cache first (cache hits are free).
 * Uncached chunks are generated via ElevenLabs with max 3 concurrent API calls.
 * Cross-chunk context (previousText/nextText) is passed for prosody continuity.
 */
async function generateCombined(
  chunks: string[],
  chunkKeys: string[],
  voice: string,
  signal?: AbortSignal,
): Promise<{
  audioBuffer: Buffer;
  alignment: MergedAlignment;
  durationMs: number;
}> {
  // Separate cached from uncached — cached are free, only uncached need rate limiting
  const results = new Array<ChunkGenResult>(chunks.length);
  const uncachedIndices: number[] = [];

  // L2: Check in-memory chunk cache
  for (let i = 0; i < chunks.length; i++) {
    const cached = chunkCache.get(chunkKeys[i]);
    if (cached) {
      results[i] = {
        audio: cached.audio,
        alignment: cached.alignment,
        durationMs: cached.durationMs,
        fromCache: true,
      };
    } else {
      uncachedIndices.push(i);
    }
  }

  // L3: Check Redis cache for remaining misses
  if (uncachedIndices.length > 0 && ttsRedisCache) {
    const redisKeys = uncachedIndices.map((i) => chunkKeys[i]);
    const redisResults = await ttsRedisCache.getBatch(redisKeys);
    const stillUncached: number[] = [];

    for (let j = 0; j < uncachedIndices.length; j++) {
      const redisHit = redisResults[j];
      if (redisHit) {
        const idx = uncachedIndices[j];
        results[idx] = {
          audio: redisHit.audio,
          alignment: redisHit.alignment,
          durationMs: redisHit.durationMs,
          fromCache: true,
        };
        // Promote to in-memory cache (write-through)
        chunkCache.set(chunkKeys[idx], {
          audio: redisHit.audio,
          alignment: redisHit.alignment,
          durationMs: redisHit.durationMs,
          size: redisHit.audio.length,
          createdAt: Date.now(),
        });
      } else {
        stillUncached.push(uncachedIndices[j]);
      }
    }

    // Replace uncachedIndices with what Redis didn't have
    uncachedIndices.length = 0;
    uncachedIndices.push(...stillUncached);
  }

  // L4: Generate uncached chunks via ElevenLabs with bounded concurrency
  if (uncachedIndices.length > 0) {
    const tasks = uncachedIndices.map((i) => async () => {
      if (signal?.aborted) throw new Error("Aborted");

      // Pass surrounding text for prosody continuity at chunk boundaries
      const context = {
        previousText: i > 0 ? chunks[i - 1].slice(-CONTEXT_CHARS) : undefined,
        nextText: i < chunks.length - 1 ? chunks[i + 1].slice(0, CONTEXT_CHARS) : undefined,
      };

      const result = await generateSpeechForChunk(chunks[i], voice, signal, context);

      // Cache immediately to L2 (in-memory)
      if (result.audioBuffer.length > 0) {
        chunkCache.set(chunkKeys[i], {
          audio: result.audioBuffer,
          alignment: result.alignment,
          durationMs: result.durationMs,
          size: result.audioBuffer.length,
          createdAt: Date.now(),
        });

        // Write-through to L3 (Redis) — fire-and-forget
        if (ttsRedisCache) {
          ttsRedisCache.set(chunkKeys[i], result.audioBuffer, result.alignment, result.durationMs).catch(() => {});
        }
      }

      return {
        audio: result.audioBuffer,
        alignment: result.alignment,
        durationMs: result.durationMs,
        fromCache: false,
      } satisfies ChunkGenResult;
    });

    const generated = await pooled(tasks, ELEVENLABS_MAX_CONCURRENT);
    for (let j = 0; j < uncachedIndices.length; j++) {
      results[uncachedIndices[j]] = generated[j];
    }
  }

  // Concatenate audio buffers
  const totalSize = results.reduce((sum, r) => sum + r.audio.length, 0);
  const combined = Buffer.alloc(totalSize);
  let offset = 0;
  for (const r of results) {
    r.audio.copy(combined, offset);
    offset += r.audio.length;
  }

  // Merge alignments with cumulative time offsets
  const mergedAlignment = mergeChunkAlignments(
    results.map((r) => r.alignment),
    results.map((r) => r.durationMs),
  );

  const totalDurationMs = results.reduce((sum, r) => sum + r.durationMs, 0);
  const cacheHits = results.filter((r) => r.fromCache).length;

  logger.debug(
    { chunksTotal: chunks.length, cacheHits, uncached: uncachedIndices.length, totalSizeMB: Math.round(totalSize / 1024 / 1024 * 10) / 10 },
    "TTS combined generation completed",
  );

  return {
    audioBuffer: combined,
    alignment: mergedAlignment,
    durationMs: totalDurationMs,
  };
}

export const ttsRoutes = new Elysia()
  .post(
    "/api/tts",
    async ({ body, request, set }) => {
      const { text, voice, articleUrl } = body;
      const clientIp = extractClientIp(request);

      // --- Validation ---
      if (!text || text.trim().length === 0) {
        set.status = 400;
        return { error: "Text is required" };
      }
      if (text.length > 50000) {
        set.status = 400;
        return { error: "Text too long. Maximum 50,000 characters." };
      }

      // --- IP rate limiting ---
      if (!checkIpRateLimit(clientIp)) {
        set.status = 429;
        return { error: "Too many TTS requests. Try again in a minute." };
      }

      // --- Auth ---
      const auth = await getAuthInfo(request);

      // --- Voice tier gating ---
      const voiceId = voice || DEFAULT_VOICE_ID;
      if (!isVoiceAllowed(voiceId, auth.isPremium)) {
        set.status = 403;
        return { error: "Premium voice requires an active subscription", upgrade: true };
      }

      // --- Daily usage limit ---
      const usage = await checkTtsUsage(auth.userId, auth.isPremium);
      if (!usage.allowed) {
        set.status = 429;
        return {
          error: "Daily TTS limit reached",
          count: usage.count,
          limit: usage.limit,
          isPremium: auth.isPremium,
        };
      }

      // --- Clean text for TTS (strip ads, navigation junk) ---
      const cleanedText = cleanTextForTTS(text);
      if (cleanedText.length === 0) {
        set.status = 400;
        return { error: "No readable text after cleaning" };
      }

      // --- Article-level cache: instant replay, zero processing ---
      const articleKey = computeChunkKeySync(cleanedText, voiceId);
      const cachedArticle = articleCache.get(articleKey);
      if (cachedArticle) {
        logger.info(
          { userId: auth.userId, textLength: cleanedText.length, voice: voiceId },
          "TTS article cache hit — instant replay",
        );
        incrementTtsUsage(auth.userId, auth.isPremium).catch(() => {});
        return new Response(
          JSON.stringify({
            audioBase64: cachedArticle.audioBuffer.toString("base64"),
            alignment: cachedArticle.alignment,
            durationMs: cachedArticle.durationMs,
          }),
          {
            headers: {
              "Content-Type": "application/json",
              "X-TTS-Usage-Count": String(usage.count + 1),
              "X-TTS-Usage-Limit": String(usage.limit),
              "X-TTS-Cache": "article-hit",
            },
          },
        );
      }

      // --- Split into chunks + compute per-chunk keys ---
      const chunks = splitTTSChunks(cleanedText);
      const chunkKeys = chunks.map((c) => computeChunkKeySync(c, voiceId));

      // --- Check if all chunks are cached (L2 memory + L3 Redis → skip concurrency slot) ---
      let allCached = chunkKeys.every((key) => chunkCache.get(key) !== null);
      if (!allCached && ttsRedisCache) {
        // Check Redis for chunks missing from memory
        const missingKeys = chunkKeys.filter((key) => chunkCache.get(key) === null);
        const redisResults = await ttsRedisCache.getBatch(missingKeys);
        const allRedisHit = redisResults.every((r) => r !== null);
        if (allRedisHit) {
          // Promote all Redis hits to memory so generateCombined finds them
          let mk = 0;
          for (let i = 0; i < chunkKeys.length; i++) {
            if (chunkCache.get(chunkKeys[i]) === null) {
              const hit = redisResults[mk++]!;
              chunkCache.set(chunkKeys[i], {
                audio: hit.audio,
                alignment: hit.alignment,
                durationMs: hit.durationMs,
                size: hit.audio.length,
                createdAt: Date.now(),
              });
            }
          }
          allCached = true;
        }
      }

      const tracker = startMemoryTrack("tts-synthesis", {
        userId: auth.userId,
        textLength: cleanedText.length,
        voice: voiceId,
        clientIp,
        chunksTotal: chunks.length,
        allCached,
      });

      // Log memory snapshot before synthesis
      const memBefore = process.memoryUsage();
      logger.info({
        rss: Math.round(memBefore.rss / 1024 / 1024),
        heapUsed: Math.round(memBefore.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memBefore.heapTotal / 1024 / 1024),
        chunkCacheStats: chunkCache.stats,
        articleCacheStats: articleCache.stats,
        redisCacheStats: ttsRedisCache?.stats,
      }, "TTS pre-synthesis memory snapshot");

      /** Helper: build response from generateCombined result and cache at article level */
      const buildResponse = (result: { audioBuffer: Buffer; alignment: MergedAlignment; durationMs: number }, cacheTag: string) => {
        // Cache combined result at article level for future instant replays
        articleCache.set(articleKey, {
          audioBuffer: result.audioBuffer,
          alignment: result.alignment,
          durationMs: result.durationMs,
          size: result.audioBuffer.length,
          createdAt: Date.now(),
        });

        incrementTtsUsage(auth.userId, auth.isPremium).catch(() => {});

        return new Response(
          JSON.stringify({
            audioBase64: result.audioBuffer.toString("base64"),
            alignment: result.alignment,
            durationMs: result.durationMs,
          }),
          {
            headers: {
              "Content-Type": "application/json",
              "X-TTS-Usage-Count": String(usage.count + 1),
              "X-TTS-Usage-Limit": String(usage.limit),
              ...(cacheTag ? { "X-TTS-Cache": cacheTag } : {}),
            },
          },
        );
      };

      // Skip concurrency slot if everything is cached
      if (!allCached) {
        const abortController = new AbortController();
        const { signal } = abortController;
        request.signal?.addEventListener("abort", () => abortController.abort(), { once: true });

        try {
          await acquireTTSSlot(auth.userId, signal);
        } catch (err) {
          tracker.end({ status: "rejected", reason: (err as Error).name });
          if (err instanceof TTSSlotTimeoutError) {
            set.status = 503;
            return { error: "TTS service busy. Please try again shortly." };
          }
          if (err instanceof TTSUserLimitError) {
            set.status = 429;
            return { error: "Too many concurrent TTS requests. Please wait for current playback to finish." };
          }
          throw err;
        }

        try {
          logger.info(
            { userId: auth.userId, textLength: cleanedText.length, voice: voiceId, chunksTotal: chunks.length, articleUrl },
            "TTS synthesis started",
          );

          const result = await generateCombined(chunks, chunkKeys, voiceId, signal);
          tracker.end({ status: "completed" });
          return buildResponse(result, "");
        } catch (error) {
          const errMsg = (error as Error).message || "TTS generation failed";
          logger.error({ error: errMsg, userId: auth.userId }, "TTS synthesis error");
          tracker.end({ status: "error", error: errMsg });
          set.status = 500;
          return { error: errMsg };
        } finally {
          releaseTTSSlot(auth.userId);
        }
      }

      // All chunks cached — no concurrency slot needed
      logger.info(
        { userId: auth.userId, textLength: cleanedText.length, voice: voiceId, chunksTotal: chunks.length },
        "TTS chunk cache hit — replaying cached audio",
      );

      try {
        const result = await generateCombined(chunks, chunkKeys, voiceId);
        tracker.end({ status: "completed", cached: true });
        return buildResponse(result, "chunk-hit");
      } catch (error) {
        const errMsg = (error as Error).message || "TTS replay failed";
        logger.error({ error: errMsg, userId: auth.userId }, "TTS cache replay error");
        tracker.end({ status: "error", error: errMsg });
        set.status = 500;
        return { error: errMsg };
      }
    },
    {
      body: t.Object({
        text: t.String(),
        voice: t.Optional(t.String()),
        articleUrl: t.Optional(t.String()),
      }),
    },
  )
  .get("/api/tts/voices", async ({ request }) => {
    const auth = await getAuthInfo(request);
    return VOICE_PRESETS.map((v) => ({
      ...v,
      locked: !isVoiceAllowed(v.id, auth.isPremium),
    }));
  });

/** Expose cache stats for /health endpoint */
export function getTTSCacheStats() {
  return {
    chunks: chunkCache.stats,
    articles: articleCache.stats,
    redis: ttsRedisCache?.stats ?? { hits: 0, misses: 0, errors: 0, hitRate: 0 },
  };
}
