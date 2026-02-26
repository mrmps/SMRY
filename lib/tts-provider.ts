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

/** Merged alignment across all chunks — used for article-level caching */
export interface MergedAlignment {
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
      ? AbortSignal.any([signal, AbortSignal.timeout(90_000)])
      : AbortSignal.timeout(90_000),
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

/**
 * Check if an MPEG frame at `offset` is a Xing/Info/VBRI encoder metadata frame.
 * These frames look like valid audio frames but contain stream metadata (total
 * frames count, byte offsets, TOC). When present in concatenated chunks, mobile
 * decoders (iOS Safari) read the metadata and think the stream ends after that
 * chunk's frame count — causing playback to "end" at chunk boundaries while
 * audio from pre-decoded buffers continues playing.
 *
 * Xing/Info marker offsets depend on MPEG version + channel mode:
 * - MPEG1 stereo/joint/dual: byte 36
 * - MPEG1 mono: byte 21
 * - MPEG2/2.5 stereo/joint/dual: byte 21
 * - MPEG2/2.5 mono: byte 13
 * VBRI is always at byte 36.
 */
function isEncoderInfoFrame(buffer: Buffer, frameOffset: number): boolean {
  const markerOffsets = [13, 21, 36];
  for (const off of markerOffsets) {
    const pos = frameOffset + off;
    if (pos + 4 > buffer.length) continue;
    const tag =
      String.fromCharCode(buffer[pos]) +
      String.fromCharCode(buffer[pos + 1]) +
      String.fromCharCode(buffer[pos + 2]) +
      String.fromCharCode(buffer[pos + 3]);
    if (tag === "Xing" || tag === "Info" || tag === "VBRI") return true;
  }
  return false;
}

/**
 * Compute the byte size of a single MPEG frame starting at `offset`.
 * Returns 0 if the frame header is invalid.
 */
function mpegFrameSize(buffer: Buffer, offset: number): number {
  if (offset + 4 > buffer.length) return 0;
  const b1 = buffer[offset + 1];
  const b2 = buffer[offset + 2];
  const ver = (b1 >> 3) & 0x03;
  const layer = (b1 >> 1) & 0x03;
  const brIdx = (b2 >> 4) & 0x0f;
  const srIdx = (b2 >> 2) & 0x03;
  const pad = (b2 >> 1) & 0x01;

  if (ver === 1 || layer === 0 || brIdx === 0 || brIdx === 15 || srIdx === 3) return 0;

  const brV1 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, -1];
  const brV2 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, -1];
  const srV1 = [44100, 48000, 32000, -1];
  const srV2 = [22050, 24000, 16000, -1];
  const srV25 = [11025, 12000, 8000, -1];

  let bitrate: number;
  let sampleRate: number;

  if (ver === 3) { bitrate = brV1[brIdx]; sampleRate = srV1[srIdx]; }
  else if (ver === 2) { bitrate = brV2[brIdx]; sampleRate = srV2[srIdx]; }
  else { bitrate = brV2[brIdx]; sampleRate = srV25[srIdx]; }

  if (bitrate <= 0 || sampleRate <= 0) return 0;
  return ver === 3
    ? Math.floor((144 * bitrate * 1000) / sampleRate) + pad
    : Math.floor((72 * bitrate * 1000) / sampleRate) + pad;
}

/**
 * Strip non-audio metadata (ID3v2 tags, Xing/Info/VBRI encoder frames) from
 * an MP3 buffer. Returns a sub-buffer starting at the first *real* audio frame.
 *
 * Used when concatenating multiple MP3 chunks: the first chunk keeps its
 * full headers, but chunks 2+ must have their headers stripped. Without this,
 * mobile audio decoders (especially iOS Safari) interpret the duplicate
 * headers mid-stream as corruption or a new stream, causing:
 * - False `ended` events at chunk boundaries
 * - `currentTime` freezing while audio continues from pre-decoded buffer
 * - Scrub bar and highlight animation stopping mid-playback
 */
export function stripMp3Metadata(buffer: Buffer): Buffer {
  let offset = 0;

  // Skip ID3v2 tag if present (starts with "ID3")
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

  // Scan for first valid MPEG frame sync (11 set bits: 0xFF followed by 0xE0+)
  while (offset + 1 < buffer.length) {
    if (buffer[offset] === 0xff && (buffer[offset + 1] & 0xe0) === 0xe0) {
      // Verify it's a valid frame header (not just random data matching the pattern)
      if (offset + 3 < buffer.length) {
        const b1 = buffer[offset + 1];
        const b2 = buffer[offset + 2];
        const ver = (b1 >> 3) & 0x03;
        const layer = (b1 >> 1) & 0x03;
        const brIdx = (b2 >> 4) & 0x0f;
        const srIdx = (b2 >> 2) & 0x03;
        // Skip reserved version (01), reserved layer (00), bad bitrate/samplerate
        if (ver !== 1 && layer !== 0 && brIdx !== 0 && brIdx !== 15 && srIdx !== 3) {
          // Check if this is a Xing/Info/VBRI encoder metadata frame.
          // These contain "total frames" metadata that causes mobile decoders
          // to stop at chunk boundaries in concatenated streams.
          if (isEncoderInfoFrame(buffer, offset)) {
            // Skip this frame entirely — advance past it to the next frame
            const frameLen = mpegFrameSize(buffer, offset);
            if (frameLen > 0) {
              offset += frameLen;
              continue; // Look for the next valid (non-metadata) frame
            }
          }
          return buffer.subarray(offset);
        }
      }
    }
    offset++;
  }

  // No valid frame found — return as-is (shouldn't happen with valid MP3)
  return buffer;
}

// --- Xing header generation for concatenated MP3 ---

/**
 * Generate a Xing VBR header frame for a concatenated MP3 stream.
 *
 * iOS Safari (and most mobile audio decoders) determine MP3 duration by reading
 * the Xing/Info header from the first MPEG frame. Without this header, iOS
 * estimates duration from the first chunk's bitrate + file size, producing a
 * wildly wrong duration that equals only the first chunk's length.
 *
 * The Xing frame is a valid MPEG audio frame with zeroed side info, containing:
 * - Total frame count (so iOS knows the real duration)
 * - Total byte count (so iOS knows the real file size)
 * - TOC seek table (so scrubbing works correctly)
 *
 * Uses "Xing" tag (not "Info") because iOS Safari has had bugs where "Info"
 * frames are not skipped properly for CBR content.
 *
 * @param audioBuffer - Raw MPEG audio data (all metadata stripped, no ID3/Xing)
 * @returns A single Xing header frame to prepend, or empty Buffer on failure
 */
export function generateXingFrame(audioBuffer: Buffer): Buffer {
  // Find the first valid MPEG frame to extract stream parameters
  let scanOffset = 0;
  while (scanOffset + 4 <= audioBuffer.length) {
    if (audioBuffer[scanOffset] !== 0xff || (audioBuffer[scanOffset + 1] & 0xe0) !== 0xe0) {
      scanOffset++;
      continue;
    }

    const b1 = audioBuffer[scanOffset + 1];
    const b2 = audioBuffer[scanOffset + 2];
    const b3 = audioBuffer[scanOffset + 3];
    const ver = (b1 >> 3) & 0x03;
    const layer = (b1 >> 1) & 0x03;
    const brIdx = (b2 >> 4) & 0x0f;
    const srIdx = (b2 >> 2) & 0x03;
    const channelMode = (b3 >> 6) & 0x03;

    if (ver === 1 || layer === 0 || brIdx === 0 || brIdx === 15 || srIdx === 3) {
      scanOffset++;
      continue;
    }

    // Skip any existing Xing/Info/VBRI frames
    if (isEncoderInfoFrame(audioBuffer, scanOffset)) {
      const fs = mpegFrameSize(audioBuffer, scanOffset);
      if (fs > 0) { scanOffset += fs; continue; }
    }

    // Found first valid audio frame — extract stream parameters
    const srV1 = [44100, 48000, 32000];
    const srV2 = [22050, 24000, 16000];
    const srV25 = [11025, 12000, 8000];

    let sampleRate: number;
    if (ver === 3) sampleRate = srV1[srIdx];
    else if (ver === 2) sampleRate = srV2[srIdx];
    else sampleRate = srV25[srIdx];

    if (sampleRate <= 0) return Buffer.alloc(0);

    // Count total MPEG frames in the audio buffer
    let totalFrames = 0;
    let countOffset = scanOffset;
    while (countOffset + 4 <= audioBuffer.length) {
      if (audioBuffer[countOffset] !== 0xff || (audioBuffer[countOffset + 1] & 0xe0) !== 0xe0) {
        countOffset++;
        continue;
      }
      const fs = mpegFrameSize(audioBuffer, countOffset);
      if (fs < 4 || countOffset + fs > audioBuffer.length) break;
      totalFrames++;
      countOffset += fs;
    }
    if (totalFrames === 0) return Buffer.alloc(0);

    // Build the Xing frame header using 128kbps (LAME convention — provides
    // plenty of room for the Xing data inside the frame).
    // For MPEG1 L3 128kbps 44100Hz: frame = floor(144*128000/44100) = 417 bytes
    const xingBrIdx = ver === 3 ? 9 : 8; // 128kbps for MPEG1, 64kbps for MPEG2/2.5
    const brV1 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
    const brV2 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
    const xingBitrate = ver === 3 ? brV1[xingBrIdx] : brV2[xingBrIdx];
    const xingFrameSize = ver === 3
      ? Math.floor((144 * xingBitrate * 1000) / sampleRate)
      : Math.floor((72 * xingBitrate * 1000) / sampleRate);

    // Xing tag offset = 4 (header) + side info size
    const isMono = channelMode === 3;
    const xingTagOffset = ver === 3
      ? (isMono ? 21 : 36)
      : (isMono ? 13 : 21);

    // Verify frame is large enough: tag(4) + flags(4) + frames(4) + bytes(4) + TOC(100) = 116
    if (xingFrameSize < xingTagOffset + 116) return Buffer.alloc(0);

    // Allocate zero-filled frame (side info = zeroed = silence)
    const frame = Buffer.alloc(xingFrameSize, 0);

    // Write frame header (4 bytes)
    frame[0] = 0xff;
    frame[1] = b1; // Same MPEG version, layer, CRC
    frame[2] = (xingBrIdx << 4) | (srIdx << 2); // Xing bitrate + same sample rate, no padding
    frame[3] = b3; // Same channel mode

    // Write "Xing" tag at the correct offset
    frame.write("Xing", xingTagOffset, "ascii");

    // Flags: frames + bytes + TOC = 0x0007
    frame.writeUInt32BE(0x00000007, xingTagOffset + 4);

    // Total frame count (audio frames + this Xing frame itself)
    frame.writeUInt32BE(totalFrames + 1, xingTagOffset + 8);

    // Total byte count (audio bytes + this Xing frame)
    frame.writeUInt32BE(audioBuffer.length + xingFrameSize, xingTagOffset + 12);

    // TOC: 100-entry seek table (linear for CBR content)
    const tocOffset = xingTagOffset + 16;
    const audioOnlySize = audioBuffer.length;
    const totalBytes = xingFrameSize + audioOnlySize;
    for (let i = 0; i < 100; i++) {
      const bytePos = xingFrameSize + Math.round((i / 100) * audioOnlySize);
      frame[tocOffset + i] = Math.min(255, Math.round((bytePos / totalBytes) * 256));
    }

    return frame;
  }

  return Buffer.alloc(0);
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
