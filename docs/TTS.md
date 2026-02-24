# TTS (Text-to-Speech) Dictation System

AI-powered article dictation with word-by-word highlighting. Uses ElevenLabs TTS (Flash v2.5 model) for high-quality neural voices with character-level alignment and MP3 audio.

## Architecture

```
Browser                          Next.js Proxy              Elysia API Server
───────                          ──────────                 ─────────────────
1. Click "Listen" button    →    POST /api/tts         →    POST /api/tts
   { text, voice }               (120s timeout)              │
                                                             ├─ IP rate limit (10/min)
                                                             ├─ Auth check (premium vs free limit)
                                                             ├─ Concurrency slot (max 20 global, 2/user)
                                                             ├─ Clean text (strip ads, junk patterns)
                                                             ├─ Split into ~1000-char chunks
                                                             ├─ Per-chunk LRU cache lookup (SHA-256 key)
                                                             ├─ Cache hits → skip synthesis
                                                             ├─ Cache misses → parallel synthesis (max 3)
                                                             │   └─ ElevenLabs convertWithTimestamps()
                                                             │       → MP3 audio + character alignment
                                                             ├─ Concatenate audio chunks, merge alignment
2. ← JSON response          ←    Forward JSON          ←    └─ Return { audioBase64, alignment, durationMs }

3. Client decodes base64 → Blob URL for <audio>
4. TranscriptViewer syncs playback to word boundaries
5. useTTSHighlight wraps article words in <span>, toggles CSS classes
6. Speed control via audio.playbackRate (0.5x–3x)
```

### Key design decisions

- **Single JSON response (not SSE)**: One API call returns all audio + alignment as JSON. Simpler than SSE streaming — the per-chunk server-side cache makes subsequent plays instant.
- **Per-chunk LRU cache**: SHA-256(text + voice) keys. Cached chunks skip synthesis entirely — only uncached chunks consume concurrency slots. Max 500MB, 1-hour TTL.
- **Parallel chunk synthesis**: Up to 3 concurrent ElevenLabs API calls for uncached chunks, reducing total generation time.
- **Character-level alignment**: ElevenLabs `convertWithTimestamps()` returns per-character start/end times. Converted to word boundaries via `alignmentToWordBoundaries()`.
- **Span-wrapping highlighting**: Words wrapped in `<span data-tts-idx="N">` with CSS class toggling (`tts-spoken`, `tts-current`, `tts-unspoken`). MutationObserver re-wraps on article DOM changes.
- **Click-to-seek**: Clicking any highlighted word seeks audio to that word's start time.
- **Client-side IndexedDB cache**: Audio blobs cached for 7 days (max 50 entries), avoiding repeat server calls.
- **TranscriptViewer compound components**: `TranscriptViewerContainer` + context provides `play()`, `pause()`, `seekToTime()`, `currentWordIndex` etc. to child controls.
- **Browser playback rate for speed**: Generate at 1.0x, let `audio.playbackRate` handle 0.5x–3x.
- **30s per-chunk timeout**: Each ElevenLabs call has `AbortSignal.timeout(30_000)`.

## Files

### Server
| File | Purpose |
|------|---------|
| `lib/elevenlabs-tts.ts` | ElevenLabs API client — `convertWithTimestamps()`, character→word alignment, voice presets |
| `server/routes/tts.ts` | Elysia endpoint — auth, rate limiting, concurrency, per-chunk caching, text chunking |
| `lib/tts-concurrency.ts` | Bounded concurrency limiter with per-user queuing, abort support, /health stats |
| `lib/tts-chunk.ts` | Shared text cleaning (`cleanTextForTTS`), chunking (`splitTTSChunks`), SHA-256 hashing |
| `lib/tts-text.ts` | DOM text extraction (`extractTTSText`) and word position mapping (`buildWordPositions`) |
| `app/api/tts/route.ts` | Next.js JSON proxy with 120s timeout and IP forwarding |

### Client
| File | Purpose |
|------|---------|
| `lib/hooks/use-tts.ts` | React hook — API calls, blob URL management, IndexedDB caching, usage tracking |
| `components/hooks/use-tts-highlight.ts` | Word highlighting via span-wrapping with MutationObserver recovery, click-to-seek |
| `components/hooks/use-transcript-viewer.ts` | Audio playback state, word timing sync (RAF + binary search), segment composition |
| `components/ui/transcript-viewer.tsx` | Compound component system — Container, Audio, PlayPauseButton, ScrubBar, Words |

### Integration
| File | Changes |
|------|---------|
| `components/ui/icons.tsx` | VolumeHigh, Play, Pause, Stop, Forward, Backward, Speed, Headphones, X |
| `components/features/floating-toolbar.tsx` | "Listen" button (desktop) |
| `components/features/mobile-bottom-bar.tsx` | "Listen" button (mobile) |
| `components/features/proxy-content.tsx` | TTS state, keyboard shortcut (`L`), TTSControls with header + control rows |
| `components/article/content.tsx` | `data-article-content` attribute for word highlighting |
| `server/index.ts` | Route registration, TTS concurrency config, /health TTS stats |
| `server/env.ts` | `ELEVENLABS_API_KEY` (optional), concurrency env vars |

## ElevenLabs API Details

### Speech Generation

```
POST via ElevenLabs SDK: textToSpeech.convertWithTimestamps(voiceId, options)

Options:
{
  text: "Text to speak...",
  modelId: "eleven_flash_v2_5",
  outputFormat: "mp3_44100_64"
}
```

Returns:
- `audioBase64` — MP3 audio encoded as base64
- `alignment` — Character-level timing data

### Character Alignment

ElevenLabs returns per-character timestamps:
```json
{
  "alignment": {
    "characters": ["H", "e", "l", "l", "o", " ", "w", "o", "r", "l", "d"],
    "characterStartTimesSeconds": [0.0, 0.05, 0.1, 0.15, 0.2, 0.3, 0.5, 0.55, 0.6, 0.65, 0.7],
    "characterEndTimesSeconds":   [0.05, 0.1, 0.15, 0.2, 0.3, 0.4, 0.55, 0.6, 0.65, 0.7, 0.9]
  }
}
```

Converted to word-level `WordBoundary` objects with forward-search for `textOffset`:
```json
[
  { "text": "Hello", "offset": 0, "duration": 300, "textOffset": 0, "textLength": 5 },
  { "text": "world", "offset": 500, "duration": 400, "textOffset": 6, "textLength": 5 }
]
```

### Audio Format

- Codec: MP3
- Sample rate: 44.1 kHz
- Bitrate: 64 kbps
- Typical size per chunk: ~60-120 KB (1000 chars → ~7-10s audio)
- Total per article: ~500 KB per minute of audio

### Voice Presets

10 curated voices stored in `VOICE_PRESETS` (`lib/elevenlabs-tts.ts`):

| Name | Gender | Accent | Description |
|------|--------|--------|-------------|
| Rachel (default) | Female | American | Calm, clear |
| Sarah | Female | American | Soft, news |
| Matilda | Female | American | Warm |
| Lily | Female | British | Raspy |
| Alice | Female | British | Confident |
| Adam | Male | American | Deep |
| Brian | Male | American | Deep, narration |
| Daniel | Male | British | News presenter |
| Josh | Male | American | Deep, young |
| Antoni | Male | American | Well-rounded |

## Control Layout

The TTS floating player uses a two-row layout:

```
┌───────────────────────────────────────────────────┐
│ NOW PLAYING                                  [✕]  │  ← header row
│ [Voice] [⏪] [⏯] [⏩] [═══ scrub ═══]      [1x] │  ← controls row
└───────────────────────────────────────────────────┘
```

- **Header row**: "Now Playing" label (left) + close button (top-right)
- **Controls row**: Voice picker, skip ±10s, play/pause, scrub bar, speed selector
- **Panel width**: 520px desktop, `calc(100vw - 1.5rem)` mobile (max 520px)

## Scalability Design (30K DAU, 100+ concurrent)

### Concurrency Control

```
┌─────────────────────────────────────────┐
│         TTS Concurrency Limiter         │
├─────────────────────────────────────────┤
│ Global max:  20 concurrent requests     │
│ Per-user:    2 concurrent requests      │
│ Queue:       FIFO with 15s timeout      │
│ Abort:       Client disconnect cleanup  │
│ ElevenLabs:  3 concurrent API calls     │
│ Metrics:     /health endpoint stats     │
└─────────────────────────────────────────┘
```

### Rate Limiting (3 layers)

| Layer | Mechanism | Limit | Scope |
|-------|-----------|-------|-------|
| IP rate limit | In-memory sliding window | 10 req/min per IP | All users |
| Daily quota | Redis (primary) + in-memory (fallback) | 3 articles/day | Free users (incremented after success only) |
| Concurrency | Slot limiter | 20 global, 2 per user | All users |

### Per-Chunk Caching

| Property | Value |
|----------|-------|
| Cache key | SHA-256(chunkText + voiceId) |
| Max size | 500 MB |
| TTL | 1 hour |
| Scope | Server-side LRU |
| Effect | Cached chunks skip synthesis + concurrency slot |

### Memory Safety

| Concern | Mitigation |
|---------|-----------|
| Audio buffer growth | ~1000 chars per ElevenLabs call (not full article). MP3 much smaller than WAV |
| Blob URL leaks | `stop()` revokes blob URLs on cleanup and unmount |
| Client disconnect | AbortSignal cancels ElevenLabs request, releases concurrency slot |
| Per-chunk timeout | 30s `AbortSignal.timeout` per ElevenLabs call |
| Per-request tracking | `startMemoryTrack()` instruments every TTS synthesis |
| Client-side cache | IndexedDB, max 50 entries, 7-day TTL |

### Memory Estimates (100 concurrent users)

```
Per user:
  Server per chunk:      ~60-120 KB (MP3, much smaller than PCM/WAV)
  Server per article:    ~500 KB - 2 MB (all chunks, before caching)
  Client per tab:        ~1-5 MB (all chunk blobs kept for seeking)

100 concurrent:
  Server peak:           50-200 MB (most served from cache)
  Client per tab:        ~1-5 MB (MP3 audio blobs)
```

### Failure Modes

| Scenario | Behavior |
|----------|----------|
| ElevenLabs API error | Error returned in JSON, displayed in player |
| ElevenLabs service down | 503 returned, error displayed in player |
| Server overloaded (20 slots full) | Queue with 15s timeout, then 503 "TTS service busy" |
| User spamming requests | IP rate limit (429), per-user concurrency limit (429) |
| Client disconnects mid-generation | AbortSignal cancels ElevenLabs request, releases slot |
| Single chunk hangs | 30s per-chunk timeout aborts that call; error propagated |

## Configuration

### Environment Variables (server/env.ts)

| Variable | Default | Description |
|----------|---------|-------------|
| `ELEVENLABS_API_KEY` | — | ElevenLabs API key (TTS disabled when absent) |
| `MAX_CONCURRENT_TTS` | 20 | Global max simultaneous TTS requests |
| `MAX_TTS_PER_USER` | 2 | Per-user max concurrent TTS requests |
| `TTS_SLOT_TIMEOUT_MS` | 15000 | Max wait time in concurrency queue (ms) |

## Monitoring

### /health endpoint

```json
{
  "tts": {
    "activeSlots": 5,
    "queuedRequests": 2,
    "maxConcurrentTTS": 20,
    "maxPerUser": 2,
    "perUserBreakdown": { "user_abc": 1, "user_xyz": 2 },
    "totalAcquired": 1234,
    "totalRejected": 12,
    "totalTimedOut": 3,
    "peakConcurrent": 18
  }
}
```

### Log patterns

| Pattern | Logger | Meaning |
|---------|--------|---------|
| `TTS synthesis started` | `api:tts` | New TTS request accepted |
| `TTS streaming error` | `api:tts` | Synthesis failed mid-stream |
| `TTS stream cancelled by client` | `api:tts` | Client disconnected |
| `TTS request queued` | `tts:concurrency` | All slots full, request waiting |
| `memory_operation` name=`tts-synthesis` | `memory-tracker` | Per-request memory delta |

### Response Headers

| Header | Description |
|--------|-------------|
| `X-TTS-Usage-Count` | Current daily usage count (free users only) |
| `X-TTS-Usage-Limit` | Daily limit (3 for free, Infinity for premium) |
| `X-TTS-Cache` | "hit" if all chunks served from cache |

## Free Tier Limits

**Free users**: 3 articles/day

### Enforcement layers

1. **Client-side** (localStorage): Tracks daily article URLs
2. **Server-side** (Redis primary): `tts-usage:{userId}:{YYYY-MM-DD}` counter with daily TTL
3. **Server-side** (in-memory fallback): Used when Redis is down. Bounded at 5K entries
4. **Anonymous users**: Client-side only enforcement

**Important**: The daily quota counter is incremented *after* successful audio generation only. If generation fails (e.g., concurrency timeout, ElevenLabs error), the user's count is not consumed.

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `L` | Toggle TTS (start playing / stop) |

## Browser Support

| Feature | Support |
|---------|---------|
| Audio playback (MP3) | All modern browsers |
| Span-based word highlighting | All modern browsers |
| MutationObserver (highlight recovery) | All modern browsers |
| Click-to-seek on words | All modern browsers |
