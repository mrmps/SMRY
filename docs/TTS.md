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
                                                             ├─ Voice gating (free: Rachel/Brian only)
                                                             ├─ Concurrency slot (max 20 global, 2/user)
                                                             ├─ Clean text (strip ads, junk patterns)
                                                             ├─ Article-level LRU cache lookup
                                                             ├─ Article cache hit → instant replay
                                                             ├─ Split into ~5000-char chunks
                                                             ├─ Per-chunk LRU cache lookup (SHA-256 key)
                                                             ├─ Per-chunk Redis cache lookup (L3)
                                                             ├─ Cache hits → skip synthesis
                                                             ├─ Cache misses → parallel synthesis (max 3)
                                                             │   └─ ElevenLabs convertWithTimestamps()
                                                             │       → MP3 audio + character alignment
                                                             │       → previousText/nextText for prosody
                                                             ├─ Write to memory + Redis caches
                                                             ├─ Concatenate audio chunks, merge alignment
2. ← JSON response          ←    Forward JSON          ←    └─ Return { audioBase64, alignment, durationMs }

3. Client decodes base64 → Blob URL for <audio>
4. TranscriptViewer syncs playback to word boundaries
5. useTTSHighlight wraps article words in <span>, toggles CSS classes
6. Speed control via audio.playbackRate (0.5x–3x)
```

### Key design decisions

- **Single JSON response (not SSE)**: One API call returns all audio + alignment as JSON. Simpler than SSE streaming — the multi-tier cache makes subsequent plays instant.
- **Four-tier server caching**: L1 article LRU (200MB, 2h) → L2 chunk LRU (300MB, 1h) → L3 Redis chunk cache (7d TTL) → L4 ElevenLabs API. Redis survives server restarts.
- **Client-side voice cache**: In-memory `Map<voiceId, {blobUrl, alignment, durationMs}>` so switching between previously-heard voices is instant — no API call, no IndexedDB lookup.
- **Voice tier gating**: Free users restricted to Rachel + Brian (2 voices). Premium users get all 10. Enforced server-side (403) and client-side (UI lock icons, redirect to /pricing).
- **Large chunks (5000 chars)**: ~5000-char chunks on sentence boundaries. Fewer API calls = lower cost + better prosody. ElevenLabs Flash v2.5 handles 5K+ chars efficiently.
- **Cross-chunk prosody**: `previousText`/`nextText` context (250 chars) passed to ElevenLabs for smooth transitions between chunks.
- **Parallel chunk synthesis**: Up to 3 concurrent ElevenLabs API calls for uncached chunks, reducing total generation time.
- **Character-level alignment**: ElevenLabs `convertWithTimestamps()` returns per-character start/end times. Converted to word boundaries via `alignmentToWordBoundaries()`.
- **Seek-safe playback**: `seekTargetRef` guard prevents stale `timeupdate`/`pause` events from overriding seek state. Seeks resume playback immediately without RAF delay.
- **Span-wrapping highlighting**: Words wrapped in `<span data-tts-idx="N">` with CSS class toggling (`tts-spoken`, `tts-current`, `tts-unspoken`). MutationObserver re-wraps on article DOM changes. Explicit CSS resets (`background: transparent; padding: 0; margin: 0`) prevent visual artifacts inside annotation `<mark>` elements.
- **TTS/Highlight coordination**: Global `_ttsMutating` flag (exported as `isTTSMutating()`) prevents the annotation `useInlineHighlights` MutationObserver from interfering during TTS span mutations. Uses `setTimeout(250ms)` to outlast the highlights observer's 150ms debounce.
- **Click-to-seek**: Clicking any highlighted word seeks audio to that word's start time and starts playback immediately.
- **Content-based duration**: Audio duration derived from alignment end times (not raw MP3 duration). Auto-pauses when spoken content finishes (player stays open for replay).
- **Restart from beginning**: When `play()` is called after audio reaches content end, automatically seeks to 0 and restarts playback.
- **Mobile auto-scroll**: When TTS player opens on mobile, adds 180px bottom padding to scroll container and scrolls down 60px so content behind the player is visible. Padding removed on close.
- **Client-side IndexedDB cache**: Audio blobs cached for 7 days (max 50 entries), avoiding repeat server calls. Cache-first: cached replays don't consume daily credits.
- **Shared TTSFloatingPlayer component**: Desktop and mobile views use a single `TTSFloatingPlayer` component (ready/loading/error states) with `isMobile` flag for positioning differences.
- **TranscriptViewer compound components**: `TranscriptViewerContainer` + context provides `play()`, `pause()`, `seekToTime()`, `currentWordIndex` etc. to child controls.
- **Browser playback rate for speed**: Generate at 1.0x, let `audio.playbackRate` handle 0.5x–3x.
- **60s per-chunk timeout**: Each ElevenLabs call has `AbortSignal.timeout(60_000)` to accommodate larger 5K-char chunks.

## Files

### Server
| File | Purpose |
|------|---------|
| `lib/elevenlabs-tts.ts` | ElevenLabs API client — `convertWithTimestamps()`, character→word alignment, voice presets, tier gating (`isVoiceAllowed`) |
| `server/routes/tts.ts` | Elysia endpoint — auth, voice gating, rate limiting, concurrency, multi-tier caching, text chunking |
| `lib/tts-redis-cache.ts` | Redis L3 chunk cache — gzip-compressed, 7-day TTL, batch lookups, silent degradation |
| `lib/tts-concurrency.ts` | Bounded concurrency limiter with per-user queuing, abort support, /health stats |
| `lib/tts-chunk.ts` | Shared text cleaning (`cleanTextForTTS`), chunking (`splitTTSChunks`), SHA-256 hashing |
| `lib/tts-text.ts` | DOM text extraction (`extractTTSText`) and word position mapping (`buildWordPositions`) |
| `app/api/tts/route.ts` | Next.js JSON proxy with 120s timeout and IP forwarding |
| `app/api/tts/voices/route.ts` | Next.js proxy for voice list — forwards auth, returns voices with `locked` boolean |

### Client
| File | Purpose |
|------|---------|
| `lib/hooks/use-tts.ts` | React hook — API calls, in-memory voice cache, IndexedDB caching, usage tracking, voice gating |
| `components/hooks/use-tts-highlight.ts` | Word highlighting via span-wrapping with MutationObserver recovery, click-to-seek, `_ttsMutating` coordination flag |
| `components/hooks/use-transcript-viewer.ts` | Audio playback state, seek-safe word timing sync (RAF + binary search), segment composition, restart-from-end |
| `components/ui/transcript-viewer.tsx` | Compound component system — Container, Audio, PlayPauseButton, ScrubBar, Words |

### Integration
| File | Changes |
|------|---------|
| `components/ui/icons.tsx` | VolumeHigh, Play, Pause, Stop, Forward, Backward, Speed, Headphones, Lock, X |
| `components/features/floating-toolbar.tsx` | "Listen" button (desktop) |
| `components/features/mobile-bottom-bar.tsx` | "Listen" button (mobile) |
| `components/features/proxy-content.tsx` | TTS state, TTSFloatingPlayer (shared desktop/mobile), TTSArticleHighlight bridge, TTSWaveAnimation, voice picker with lock UI, mobile auto-scroll |
| `lib/hooks/use-inline-highlights.ts` | Annotation highlights — checks `isTTSMutating()` to skip TTS DOM mutations |
| `components/article/content.tsx` | `data-article-content` attribute for word highlighting |
| `server/index.ts` | Route registration, TTS concurrency config, /health TTS stats |
| `server/env.ts` | `ELEVENLABS_API_KEY` (optional), concurrency env vars |

## Cache Hierarchy

```
L0: Client in-memory voice cache  (per session)        — instant voice switching, no async
L1: Client IndexedDB              (7d TTL, 50 entries)  — per-user, no server call
L2: Server article LRU            (200MB, 2h TTL)       — instant replay, no chunking
L3: Server chunk LRU              (300MB, 1h TTL)       — per-chunk, partial hits
L4: Redis chunk cache             (7d TTL, per-chunk)    — survives restarts
L5: ElevenLabs API                (last resort)          — actual credit spend
```

### Write-through promotion
- Redis hit → promoted to server chunk LRU (L3 → L2)
- IndexedDB hit → promoted to client in-memory cache (L1 → L0)
- API result → written to all caches (L0 + L1 + L3 + L4)

## Voice Tiers

10 curated voices stored in `VOICE_PRESETS` (`lib/elevenlabs-tts.ts`):

| Name | Gender | Accent | Description | Tier |
|------|--------|--------|-------------|------|
| Rachel (default) | Female | American | Calm, clear | Free |
| Brian | Male | American | Deep, narration | Free |
| Sarah | Female | American | Soft, news | Premium |
| Matilda | Female | American | Warm | Premium |
| Lily | Female | British | Raspy | Premium |
| Alice | Female | British | Confident | Premium |
| Adam | Male | American | Deep | Premium |
| Daniel | Male | British | News presenter | Premium |
| Josh | Male | American | Deep, young | Premium |
| Antoni | Male | American | Well-rounded | Premium |

### Voice gating enforcement

1. **Server** (`server/routes/tts.ts`): Validates `voiceId` via `isVoiceAllowed()` → 403 for premium voice + free user
2. **Client hook** (`lib/hooks/use-tts.ts`): `setVoice()` silently rejects premium voices for free users
3. **UI** (`proxy-content.tsx`): Locked voices show grayscale avatar, lock icon, "PRO" badge, "Upgrade to unlock" tooltip on hover. Clicking redirects to `/pricing`.
4. **Voices endpoint** (`/api/tts/voices`): Returns all presets with `locked` boolean per voice based on auth. Cache: `private, max-age=300`.

## ElevenLabs API Details

### Speech Generation

```
POST via ElevenLabs SDK: textToSpeech.convertWithTimestamps(voiceId, options)

Options:
{
  text: "Text to speak...",
  modelId: "eleven_flash_v2_5",
  outputFormat: "mp3_44100_64",
  previousText: "...last 250 chars of previous chunk...",  // optional, for prosody
  nextText: "...first 250 chars of next chunk..."          // optional, for prosody
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
- Typical size per chunk: ~300-600 KB (5000 chars → ~35-50s audio)
- Total per article: ~500 KB per minute of audio

## Control Layout

The TTS floating player uses a shared `TTSFloatingPlayer` component for both desktop and mobile:

```
┌───────────────────────────────────────────────────┐
│ 3 credits remaining          Subscribe now   [✕]  │  ← credits banner (free users)
│ NOW PLAYING                                       │  ← header row
│ [Voice] [⏪] [⏯] [⏩] [═══ scrub ═══]      [1x] │  ← controls row
└───────────────────────────────────────────────────┘
```

- **Credits banner**: Amber warning for free users showing remaining credits
- **Header row**: "Now Playing" label (left) + close button (top-right)
- **Controls row**: Voice picker, skip ±10s, play/pause, scrub bar, speed selector
- **Panel width**: 520px desktop, `calc(100vw - 1.5rem)` mobile (max 520px)
- **Positioning**: Desktop uses `bottom-6`, mobile uses `calc(3.5rem + safe-area-inset-bottom + 0.5rem)` to sit above bottom bar

### Voice picker

Dropdown with gender sections (Female/Male). Each voice shows:
- Gradient avatar circle
- Name + accent/description
- For locked voices: grayscale avatar, "PRO" badge with lock icon, hover tooltip "Upgrade to unlock"
- Clicking a locked voice redirects to `/pricing`
- Footer link: "Unlock all voices with Premium"

## Seek System

The seek implementation uses a `seekTargetRef` guard pattern to prevent stale browser events from overriding seek state:

1. **seekToTime()**: Sets `seekTargetRef.current = time`, updates React state, sets `audio.currentTime`, resumes playback if was playing
2. **timeupdate events**: Skipped while `seekTargetRef.current != null`
3. **pause events**: `syncTime()` skipped during seeks (browser fires transient pause during seek)
4. **seeked event**: Clears `seekTargetRef`, syncs final `audio.currentTime` to React state. Re-seeks if browser jumped away (>0.5s tolerance)
5. **RAF loop**: Skips state updates while seek is in progress

### Auto-end behavior

When audio reaches the content end time (last character alignment), the player **pauses** (stays open for replay). It does NOT close — user can seek back or replay. Pressing play after content end automatically restarts from the beginning (seeks to 0, resets word index).

### TTS/Highlight coordination

The `useTTSHighlight` hook and `useInlineHighlights` hook both modify the article DOM. To prevent cascading MutationObserver rebuilds:

1. `useTTSHighlight` sets a global `_ttsMutating = true` flag before any DOM mutation (span wrapping, unwrapping, cleanup)
2. `useInlineHighlights` MutationObserver checks `isTTSMutating()` and skips if true
3. Flag stays true for 250ms (via `setTimeout`) to outlast the highlights observer's 150ms debounce
4. CSS rule `mark[data-highlight-id] [data-tts-idx]` forces transparent background and no padding on TTS spans inside annotation marks

### Mobile auto-scroll

When the TTS player opens on mobile:
1. Adds `paddingBottom: 180px` to `[data-mobile-scroll]` container so content isn't obscured
2. Scrolls container down 60px smoothly to reveal content behind the player
3. On close, padding is removed via cleanup effect

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

### Server Caching (Three-Tier)

**L2: Article-level cache** (full combined result):

| Property | Value |
|----------|-------|
| Cache key | SHA-256(fullText + voiceId) |
| Max size | 200 MB |
| TTL | 2 hours |
| Scope | Server-side LRU |
| Effect | Instant replay — zero processing, zero API calls |

**L3: Per-chunk cache** (individual chunk audio):

| Property | Value |
|----------|-------|
| Cache key | SHA-256(chunkText + voiceId) |
| Max size | 300 MB |
| TTL | 1 hour |
| Scope | Server-side LRU |
| Effect | Cached chunks skip synthesis + concurrency slot |

**L4: Redis chunk cache** (persistent across restarts):

| Property | Value |
|----------|-------|
| Cache key | `tts:chunk:{sha256hex}` |
| TTL | 7 days |
| Max per chunk | 2 MB |
| Compression | gzip via `compressAsync`/`decompressAsync` |
| Scope | Redis (Upstash) |
| Effect | Survives server restarts, batch lookups via pipeline |
| Degradation | Silent — errors treated as cache miss |

### Memory Safety

| Concern | Mitigation |
|---------|-----------|
| Audio buffer growth | ~5000 chars per ElevenLabs call (not full article). MP3 much smaller than WAV |
| Blob URL leaks | Voice cache tracks all blob URLs. `stop()` revokes all. Cleanup on unmount |
| Client disconnect | AbortSignal cancels ElevenLabs request, releases concurrency slot |
| Per-chunk timeout | 60s `AbortSignal.timeout` per ElevenLabs call |
| Per-request tracking | `startMemoryTrack()` instruments every TTS synthesis |
| Client-side cache | IndexedDB, max 50 entries, 7-day TTL |
| Redis cache | 2MB per-chunk cap, gzip compression, silent degradation on errors |

### Memory Estimates (100 concurrent users)

```
Per user:
  Server per chunk:      ~60-120 KB (MP3, much smaller than PCM/WAV)
  Server per article:    ~500 KB - 2 MB (all chunks, before caching)
  Client per tab:        ~1-5 MB (all chunk blobs kept for seeking)
  Client voice cache:    ~2-10 MB (multiple voice variants in memory)

100 concurrent:
  Server peak:           50-200 MB (most served from cache)
  Redis:                 Proportional to unique articles × voices
  Client per tab:        ~1-10 MB (MP3 audio blobs, multiple voices)
```

### Failure Modes

| Scenario | Behavior |
|----------|----------|
| ElevenLabs API error | Error returned in JSON, displayed in player |
| ElevenLabs service down | 503 returned, error displayed in player |
| Server overloaded (20 slots full) | Queue with 15s timeout, then 503 "TTS service busy" |
| User spamming requests | IP rate limit (429), per-user concurrency limit (429) |
| Client disconnects mid-generation | AbortSignal cancels ElevenLabs request, releases slot |
| Single chunk hangs | 60s per-chunk timeout aborts that call; error propagated |
| Premium voice + free user | 403 "Premium voice requires subscription", UI shows upgrade prompt |
| Redis down | Silent degradation — treated as cache miss, falls through to ElevenLabs |

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
    "peakConcurrent": 18,
    "redis": {
      "hits": 456,
      "misses": 78,
      "errors": 2,
      "hitRate": "85.4%"
    }
  }
}
```

### Log patterns

#### Server-side

| Pattern | Logger | Meaning |
|---------|--------|---------|
| `TTS synthesis started` | `api:tts` | New TTS request accepted |
| `TTS streaming error` | `api:tts` | Synthesis failed mid-stream |
| `TTS stream cancelled by client` | `api:tts` | Client disconnected |
| `TTS request queued` | `tts:concurrency` | All slots full, request waiting |
| `TTS pre-synthesis memory snapshot` | `api:tts` | RSS, heap, cache stats before synthesis |
| `memory_operation` name=`tts-synthesis` | `memory-tracker` | Per-request memory delta |

#### Client-side (development only)

| Prefix | Source | Logged data |
|--------|--------|-------------|
| `[TTS]` | `use-tts.ts` | Cache hits (L0/L1), fetch timing, audio size, errors |
| `[TTS Player]` | `use-transcript-viewer.ts` | Segment composition, RAF loop, play/pause/ended events, audio setup |
| `[TTS Highlight]` | `use-tts-highlight.ts` | Span build success/failure, rebuild attempts, span counts |
| `[TTS Sync]` | `proxy-content.tsx` | Word index updates (throttled 2s), current time, playing state |

### Response Headers

| Header | Description |
|--------|-------------|
| `X-TTS-Usage-Count` | Current daily usage count (free users only) |
| `X-TTS-Usage-Limit` | Daily limit (3 for free, Infinity for premium) |
| `X-TTS-Cache` | "article-hit" (article cache), "full-hit" (all chunks cached), "partial-hit" or "miss" |

## Free Tier Limits

**Free users**: 3 articles/day, 2 voices (Rachel + Brian)

### Enforcement layers

1. **Client-side** (localStorage): Tracks daily article URLs
2. **Server-side** (Redis primary): `tts-usage:{userId}:{YYYY-MM-DD}` counter with daily TTL
3. **Server-side** (in-memory fallback): Used when Redis is down. Bounded at 5K entries
4. **Anonymous users**: Client-side only enforcement
5. **Voice gating**: `isVoiceAllowed()` checks both server and client side

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
| IndexedDB audio caching | All modern browsers |
