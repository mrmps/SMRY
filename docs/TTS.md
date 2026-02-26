# TTS (Text-to-Speech) Dictation System

AI-powered article dictation with word-by-word highlighting. Uses Inworld AI TTS (TTS 1.5 Mini model) for high-quality neural voices with character-level alignment and MP3 audio.

## Architecture

```
Browser                          Next.js Proxy              Elysia API Server
───────                          ──────────                 ─────────────────
1. Click "Listen" button    →    POST /api/tts         →    POST /api/tts
   { text, voice }               (120s timeout)              │
                                                             ├─ IP rate limit (10/min)
                                                             ├─ Auth check (premium vs free limit)
                                                             ├─ Voice gating (free: Ashley/Dennis only)
                                                             ├─ Concurrency slot (max 15 global, 2/user)
                                                             ├─ Clean text (strip ads, junk patterns)
                                                             ├─ Article-level LRU cache lookup
                                                             ├─ Article cache hit → instant replay
                                                             ├─ Split into ~1800-char chunks
                                                             ├─ Per-chunk LRU cache lookup (SHA-256 key)
                                                             ├─ Per-chunk Redis cache lookup (L3)
                                                             ├─ Cache hits → skip synthesis
                                                             ├─ Request dedup (pendingGenerations map)
                                                             ├─ Cache misses → parallel synthesis (max 3)
                                                             │   └─ Inworld TTS API (REST)
                                                             │       → MP3 audio + character alignment
                                                             ├─ Write to memory + Redis caches
                                                             ├─ Concat audio + Xing VBR header, merge alignment
2. ← JSON response          ←    Forward JSON          ←    └─ Return { audioBase64, alignment, durationMs }

3. Client decodes base64 → Blob URL for <audio>
4. TranscriptViewer syncs playback to word boundaries
5. useTTSHighlight wraps article words in <span>, toggles CSS classes
6. Speed control via audio.playbackRate (0.5x–3x)
```

### Key design decisions

- **Single JSON response (not SSE)**: One API call returns all audio + alignment as JSON. Simpler than SSE streaming — the multi-tier cache makes subsequent plays instant.
- **Seven-tier caching**: L0 client memory → L1 IndexedDB (7d, 50 entries) → L2 article LRU (100MB, 2h) → L2.5 Redis article (7d) → L3 chunk LRU (150MB, 1h) → L3.5 Redis chunk (7d) → L4 Inworld API. Redis survives server restarts.
- **Client-side voice cache**: In-memory `Map<voiceId, {blobUrl, alignment, durationMs}>` so switching between previously-heard voices is instant — no API call, no IndexedDB lookup.
- **Voice tier gating**: Free users restricted to Ashley + Dennis (2 voices). Premium users get all 10. Enforced server-side (403) and client-side (UI lock icons, redirect to /pricing).
- **1800-char chunks**: ~1800-char chunks on sentence boundaries (Inworld limit: 2000 chars with safety margin). Fewer API calls = lower cost + better prosody.
- **Parallel chunk synthesis**: Up to 3 concurrent Inworld API calls per request for uncached chunks. Lowered from 5 to reduce per-request memory footprint on 4GB server.
- **Request deduplication**: `pendingGenerations` Map prevents duplicate Inworld API calls when multiple users request the same article+voice simultaneously. Piggybacking requests release their concurrency slot immediately.
- **Xing VBR header**: Combined MP3 audio gets an Xing/Info frame prepended so iOS Safari reports correct total duration. Without it, `audio.duration` shows wrong value for VBR-encoded multi-chunk audio.
- **Audio throttled React state**: `setCurrentTime` updated at ~15fps (every 66ms) to avoid 60 re-renders/sec. Word highlighting reads `audio.currentTime` directly at 60fps via RAF, bypassing React state.
- **Character-level alignment**: Inworld returns per-character start/end times via `timestampType: "CHARACTER"`. Converted to word boundaries via `alignmentToWordBoundaries()`.
- **Seek-safe playback**: `seekTargetRef` guard prevents stale `timeupdate`/`pause` events from overriding seek state. Seeks resume playback immediately without RAF delay.
- **Span-wrapping highlighting**: Words wrapped in `<span data-tts-idx="N">` with CSS class toggling (`tts-spoken`, `tts-current`, `tts-unspoken`). MutationObserver re-wraps on article DOM changes. Explicit CSS resets (`background: transparent; padding: 0; margin: 0`) prevent visual artifacts inside annotation `<mark>` elements.
- **Direct index mapping for sync**: DOM word spans and alignment words both derive from the same cleaned text, so they map 1:1 by index. `alignToDomIdx()` and `domToAlignIdx()` handle the common case (same count) as a direct passthrough, with proportional scaling fallback when counts differ. This replaced the fragile `matchTimingsToPositions()` forward-search approach that would cascade mismatches.
- **TTS/Highlight coordination**: Numeric lock counter (`_ttsMutLockCount`) with generation tracking (exported as `isTTSMutating()`) prevents the annotation `useInlineHighlights` MutationObserver from interfering during TTS span mutations. Uses `setTimeout(250ms)` to outlast the highlights observer's 150ms debounce. Multiple concurrent operations (buildSpans, cleanup) each hold their own lock.
- **Click-to-seek**: Clicking any highlighted word maps DOM span index → alignment word index → seek time, then seeks audio and starts playback immediately.
- **MP3 frame-based duration**: Chunk duration computed by parsing MPEG audio frames (`parseMp3DurationMs()`) rather than using alignment end times. Handles MPEG1/2/2.5 Layer III, both CBR and VBR. Falls back to bitrate-based estimate if parsing fails. This eliminates cumulative time drift when merging multi-chunk alignments — the old boundary-based estimate excluded trailing silence/padding in each chunk.
- **Restart from beginning**: When `play()` is called after audio reaches content end, automatically seeks to 0 and restarts playback.
- **Mobile auto-scroll**: When TTS player opens on mobile, adds 180px bottom padding to scroll container and scrolls down 60px so content behind the player is visible. Padding removed on close.
- **Client-side IndexedDB cache**: Audio blobs cached for 7 days (max 50 entries), avoiding repeat server calls. Cache-first: cached replays don't consume daily credits.
- **Shared TTSFloatingPlayer component**: Desktop and mobile views use a single `TTSFloatingPlayer` component (ready/loading/error states) with `isMobile` flag for positioning differences.
- **TranscriptViewer compound components**: `TranscriptViewerContainer` + context provides `play()`, `pause()`, `seekToTime()`, `currentWordIndex` etc. to child controls.
- **Browser playback rate for speed**: Generate at 1.0x, let `audio.playbackRate` handle 0.5x–3x.
- **60s per-chunk timeout**: Each Inworld call has `AbortSignal.timeout(60_000)`.

## Files

### Server
| File | Purpose |
|------|---------|
| `lib/tts-provider.ts` | Inworld AI TTS client — REST API, character→word alignment, MP3 frame parser (`parseMp3DurationMs`), voice presets, tier gating (`isVoiceAllowed`) |
| `server/routes/tts.ts` | Elysia endpoint — auth, voice gating, rate limiting, concurrency, multi-tier caching, text chunking |
| `lib/tts-redis-cache.ts` | Redis L3 chunk cache — gzip-compressed, 7-day TTL, batch lookups, silent degradation |
| `lib/tts-concurrency.ts` | Bounded concurrency limiter with per-user queuing, abort support, /health stats |
| `lib/tts-chunk.ts` | Shared text cleaning (`cleanTextForTTS`), chunking (`splitTTSChunks`), SHA-256 hashing |
| `lib/tts-text.ts` | DOM text extraction (`extractTTSText`), word position mapping (`buildWordPositions`), fuzzy timing match (`matchTimingsToPositions` — legacy, unused by highlight hook) |
| `app/api/tts/route.ts` | Next.js JSON proxy with 120s timeout and IP forwarding |
| `app/api/tts/voices/route.ts` | Next.js proxy for voice list — forwards auth, returns voices with `locked` boolean |

### Client
| File | Purpose |
|------|---------|
| `lib/hooks/use-tts.ts` | React hook — API calls, in-memory voice cache, IndexedDB caching, usage tracking, voice gating |
| `components/hooks/use-tts-highlight.ts` | Word highlighting via span-wrapping with direct 1:1 index mapping (`alignToDomIdx`/`domToAlignIdx`), MutationObserver recovery, click-to-seek, `_ttsMutating` coordination flag |
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
| `server/env.ts` | `INWORLD_API_KEY` (optional), concurrency env vars |

## Cache Hierarchy

```
L0:   Client in-memory voice cache  (per session)        — instant voice switching, no async
L1:   Client IndexedDB              (7d TTL, 50 entries)  — per-user, no server call
L2:   Server article LRU            (100MB, 2h TTL)       — instant replay, no chunking
L2.5: Redis article cache           (7d TTL, 10MB/entry)  — cross-device sync (premium)
L3:   Server chunk LRU              (150MB, 1h TTL)       — per-chunk, partial hits
L3.5: Redis chunk cache             (7d TTL, 2MB/chunk)   — survives restarts
L4:   Inworld TTS API               (last resort)         — actual credit spend
```

### Write-through promotion
- Redis article hit → promoted to server article LRU (L2.5 → L2)
- Redis chunk hit → promoted to server chunk LRU (L3.5 → L3)
- IndexedDB hit → promoted to client in-memory cache (L1 → L0)
- API result → written to all server caches (L2 + L2.5 + L3 + L3.5)
- Client receives result → written to L0 + L1

## Voice Tiers

10 curated voices stored in `VOICE_PRESETS` (`lib/tts-provider.ts`):

| Name | Gender | Accent | Description | Tier |
|------|--------|--------|-------------|------|
| Ashley (default) | Female | American | Warm, natural | Free |
| Dennis | Male | American | Deep, narration | Free |
| Sarah | Female | American | Soft, warm | Premium |
| Olivia | Female | British | Upbeat, friendly | Premium |
| Julia | Female | American | Bright, clear | Premium |
| Elizabeth | Female | British | Confident, refined | Premium |
| Alex | Male | American | Well-rounded | Premium |
| Craig | Male | American | Deep, clear | Premium |
| Edward | Male | American | Emphatic, expressive | Premium |
| Timothy | Male | American | Young, natural | Premium |

### Voice gating enforcement

1. **Server** (`server/routes/tts.ts`): Validates `voiceId` via `isVoiceAllowed()` → 403 for premium voice + free user
2. **Client hook** (`lib/hooks/use-tts.ts`): `setVoice()` silently rejects premium voices for free users
3. **UI** (`proxy-content.tsx`): Locked voices show grayscale avatar, lock icon, "PRO" badge, "Upgrade to unlock" tooltip on hover. Clicking redirects to `/pricing`.
4. **Voices endpoint** (`/api/tts/voices`): Returns all presets with `locked` boolean per voice based on auth. Cache: `private, max-age=300`.

## How Inworld AI TTS Makes This Work

Inworld AI TTS returns **character-level alignment timestamps** alongside MP3 audio in a single API call — the same behavior as ElevenLabs but at ~5x lower cost ($5/1M chars vs ~$24/1M chars).

1. **Single REST call does everything**: `POST https://api.inworld.ai/tts/v1/voice` with `timestampType: "CHARACTER"` returns both the MP3 audio (base64-encoded) and a character-level alignment object in one response. No second pass or forced-alignment step needed.

2. **Character-level granularity**: Inworld returns per-character start/end times via `timestampInfo.characterAlignment`, which we convert to word boundaries. This gives precise highlighting — we know exactly when each character is spoken.

3. **MP3 output directly**: Inworld generates MP3 at the specified config (44.1kHz, 64kbps). No server-side audio encoding needed.

4. **TTS 1.5 Mini model**: ~100ms median latency, $5/1M characters. Handles long text chunks efficiently.

5. **Alignment offset tracking**: After generating audio for multiple chunks, we merge the alignment data by offsetting timestamps based on cumulative audio duration (computed via MP3 frame parsing for accuracy). Each chunk's character positions are adjusted by the total text length of previous chunks. This produces a single continuous alignment for the full article.

6. **Text normalization disabled**: `applyTextNormalization: "OFF"` ensures Inworld returns alignment characters that exactly match the input text. With normalization ON, numbers/symbols could be expanded (e.g. "$100" → "one hundred dollars"), causing word count mismatches between the DOM and alignment.

**Note**: Unlike ElevenLabs, Inworld does not support cross-chunk prosody context (`previousText`/`nextText`). Each chunk is synthesized independently. With 1800-char chunks on sentence boundaries, this produces acceptable results.

## Inworld AI TTS API Details

### Speech Generation

```
POST https://api.inworld.ai/tts/v1/voice
Authorization: Basic {INWORLD_API_KEY}
Content-Type: application/json

{
  "text": "Text to speak...",
  "voiceId": "Ashley",
  "modelId": "inworld-tts-1.5-mini",
  "audioConfig": {
    "audioEncoding": "MP3",
    "sampleRateHertz": 44100,
    "bitRate": 64000
  },
  "timestampType": "CHARACTER",
  "applyTextNormalization": "OFF"
}
```

Returns:
- `audioContent` — MP3 audio encoded as base64
- `timestampInfo.characterAlignment` — Character-level timing data

### Character Alignment

Inworld returns per-character timestamps (note: singular field names):
```json
{
  "timestampInfo": {
    "characterAlignment": {
      "characters": ["H", "e", "l", "l", "o", " ", "w", "o", "r", "l", "d"],
      "characterStartTimeSeconds": [0.0, 0.05, 0.1, 0.15, 0.2, 0.3, 0.5, 0.55, 0.6, 0.65, 0.7],
      "characterEndTimeSeconds":   [0.05, 0.1, 0.15, 0.2, 0.3, 0.4, 0.55, 0.6, 0.65, 0.7, 0.9]
    }
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
- Typical size per chunk: ~100-300 KB (1800 chars)
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

### Click-to-seek flow

1. User clicks a word span (`<span data-tts-idx="N">`)
2. `useTTSHighlight` click handler extracts DOM index `N`
3. Maps DOM index → alignment index via `domToAlignIdx(N, domCount, alignCount)`
4. Looks up `words[alignIdx].startTime` for the seek target
5. Immediately updates CSS classes on all spans (synchronous DOM mutation for instant visual feedback)
6. Calls `seekToTime(time)` then `play()`

## Highlight Sync Architecture

### How word highlighting stays in sync with audio

The highlight system maps between two word arrays:
1. **DOM words**: Extracted from article prose containers via `buildWordPositions()` → filtered through `cleanTextForTTS()`
2. **Alignment words**: Returned by Inworld TTS API (character-level timestamps grouped into words by `composeSegments()`)

Both arrays derive from the same cleaned text, so word counts should match (1:1 index mapping). The `alignToDomIdx()` / `domToAlignIdx()` helpers handle both cases:
- **Same count** (common): Direct passthrough (`alignIdx` = `domIdx`)
- **Different count** (rare): Proportional scaling `Math.round(idx * (targetCount-1) / (sourceCount-1))`

### Why not fuzzy word matching?

The previous approach used `matchTimingsToPositions()` — a forward-search that compared normalized DOM words against alignment words. Problems:
1. **Cascade failure**: One mismatched word caused all subsequent words to shift
2. **Normalization sensitivity**: Even with `applyTextNormalization: "OFF"`, minor differences could break the chain
3. **No recovery**: Once matching fell out of sync, all remaining words had wrong timing

The direct index approach is robust because both word arrays come from the same source text, making index correspondence inherent.

### MP3 frame duration parsing

Multi-chunk TTS merges alignment timestamps by offsetting each chunk by the cumulative duration of previous chunks. The old approach used the last word boundary's end time as chunk duration — but this excluded trailing silence/padding in the MP3 data. Over 10+ chunks, the cumulative error grew to 3-7 seconds.

`parseMp3DurationMs()` in `lib/tts-provider.ts` computes exact duration by:
1. Skipping ID3v2 tag if present
2. Scanning for MPEG frame sync bytes (0xFF 0xE0 mask)
3. Decoding version (MPEG1/2/2.5), layer (III), bitrate, sample rate, padding
4. Counting frames × samples-per-frame (1152 for MPEG1-L3, 576 for MPEG2/2.5-L3)
5. Duration = totalSamples / sampleRate

This works correctly for both CBR and VBR because sample count per frame is constant regardless of bitrate. Falls back to `estimateMp3DurationMs()` (bitrate-based estimate) if parsing returns 0.

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
4. `scrollToSpan()` uses a 200px bottom buffer on mobile (vs 100px on desktop) to keep the current word above the floating player

## Scalability Design (30K DAU, 100+ concurrent)

### Concurrency Control

```
┌─────────────────────────────────────────┐
│         TTS Concurrency Limiter         │
├─────────────────────────────────────────┤
│ Global max:  15 concurrent requests     │
│ Per-user:    2 concurrent requests      │
│ Queue:       FIFO with 15s timeout      │
│ Abort:       Client disconnect cleanup  │
│ Inworld:     3 concurrent API calls/req │
│ Dedup:       pendingGenerations map     │
│ Metrics:     /health endpoint stats     │
└─────────────────────────────────────────┘
```

### Rate Limiting (3 layers)

| Layer | Mechanism | Limit | Scope |
|-------|-----------|-------|-------|
| IP rate limit | In-memory sliding window | 10 req/min per IP | All users |
| Daily quota | Redis (primary) + in-memory (fallback) | 3 articles/day | Free + anonymous users (incremented after success only, deduped by article+voice) |
| Concurrency | Slot limiter | 15 global, 2 per user | All users |

### Server Caching (Three-Tier)

**L2: Article-level cache** (full combined result):

| Property | Value |
|----------|-------|
| Cache key | SHA-256(v3 + fullText + voiceId) |
| Max size | 100 MB |
| TTL | 2 hours |
| Scope | Server-side LRU |
| Effect | Instant replay — zero processing, zero API calls |

**L2.5: Redis article cache** (cross-device sync for premium):

| Property | Value |
|----------|-------|
| Cache key | `tts:article:v2:{sha256hex}` |
| TTL | 7 days |
| Max per article | 10 MB |
| Compression | gzip via `compressAsync`/`decompressAsync` |
| Scope | Redis (Upstash) |
| Effect | Premium users get same audio on all devices |
| Write | Premium-only (fire-and-forget after generation) |

**L3: Per-chunk cache** (individual chunk audio):

| Property | Value |
|----------|-------|
| Cache key | SHA-256(v3 + chunkText + voiceId) |
| Max size | 150 MB |
| TTL | 1 hour |
| Scope | Server-side LRU |
| Effect | Cached chunks skip synthesis + concurrency slot |

**L3.5: Redis chunk cache** (persistent across restarts):

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
| Audio buffer growth | ~1800 chars per Inworld call (not full article). MP3 much smaller than WAV. 50MB audio size cap per request |
| Cache memory caps | Article LRU 100MB + Chunk LRU 150MB = 250MB total (was 500MB) |
| Text limit | 100K chars max (was 200K). ~20 min audio |
| Blob URL leaks | Voice cache tracks all blob URLs. `stop()` revokes all. Cleanup on unmount |
| Client disconnect | AbortSignal cancels Inworld request, releases concurrency slot |
| Per-chunk timeout | 60s `AbortSignal.timeout` per Inworld call |
| Per-request tracking | `startMemoryTrack()` instruments every TTS synthesis with checkpoints |
| Client-side cache | IndexedDB, max 50 entries, 7-day TTL, evicts oldest 10 on overflow |
| Redis cache | 2MB per-chunk cap, 10MB per-article cap, gzip compression, silent degradation |
| Intermediate buffers | Nulled after use to allow GC during generation |
| Large response warning | Logs warning when audio > 20MB |

### Memory Estimates (100 concurrent users, 4GB server)

```
Fixed costs:
  Base process (Bun + Next.js):  ~500 MB
  Article LRU cache:             100 MB (max)
  Chunk LRU cache:               150 MB (max)
  Other caches + overhead:       ~200 MB

Per concurrent user (generating):
  Audio buffers per request:     ~1-3 MB (chunks + combined)
  Alignment data:                ~50 KB
  Total per user:                ~3 MB

15 concurrent generating:
  Active generation memory:      ~45 MB
  Peak total:                    ~1.0 GB

100 concurrent (85 from cache, 15 generating):
  Server peak:                   ~1.0-1.4 GB
  Headroom on 4GB server:        ~2.6 GB

Per client tab:
  Audio blobs:                   ~1-5 MB
  Voice cache (multiple voices): ~2-10 MB
```

### Failure Modes

| Scenario | Behavior |
|----------|----------|
| Inworld API error | Error returned in JSON, displayed in player |
| Inworld service down | 503 returned, error displayed in player |
| Server overloaded (15 slots full) | Queue with 15s timeout, then 503 "TTS service busy" |
| User spamming requests | IP rate limit (429), per-user concurrency limit (429) |
| Client disconnects mid-generation | AbortSignal cancels Inworld request, releases slot |
| Single chunk hangs | 60s per-chunk timeout aborts that call; error propagated |
| Premium voice + free user | 403 "Premium voice requires subscription", UI shows upgrade prompt |
| Redis down | Silent degradation — treated as cache miss, falls through to Inworld |

## Configuration

### Environment Variables (server/env.ts)

| Variable | Default | Description |
|----------|---------|-------------|
| `INWORLD_API_KEY` | — | Inworld AI API key (TTS disabled when absent) |
| `MAX_CONCURRENT_TTS` | 15 | Global max simultaneous TTS requests |
| `MAX_TTS_PER_USER` | 2 | Per-user max concurrent TTS requests |
| `TTS_SLOT_TIMEOUT_MS` | 15000 | Max wait time in concurrency queue (ms) |

## Monitoring

### /health endpoint

```json
{
  "tts": {
    "activeSlots": 5,
    "queuedRequests": 2,
    "maxConcurrentTTS": 15,
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
| `TTS synthesis error` | `api:tts` | Synthesis failed |
| `TTS article cache hit` | `api:tts` | Full article served from cache |
| `TTS chunk cache hit` | `api:tts` | All chunks served from cache |
| `TTS request queued` | `tts:concurrency` | All slots full, request waiting |
| `TTS dedup piggyback` | `api:tts` | Request piggybacked on in-flight generation |
| `TTS pre-synthesis memory snapshot` | `api:tts` | RSS, heap, cache stats before synthesis |
| `large_allocation` | `memory-tracker` | Audio buffer > threshold warning |
| `memory_operation` name=`tts-synthesis` | `memory-tracker` | Per-request memory delta |
| `memory_checkpoint` | `memory-tracker` | Intermediate checkpoints (chunk-gen, build-response) |

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
| `X-TTS-Cache` | "article-hit" (article cache), "chunk-hit" (all chunks cached) |

## Free Tier Limits

**Free users**: 3 articles/day, 2 voices (Ashley + Dennis)
**Anonymous users**: 3 articles/day per IP, 2 voices — no signup required

### Enforcement layers

1. **Client-side** (localStorage): Tracks daily article URLs
2. **Server-side** (Redis primary): `tts-usage:{trackingKey}:{YYYY-MM-DD}` counter with daily TTL
3. **Server-side** (in-memory fallback): Used when Redis is down. Bounded at 5K entries
4. **Anonymous users**: Server-side IP-based tracking (`trackingKey = anon:{clientIp}`)
5. **Voice gating**: `isVoiceAllowed()` checks both server and client side
6. **Deduplication**: Same article+voice combo counted only once per day per user (`tts-dedup:{trackingKey}:{day}` Redis set)

**Important**: The daily quota counter is incremented *after* successful audio generation only. If generation fails (e.g., concurrency timeout, Inworld error), the user's count is not consumed.

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

## Cost Comparison (ElevenLabs → Inworld)

| | ElevenLabs (previous) | Inworld AI (current) |
|--|-----------|----------|
| **Model** | Flash v2.5 | TTS 1.5 Mini |
| **Cost** | ~$24/1M chars | $5/1M chars |
| **Latency** | ~75ms | ~100ms |
| **Timestamps** | Character-level | Character-level |
| **Audio format** | MP3 (direct) | MP3 (direct) |
| **Cross-chunk context** | Yes (previousText/nextText) | No |
| **Savings** | — | ~5x cheaper |
