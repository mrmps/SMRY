/**
 * Inworld AI TTS client for speech synthesis with character-level timestamps.
 *
 * Uses Inworld's REST API with CHARACTER timestamp alignment to generate
 * MP3 audio with per-character timing, then converts to word boundaries
 * for highlight tracking.
 *
 * Replaces the previous ElevenLabs TTS integration with a cheaper provider
 * ($5/1M chars via inworld-tts-1.5-mini vs ~$15-30/1M chars ElevenLabs).
 */

// --- Config ---

const INWORLD_API_URL = "https://api.inworld.ai/tts/v1/voice";

let apiKey: string | null = null;

export function initTTSProvider(key: string): void {
  apiKey = key;
}

function getApiKey(): string {
  if (!apiKey) {
    throw new Error("Inworld TTS not initialized — call initTTSProvider() at startup");
  }
  return apiKey;
}

// --- Types ---

export interface WordBoundary {
  text: string;
  offset: number; // ms from audio start
  duration: number; // ms
  textOffset: number; // character offset in original text
  textLength: number;
}

export interface ChunkAlignment {
  characters: string[];
  characterStartTimesSeconds: number[];
  characterEndTimesSeconds: number[];
}

export interface ChunkResult {
  audioBuffer: Buffer;
  boundaries: WordBoundary[];
  alignment: ChunkAlignment | null;
  durationMs: number;
}

// --- Voice presets ---

export interface VoicePreset {
  id: string;
  name: string;
  gender: "female" | "male";
  accent: string;
  description: string;
  tier: "free" | "premium";
}

export const DEFAULT_VOICE_ID = "Ashley";

export const VOICE_PRESETS: VoicePreset[] = [
  { id: "Ashley", name: "Ashley", gender: "female", accent: "American", description: "Warm, natural", tier: "free" },
  { id: "Sarah", name: "Sarah", gender: "female", accent: "American", description: "Soft, warm", tier: "premium" },
  { id: "Olivia", name: "Olivia", gender: "female", accent: "British", description: "Upbeat, friendly", tier: "premium" },
  { id: "Julia", name: "Julia", gender: "female", accent: "American", description: "Bright, clear", tier: "premium" },
  { id: "Elizabeth", name: "Elizabeth", gender: "female", accent: "British", description: "Confident, refined", tier: "premium" },
  { id: "Dennis", name: "Dennis", gender: "male", accent: "American", description: "Deep, narration", tier: "free" },
  { id: "Alex", name: "Alex", gender: "male", accent: "American", description: "Well-rounded", tier: "premium" },
  { id: "Craig", name: "Craig", gender: "male", accent: "American", description: "Deep, clear", tier: "premium" },
  { id: "Edward", name: "Edward", gender: "male", accent: "American", description: "Emphatic, expressive", tier: "premium" },
  { id: "Timothy", name: "Timothy", gender: "male", accent: "American", description: "Young, natural", tier: "premium" },
];

/** Voice IDs available to free users */
export const FREE_VOICE_IDS = new Set(
  VOICE_PRESETS.filter((v) => v.tier === "free").map((v) => v.id),
);

/** All valid voice IDs */
export const ALL_VOICE_IDS = new Set(VOICE_PRESETS.map((v) => v.id));

/** Check if a voice is allowed for a given user tier */
export function isVoiceAllowed(voiceId: string, isPremium: boolean): boolean {
  if (!ALL_VOICE_IDS.has(voiceId)) return false;
  if (isPremium) return true;
  return FREE_VOICE_IDS.has(voiceId);
}

// Inworld TTS 1.5 Mini — $5/1M chars, ~100ms median latency
export const MODEL_ID = "inworld-tts-1.5-mini";

// --- Inworld API response types ---

interface InworldCharacterAlignment {
  characters: string[];
  characterStartTimeSeconds: number[]; // singular (Inworld convention)
  characterEndTimeSeconds: number[]; // singular (Inworld convention)
}

interface InworldTimestampInfo {
  characterAlignment?: InworldCharacterAlignment;
}

interface InworldTTSResponse {
  audioContent: string; // base64-encoded audio
  usage?: {
    processedCharactersCount?: number;
    modelId?: string;
  };
  timestampInfo?: InworldTimestampInfo;
}

// --- Speech generation ---

/**
 * Generate speech for a single text chunk using Inworld AI TTS API.
 *
 * Returns MP3 audio buffer + word-level boundaries derived from character alignment.
 * The `context` param is accepted for API compatibility but ignored — Inworld
 * doesn't support cross-chunk prosody context.
 */
export async function generateSpeechForChunk(
  text: string,
  voiceId: string,
  signal?: AbortSignal,
  _context?: { previousText?: string; nextText?: string },
): Promise<ChunkResult> {
  const key = getApiKey();

  const response = await fetch(INWORLD_API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      voiceId,
      modelId: MODEL_ID,
      audioConfig: {
        audioEncoding: "MP3",
        sampleRateHertz: 44100,
        bitRate: 64000,
      },
      timestampType: "CHARACTER",
      applyTextNormalization: "OFF",
    }),
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(60_000)])
      : AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(
      `Inworld TTS API error ${response.status}: ${errorBody || response.statusText}`,
    );
  }

  const data = (await response.json()) as InworldTTSResponse;

  // Extract audio buffer from base64
  const audioBase64 = data.audioContent ?? "";
  const audioBuffer = Buffer.from(audioBase64, "base64");

  // Map Inworld's alignment (singular field names) to our internal format (plural)
  const inworldAlignment = data.timestampInfo?.characterAlignment;
  const rawAlignment: ChunkAlignment | null = inworldAlignment
    ? {
        characters: inworldAlignment.characters ?? [],
        characterStartTimesSeconds: inworldAlignment.characterStartTimeSeconds ?? [],
        characterEndTimesSeconds: inworldAlignment.characterEndTimeSeconds ?? [],
      }
    : null;

  // Convert character-level alignment → word boundaries
  const boundaries = alignmentToWordBoundaries(rawAlignment, text);

  // Use actual MP3 frame duration for accurate multi-chunk alignment merging.
  // The old boundary-based estimate (last word end time) excluded trailing
  // silence/padding in each chunk, causing cumulative time drift when chunks
  // are concatenated — highlights would advance ahead of the audio.
  const parsedMs = parseMp3DurationMs(audioBuffer);
  const durationMs = parsedMs > 0
    ? parsedMs
    : estimateMp3DurationMs(audioBuffer.length);

  return { audioBuffer, boundaries, alignment: rawAlignment, durationMs };
}

// --- Alignment conversion ---

/**
 * Convert character-level alignment to word-level boundaries.
 *
 * Groups consecutive non-whitespace characters into words, using the first
 * character's start time and last character's end time for each word.
 * Uses forward-search for textOffset to handle repeated words correctly.
 */
function alignmentToWordBoundaries(
  alignment: ChunkAlignment | null,
  originalText: string,
): WordBoundary[] {
  if (
    !alignment ||
    !alignment.characters.length ||
    !alignment.characterStartTimesSeconds.length ||
    !alignment.characterEndTimesSeconds.length
  ) {
    return [];
  }

  const chars = alignment.characters;
  const starts = alignment.characterStartTimesSeconds;
  const ends = alignment.characterEndTimesSeconds;

  const boundaries: WordBoundary[] = [];
  let wordChars: string[] = [];
  let wordStartMs = 0;
  let wordEndMs = 0;

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const isWhitespace = /\s/.test(ch);

    if (isWhitespace) {
      if (wordChars.length > 0) {
        // Flush current word
        const word = wordChars.join("");
        const textOffset = findWordOffset(originalText, word, boundaries);
        boundaries.push({
          text: word,
          offset: Math.round(wordStartMs),
          duration: Math.round(wordEndMs - wordStartMs),
          textOffset,
          textLength: word.length,
        });
        wordChars = [];
      }
    } else {
      if (wordChars.length === 0) {
        wordStartMs = starts[i] * 1000;
      }
      wordEndMs = ends[i] * 1000;
      wordChars.push(ch);
    }
  }

  // Flush last word
  if (wordChars.length > 0) {
    const word = wordChars.join("");
    const textOffset = findWordOffset(originalText, word, boundaries);
    boundaries.push({
      text: word,
      offset: Math.round(wordStartMs),
      duration: Math.round(wordEndMs - wordStartMs),
      textOffset,
      textLength: word.length,
    });
  }

  return boundaries;
}

/**
 * Forward-search for a word's character offset in the original text.
 * Continues from the last boundary's position to handle repeated words correctly.
 */
function findWordOffset(text: string, word: string, existingBoundaries: WordBoundary[]): number {
  const lastEnd = existingBoundaries.length > 0
    ? existingBoundaries[existingBoundaries.length - 1].textOffset +
      existingBoundaries[existingBoundaries.length - 1].textLength
    : 0;

  const idx = text.indexOf(word, lastEnd);
  return idx >= 0 ? idx : lastEnd;
}

/**
 * Parse exact MP3 duration by counting MPEG audio frames.
 * Handles MPEG1/2/2.5 Layer III (common TTS output formats).
 * Works correctly for both CBR and VBR: each MPEG1-L3 frame always has
 * 1152 samples, MPEG2/2.5-L3 has 576 — independent of bitrate.
 * Returns duration in milliseconds, or 0 if parsing fails.
 */
function parseMp3DurationMs(buffer: Buffer): number {
  let offset = 0;

  // Skip ID3v2 tag if present
  if (
    buffer.length >= 10 &&
    buffer[0] === 0x49 && // 'I'
    buffer[1] === 0x44 && // 'D'
    buffer[2] === 0x33    // '3'
  ) {
    const tagSize =
      ((buffer[6] & 0x7f) << 21) |
      ((buffer[7] & 0x7f) << 14) |
      ((buffer[8] & 0x7f) << 7) |
      (buffer[9] & 0x7f);
    offset = 10 + tagSize;
  }

  // MPEG1 Layer III bitrate table (kbps), index 0–15
  const brV1 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, -1];
  // MPEG2/2.5 Layer III bitrate table (kbps)
  const brV2 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, -1];
  // Sample rate tables
  const srV1  = [44100, 48000, 32000, -1];
  const srV2  = [22050, 24000, 16000, -1];
  const srV25 = [11025, 12000,  8000, -1];

  let totalSamples = 0;
  let detectedSR = 0;
  let frames = 0;

  while (offset + 4 <= buffer.length) {
    // Frame sync: 11 set bits
    if (buffer[offset] !== 0xff || (buffer[offset + 1] & 0xe0) !== 0xe0) {
      offset++;
      continue;
    }

    const b1 = buffer[offset + 1];
    const b2 = buffer[offset + 2];
    const ver   = (b1 >> 3) & 0x03; // 00=2.5, 01=reserved, 10=2, 11=1
    const layer = (b1 >> 1) & 0x03; // 01=III, 10=II, 11=I
    const brIdx = (b2 >> 4) & 0x0f;
    const srIdx = (b2 >> 2) & 0x03;
    const pad   = (b2 >> 1) & 0x01;

    // Only handle Layer III, skip reserved version
    if (ver === 1 || layer !== 1) { offset++; continue; }

    let bitrate: number;
    let sampleRate: number;
    let samplesPerFrame: number;

    if (ver === 3) {          // MPEG1
      bitrate = brV1[brIdx]; sampleRate = srV1[srIdx]; samplesPerFrame = 1152;
    } else if (ver === 2) {   // MPEG2
      bitrate = brV2[brIdx]; sampleRate = srV2[srIdx]; samplesPerFrame = 576;
    } else {                  // MPEG2.5
      bitrate = brV2[brIdx]; sampleRate = srV25[srIdx]; samplesPerFrame = 576;
    }

    if (bitrate <= 0 || sampleRate <= 0) { offset++; continue; }

    detectedSR = sampleRate;
    const frameSize = ver === 3
      ? Math.floor((144 * bitrate * 1000) / sampleRate) + pad
      : Math.floor((72 * bitrate * 1000) / sampleRate) + pad;

    if (frameSize < 4 || offset + frameSize > buffer.length) break;

    frames++;
    totalSamples += samplesPerFrame;
    offset += frameSize;
  }

  if (frames === 0 || detectedSR === 0) return 0;
  return (totalSamples / detectedSR) * 1000;
}

/** Rough MP3 duration estimate (fallback): 64kbps = 8000 bytes/sec */
function estimateMp3DurationMs(byteLength: number): number {
  return (byteLength / 8000) * 1000;
}

// --- Voice avatar helpers ---

const AVATAR_GRADIENTS = [
  "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
  "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
  "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
  "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
  "linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)",
  "linear-gradient(135deg, #fccb90 0%, #d57eeb 100%)",
  "linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)",
  "linear-gradient(135deg, #f5576c 0%, #ff9a9e 100%)",
  "linear-gradient(135deg, #667eea 0%, #38f9d7 100%)",
];

/** Deterministic CSS gradient for a voice avatar based on voice ID */
export function getVoiceAvatarGradient(voiceId: string): string {
  let hash = 0;
  for (let i = 0; i < voiceId.length; i++) {
    hash = ((hash << 5) - hash + voiceId.charCodeAt(i)) | 0;
  }
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}

/** First letter of a voice name for avatar display */
export function getVoiceAvatarInitial(name: string): string {
  return (name[0] ?? "?").toUpperCase();
}
