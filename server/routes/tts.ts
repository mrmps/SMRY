/**
 * TTS Routes - POST /api/tts, GET /api/tts/voices
 *
 * /api/tts - Generates speech audio via Cartesia TTS SSE API.
 *            Streams SSE with audio chunks (base64 WAV) and word boundary events.
 * /api/tts/voices - Returns available voice list.
 *
 * Scalability design (30K DAU, 100+ concurrent):
 * - Bounded concurrency: max 20 global connections, max 2 per user
 * - Memory tracking: all operations instrumented via memory-tracker
 * - Client disconnect cleanup: AbortSignal propagated to Cartesia request
 * - Rate limiting: per-IP via in-memory sliding window + daily Redis quota
 * - Audio size cap: max 50KB text (~30 min audio, ~50MB buffer)
 * - Backpressure: stream controller checked before enqueue
 * - Graceful error handling with explicit cleanup
 *
 * Free users: 3 articles/day. Premium users: unlimited.
 */

import { Elysia, t } from "elysia";
import {
  initCartesiaTTS,
  generateSpeech,
  fetchCartesiaVoices,
  DEFAULT_VOICE_ID,
} from "../../lib/cartesia-tts";
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

const isDev = env.NODE_ENV === "development";

const logger = createLogger("api:tts");

// Initialize Cartesia TTS with validated env vars (optional — TTS disabled when absent)
if (env.CARTESIA_API_KEY) {
  initCartesiaTTS(env.CARTESIA_API_KEY);
} else {
  logger.warn("Cartesia API key not set — TTS routes will return 503");
}

// Free user daily limit
const FREE_TTS_LIMIT = 3;

// SSE chunk size for base64 audio
const SSE_CHUNK_SIZE = 32768;

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
  if (isDev) return true; // Skip rate limiting in dev mode

  const now = Date.now();
  const entry = ipRateLimiter.get(ip);

  if (!entry || entry.resetAt <= now) {
    // Evict if too large
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
 * Check and increment TTS usage for a user.
 * Free users: 3 plays per day. Premium: unlimited.
 * Uses Redis with in-memory fallback when Redis is down.
 */
async function checkTtsUsage(
  userId: string | null,
  isPremium: boolean,
): Promise<{ allowed: boolean; count: number; limit: number }> {
  if (isDev) return { allowed: true, count: 0, limit: Infinity }; // Unlimited in dev mode
  if (isPremium) return { allowed: true, count: 0, limit: Infinity };
  if (!userId) return { allowed: false, count: 0, limit: FREE_TTS_LIMIT };

  const dayKey = getDayKey();

  // Try Redis first
  if (redis) {
    const redisKey = `tts-usage:${userId}:${dayKey}`;
    try {
      const current = (await redis.get<number>(redisKey)) || 0;
      if (current >= FREE_TTS_LIMIT) {
        return { allowed: false, count: current, limit: FREE_TTS_LIMIT };
      }
      await redis.incr(redisKey);
      // Expire at end of day + 1h buffer
      await redis.expire(redisKey, 90000); // 25 hours
      return { allowed: true, count: current + 1, limit: FREE_TTS_LIMIT };
    } catch (error) {
      logger.warn({ error, userId }, "Redis TTS usage check failed, falling back to memory");
    }
  }

  // In-memory fallback (prevents unlimited usage when Redis is down)
  const memKey = `${userId}:${dayKey}`;
  const memEntry = memoryUsageCache.get(memKey);
  if (memEntry && memEntry.day === dayKey) {
    if (memEntry.count >= FREE_TTS_LIMIT) {
      return { allowed: false, count: memEntry.count, limit: FREE_TTS_LIMIT };
    }
    memEntry.count++;
    return { allowed: true, count: memEntry.count, limit: FREE_TTS_LIMIT };
  }

  // Evict if cache too large
  if (memoryUsageCache.size >= MEMORY_CACHE_MAX) {
    const first = memoryUsageCache.keys().next().value;
    if (first) memoryUsageCache.delete(first);
  }
  memoryUsageCache.set(memKey, { count: 1, day: dayKey });
  return { allowed: true, count: 1, limit: FREE_TTS_LIMIT };
}

/**
 * Stream TTS audio + word boundaries via SSE using Cartesia.
 * Supports abort signal for cleanup on client disconnect.
 */
async function* streamTTS(
  text: string,
  voice: string,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  // Chunk long text on sentence boundaries (~30KB per chunk)
  const MAX_CHUNK = 30000;
  const chunks: string[] = [];
  if (text.length <= MAX_CHUNK) {
    chunks.push(text);
  } else {
    const sentences = text.split(/(?<=[.!?])\s+/);
    let current = "";
    for (const sentence of sentences) {
      if (current.length + sentence.length > MAX_CHUNK && current.length > 0) {
        chunks.push(current);
        current = sentence;
      } else {
        current += (current ? " " : "") + sentence;
      }
    }
    if (current) chunks.push(current);
  }

  let globalTimeOffset = 0;
  let globalTextOffset = 0;

  for (const chunk of chunks) {
    if (signal?.aborted) return;

    const result = await generateSpeech(chunk, voice, signal);

    // Yield word boundaries with adjusted offsets
    for (const boundary of result.boundaries) {
      if (signal?.aborted) return;
      yield `event: boundary\ndata: ${JSON.stringify({
        text: boundary.text,
        offset: boundary.offset + globalTimeOffset,
        duration: boundary.duration,
        textOffset: boundary.textOffset + globalTextOffset,
        textLength: boundary.textLength,
      })}\n\n`;
    }

    // Yield audio as base64 chunks (WAV)
    if (result.audio.length > 0) {
      const base64 = result.audio.toString("base64");
      for (let i = 0; i < base64.length; i += SSE_CHUNK_SIZE) {
        if (signal?.aborted) return;
        yield `event: audio\ndata: ${JSON.stringify({
          chunk: base64.slice(i, i + SSE_CHUNK_SIZE),
          index: Math.floor(i / SSE_CHUNK_SIZE),
          final: i + SSE_CHUNK_SIZE >= base64.length,
        })}\n\n`;
      }
    }

    // Calculate time offset for next chunk
    if (result.boundaries.length > 0) {
      const lastBoundary = result.boundaries[result.boundaries.length - 1];
      globalTimeOffset += lastBoundary.offset + lastBoundary.duration + 100;
    }
    globalTextOffset += chunk.length + 1;
  }

  yield `event: done\ndata: {}\n\n`;
}

// Cached voice list (refreshes every hour)
let voiceCache: { voices: unknown[]; expiresAt: number } | null = null;

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

      // --- Memory tracking ---
      const tracker = startMemoryTrack("tts-synthesis", {
        userId: auth.userId,
        textLength: text.length,
        voice: voice || DEFAULT_VOICE_ID,
        clientIp,
      });

      // --- Concurrency slot ---
      const abortController = new AbortController();
      const { signal } = abortController;

      // Listen for client disconnect (request abort)
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

      logger.info(
        { userId: auth.userId, isPremium: auth.isPremium, textLength: text.length, voice, articleUrl },
        "TTS synthesis started",
      );

      // --- Stream SSE response ---
      const encoder = new TextEncoder(); // Reuse single encoder

      const stream = new ReadableStream({
        async start(controller) {
          try {
            for await (const event of streamTTS(
              text,
              voice || DEFAULT_VOICE_ID,
              signal,
            )) {
              // Backpressure check: skip if controller is closing
              try {
                controller.enqueue(encoder.encode(event));
              } catch {
                // Stream closed by client
                abortController.abort();
                break;
              }
            }
            try { controller.close(); } catch { /* already closed */ }
            tracker.end({ status: "completed" });
          } catch (error) {
            const errMsg = (error as Error).message || "TTS generation failed";
            logger.error({ error: errMsg, userId: auth.userId }, "TTS streaming error");
            try {
              controller.enqueue(
                encoder.encode(`event: error\ndata: ${JSON.stringify({ error: errMsg })}\n\n`),
              );
              controller.close();
            } catch { /* stream already closed */ }
            tracker.end({ status: "error", error: errMsg });
          } finally {
            releaseTTSSlot(auth.userId);
          }
        },
        cancel() {
          // Called when client disconnects
          abortController.abort();
          releaseTTSSlot(auth.userId);
          tracker.end({ status: "client_disconnected" });
          logger.debug({ userId: auth.userId }, "TTS stream cancelled by client");
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "X-TTS-Usage-Count": String(usage.count),
          "X-TTS-Usage-Limit": String(usage.limit),
        },
      });
    },
    {
      body: t.Object({
        text: t.String(),
        voice: t.Optional(t.String()),
        articleUrl: t.Optional(t.String()),
      }),
    },
  )
  .get("/api/tts/voices", async ({ set }) => {
    const now = Date.now();
    if (voiceCache && voiceCache.expiresAt > now) {
      return voiceCache.voices;
    }

    try {
      const voices = await fetchCartesiaVoices();
      voiceCache = { voices, expiresAt: now + 3600000 };
      return voices;
    } catch (error) {
      if (voiceCache) {
        logger.warn({ error }, "Voice fetch failed, returning stale cache");
        return voiceCache.voices;
      }
      logger.error({ error }, "Failed to fetch voice list");
      set.status = 500;
      return { error: "Failed to fetch voices" };
    }
  });
