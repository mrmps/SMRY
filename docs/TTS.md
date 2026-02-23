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
                                                             ├─ Cartesia SSE API (word timestamps ON)
                                                             │   ├─ PCM audio chunks → WAV conversion
2. ← SSE stream             ←    Forward SSE          ←     │   └─ Word timestamp metadata
   event: boundary {word, offset, duration}                  └─ Release slot on done/error/disconnect
   event: audio {base64 chunk}
   event: done {}

3. Client collects audio chunks → Blob (audio/wav) → <Audio> element
4. requestAnimationFrame tracks audio.currentTime
   → maps to word boundary → CSS Custom Highlight API
5. Speed control via audio.playbackRate (0.5x–2x)
```

### Key design decisions

- **SSE over WebSocket**: SSE is simpler, works through proxies/CDNs, auto-reconnects. No bidirectional communication needed.
- **Full audio before playback**: Audio chunks collected into a Blob, then played via `<audio>`. Avoids MediaSource API complexity.
- **PCM-to-WAV on server**: Cartesia outputs raw PCM. We prepend a 44-byte WAV header server-side so the client uses simple `new Audio(blobUrl)`.
- **CSS Custom Highlight API**: Highlights current word without modifying article DOM. Falls back silently on unsupported browsers.
- **No Cartesia SDK**: Raw `fetch()` to SSE endpoint (~200 lines). The JS SDK is browser-oriented; our server usage is a single POST.
- **Browser playback rate for speed**: Generate at 1.0x, let `audio.playbackRate` handle 0.5x–2x. Avoids Cartesia's narrower 0.6–1.5x range.

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
| `lib/hooks/use-tts.ts` | React hook — SSE parsing, audio playback, word tracking, free tier enforcement |
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

### Audio Format

- Codec: PCM → WAV (44-byte RIFF header prepended server-side)
- Sample rate: 24 kHz
- Bit depth: 16-bit signed little-endian mono
- Typical size: ~2.8 MB per minute (WAV), ~14 MB for a 5-minute article

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
| Audio buffer growth | WAV files capped by text limit (50KB text → ~14MB WAV max) |
| Blob URL leaks | `cleanupAudio()` revokes URL on stop(), unmount, and play() restart |
| SSE backpressure | Stream `cancel()` handler aborts Cartesia request on client disconnect |
| Per-request tracking | `startMemoryTrack()` instruments every TTS synthesis |

### Memory Estimates (100 concurrent users)

```
Per user:
  WAV buffer (server):     ~3-14 MB (typical article)
  Base64 encoding:         +33% overhead
  Word boundaries:         ~100 KB (10K words × 10 bytes)
  Total per user:          ~5-20 MB

100 concurrent:
  Server peak:             500 MB - 2 GB (larger than MP3 due to WAV)
  Client per tab:          ~5-20 MB (audio blob + word index)
```

### Failure Modes

| Scenario | Behavior |
|----------|----------|
| Cartesia API error | Error event sent to client, "TTS generation failed" |
| Cartesia service down | 503 returned, error displayed in player |
| Server overloaded (20 slots full) | Queue with 15s timeout, then 503 "TTS service busy" |
| User spamming requests | IP rate limit (429), per-user concurrency limit (429) |
| Client disconnects mid-stream | AbortSignal cancels Cartesia request, releases slot |
| Redis down | In-memory fallback enforces monthly limit |

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
