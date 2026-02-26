/**
 * TTS Redis L2 Cache — persistent per-chunk audio cache that survives restarts.
 *
 * Cache hierarchy:
 *   L0: Client IndexedDB (7d, 50 entries)
 *   L1: Server article LRU (200MB, 2h TTL)
 *   L2: Server chunk LRU (300MB, 1h TTL)
 *   L3: Redis chunk cache (7d TTL) ← THIS
 *   L4: Inworld API (last resort)
 *
 * Stores gzip-compressed JSON with base64 audio per chunk hash.
 * Silent degradation: all errors → cache miss → fall through to Inworld.
 */

import { Redis } from "@upstash/redis";
import { compressAsync, decompressAsync } from "./redis-compression";
import { createLogger } from "./logger";
import type { ChunkAlignment, MergedAlignment } from "./tts-provider";

const logger = createLogger("tts-redis-cache");

const REDIS_KEY_PREFIX = "tts:chunk:";
const ARTICLE_KEY_PREFIX = "tts:article:v2:";
const TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
const MAX_CHUNK_BYTES = 2 * 1024 * 1024; // 2MB per chunk
const MAX_ARTICLE_BYTES = 10 * 1024 * 1024; // 10MB per article

interface CachedChunkData {
  /** base64-encoded MP3 audio */
  audioBase64: string;
  alignment: ChunkAlignment | null;
  durationMs: number;
}

interface CachedArticleData {
  /** base64-encoded combined MP3 audio */
  audioBase64: string;
  alignment: MergedAlignment;
  durationMs: number;
}

export class TTSRedisCache {
  private redis: Redis;
  private _hits = 0;
  private _misses = 0;
  private _errors = 0;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  async get(chunkHash: string): Promise<{ audio: Buffer; alignment: ChunkAlignment | null; durationMs: number } | null> {
    try {
      const raw = await this.redis.get<string>(`${REDIS_KEY_PREFIX}${chunkHash}`);
      if (!raw) {
        this._misses++;
        return null;
      }

      const data = await decompressAsync(raw) as CachedChunkData | null;
      if (!data || !data.audioBase64) {
        this._misses++;
        return null;
      }

      this._hits++;
      return {
        audio: Buffer.from(data.audioBase64, "base64"),
        alignment: data.alignment,
        durationMs: data.durationMs,
      };
    } catch (err) {
      this._errors++;
      logger.warn({ err, chunkHash }, "Redis TTS cache get failed");
      return null;
    }
  }

  async set(chunkHash: string, audio: Buffer, alignment: ChunkAlignment | null, durationMs: number): Promise<void> {
    try {
      if (audio.length > MAX_CHUNK_BYTES) {
        logger.debug({ chunkHash, size: audio.length }, "Chunk too large for Redis cache");
        return;
      }

      const data: CachedChunkData = {
        audioBase64: audio.toString("base64"),
        alignment,
        durationMs,
      };

      const compressed = await compressAsync(data);
      await this.redis.set(`${REDIS_KEY_PREFIX}${chunkHash}`, compressed, { ex: TTL_SECONDS });
    } catch (err) {
      this._errors++;
      logger.warn({ err, chunkHash }, "Redis TTS cache set failed");
    }
  }

  /** Batch get — returns array of results (null for misses), same order as input keys */
  async getBatch(chunkHashes: string[]): Promise<({ audio: Buffer; alignment: ChunkAlignment | null; durationMs: number } | null)[]> {
    if (chunkHashes.length === 0) return [];

    try {
      const pipeline = this.redis.pipeline();
      for (const hash of chunkHashes) {
        pipeline.get(`${REDIS_KEY_PREFIX}${hash}`);
      }
      const rawResults = await pipeline.exec<(string | null)[]>();

      const results = await Promise.all(
        rawResults.map(async (raw) => {
          if (!raw) {
            this._misses++;
            return null;
          }
          try {
            const data = await decompressAsync(raw) as CachedChunkData | null;
            if (!data || !data.audioBase64) {
              this._misses++;
              return null;
            }
            this._hits++;
            return {
              audio: Buffer.from(data.audioBase64, "base64"),
              alignment: data.alignment,
              durationMs: data.durationMs,
            };
          } catch {
            this._misses++;
            return null;
          }
        }),
      );

      return results;
    } catch (err) {
      this._errors++;
      logger.warn({ err }, "Redis TTS cache batch get failed");
      return chunkHashes.map(() => null);
    }
  }

  /** Get combined article audio + alignment from Redis */
  async getArticle(articleHash: string): Promise<{ audio: Buffer; alignment: MergedAlignment; durationMs: number } | null> {
    try {
      const raw = await this.redis.get<string>(`${ARTICLE_KEY_PREFIX}${articleHash}`);
      if (!raw) {
        this._misses++;
        return null;
      }

      const data = await decompressAsync(raw) as CachedArticleData | null;
      if (!data || !data.audioBase64) {
        this._misses++;
        return null;
      }

      this._hits++;
      return {
        audio: Buffer.from(data.audioBase64, "base64"),
        alignment: data.alignment,
        durationMs: data.durationMs,
      };
    } catch (err) {
      this._errors++;
      logger.warn({ err, articleHash }, "Redis TTS article cache get failed");
      return null;
    }
  }

  /** Store combined article audio + alignment in Redis (7d TTL) */
  async setArticle(articleHash: string, audio: Buffer, alignment: MergedAlignment, durationMs: number): Promise<void> {
    try {
      if (audio.length > MAX_ARTICLE_BYTES) {
        logger.debug({ articleHash, size: audio.length }, "Article too large for Redis cache");
        return;
      }

      const data: CachedArticleData = {
        audioBase64: audio.toString("base64"),
        alignment,
        durationMs,
      };

      const compressed = await compressAsync(data);
      await this.redis.set(`${ARTICLE_KEY_PREFIX}${articleHash}`, compressed, { ex: TTL_SECONDS });
    } catch (err) {
      this._errors++;
      logger.warn({ err, articleHash }, "Redis TTS article cache set failed");
    }
  }

  get stats() {
    return {
      hits: this._hits,
      misses: this._misses,
      errors: this._errors,
      hitRate: this._hits + this._misses > 0
        ? Math.round((this._hits / (this._hits + this._misses)) * 100)
        : 0,
    };
  }
}
