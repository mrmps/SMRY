/**
 * Cartesia TTS client for speech synthesis with word-level timestamps.
 *
 * Uses the Cartesia SSE endpoint (POST /tts/sse) to generate PCM audio
 * with word timestamps, then converts to WAV for browser playback.
 *
 * No SDK dependency — raw fetch + SSE parsing (~200 lines).
 */

// --- Config ---

let apiKey: string | null = null;

export function initCartesiaTTS(key: string): void {
  apiKey = key;
}

function getApiKey(): string {
  if (!apiKey) {
    throw new Error("Cartesia TTS not initialized — call initCartesiaTTS() at startup");
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

interface CartesiaWordTimestamps {
  words: string[];
  start: number[];
  end: number[];
}

interface CartesiaChunkData {
  data?: string; // base64 PCM audio
  word_timestamps?: CartesiaWordTimestamps;
  done?: boolean;
}

export interface CartesiaVoice {
  id: string;
  name: string;
  language: string;
}

// Default voice: Sonic-2 English
export const DEFAULT_VOICE_ID = "79a125e8-cd45-4c13-8a67-188112f4dd22"; // "Barbershop Man"

// --- PCM to WAV conversion ---

/**
 * Prepend a 44-byte RIFF/WAVE header to raw PCM data.
 */
export function pcmToWav(
  pcmBuffer: Buffer,
  sampleRate = 24000,
  channels = 1,
  bitsPerSample = 16,
): Buffer {
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);
  const dataSize = pcmBuffer.length;
  const headerSize = 44;

  const header = Buffer.alloc(headerSize);

  // RIFF chunk descriptor
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4); // ChunkSize
  header.write("WAVE", 8);

  // fmt sub-chunk
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // Subchunk1Size (PCM)
  header.writeUInt16LE(1, 20); // AudioFormat (PCM = 1)
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);

  // data sub-chunk
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]);
}

// --- Speech generation ---

/**
 * Generate speech audio + word boundaries from Cartesia SSE endpoint.
 * Returns WAV audio buffer and flattened word boundaries.
 */
export async function generateSpeech(
  text: string,
  voiceId: string,
  signal?: AbortSignal,
): Promise<{ audio: Buffer; boundaries: WordBoundary[] }> {
  const key = getApiKey();

  const response = await fetch("https://api.cartesia.ai/tts/sse", {
    method: "POST",
    headers: {
      "X-API-Key": key,
      "Cartesia-Version": "2024-06-10",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model_id: "sonic-2",
      transcript: text,
      voice: { mode: "id", id: voiceId },
      output_format: {
        container: "raw",
        encoding: "pcm_s16le",
        sample_rate: 24000,
      },
      language: "en",
      add_timestamps: true,
    }),
    signal,
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => "");
    throw new Error(`Cartesia API error ${response.status}: ${errBody}`);
  }

  const body = response.body;
  if (!body) throw new Error("No response body from Cartesia");

  // Parse SSE stream
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const pcmChunks: Buffer[] = [];
  const allBoundaries: WordBoundary[] = [];

  while (true) {
    if (signal?.aborted) throw new Error("TTS request aborted by client");

    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    let eventType = "";
    for (const line of lines) {
      if (line.startsWith("event:")) {
        eventType = line.slice(6).trim();
      } else if (line.startsWith("data:") && eventType) {
        const dataStr = line.slice(5).trim();
        if (!dataStr) { eventType = ""; continue; }

        try {
          const data = JSON.parse(dataStr) as CartesiaChunkData;

          // Accumulate PCM audio
          if (data.data) {
            pcmChunks.push(Buffer.from(data.data, "base64"));
          }

          // Flatten word timestamps into boundaries
          if (data.word_timestamps) {
            const ts = data.word_timestamps;
            for (let i = 0; i < ts.words.length; i++) {
              const word = ts.words[i];
              const startMs = Math.round(ts.start[i] * 1000);
              const endMs = Math.round(ts.end[i] * 1000);

              // Forward-search for textOffset in the original text
              const textOffset = findWordOffset(text, word, allBoundaries);

              allBoundaries.push({
                text: word,
                offset: startMs,
                duration: endMs - startMs,
                textOffset,
                textLength: word.length,
              });
            }
          }
        } catch {
          // Skip malformed JSON
        }
        eventType = "";
      }
    }
  }

  // Convert accumulated PCM to WAV
  const pcmBuffer = Buffer.concat(pcmChunks);
  const wavBuffer = pcmToWav(pcmBuffer);

  return { audio: wavBuffer, boundaries: allBoundaries };
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

// --- Voice list ---

/**
 * Fetch available voices from Cartesia, filtered to English.
 */
export async function fetchCartesiaVoices(): Promise<CartesiaVoice[]> {
  const key = getApiKey();

  const response = await fetch("https://api.cartesia.ai/voices", {
    headers: {
      "X-API-Key": key,
      "Cartesia-Version": "2024-06-10",
    },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Cartesia voices: ${response.status}`);
  }

  const voices = (await response.json()) as Array<{
    id: string;
    name: string;
    language: string;
    is_public: boolean;
  }>;

  return voices
    .filter((v) => v.language === "en" && v.is_public)
    .map((v) => ({
      id: v.id,
      name: v.name,
      language: v.language,
    }));
}
