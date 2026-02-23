/**
 * TTS Routes - POST /api/tts, GET /api/tts/voices
 *
 * /api/tts - Generates speech audio via Azure Speech Service WebSocket API.
 *            Streams SSE with audio chunks (base64 mp3) and word boundary events.
 * /api/tts/voices - Returns available voice list.
 *
 * Scalability design (30K DAU, 100+ concurrent):
 * - Bounded concurrency: max 20 global WebSocket connections, max 2 per user
 * - Memory tracking: all operations instrumented via memory-tracker
 * - Client disconnect cleanup: AbortSignal propagated to WebSocket
 * - Rate limiting: per-IP via in-memory sliding window + monthly Redis quota
 * - Audio size cap: max 50KB text (~30 min audio, ~50MB buffer)
 * - Backpressure: stream controller checked before enqueue
 * - Graceful error handling with explicit WebSocket cleanup
 *
 * Free users: 3 articles/month. Premium users: unlimited.
 */

import { Elysia, t } from "elysia";
import {
  AzureTTSWebSocket,
  initAzureTTS,
  buildTTSUrl,
  getTTSHeaders,
  getTTSHost,
  getTTSOrigin,
  buildVoiceListUrl,
  getVoiceListHeaders,
} from "../../lib/azure-tts-ws";
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

// Initialize Azure Speech Service with validated env vars (optional — TTS disabled when absent)
if (env.AZURE_SPEECH_KEY && env.AZURE_SPEECH_REGION) {
  initAzureTTS(env.AZURE_SPEECH_KEY, env.AZURE_SPEECH_REGION);
} else {
  logger.warn("Azure Speech credentials not set — TTS routes will return 503");
}

// Free user monthly limit
const FREE_TTS_LIMIT = 3;

// Per-chunk WebSocket timeout (scaled for text size)
const WS_TIMEOUT_BASE_MS = 10_000; // 10s minimum
const WS_TIMEOUT_PER_CHAR_MS = 0.5; // +0.5ms per character
const WS_TIMEOUT_MAX_MS = 30_000; // 30s maximum

// Max audio buffer size per request (50MB — ~30 min MP3)
const MAX_AUDIO_BUFFER_BYTES = 50 * 1024 * 1024;

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

// In-memory fallback for monthly limits when Redis is down
const memoryUsageCache = new Map<string, { count: number; month: string }>();
const MEMORY_CACHE_MAX = 5000;

function uuid() {
  return crypto.randomUUID().replaceAll("-", "");
}

function getMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
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

interface WordBoundary {
  text: string;
  offset: number; // ms from audio start
  duration: number; // ms
  textOffset: number; // character offset in original text
  textLength: number;
}

/**
 * Check and increment TTS usage for a user.
 * Uses Redis with in-memory fallback when Redis is down.
 */
async function checkTtsUsage(
  userId: string | null,
  isPremium: boolean,
): Promise<{ allowed: boolean; count: number; limit: number }> {
  if (isDev) return { allowed: true, count: 0, limit: Infinity }; // Unlimited in dev mode
  if (isPremium) return { allowed: true, count: 0, limit: Infinity };
  if (!userId) return { allowed: true, count: 0, limit: FREE_TTS_LIMIT };

  const monthKey = getMonthKey();

  // Try Redis first
  if (redis) {
    const redisKey = `tts-usage:${userId}:${monthKey}`;
    try {
      const current = (await redis.get<number>(redisKey)) || 0;
      if (current >= FREE_TTS_LIMIT) {
        return { allowed: false, count: current, limit: FREE_TTS_LIMIT };
      }
      await redis.incr(redisKey);
      const now = new Date();
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const ttlSeconds = Math.ceil((endOfMonth.getTime() - now.getTime()) / 1000) + 86400;
      await redis.expire(redisKey, ttlSeconds);
      return { allowed: true, count: current + 1, limit: FREE_TTS_LIMIT };
    } catch (error) {
      logger.warn({ error, userId }, "Redis TTS usage check failed, falling back to memory");
    }
  }

  // In-memory fallback (prevents unlimited usage when Redis is down)
  const memKey = `${userId}:${monthKey}`;
  const memEntry = memoryUsageCache.get(memKey);
  if (memEntry && memEntry.month === monthKey) {
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
  memoryUsageCache.set(memKey, { count: 1, month: monthKey });
  return { allowed: true, count: 1, limit: FREE_TTS_LIMIT };
}

/**
 * Generate a single chunk of TTS audio via Azure Speech WebSocket.
 * AbortSignal support for cleanup when client disconnects.
 */
function generateChunk(
  text: string,
  voice: string,
  rate: string,
  pitch: string,
  signal?: AbortSignal,
): Promise<{ audio: Buffer; boundaries: WordBoundary[] }> {
  return new Promise((resolve, reject) => {
    // Scale timeout by text length
    const timeoutMs = Math.min(
      WS_TIMEOUT_MAX_MS,
      WS_TIMEOUT_BASE_MS + text.length * WS_TIMEOUT_PER_CHAR_MS,
    );

    let settled = false;
    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      signal?.removeEventListener("abort", onAbort);
      fn();
    };

    const timeout = setTimeout(() => {
      settle(() => {
        try { ws.close(); } catch { /* ignore */ }
        reject(new Error(`TTS WebSocket timeout after ${timeoutMs}ms`));
      });
    }, timeoutMs);

    const onAbort = () => {
      settle(() => {
        try { ws.close(); } catch { /* ignore */ }
        reject(new Error("TTS request aborted by client"));
      });
    };

    signal?.addEventListener("abort", onAbort, { once: true });

    const connectionId = uuid();
    const ws = new AzureTTSWebSocket(buildTTSUrl(connectionId), {
      host: getTTSHost(),
      origin: getTTSOrigin(),
      headers: getTTSHeaders(),
    });

    const audioData: Buffer[] = [];
    const boundaries: WordBoundary[] = [];
    let totalAudioBytes = 0;

    ws.on("message", (rawData: Buffer, isBinary: boolean) => {
      if (settled) return;

      if (!isBinary) {
        const data = rawData.toString("utf8");

        // Parse word boundary metadata
        if (data.includes("Path:audio.metadata")) {
          try {
            const jsonStart = data.indexOf("{");
            if (jsonStart !== -1) {
              const metadata = JSON.parse(data.slice(jsonStart));
              if (metadata.Metadata) {
                for (const item of metadata.Metadata) {
                  if (item.Type === "WordBoundary" && item.Data) {
                    boundaries.push({
                      text: item.Data.text?.Text || "",
                      offset: Math.round((item.Data.Offset || 0) / 10000),
                      duration: Math.round((item.Data.Duration || 0) / 10000),
                      textOffset: item.Data.text?.BoundaryType === "Word"
                        ? (item.Data.text?.Offset || 0)
                        : 0,
                      textLength: item.Data.text?.Length || 0,
                    });
                  }
                }
              }
            }
          } catch {
            // Ignore metadata parse errors
          }
        }

        if (data.includes("turn.end")) {
          settle(() => {
            ws.close();
            resolve({ audio: Buffer.concat(audioData), boundaries });
          });
        }
        return;
      }

      // Binary audio data
      const data = rawData;
      const separator = "Path:audio\r\n";
      const sepIndex = data.indexOf(separator);
      if (sepIndex !== -1) {
        const chunk = data.subarray(sepIndex + separator.length);
        totalAudioBytes += chunk.length;

        // Guard against unbounded audio buffer growth
        if (totalAudioBytes > MAX_AUDIO_BUFFER_BYTES) {
          settle(() => {
            ws.close();
            reject(new Error(`Audio buffer exceeded ${MAX_AUDIO_BUFFER_BYTES} bytes`));
          });
          return;
        }

        audioData.push(chunk);
      }
    });

    ws.on("error", (error: Error) => {
      settle(() => reject(error));
    });

    ws.on("close", () => {
      // If closed without resolving, reject
      settle(() => reject(new Error("TTS WebSocket closed unexpectedly")));
    });

    // Speech config with word boundary events ENABLED
    const speechConfig = JSON.stringify({
      context: {
        synthesis: {
          audio: {
            metadataoptions: {
              sentenceBoundaryEnabled: true,
              wordBoundaryEnabled: true,
            },
            outputFormat: "audio-24khz-48kbitrate-mono-mp3",
          },
        },
      },
    });

    const configMessage =
      `X-Timestamp:${Date()}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n${speechConfig}`;

    ws.on("open", () => {
      if (settled) { ws.close(); return; }

      ws.send(configMessage, undefined, (configError?: Error) => {
        if (configError) {
          settle(() => reject(configError));
          return;
        }

        const ssmlMessage =
          `X-RequestId:${uuid()}\r\nContent-Type:application/ssml+xml\r\n` +
          `X-Timestamp:${Date()}Z\r\nPath:ssml\r\n\r\n` +
          `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>` +
          `<voice name='${voice}'><prosody pitch='${pitch}' rate='${rate}' volume='+0%'>` +
          `${text}</prosody></voice></speak>`;

        ws.send(ssmlMessage, undefined, (ssmlError?: Error) => {
          if (ssmlError) settle(() => reject(ssmlError));
        });
      });
    });
  });
}

/**
 * Stream TTS audio + word boundaries via SSE.
 * Supports abort signal for cleanup on client disconnect.
 */
async function* streamTTS(
  text: string,
  voice: string,
  rate: string,
  pitch: string,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  // Sanitize text for SSML
  const sanitized = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

  // Chunk long text to avoid WebSocket limits (~64KB per message)
  const MAX_CHUNK = 30000;
  const chunks: string[] = [];
  if (sanitized.length <= MAX_CHUNK) {
    chunks.push(sanitized);
  } else {
    const sentences = sanitized.split(/(?<=[.!?])\s+/);
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
    // Check abort before each chunk
    if (signal?.aborted) return;

    const result = await generateChunk(chunk, voice, rate, pitch, signal);

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

    // Yield audio as base64 chunks
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
      const { text, voice, rate, pitch, articleUrl } = body;
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

      // --- Monthly usage limit ---
      const usage = await checkTtsUsage(auth.userId, auth.isPremium);
      if (!usage.allowed) {
        set.status = 429;
        return {
          error: "Monthly TTS limit reached",
          count: usage.count,
          limit: usage.limit,
          isPremium: auth.isPremium,
        };
      }

      // --- Memory tracking ---
      const tracker = startMemoryTrack("tts-synthesis", {
        userId: auth.userId,
        textLength: text.length,
        voice: voice || "en-US-AriaNeural",
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
        { userId: auth.userId, isPremium: auth.isPremium, textLength: text.length, voice, rate, articleUrl },
        "TTS synthesis started",
      );

      // --- Stream SSE response ---
      const encoder = new TextEncoder(); // Reuse single encoder

      const stream = new ReadableStream({
        async start(controller) {
          try {
            for await (const event of streamTTS(
              text,
              voice || "en-US-AriaNeural",
              rate || "+0%",
              pitch || "+0Hz",
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
        rate: t.Optional(t.String()),
        pitch: t.Optional(t.String()),
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
      const resp = await fetch(buildVoiceListUrl(), {
        headers: getVoiceListHeaders(),
        signal: AbortSignal.timeout(10_000),
      });
      const voices = (await resp.json()) as Array<{
        ShortName: string;
        DisplayName: string;
        Gender: string;
        Locale: string;
      }>;

      const englishVoices = voices
        .filter((v) => v.Locale.startsWith("en-"))
        .map((v) => ({
          id: v.ShortName,
          name: v.DisplayName.replace("Microsoft ", ""),
          gender: v.Gender,
          locale: v.Locale,
        }));

      voiceCache = { voices: englishVoices, expiresAt: now + 3600000 };
      return englishVoices;
    } catch (error) {
      // Return stale cache if available
      if (voiceCache) {
        logger.warn({ error }, "Voice fetch failed, returning stale cache");
        return voiceCache.voices;
      }
      logger.error({ error }, "Failed to fetch voice list");
      set.status = 500;
      return { error: "Failed to fetch voices" };
    }
  });
