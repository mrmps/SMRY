/**
 * Shared TTS text cleaning, chunking, and hashing.
 *
 * Used by both browser (use-tts hook) and server (tts route) to ensure
 * identical text cleaning, chunk splitting, and cache key computation.
 *
 * Per-chunk caching: each ~1800-char chunk is independently cached by its
 * own text content + voice. Partial cache hits work — only missing chunks
 * need to be generated.
 */

// --- Text cleaning ---

/**
 * Clean text for TTS. Strips common junk patterns (ads, navigation, etc.)
 * and collapses whitespace. Idempotent — safe to call multiple times.
 *
 * Single source of truth — used by both client and server.
 */
export function cleanTextForTTS(text: string): string {
  let cleaned = text;

  const junkPatterns = [
    /\b(?:SKIP\s+)?ADVERTISEMENT\b/gi,
    /\bSponsored\s+Content\b/gi,
    /\bPromoted\b/gi,
    /\bShare\s+this\s+article\b/gi,
    /\bContinue\s+reading\s+the\s+main\s+story\b/gi,
    /\bRead\s+more\b:?/gi,
    /\bSign\s+up\s+for\s+.*?newsletter\b/gi,
    /\bCredit\s*\.\.\./gi,
    /\bImage\s+credit\s*:?/gi,
    /\bPhoto\s*:?\s*Getty\b/gi,
    /\b(?:Share|Tweet|Pin|Email)\s+(?:on|via)\s+\w+\b/gi,
    /\bAccept\s+(?:all\s+)?cookies?\b/gi,
    /\bSubscribe\s+now\b/gi,
  ];

  for (const pattern of junkPatterns) {
    cleaned = cleaned.replace(pattern, "");
  }

  cleaned = cleaned.replace(/\s+/g, " ").trim();
  return cleaned;
}

// --- Chunk splitting ---

const MAX_CHUNK_SIZE = 1800; // Inworld limit: 2000 chars per request (with safety margin)

/**
 * Split text into ~1800-char chunks on sentence boundaries.
 * Inworld TTS has a 2000-char per-request limit.
 * Smaller chunks = more API calls, but each call is cheaper.
 * Identical algorithm on client and server ensures matching chunk keys.
 *
 * If a single sentence exceeds MAX_CHUNK_SIZE, it is force-split on the
 * last word boundary before the limit so no chunk ever exceeds 1800 chars.
 */
export function splitTTSChunks(text: string): string[] {
  if (text.length <= MAX_CHUNK_SIZE) {
    return [text];
  }

  const sentences = text.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    // If the sentence itself exceeds the limit, force-split on word boundaries
    if (sentence.length > MAX_CHUNK_SIZE) {
      if (current) {
        chunks.push(current);
        current = "";
      }
      for (const sub of forceSplitLongSegment(sentence)) {
        if (current.length + sub.length + (current ? 1 : 0) > MAX_CHUNK_SIZE && current.length > 0) {
          chunks.push(current);
          current = sub;
        } else {
          current += (current ? " " : "") + sub;
        }
      }
      continue;
    }

    if (current.length + sentence.length + (current ? 1 : 0) > MAX_CHUNK_SIZE && current.length > 0) {
      chunks.push(current);
      current = sentence;
    } else {
      current += (current ? " " : "") + sentence;
    }
  }
  if (current) chunks.push(current);

  return chunks;
}

/**
 * Force-split a long segment (no sentence boundaries) into pieces that
 * each fit within MAX_CHUNK_SIZE. Splits on the last word boundary (' ')
 * before the limit. Falls back to hard character split if there are no spaces.
 */
function forceSplitLongSegment(text: string): string[] {
  const parts: string[] = [];
  let remaining = text;

  while (remaining.length > MAX_CHUNK_SIZE) {
    // Find last space within the limit
    let splitAt = remaining.lastIndexOf(" ", MAX_CHUNK_SIZE);
    if (splitAt <= 0) {
      // No space found — hard split at limit
      splitAt = MAX_CHUNK_SIZE;
    }
    parts.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).trimStart();
  }
  if (remaining) parts.push(remaining);

  return parts;
}

// --- Chunk key computation ---

/**
 * Cache key version — bump this when the chunk audio/alignment format changes.
 * This invalidates all stale server-side (LRU + Redis) and client-side (IndexedDB)
 * cached chunks, forcing re-generation with the corrected logic.
 *
 * v2: MP3 frame-based durationMs (parseMp3DurationMs) replaces boundary-based estimate.
 *     Old cached chunks had wrong durationMs causing cumulative alignment drift.
 * v3: Xing VBR header fix — combined audio now has correct total duration header.
 *     Invalidates all cached chunks so they get re-combined with the Xing frame.
 */
const CHUNK_CACHE_VERSION = "v3";

/**
 * Compute a per-chunk cache key (async, browser-compatible via Web Crypto).
 * SHA-256(version + "\0" + chunkText + "\0" + voice) — works in both browser and server.
 */
export async function computeChunkKey(
  chunkText: string,
  voice: string,
): Promise<string> {
  const data = new TextEncoder().encode(CHUNK_CACHE_VERSION + "\0" + chunkText + "\0" + voice);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

/**
 * Compute a per-chunk cache key (sync, server-only).
 * Uses Bun.CryptoHasher when available, falls back to Node.js crypto.
 * Same hash as computeChunkKey — produces identical keys.
 */
export function computeChunkKeySync(
  chunkText: string,
  voice: string,
): string {
  const input = CHUNK_CACHE_VERSION + "\0" + chunkText + "\0" + voice;
  if (typeof Bun !== "undefined") {
    const hasher = new Bun.CryptoHasher("sha256");
    hasher.update(input);
    return hasher.digest("hex");
  }
  // Node.js fallback
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createHash } = require("crypto") as typeof import("crypto");
  return createHash("sha256").update(input).digest("hex");
}

// --- Types ---

/** Word boundary with LOCAL offsets (within a single chunk). */
export interface LocalBoundary {
  text: string;
  offset: number; // ms from chunk audio start
  duration: number; // ms
  textOffset: number; // char offset within chunk text
  textLength: number;
}
