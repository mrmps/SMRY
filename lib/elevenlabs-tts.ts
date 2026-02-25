/**
 * ElevenLabs TTS client for speech synthesis with word-level timestamps.
 *
 * Uses the ElevenLabs SDK's convertWithTimestamps() to generate MP3 audio
 * with character-level alignment, then converts to word boundaries for
 * highlight tracking.
 */

import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

// --- Config ---

let client: ElevenLabsClient | null = null;

export function initElevenLabsTTS(apiKey: string): void {
  client = new ElevenLabsClient({ apiKey });
}

function getClient(): ElevenLabsClient {
  if (!client) {
    throw new Error("ElevenLabs TTS not initialized — call initElevenLabsTTS() at startup");
  }
  return client;
}

// --- Types ---

export interface WordBoundary {
  text: string;
  offset: number; // ms from audio start
  duration: number; // ms
  textOffset: number; // character offset in original text
  textLength: number;
}

export interface ElevenLabsVoice {
  id: string;
  name: string;
  language: string;
}

// Default voice: "Rachel" — clear, natural female voice
export const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";

/** Curated voice presets for article narration */
export interface VoicePreset {
  id: string;
  name: string;
  gender: "female" | "male";
  accent: string;
  description: string;
  tier: "free" | "premium";
}

export const VOICE_PRESETS: VoicePreset[] = [
  { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel", gender: "female", accent: "American", description: "Calm, clear", tier: "free" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", gender: "female", accent: "American", description: "Soft, news", tier: "premium" },
  { id: "XrExE9yKIg1WjnnlVkGX", name: "Matilda", gender: "female", accent: "American", description: "Warm", tier: "premium" },
  { id: "pFZP5JQG7iQjIQuC4Bku", name: "Lily", gender: "female", accent: "British", description: "Raspy", tier: "premium" },
  { id: "Xb7hH8MSUJpSbSDYk0k2", name: "Alice", gender: "female", accent: "British", description: "Confident", tier: "premium" },
  { id: "pNInz6obpgDQGcFmaJgB", name: "Adam", gender: "male", accent: "American", description: "Deep", tier: "premium" },
  { id: "nPczCjzI2devNBz1zQrb", name: "Brian", gender: "male", accent: "American", description: "Deep, narration", tier: "free" },
  { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel", gender: "male", accent: "British", description: "News presenter", tier: "premium" },
  { id: "TxGEqnHWrfWFTfGW9XjX", name: "Josh", gender: "male", accent: "American", description: "Deep, young", tier: "premium" },
  { id: "ErXwobaYiN019PkySvjV", name: "Antoni", gender: "male", accent: "American", description: "Well-rounded", tier: "premium" },
];

/** Voice IDs available to free users (Rachel + Brian) */
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

// Cheapest model: Flash v2.5 — 0.5 credits/char, ~75ms latency
export const MODEL_ID = "eleven_flash_v2_5";

// MP3 44.1kHz 64kbps — good quality, small size
export const OUTPUT_FORMAT = "mp3_44100_64" as const;

// --- Speech generation ---

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

/**
 * Generate speech for a single text chunk using ElevenLabs convertWithTimestamps.
 *
 * Returns MP3 audio buffer + word-level boundaries derived from character alignment.
 * Optional `context` provides surrounding text for cross-chunk prosody continuity.
 */
export async function generateSpeechForChunk(
  text: string,
  voiceId: string,
  signal?: AbortSignal,
  context?: { previousText?: string; nextText?: string },
): Promise<ChunkResult> {
  const el = getClient();

  const response = await el.textToSpeech.convertWithTimestamps(voiceId, {
    text,
    modelId: MODEL_ID,
    outputFormat: OUTPUT_FORMAT,
    ...(context?.previousText ? { previousText: context.previousText } : {}),
    ...(context?.nextText ? { nextText: context.nextText } : {}),
  }, {
    abortSignal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(60_000)])
      : AbortSignal.timeout(60_000),
  });

  // Extract audio buffer from base64
  const audioBase64 = response.audioBase64 ?? "";
  const audioBuffer = Buffer.from(audioBase64, "base64");

  // Preserve raw alignment for combined mode (TranscriptViewer)
  const rawAlignment: ChunkAlignment | null = response.alignment
    ? {
        characters: response.alignment.characters ?? [],
        characterStartTimesSeconds: response.alignment.characterStartTimesSeconds ?? [],
        characterEndTimesSeconds: response.alignment.characterEndTimesSeconds ?? [],
      }
    : null;

  // Convert character-level alignment → word boundaries
  const boundaries = alignmentToWordBoundaries(
    response.alignment ?? null,
    text,
  );

  // Duration from last boundary end, or estimate from audio size
  const durationMs = boundaries.length > 0
    ? boundaries[boundaries.length - 1].offset + boundaries[boundaries.length - 1].duration
    : estimateMp3DurationMs(audioBuffer.length);

  return { audioBuffer, boundaries, alignment: rawAlignment, durationMs };
}

// --- Alignment conversion ---

interface AlignmentData {
  characters: string[];
  characterStartTimesSeconds: number[];
  characterEndTimesSeconds: number[];
}

/**
 * Convert ElevenLabs character-level alignment to word-level boundaries.
 *
 * Groups consecutive non-whitespace characters into words, using the first
 * character's start time and last character's end time for each word.
 * Uses forward-search for textOffset to handle repeated words correctly.
 */
function alignmentToWordBoundaries(
  alignment: AlignmentData | null,
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

/** Rough MP3 duration estimate: 64kbps = 8000 bytes/sec */
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

