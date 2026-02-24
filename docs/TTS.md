# TTS (Text-to-Speech) Dictation System

AI-powered article dictation with word-by-word highlighting. Uses Cartesia TTS (Sonic-2 model) for high-quality neural voices with streaming audio and word-level timestamps.

## Architecture

```
Browser                          Next.js Proxy              Elysia API Server
───────                          ──────────                 ─────────────────
1. Click "Listen" button    →    POST /api/tts         →    POST /api/tts
   { text, voice }               (120s timeout)              │
                                                             ├─ IP rate limit (10/min)
                                                             ├─ Auth check (premium vs free limit)
                                                             ├─ Concurrency slot (max 20 global, 2/user)
                                                             ├─ Split text into ~1000-char segments
                                                             ├─ For each segment:
                                                             │   ├─ Cartesia SSE API (30s timeout per call)
                                                             │   ├─ PCM audio chunks → WAV conversion
2. ← SSE stream             ←    Forward SSE          ←     │   └─ Word timestamps with global offsets
   event: boundary {word, offset, segment}                   └─ Release slot on done/error/disconnect
   event: audio {segment, chunk, final}
   event: done {segments}

3. Client collects audio per-segment → Blob when segment final
4. Segment 0 ready → playSegment(0) immediately (~2-3s)
5. Segment chaining: onended → play next segment (gapless)
6. requestAnimationFrame tracks global time (completedDuration + audio.currentTime)
   → maps to word boundary → CSS Custom Highlight API
7. Speed control via audio.playbackRate (0.5x–2x), persisted across segments
```

### Key design decisions

- **SSE over WebSocket**: SSE is simpler, works through proxies/CDNs, auto-reconnects. No bidirectional communication needed.
- **Chunked streaming (~1000 chars/segment)**: Text split into small segments sent to Cartesia sequentially. First segment plays in ~2-3s while remaining segments generate in the background. Avoids the previous single-call approach that caused >120s timeouts on long articles.
- **Segment-based playback**: Each segment produces a separate WAV Blob + `<Audio>` element. `onended` chains to the next segment for gapless playback. If the next segment isn't ready yet, the client shows "loading" until it arrives.
- **PCM-to-WAV on server**: Cartesia outputs raw PCM. We prepend a 44-byte WAV header server-side so the client uses simple `new Audio(blobUrl)`.
- **WAV duration from header (no decodeAudioData)**: Client extracts duration synchronously from WAV data sub-chunk size (`dataSize / 48000`), avoiding async AudioContext overhead.
- **CSS Custom Highlight API**: Highlights current word without modifying article DOM. Falls back silently on unsupported browsers.
- **No Cartesia SDK**: Raw `fetch()` to SSE endpoint (~200 lines). The JS SDK is browser-oriented; our server usage is a single POST.
- **30s per-chunk timeout**: Each Cartesia API call has a 30s `AbortSignal.timeout` to prevent single-chunk hangs from blocking the entire stream.
- **Browser playback rate for speed**: Generate at 1.0x, let `audio.playbackRate` handle 0.5x–2x. Avoids Cartesia's narrower 0.6–1.5x range. Rate persisted in `rateRef` and applied to each new segment's Audio element.

## Files

### Server
| File | Purpose |
|------|---------|
| `lib/cartesia-tts.ts` | Cartesia API client — SSE parsing, PCM→WAV, word timestamp flattening, voice list |
| `server/routes/tts.ts` | Elysia endpoint — auth, rate limiting, concurrency, text chunking, SSE streaming |
| `lib/tts-concurrency.ts` | Bounded concurrency limiter with per-user queuing, abort support, /health stats |
| `app/api/tts/route.ts` | Next.js SSE proxy with 120s timeout and IP forwarding |
| `app/api/tts/voices/route.ts` | Voice list proxy (1h cache) |

### Client
| File | Purpose |
|------|---------|
| `lib/hooks/use-tts.ts` | React hook — SSE parsing, segment-based playback with chaining, global word tracking, cross-segment skip, free tier enforcement |
| `components/features/tts-player.tsx` | Dark pill player — play/pause, skip, speed, progress bar, upgrade prompt |
| `components/features/tts-highlight.tsx` | Word highlighting via CSS Custom Highlight API with cached word index |

### Integration
| File | Changes |
|------|---------|
| `components/ui/icons.tsx` | VolumeHigh, Play, Pause, Stop, Forward, Backward, Speed, Headphones |
| `components/features/floating-toolbar.tsx` | "Listen" button (desktop) |
| `components/features/mobile-bottom-bar.tsx` | "Listen" button (mobile) |
| `components/features/proxy-content.tsx` | TTS state, keyboard shortcut (`L`), player + highlight rendering |
| `components/article/content.tsx` | `data-article-content` attribute for word highlighting |
| `server/index.ts` | Route registration, TTS concurrency config, /health TTS stats |
| `server/env.ts` | `CARTESIA_API_KEY` (optional), concurrency env vars |

## Cartesia API Details

### SSE Endpoint

```
POST https://api.cartesia.ai/tts/sse
Headers:
  X-API-Key: <CARTESIA_API_KEY>
  Cartesia-Version: 2024-06-10
  Content-Type: application/json

Body:
{
  "model_id": "sonic-2",
  "transcript": "Text to speak...",
  "voice": { "mode": "id", "id": "<voice-id>" },
  "output_format": {
    "container": "raw",
    "encoding": "pcm_s16le",
    "sample_rate": 24000
  },
  "language": "en",
  "add_timestamps": true
}
```

### Word Timestamps

Cartesia returns batched timestamps per SSE chunk:
```json
{
  "word_timestamps": {
    "words": ["Hello", "world"],
    "start": [0.0, 0.5],
    "end": [0.4, 0.9]
  }
}
```

Flattened to individual `WordBoundary` objects with forward-search for `textOffset`:
```json
[
  { "text": "Hello", "offset": 0, "duration": 400, "textOffset": 0, "textLength": 5 },
  { "text": "world", "offset": 500, "duration": 400, "textOffset": 6, "textLength": 5 }
]
```

### SSE Event Format

The server streams three event types:

**`boundary`** — word-level timestamp (emitted as Cartesia returns them):
```json
{ "text": "Hello", "offset": 0, "duration": 400, "textOffset": 0, "textLength": 5, "segment": 0 }
```
`offset` and `textOffset` are global (across all segments).

**`audio`** — base64 WAV chunk for a segment:
```json
{ "segment": 0, "chunk": "<base64>", "index": 0, "final": true }
```
Large segments may have multiple chunks (`index` 0, 1, 2...). `final: true` marks the last chunk for that segment.

**`done`** — stream complete:
```json
{ "segments": 9 }
```

### Audio Format

- Codec: PCM → WAV (44-byte RIFF header prepended server-side)
- Sample rate: 24 kHz
- Bit depth: 16-bit signed little-endian mono
- Typical size per segment: ~350-700 KB (1000 chars → ~7-10s audio)
- Total per article: ~2.8 MB per minute of audio

### Voice List

```
GET https://api.cartesia.ai/voices
Headers:
  X-API-Key: <CARTESIA_API_KEY>
  Cartesia-Version: 2024-06-10
```

Filtered to `language === "en"` and `is_public === true`. Cached for 1 hour.

Default voice: `79a125e8-cd45-4c13-8a67-188112f4dd22` ("Barbershop Man")

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
│ Metrics:     /health endpoint stats     │
└─────────────────────────────────────────┘
```

### Rate Limiting (3 layers)

| Layer | Mechanism | Limit | Scope |
|-------|-----------|-------|-------|
| IP rate limit | In-memory sliding window | 10 req/min per IP | All users |
| Monthly quota | Redis (primary) + in-memory (fallback) | 3 articles/month | Free users |
| Concurrency | Slot limiter | 20 global, 2 per user | All users |

### Memory Safety

| Concern | Mitigation |
|---------|-----------|
| Audio buffer growth | ~1000 chars per Cartesia call (not full article). WAV files capped by text limit (50KB text → ~14MB total) |
| Blob URL leaks | `cleanupAudio()` revokes all segment blob URLs on stop(), unmount, and play() restart |
| SSE backpressure | Stream `cancel()` handler aborts Cartesia request on client disconnect |
| Per-chunk timeout | 30s `AbortSignal.timeout` per Cartesia call prevents single-segment hangs |
| Per-request tracking | `startMemoryTrack()` instruments every TTS synthesis |

### Client Segment Playback (`use-tts.ts`)

```
Segment lifecycle:
  SSE audio events arrive → segmentChunksRef (Map<segIdx, string[]>)
  final: true → finalizeSegment(idx):
    1. Join base64 chunks → decode → Blob → blobUrl
    2. Extract WAV duration from header bytes (sync, no AudioContext)
    3. Store in segmentBlobUrlsRef + segmentDurationsRef
    4. If segment 0 and still "loading" → playSegment(0)
    5. If pendingPlay and this is the next needed segment → playSegment(idx)

Segment chaining:
  Audio.onended →
    next segment blob exists? → playSegment(nextIdx)
    stream done, no more?    → set status "idle"
    next not ready yet?      → set pendingPlay=true, status "loading"

Global time tracking:
  globalTimeMs = (completedDurationRef + audio.currentTime) * 1000
  completedDurationRef accumulates durations of all finished segments
  Word boundaries use global offsets → forward-scan + binary-search fallback

Cross-segment skip (±10s):
  Calculate target global time
  Iterate segment durations to find containing segment
  Same segment → audio.currentTime = localTime
  Different segment → update completedDuration, playSegment(targetIdx, startTime)
```

### Memory Estimates (100 concurrent users)

```
Per user (chunked streaming):
  Server WAV buffer:       ~350-700 KB per segment (only 1 segment in flight)
  Base64 encoding:         +33% overhead per segment
  Word boundaries:         ~100 KB (10K words × 10 bytes, accumulated)
  Total server per user:   ~1-2 MB peak (single segment + boundaries)

  Client per tab:          ~5-20 MB (all segment blobs kept for seeking)
  Client per segment:      ~350-700 KB (blob URL per segment)

100 concurrent:
  Server peak:             100-200 MB (vs previous 500 MB - 2 GB)
  Client per tab:          ~5-20 MB (audio blobs + word index)
```

### Failure Modes

| Scenario | Behavior |
|----------|----------|
| Cartesia API error | Error event sent to client, "TTS generation failed" |
| Cartesia service down | 503 returned, error displayed in player |
| Server overloaded (20 slots full) | Queue with 15s timeout, then 503 "TTS service busy" |
| User spamming requests | IP rate limit (429), per-user concurrency limit (429) |
| Client disconnects mid-stream | AbortSignal cancels Cartesia request, releases slot |
| Single segment hangs | 30s per-chunk timeout aborts that Cartesia call; error propagated to client |
| Segment gap during playback | Client shows "loading" status until next segment arrives, then auto-resumes |
| Redis down | In-memory fallback enforces monthly limit |

## Performance (Chunked Streaming)

| Metric | Before (single call) | After (chunked) |
|--------|---------------------|------------------|
| Time to first audio | >120s (failed/timed out) | ~2-3s |
| Total generation time | >120s | ~20-30s (sequential segments) |
| Server memory per segment | Full article WAV (~5-20 MB) | ~350-700 KB (1000 chars) |
| Cartesia calls per article | 1 (huge) | ~N (1000-char chunks) |
| Timeout risk | High (single long call) | Low (30s per chunk) |

Key constants:
- `MAX_CHUNK = 1000` chars per segment (in `server/routes/tts.ts`)
- `AbortSignal.timeout(30_000)` per Cartesia call (in `lib/cartesia-tts.ts`)
- `Cartesia-Version: 2024-06-10` (reverted from `2025-04-16` to avoid hangs)

## Configuration

### Environment Variables (server/env.ts)

| Variable | Default | Description |
|----------|---------|-------------|
| `CARTESIA_API_KEY` | — | Cartesia API key (TTS disabled when absent) |
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

## Free Tier Limits

**Free users**: 3 articles/month

### Enforcement layers

1. **Client-side** (localStorage): `tts-articles-{YYYY-MM}` stores array of article URLs
2. **Server-side** (Redis primary): `tts-usage:{userId}:{YYYY-MM}` integer counter with monthly TTL
3. **Server-side** (in-memory fallback): Used when Redis is down. Bounded at 5K entries
4. **Anonymous users**: Client-side only enforcement

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `L` | Toggle TTS (start playing / stop) |

## Browser Support

| Feature | Support |
|---------|---------|
| Audio playback (WAV) | All modern browsers |
| SSE streaming | All modern browsers |
| CSS Custom Highlight API | Chrome 105+, Edge 105+, Safari 17.2+ |
| Word highlighting fallback | No highlighting on Firefox (audio still works) |
