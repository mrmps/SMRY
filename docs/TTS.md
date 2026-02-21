# TTS (Text-to-Speech) Dictation System

AI-powered article dictation with word-by-word highlighting. Uses Microsoft Edge TTS for free, high-quality neural voices with streaming audio and word boundary events.

## Architecture

```
Browser                          Next.js Proxy              Elysia API Server
───────                          ──────────                 ─────────────────
1. Click "Listen" button    →    POST /api/tts         →    POST /api/tts
   { text, voice, rate }         (120s timeout)              │
                                                             ├─ IP rate limit (10/min)
                                                             ├─ Auth check (premium vs free limit)
                                                             ├─ Concurrency slot (max 20 global, 2/user)
                                                             ├─ Edge TTS WebSocket (word boundaries ON)
                                                             │   ├─ Audio chunks (mp3)
2. ← SSE stream             ←    Forward SSE          ←     │   └─ Word boundary metadata
   event: boundary {word, offset, duration}                  └─ Release slot on done/error/disconnect
   event: audio {base64 chunk}
   event: done {}

3. Client collects audio chunks → Blob → <Audio> element
4. requestAnimationFrame tracks audio.currentTime
   → maps to word boundary → CSS Custom Highlight API
```

### Key design decisions

- **SSE over WebSocket**: SSE is simpler, works through proxies/CDNs, auto-reconnects. We don't need bidirectional communication.
- **Full audio before playback**: Audio chunks are collected into a Blob, then played via `<audio>`. This avoids MediaSource API complexity and works reliably across browsers.
- **CSS Custom Highlight API**: Highlights the current word without modifying the article DOM (no span wrapping). Falls back silently on unsupported browsers.
- **Edge TTS over Web Speech API**: Edge TTS provides consistent, high-quality neural voices across all browsers/platforms. Web Speech API quality varies wildly.

## Files

### Server
| File | Purpose |
|------|---------|
| `server/routes/tts.ts` | Elysia endpoint — auth, rate limiting, concurrency, Edge TTS WebSocket, SSE streaming |
| `lib/tts-concurrency.ts` | Bounded concurrency limiter with per-user queuing, abort support, /health stats |
| `app/api/tts/route.ts` | Next.js SSE proxy with 120s timeout and IP forwarding |
| `app/api/tts/voices/route.ts` | Voice list proxy (1h cache) |

### Client
| File | Purpose |
|------|---------|
| `lib/hooks/use-tts.ts` | React hook — SSE parsing, audio playback, word tracking, free tier enforcement |
| `components/features/tts-player.tsx` | Player panel — play/pause, skip, speed, progress bar, upgrade prompt |
| `components/features/tts-highlight.tsx` | Word highlighting via CSS Custom Highlight API with cached word index |

### Integration
| File | Changes |
|------|---------|
| `components/ui/icons.tsx` | Added VolumeHigh, Play, Pause, Stop, Forward, Backward, Speed, Headphones |
| `components/features/floating-toolbar.tsx` | "Listen" button (desktop) |
| `components/features/mobile-bottom-bar.tsx` | "Listen" button (mobile) |
| `components/features/proxy-content.tsx` | TTS state, keyboard shortcut (`L`), player + highlight rendering |
| `components/article/content.tsx` | `data-article-content` attribute for word highlighting |
| `server/index.ts` | Route registration, TTS concurrency config, /health TTS stats |
| `server/env.ts` | Optional env vars: `MAX_CONCURRENT_TTS`, `MAX_TTS_PER_USER`, `TTS_SLOT_TIMEOUT_MS` |

## Scalability Design (30K DAU, 100+ concurrent)

### Concurrency Control

The TTS concurrency limiter (`lib/tts-concurrency.ts`) mirrors the article fetch limiter pattern:

```
┌─────────────────────────────────────────┐
│         TTS Concurrency Limiter         │
├─────────────────────────────────────────┤
│ Global max:  20 concurrent WebSockets   │
│ Per-user:    2 concurrent requests      │
│ Queue:       FIFO with 15s timeout      │
│ Abort:       Client disconnect cleanup  │
│ Metrics:     /health endpoint stats     │
└─────────────────────────────────────────┘
```

**Why 20 max?** Edge TTS uses a free Microsoft token. Too many concurrent connections from one IP risks rate limiting/bans. 20 connections at ~30s each supports ~40 requests/minute throughput.

**Why 2 per user?** Prevents a single user from monopolizing slots (e.g., opening multiple tabs).

### Rate Limiting (3 layers)

| Layer | Mechanism | Limit | Scope |
|-------|-----------|-------|-------|
| IP rate limit | In-memory sliding window | 10 req/min per IP | All users |
| Monthly quota | Redis (primary) + in-memory (fallback) | 3 articles/month | Free users |
| Concurrency | Slot limiter | 20 global, 2 per user | All users |

**Redis fallback**: When Redis is down, in-memory cache prevents unlimited usage (unlike the original which silently allowed unlimited). Cache bounded at 5K entries.

### Memory Safety

| Concern | Mitigation |
|---------|-----------|
| Audio buffer growth | Hard cap at 50MB per request — synthesis aborted if exceeded |
| Blob URL leaks | `cleanupAudio()` revokes URL on stop(), unmount, and play() restart |
| SSE backpressure | Stream `cancel()` handler aborts synthesis on client disconnect |
| WebSocket orphans | AbortSignal propagated to WebSocket, explicit close on timeout/abort/error |
| Per-request tracking | `startMemoryTrack()` instruments every TTS synthesis |

### Memory Estimates (100 concurrent users)

```
Per user:
  Audio buffer (server):     ~2-5 MB (typical article)
  Base64 encoding:           +33% overhead
  Word boundaries:           ~100 KB (10K words × 10 bytes)
  Total per user:            ~3-7 MB

100 concurrent:
  Server peak:               300-700 MB (well within 1GB threshold)
  Client per tab:            ~5-10 MB (audio blob + word index)
```

### Failure Modes

| Scenario | Behavior |
|----------|----------|
| Edge TTS WebSocket timeout | Chunk-level timeout (10-30s adaptive), error event to client |
| Edge TTS service down | Error returned, client shows "TTS generation failed" |
| Server overloaded (20 slots full) | Queue with 15s timeout, then 503 "TTS service busy" |
| User spamming requests | IP rate limit (429), per-user concurrency limit (429) |
| Client disconnects mid-stream | AbortSignal closes WebSocket, releases concurrency slot |
| Redis down | In-memory fallback enforces monthly limit |
| Audio too large | 50MB cap, synthesis aborted |

## Configuration

### Environment Variables (server/env.ts)

| Variable | Default | Description |
|----------|---------|-------------|
| `MAX_CONCURRENT_TTS` | 20 | Global max simultaneous Edge TTS WebSocket connections |
| `MAX_TTS_PER_USER` | 2 | Per-user max concurrent TTS requests |
| `TTS_SLOT_TIMEOUT_MS` | 15000 | Max wait time in concurrency queue (ms) |

### Tuning Guidelines

- **High load (200+ concurrent)**: Increase `MAX_CONCURRENT_TTS` to 30-40, but watch for Edge TTS rate limiting
- **Memory pressure**: Decrease to 10-15 slots to reduce peak memory
- **Free tier abuse**: Decrease IP rate limit in `tts.ts` (currently 10/min)

## Monitoring

### /health endpoint

The `/health` endpoint includes TTS stats:

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

### Alerts to configure

- `tts.activeSlots >= 18` (90% capacity) — scale up or increase limit
- `tts.totalTimedOut` increasing — users getting 503s, need more capacity
- `tts.peakConcurrent >= maxConcurrentTTS` — hitting ceiling regularly
- `memory_spike_operation` with name `tts-synthesis` — individual TTS using 50MB+ RSS

## Free Tier Limits

**Free users**: 3 articles/month

### Enforcement layers

1. **Client-side** (localStorage): `tts-articles-{YYYY-MM}` stores array of article URLs. Prevents play button from firing when limit reached.
2. **Server-side** (Redis primary): `tts-usage:{userId}:{YYYY-MM}` integer counter with monthly TTL.
3. **Server-side** (in-memory fallback): Used when Redis is down. Bounded at 5K entries.
4. **Anonymous users**: Client-side only enforcement (no server tracking without userId).

### Upgrade prompt

When limit is reached, `TTSPlayer` shows a prompt with crown icon: "TTS limit reached — 3/3 articles this month. Upgrade for unlimited listening."

## Edge TTS Details

### Voice quality

Uses Microsoft Edge TTS neural voices (same as Edge browser's Read Aloud). Default voice: `en-US-AriaNeural` (female, natural).

### SSML features used

```xml
<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>
  <voice name='en-US-AriaNeural'>
    <prosody pitch='+0Hz' rate='+0%' volume='+0%'>
      {sanitized article text}
    </prosody>
  </voice>
</speak>
```

### Word boundary events

Edge TTS returns `audio.metadata` messages with:
- `Type: "WordBoundary"`
- `Offset`: time in 100-nanosecond units from audio start
- `Duration`: word duration in 100ns units
- `text.Text`: the spoken word
- `text.Offset`: character position in original text

These are converted to milliseconds and streamed as SSE `boundary` events.

### Audio format

- Codec: MP3
- Sample rate: 24 kHz
- Bitrate: 48 kbps mono
- Typical size: ~100 KB per minute of speech

### Connection details

- Protocol: WebSocket to `wss://speech.platform.bing.com/...`
- Auth: Hardcoded trusted client token (same as Edge browser)
- No API key required (free tier, no billing)
- Rate limits: Not officially documented; empirically ~50 concurrent per IP

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `L` | Toggle TTS (start playing / stop) |
| Space | (when TTS player focused) Play/pause |

## Browser Support

| Feature | Support |
|---------|---------|
| Audio playback | All modern browsers |
| SSE streaming | All modern browsers |
| CSS Custom Highlight API | Chrome 105+, Edge 105+, Safari 17.2+ |
| Word highlighting fallback | No highlighting on Firefox (audio still works) |
