"use client"

import { useCallback, useEffect, useRef, type RefObject } from "react"
import { buildWordPositions, type WordPosition } from "@/lib/tts-text"

type TranscriptWord = {
  text: string
  startTime: number
  endTime: number
}

type UseTTSHighlightOptions = {
  currentWordIndex: number
  isActive: boolean
  /** Seek the audio to a specific time in seconds */
  seekToTime?: (time: number) => void
  /** Start audio playback */
  play?: () => void
  /** Transcript words with timing data (used for click-to-seek and span timing) */
  words?: TranscriptWord[]
  /** Audio element ref for RAF-based sync (bypasses React state latency) */
  audioRef?: RefObject<HTMLAudioElement | null>
}

/** Binary search for the word at a given time. Returns word index or -1. */
function findWordAtTime(words: TranscriptWord[], time: number): number {
  if (!words.length) return -1
  let lo = 0, hi = words.length - 1, answer = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (time >= words[mid].startTime && time < words[mid].endTime) return mid
    if (time < words[mid].startTime) hi = mid - 1
    else { answer = mid; lo = mid + 1 }
  }
  return answer >= 0 ? answer : 0
}

const STYLE_ID = "tts-highlight-styles"

/**
 * Global lock so useInlineHighlights MutationObserver can skip TTS DOM mutations
 * and avoid cascading rebuilds.
 *
 * Uses a numeric lock counter so multiple concurrent operations (buildSpans,
 * deactivation cleanup) each hold their own lock. isTTSMutating() only returns
 * false when ALL operations have released.
 *
 * Generation counter prevents stale setTimeout callbacks from decrementing
 * the lock for a previous generation.
 */
let _ttsMutLockCount = 0
let _ttsMutGeneration = 0
export function isTTSMutating(): boolean { return _ttsMutLockCount > 0 }

/**
 * Map alignment word index → DOM span index.
 * When counts match (common case), returns alignIdx directly (1:1 mapping).
 * When counts differ, uses proportional scaling.
 */
function alignToDomIdx(alignIdx: number, domCount: number, alignCount: number): number {
  if (domCount === 0 || alignCount === 0) return -1
  if (domCount === alignCount) return alignIdx
  return Math.min(Math.round(alignIdx * (domCount - 1) / Math.max(1, alignCount - 1)), domCount - 1)
}

/**
 * Map DOM span index → alignment word index.
 * Inverse of alignToDomIdx.
 */
function domToAlignIdx(domIdx: number, domCount: number, alignCount: number): number {
  if (domCount === 0 || alignCount === 0) return -1
  if (domCount === alignCount) return domIdx
  return Math.min(Math.round(domIdx * (alignCount - 1) / Math.max(1, domCount - 1)), alignCount - 1)
}

/**
 * Highlights the current TTS word on the article DOM by wrapping every word
 * in a `<span data-tts-idx>` and toggling CSS classes as playback advances.
 *
 * Sync approach: direct 1:1 index mapping between DOM words and alignment words.
 * Both come from the same cleaned text, so word counts should match. When they
 * don't (rare edge case), proportional scaling preserves approximate sync.
 *
 * Handles edge cases:
 * - Article DOM not yet rendered when TTS activates (MutationObserver waits)
 * - Article re-renders (dangerouslySetInnerHTML) destroying wrapped spans
 *   (detected via isConnected check, automatically re-wraps)
 * - Click-to-seek: clicking a word seeks the audio to that word's start time
 * - On deactivation, all spans are unwrapped and text nodes normalised
 */
export function useTTSHighlight({
  currentWordIndex,
  isActive,
  seekToTime,
  play,
  words,
  audioRef,
}: UseTTSHighlightOptions) {
  const spanMapRef = useRef<Map<number, HTMLSpanElement>>(new Map())
  /** Number of DOM word spans created by buildWordPositions */
  const domWordCountRef = useRef(0)
  /** Number of alignment words from composeSegments */
  const alignWordCountRef = useRef(0)
  /** Direct text-based mapping: DOM span index → alignment word index */
  const domToAlignMapRef = useRef<Map<number, number>>(new Map())
  /** Reverse mapping: alignment word index → DOM span index */
  const alignToDomMapRef = useRef<Map<number, number>>(new Map())
  const prevIndexRef = useRef<number>(-1)
  const initializedRef = useRef(false)
  const observerRef = useRef<MutationObserver | null>(null)
  const isMutatingRef = useRef(false)
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestSpanRef = useRef<HTMLSpanElement | undefined>(undefined)

  // Keep latest callbacks in refs to avoid stale closures in event handlers
  const seekToTimeRef = useRef(seekToTime)
  seekToTimeRef.current = seekToTime
  const playRef = useRef(play)
  playRef.current = play
  const wordsRef = useRef(words)
  wordsRef.current = words

  const buildSpans = useCallback((articleEl: Element, alignmentWords?: TranscriptWord[]): boolean => {
    isMutatingRef.current = true
    _ttsMutLockCount++
    const gen = ++_ttsMutGeneration
    try {
      removeAllTTSSpans()
      spanMapRef.current.clear()

      const positions = buildWordPositions(articleEl)
      if (positions.length === 0) return false

      domWordCountRef.current = positions.length
      alignWordCountRef.current = alignmentWords?.length ?? 0

      // Use proportional mapping between DOM words and alignment words.
      // Previous text-based forward matching was fragile — a single false positive
      // in textMatch (e.g. "in" matching "involved" via containment) would cause
      // alignPtr to skip ahead, cascading into total matching failure at chunk
      // boundaries. Proportional mapping avoids this entirely:
      // - When counts match (common case): 1:1 direct index mapping
      // - When counts differ: smooth proportional scaling
      // The alignToDomIdx/domToAlignIdx helpers handle both cases.
      //
      // Since buildWordPositions already filters out ad/navigation text via
      // shouldSkipNode + getProseContainers, DOM word count closely tracks
      // alignment word count (typically within 1-5%).
      domToAlignMapRef.current.clear()
      alignToDomMapRef.current.clear()

      if (process.env.NODE_ENV === "development" && alignmentWords?.length) {
        const ratio = positions.length > 0 ? (alignmentWords.length / positions.length).toFixed(2) : "N/A"
        const lastWord = alignmentWords[alignmentWords.length - 1]
        console.log("[TTS Highlight] buildSpans:",
          "DOM words:", positions.length,
          "alignment words:", alignmentWords.length,
          "ratio:", ratio,
          "lastWordEnd:", lastWord ? lastWord.endTime.toFixed(2) + "s" : "none",
          "(proportional mapping)")
      }

      injectStyles()
      const map = wrapWords(positions)
      spanMapRef.current = map
      initializedRef.current = false
      prevIndexRef.current = -1

      return true
    } finally {
      // Always decrement the global lock (every ++ must get a --).
      // Only gate the instance-local isMutatingRef on generation match.
      setTimeout(() => {
        _ttsMutLockCount = Math.max(0, _ttsMutLockCount - 1)
        if (_ttsMutGeneration === gen) {
          isMutatingRef.current = false
        }
      }, 250)
    }
  }, [])

  const areSpansValid = useCallback((): boolean => {
    const map = spanMapRef.current
    if (map.size === 0) return false
    const firstSpan = map.values().next().value
    return firstSpan?.isConnected === true
  }, [])

  const tryRebuild = useCallback(() => {
    const articleEl = document.querySelector("[data-article-content]")
    if (!articleEl) return false
    return buildSpans(articleEl, wordsRef.current)
  }, [buildSpans])

  // Activation/deactivation + MutationObserver + click-to-seek
  useEffect(() => {
    if (!isActive) {
      observerRef.current?.disconnect()
      observerRef.current = null
      isMutatingRef.current = true
      _ttsMutLockCount++
      const gen = ++_ttsMutGeneration
      cleanupFully()
      spanMapRef.current.clear()
      domWordCountRef.current = 0
      alignWordCountRef.current = 0
      domToAlignMapRef.current.clear()
      alignToDomMapRef.current.clear()
      prevIndexRef.current = -1
      initializedRef.current = false
      setTimeout(() => {
        _ttsMutLockCount = Math.max(0, _ttsMutLockCount - 1)
        if (_ttsMutGeneration === gen) {
          isMutatingRef.current = false
          document.dispatchEvent(new CustomEvent("tts-cleanup-complete"))
        }
      }, 250)
      return
    }

    injectStyles()

    const articleEl = document.querySelector("[data-article-content]")
    if (articleEl) {
      const ok = buildSpans(articleEl, wordsRef.current)
      if (process.env.NODE_ENV === "development") {
        console.log("[TTS Highlight] initial buildSpans:", ok, "spans:", spanMapRef.current.size)
      }
    } else if (process.env.NODE_ENV === "development") {
      console.log("[TTS Highlight] article element not found on activation, waiting for MutationObserver")
    }

    const observer = new MutationObserver(() => {
      if (isMutatingRef.current) return

      if (spanMapRef.current.size > 0) {
        if (areSpansValid()) return
        tryRebuild()
        return
      }

      const el = document.querySelector("[data-article-content]")
      if (el) {
        buildSpans(el, wordsRef.current)
      }
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    })
    observerRef.current = observer

    // Click-to-seek: clicking a word span seeks audio to that word's time.
    // Uses mousedown position tracking to distinguish "real clicks" from
    // "drag-to-select" — only a click with < 5px of mouse movement triggers seek.
    // This fixes the desktop bug where pre-existing text selections blocked
    // click-to-seek (the capture-phase handler saw the old selection before
    // the browser collapsed it).
    let mdX = 0, mdY = 0
    const handleMouseDown = (e: MouseEvent) => { mdX = e.clientX; mdY = e.clientY }

    const handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest?.("[data-tts-idx]")
      if (!target) return

      // If mouse moved > 5px from mousedown, user was drag-selecting — don't seek
      const dx = e.clientX - mdX, dy = e.clientY - mdY
      if (dx * dx + dy * dy > 25) return

      const idx = target.getAttribute("data-tts-idx")
      if (idx == null) return

      const domIdx = Number(idx)
      const seek = seekToTimeRef.current
      const w = wordsRef.current
      if (!seek || !w || domIdx < 0) return

      // Map DOM word index → alignment word index via text-based map (robust)
      // Falls back to proportional mapping if no text match found
      const mappedAlignIdx = domToAlignMapRef.current.get(domIdx)
      const alignIdx = mappedAlignIdx !== undefined
        ? mappedAlignIdx
        : domToAlignIdx(domIdx, domWordCountRef.current, alignWordCountRef.current)
      if (alignIdx < 0 || alignIdx >= w.length) return

      const seekTime = w[alignIdx].startTime

      if (process.env.NODE_ENV === "development") {
        console.log("[TTS Click-to-seek] domIdx:", domIdx, "alignIdx:", alignIdx,
          "seekTime:", seekTime.toFixed(2), "word:", w[alignIdx].text)
      }

      // Clear any pre-existing selection so it doesn't interfere
      window.getSelection()?.removeAllRanges()
      e.stopPropagation()
      e.preventDefault()

      // Immediately update visual state on spans (synchronous DOM mutation)
      // so the highlight moves instantly, before React's batched state update.
      const map = spanMapRef.current
      if (map.size > 0) {
        for (const [i, span] of map) {
          span.classList.remove("tts-spoken", "tts-current", "tts-unspoken")
          if (i < domIdx) span.classList.add("tts-spoken")
          else if (i === domIdx) span.classList.add("tts-current")
          else span.classList.add("tts-unspoken")
        }
        prevIndexRef.current = domIdx
        initializedRef.current = true
      }

      seek(seekTime)
      playRef.current?.()
    }
    document.addEventListener("mousedown", handleMouseDown, true)
    document.addEventListener("click", handleClick, true)

    return () => {
      document.removeEventListener("mousedown", handleMouseDown, true)
      document.removeEventListener("click", handleClick, true)
      observer.disconnect()
      observerRef.current = null
      isMutatingRef.current = true
      _ttsMutLockCount++
      const gen = ++_ttsMutGeneration
      cleanupFully()
      spanMapRef.current.clear()
      domWordCountRef.current = 0
      alignWordCountRef.current = 0
      domToAlignMapRef.current.clear()
      alignToDomMapRef.current.clear()
      prevIndexRef.current = -1
      initializedRef.current = false
      setTimeout(() => {
        _ttsMutLockCount = Math.max(0, _ttsMutLockCount - 1)
        if (_ttsMutGeneration === gen) {
          isMutatingRef.current = false
          document.dispatchEvent(new CustomEvent("tts-cleanup-complete"))
        }
      }, 250)
    }
  }, [isActive, buildSpans, areSpansValid, tryRebuild])

  // Throttled scroll — fires immediately on first call, then blocks for 600ms
  // so native smooth scroll finishes before the next one starts.
  const debouncedScrollToSpan = useCallback((span: HTMLSpanElement | undefined) => {
    // If a throttle is active, just store the latest span for trailing call
    if (scrollTimerRef.current) {
      latestSpanRef.current = span
      return
    }
    // Fire immediately
    scrollToSpan(span)
    // Block for 600ms, then fire trailing call if any
    scrollTimerRef.current = setTimeout(() => {
      scrollTimerRef.current = null
      const trailing = latestSpanRef.current
      latestSpanRef.current = undefined
      if (trailing) scrollToSpan(trailing)
    }, 600)
  }, [])

  // Clean up scroll timer on unmount
  useEffect(() => {
    return () => {
      if (scrollTimerRef.current) {
        clearTimeout(scrollTimerRef.current)
        scrollTimerRef.current = null
      }
    }
  }, [])

  // Shared helper: update span CSS classes for a given target index.
  // Handles init (bulk-set), forward (incremental), and backward (bulk or incremental).
  const applyHighlight = useCallback((
    spanIdx: number,
    map: Map<number, HTMLSpanElement>,
  ) => {
    if (spanIdx < 0) return
    // Clamp to last valid span instead of bailing — alignment can have more words
    // than DOM spans (due to TTS normalization, e.g. "$100" → "one hundred dollars").
    if (spanIdx >= map.size) spanIdx = map.size - 1

    if (!initializedRef.current) {
      initializedRef.current = true
      for (const [idx, span] of map) {
        span.classList.remove("tts-spoken", "tts-current", "tts-unspoken")
        if (idx < spanIdx) span.classList.add("tts-spoken")
        else if (idx === spanIdx) span.classList.add("tts-current")
        else span.classList.add("tts-unspoken")
      }
      prevIndexRef.current = spanIdx
      debouncedScrollToSpan(map.get(spanIdx))
      return
    }

    const prev = prevIndexRef.current

    if (spanIdx < prev) {
      const backwardDelta = prev - spanIdx
      if (backwardDelta > 100) {
        for (const [idx, span] of map) {
          span.classList.remove("tts-spoken", "tts-current", "tts-unspoken")
          if (idx < spanIdx) span.classList.add("tts-spoken")
          else if (idx === spanIdx) span.classList.add("tts-current")
          else span.classList.add("tts-unspoken")
        }
      } else {
        for (let i = spanIdx; i <= prev; i++) {
          const span = map.get(i)
          if (!span) continue
          span.classList.remove("tts-spoken", "tts-current", "tts-unspoken")
          if (i < spanIdx) span.classList.add("tts-spoken")
          else if (i === spanIdx) span.classList.add("tts-current")
          else span.classList.add("tts-unspoken")
        }
      }
    } else if (spanIdx > prev) {
      if (prev >= 0) {
        const prevSpan = map.get(prev)
        if (prevSpan) {
          prevSpan.classList.remove("tts-current")
          prevSpan.classList.add("tts-spoken")
        }
        for (let i = prev + 1; i < spanIdx; i++) {
          const span = map.get(i)
          if (span) {
            span.classList.remove("tts-unspoken")
            span.classList.add("tts-spoken")
          }
        }
      }
      const curSpan = map.get(spanIdx)
      if (curSpan) {
        curSpan.classList.remove("tts-unspoken")
        curSpan.classList.add("tts-current")
      }
    } else {
      return // Same index, no update needed
    }

    prevIndexRef.current = spanIdx
    debouncedScrollToSpan(map.get(spanIdx))
  }, [debouncedScrollToSpan])

  // Helper: resolve alignment word index → DOM span index
  const resolveSpanIdx = useCallback((wordIdx: number): number => {
    const mapped = alignToDomMapRef.current.get(wordIdx)
    return mapped !== undefined
      ? mapped
      : alignToDomIdx(wordIdx, domWordCountRef.current, alignWordCountRef.current)
  }, [])

  // ── Hybrid RAF + timeupdate highlight sync ──
  // RAF provides smooth 60fps DOM updates. timeupdate (~4/sec) acts as a
  // never-die fallback — on mobile, RAF silently stops at MP3 chunk boundaries
  // but timeupdate keeps firing from the browser's audio stack.
  // applyHighlight is idempotent (early-exits when spanIdx unchanged), so
  // running from both sources has zero overhead.
  useEffect(() => {
    if (!isActive) return

    const audio = audioRef?.current
    if (!audio) return

    let raf: number | null = null

    const syncHighlight = () => {
      const w = wordsRef.current
      let map = spanMapRef.current

      if (!w?.length) return
      if (map.size === 0 || !areSpansValid()) {
        tryRebuild()
        map = spanMapRef.current
        if (map.size === 0) return
      }

      const t = audio.currentTime
      const wordIdx = findWordAtTime(w, t)
      const spanIdx = resolveSpanIdx(wordIdx)

      if (spanIdx !== prevIndexRef.current || !initializedRef.current) {
        applyHighlight(spanIdx, map)
      }
    }

    // RAF loop: smooth 60fps updates when browser allows
    const tick = () => {
      raf = null
      syncHighlight()
      schedule()
    }
    function schedule() {
      if (audio && !audio.paused && raf == null) {
        raf = requestAnimationFrame(tick)
      }
    }

    // Event listeners: timeupdate is the reliable backbone (~4/sec)
    const onTimeUpdate = () => {
      syncHighlight()
      // Watchdog: restart RAF if it died while audio is playing
      if (raf == null && !audio.paused) schedule()
    }
    const onPlay = () => { schedule() }
    const onSeeked = () => { syncHighlight() }

    audio.addEventListener("timeupdate", onTimeUpdate)
    audio.addEventListener("play", onPlay)
    audio.addEventListener("seeked", onSeeked)

    // Watchdog interval: force-sync highlight every 100ms.
    // On mobile, both RAF and timeupdate can silently stop at MP3 chunk
    // boundaries while audio continues from pre-decoded buffer. This
    // interval ensures highlighting never stalls for more than 100ms.
    // Also restarts RAF if it died (e.g. Chrome throttles RAF during scroll).
    const watchdog = setInterval(() => {
      if (audio.paused) return
      syncHighlight()
      if (raf == null) schedule()
    }, 100)

    // Initial sync
    if (!audio.paused) schedule()
    else syncHighlight()

    return () => {
      clearInterval(watchdog)
      if (raf != null) cancelAnimationFrame(raf)
      audio.removeEventListener("timeupdate", onTimeUpdate)
      audio.removeEventListener("play", onPlay)
      audio.removeEventListener("seeked", onSeeked)
    }
  }, [isActive, audioRef, areSpansValid, tryRebuild, applyHighlight, resolveSpanIdx])

  // Fallback: React state-driven sync for when audioRef is not available.
  // This path is only used if no direct audio reference is provided.
  useEffect(() => {
    if (!isActive || audioRef?.current) return // Skip when event-driven path is active

    let map = spanMapRef.current
    if (map.size === 0 || !areSpansValid()) {
      if (!tryRebuild()) return
      map = spanMapRef.current
    }

    const spanIdx = resolveSpanIdx(currentWordIndex)
    if (spanIdx >= 0 && spanIdx < map.size) {
      applyHighlight(spanIdx, map)
    }
  }, [isActive, audioRef, currentWordIndex, areSpansValid, tryRebuild, applyHighlight, resolveSpanIdx])
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement("style")
  style.id = STYLE_ID
  style.textContent = `
[data-tts-idx] {
  cursor: pointer;
  background-color: transparent;
  padding: 1px 2px;
  margin: 0;
  border: none;
  border-radius: 3px;
}
[data-article-content] .tts-spoken {
  color: var(--foreground) !important;
  opacity: 1 !important;
}
[data-article-content] .tts-current {
  background-color: color-mix(in srgb, var(--primary) 25%, transparent) !important;
  color: var(--foreground) !important;
  opacity: 1 !important;
}
[data-article-content] .tts-unspoken {
  opacity: 0.3 !important;
}

/* ── Annotation marks during TTS playback ── */
/* Spoken words inside marks: keep mark bg, ensure readable text */
mark[data-highlight-id] [data-tts-idx].tts-spoken,
[data-tts-idx].tts-spoken mark[data-highlight-id] {
  color: var(--foreground) !important;
  background-color: transparent !important;
  opacity: 1 !important;
  padding: 0 !important;
}
/* Current word inside marks: show a distinct highlight ring instead of bg color */
mark[data-highlight-id] [data-tts-idx].tts-current,
[data-tts-idx].tts-current mark[data-highlight-id] {
  color: var(--foreground) !important;
  background-color: transparent !important;
  opacity: 1 !important;
  padding: 0 !important;
  text-decoration: underline 2px var(--primary) !important;
  text-underline-offset: 3px !important;
}
/* Unspoken words inside marks: dim slightly but less than normal unspoken text */
mark[data-highlight-id] [data-tts-idx].tts-unspoken,
[data-tts-idx].tts-unspoken mark[data-highlight-id] {
  opacity: 0.55 !important;
  background-color: transparent !important;
  padding: 0 !important;
}
/* The mark element itself should stay visible with full bg during TTS */
mark[data-highlight-id]:has([data-tts-idx]) {
  opacity: 1 !important;
}
`
  document.head.appendChild(style)
}

function wrapWords(positions: WordPosition[]): Map<number, HTMLSpanElement> {
  const map = new Map<number, HTMLSpanElement>()

  const groups = new Map<Text, { idx: number; start: number; end: number }[]>()
  for (let i = 0; i < positions.length; i++) {
    const pos = positions[i]
    let list = groups.get(pos.node)
    if (!list) {
      list = []
      groups.set(pos.node, list)
    }
    list.push({ idx: i, start: pos.start, end: pos.end })
  }

  for (const [textNode, wordList] of groups) {
    const text = textNode.textContent || ""
    const parent = textNode.parentNode
    if (!parent) continue

    // When text node is inside a <mark data-highlight-id>, create spans inside
    // the mark rather than replacing at the mark level, preserving annotation DOM.
    const frag = document.createDocumentFragment()
    let cursor = 0

    for (const word of wordList) {
      if (word.start > cursor) {
        frag.appendChild(document.createTextNode(text.slice(cursor, word.start)))
      }

      const span = document.createElement("span")
      span.setAttribute("data-tts-idx", String(word.idx))
      span.textContent = text.slice(word.start, word.end)
      frag.appendChild(span)
      map.set(word.idx, span)

      cursor = word.end
    }

    if (cursor < text.length) {
      frag.appendChild(document.createTextNode(text.slice(cursor)))
    }

    parent.replaceChild(frag, textNode)
  }

  return map
}

function removeAllTTSSpans() {
  const spans = document.querySelectorAll("[data-tts-idx]")
  if (spans.length === 0) return
  const parents = new Set<Node>()

  for (const span of spans) {
    const parent = span.parentNode
    if (!parent) continue
    parents.add(parent)
    parent.replaceChild(document.createTextNode(span.textContent || ""), span)
  }

  for (const parent of parents) {
    (parent as Element).normalize()
  }
}

function cleanupFully() {
  removeAllTTSSpans()
  document.getElementById(STYLE_ID)?.remove()
}

function scrollToSpan(span: HTMLSpanElement | undefined) {
  if (!span) return

  const desktopSc = document.querySelector("[data-desktop-scroll]")
  const mobileSc = desktopSc ? null : document.querySelector("[data-mobile-scroll]")
  const sc = desktopSc ?? mobileSc
  if (!sc) return

  const rect = span.getBoundingClientRect()
  const containerRect = sc.getBoundingClientRect()

  // Visible bottom = whichever is smaller: container bottom or player top.
  // The player is fixed-positioned and can overlap the scroll container.
  const player = document.querySelector<HTMLElement>("[data-tts-player]")
  const playerTop = player ? player.getBoundingClientRect().top : Infinity
  const effectiveBottom = Math.min(containerRect.bottom, playerTop) - 24

  const topEdge = containerRect.top + 40

  const isVisible = rect.top >= topEdge && rect.bottom <= effectiveBottom

  if (!isVisible) {
    // Use absolute scrollTo instead of relative scrollBy.
    // scrollTo to the same target is a no-op, so overlapping calls don't compound.
    const visibleHeight = effectiveBottom - topEdge
    const offsetFromTarget = rect.top - (topEdge + visibleHeight * 0.3)
    const targetScrollTop = sc.scrollTop + offsetFromTarget
    sc.scrollTo({ top: targetScrollTop, behavior: "smooth" })
  }
}
