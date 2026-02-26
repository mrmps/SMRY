# TTS Provider Comparison: Migration from ElevenLabs to Inworld AI

## Executive Summary

SMRY's TTS feature converts articles into natural-sounding audio with real-time word highlighting. We need a provider that returns both **audio** and **word timestamps** in a single call. After evaluating multiple providers, we migrated from ElevenLabs to **Inworld AI TTS** for ~5x cost savings while maintaining the same core behavior.

**Bottom line**: Inworld AI TTS provides character-level timestamps + MP3 audio in a single REST call at $5/1M characters, compared to ElevenLabs' ~$24/1M characters.

---

## Current TTS Features (powered by Inworld AI)

These features all depend on accurate word-level timestamps from the TTS provider:

- **Word highlighting** — as the article is read aloud, the current word gets a colored background so you can follow along
- **Click-to-seek** — click any word in the article to jump the audio to that point
- **Auto-scroll** — the page scrolls automatically to keep the current word visible
- **Opacity dimming** — words that haven't been spoken yet are dimmed (35% opacity), making it easy to see where you are
- **Voice selection** — users can choose from 10 Inworld AI voices (2 free, 8 premium)
- **5-tier caching** — audio is cached at every level (browser memory → IndexedDB → server LRU → Redis → API) so repeat listens are instant

---

## What SMRY Needs from a TTS Provider

1. **High-quality audio** — natural-sounding voices that can read long articles
2. **Word-level timestamps** — know exactly when each word starts and ends, for highlighting
3. **MP3 audio output** — browsers can play MP3 natively; raw audio formats (PCM) cannot
4. **Long text support** — articles can be 1,800+ characters per chunk
5. **Low latency** — users expect audio to start quickly after pressing "Listen"
6. **Low cost** — affordable at scale (30K DAU target)

---

## Provider Comparison

| Feature | ElevenLabs (previous) | Cartesia (evaluated) | Inworld AI (current) |
|---------|-----------|----------|------------|
| **Audio + timestamps in one call** | Yes | No (timestamps only via SSE/PCM) | Yes |
| **Audio format** | MP3 (browser-ready) | PCM raw (requires conversion) | MP3 (browser-ready) |
| **Timestamp precision** | Per-character | Per-word only | Per-character |
| **Cross-chunk prosody** | Yes | No | No |
| **Integration complexity** | ~150 lines (SDK) | ~400+ lines (custom parser) | ~150 lines (REST) |
| **Server CPU overhead** | None | High (PCM → MP3 encoding) | None |
| **Latency** | ~75ms | ~3-6s + encoding | ~100ms |
| **Cost per 1M chars** | ~$24 | ~$37 | $5 |
| **Production stability** | Stable | Fragile (3 parser bugs) | Stable |

---

## Cost Comparison at Scale

| | ElevenLabs | Inworld AI TTS |
|--|-----------|----------------|
| **Plan** | Scale ($99/mo) | Pay-as-you-go |
| **Cost per 1M chars** | ~$24 | $5 (Mini) / $10 (Max) |
| **At 30K DAU (~5M chars/mo)** | ~$207/mo | ~$25/mo (Mini) |
| **Annual savings** | — | ~$2,200/year |

---

## Why Inworld AI Over ElevenLabs

1. **5x cheaper**: $5/1M chars (TTS 1.5 Mini) vs ~$24/1M chars
2. **Same core capability**: Character-level timestamps + MP3 in a single REST call
3. **Simple REST API**: No SDK dependency — just a `fetch()` call
4. **22 preset voices**: More variety than ElevenLabs' preset library
5. **Comparable latency**: ~100ms (Inworld Mini) vs ~75ms (ElevenLabs Flash)

## What We Traded Off

1. **No cross-chunk prosody**: ElevenLabs supported `previousText`/`nextText` for smooth transitions between chunks. Inworld doesn't. With 1800-char chunks on sentence boundaries, the impact is minimal.
2. **No official SDK**: We use raw REST API calls instead of an SDK. This is simpler and has fewer dependencies.
3. **Newer provider**: Inworld TTS is newer than ElevenLabs. Less battle-tested at scale, but our multi-tier caching means most requests never hit the API.

---

## Previously Evaluated: Cartesia

Cartesia was evaluated and rejected because:
- Timestamps only available via SSE endpoint (raw PCM, not MP3)
- Required server-side PCM → MP3 encoding (~200-500ms overhead)
- Non-standard SSE format caused 3 parser bugs
- Word-level timestamps only (not character-level)
- No cross-chunk context
- Server hung on first production request

See git history for the full Cartesia implementation attempt.
