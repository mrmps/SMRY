/**
 * Shared TTS text cleaning, chunking, and hashing.
 *
 * Used by both browser (use-tts hook) and server (tts route) to ensure
 * identical text cleaning, chunk splitting, and cache key computation.
 *
 * Per-chunk caching: each ~5000-char chunk is independently cached by its
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
 */
export function splitTTSChunks(text: string): string[] {
  if (text.length <= MAX_CHUNK_SIZE) {
    return [text];
  }

  const sentences = text.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    if (current.length + sentence.length > MAX_CHUNK_SIZE && current.length > 0) {
      chunks.push(current);
      current = sentence;
    } else {
      current += (current ? " " : "") + sentence;
    }
  }
  if (current) chunks.push(current);

  return chunks;
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
 * Compute a per-chunk cache key (sync, server-only via Bun.CryptoHasher).
 * Same hash as computeChunkKey — produces identical keys.
 */
export function computeChunkKeySync(
  chunkText: string,
  voice: string,
): string {
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(CHUNK_CACHE_VERSION + "\0" + chunkText + "\0" + voice);
  return hasher.digest("hex");
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
