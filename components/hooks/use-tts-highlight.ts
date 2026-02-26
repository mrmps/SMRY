"use client"

import { useCallback, useEffect, useRef } from "react"
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

      // Build text-based forward matching: DOM word → alignment word.
      // This is robust against word count mismatches (brackets, normalization, etc.)
      // and replaces the fragile proportional index mapping.
      const domToAlign = new Map<number, number>()
      const alignToDom = new Map<number, number>()

      if (alignmentWords?.length) {
        let alignPtr = 0
        for (let domIdx = 0; domIdx < positions.length && alignPtr < alignmentWords.length; domIdx++) {
          const pos = positions[domIdx]
          const domWord = (pos.node.textContent || "").slice(pos.start, pos.end)

          // Forward search for matching alignment word (up to 10 ahead)
          const searchLimit = Math.min(alignPtr + 10, alignmentWords.length)
          for (let j = alignPtr; j < searchLimit; j++) {
            if (textMatch(domWord, alignmentWords[j].text)) {
              domToAlign.set(domIdx, j)
              alignToDom.set(j, domIdx)
              alignPtr = j + 1
              break
            }
          }
        }

        // Fill gaps in alignToDom: unmatched alignment indices → nearest previous matched DOM index
        let lastDomIdx = 0
        for (let i = 0; i < alignmentWords.length; i++) {
          if (alignToDom.has(i)) {
            lastDomIdx = alignToDom.get(i)!
          } else {
            alignToDom.set(i, lastDomIdx)
          }
        }
      }

      domToAlignMapRef.current = domToAlign
      alignToDomMapRef.current = alignToDom

      if (process.env.NODE_ENV === "development" && alignmentWords?.length) {
        const matched = domToAlign.size
        if (positions.length !== alignmentWords.length) {
          console.warn("[TTS Highlight] word count mismatch — DOM:", positions.length, "alignment:", alignmentWords.length, "text-matched:", matched)
        } else {
          console.log("[TTS Highlight] word counts match:", positions.length, "text-matched:", matched)
        }
      }

      injectStyles()
      const map = wrapWords(positions)
      spanMapRef.current = map
      initializedRef.current = false
      prevIndexRef.current = -1

      return true
    } finally {
      // Use setTimeout(250) instead of queueMicrotask so the lock stays held
      // long enough to cover the useInlineHighlights MutationObserver debounce (150ms).
      // Generation counter prevents stale timeouts from decrementing the lock
      // during close→reopen races.
      setTimeout(() => {
        if (_ttsMutGeneration === gen) {
          isMutatingRef.current = false
          _ttsMutLockCount = Math.max(0, _ttsMutLockCount - 1)
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
        if (_ttsMutGeneration === gen) {
          isMutatingRef.current = false
          _ttsMutLockCount = Math.max(0, _ttsMutLockCount - 1)
          // Notify annotation highlights to re-apply now that TTS cleanup is done
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
    // Uses "click" (not "pointerdown") so text selection/drag doesn't trigger seek.
    //
    // Direct index mapping: DOM span index → alignment word index → seek time.
    // Both word lists come from the same cleaned text so indices are 1:1 when
    // counts match, with proportional fallback for mismatches.
    const handleClick = (e: MouseEvent) => {
      // Don't seek if user selected text (drag-to-highlight)
      const selection = window.getSelection()
      if (selection && selection.toString().length > 0) return

      const target = (e.target as HTMLElement)?.closest?.("[data-tts-idx]")
      if (!target) return
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
    document.addEventListener("click", handleClick, true)

    return () => {
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
        if (_ttsMutGeneration === gen) {
          isMutatingRef.current = false
          _ttsMutLockCount = Math.max(0, _ttsMutLockCount - 1)
          document.dispatchEvent(new CustomEvent("tts-cleanup-complete"))
        }
      }, 250)
    }
  }, [isActive, buildSpans, areSpansValid, tryRebuild])

  // Debounced scroll to avoid excessive layout thrashing
  const debouncedScrollToSpan = useCallback((span: HTMLSpanElement | undefined) => {
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current)
    scrollTimerRef.current = setTimeout(() => {
      scrollTimerRef.current = null
      scrollToSpan(span)
    }, 300)
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

  // Toggle classes on word change.
  // `currentWordIndex` is an alignment word index (from composeSegments).
  // Map it to a DOM span index using direct 1:1 mapping (proportional fallback
  // when word counts differ).
  useEffect(() => {
    if (!isActive) return

    let map = spanMapRef.current

    if (map.size === 0 || !areSpansValid()) {
      if (process.env.NODE_ENV === "development") {
        console.log("[TTS Highlight] spans invalid/empty, attempting rebuild. size:", map.size, "valid:", map.size > 0 ? areSpansValid() : "N/A")
      }
      if (!tryRebuild()) {
        if (process.env.NODE_ENV === "development") {
          console.warn("[TTS Highlight] rebuild failed — article element may not be in DOM")
        }
        return
      }
      map = spanMapRef.current
    }

    // Map alignment word index → DOM span index via text-based map (robust)
    // Falls back to proportional mapping if no text match found
    const mappedDomIdx = alignToDomMapRef.current.get(currentWordIndex)
    const spanIdx = mappedDomIdx !== undefined
      ? mappedDomIdx
      : alignToDomIdx(currentWordIndex, domWordCountRef.current, alignWordCountRef.current)

    if (spanIdx < 0 || spanIdx >= map.size) return

    // First run or after a rebuild: bulk-set all spans
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
      // Backward seek: use bulk path if jumping >100 words
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
    } else {
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
    }

    prevIndexRef.current = spanIdx
    debouncedScrollToSpan(map.get(spanIdx))
  }, [isActive, currentWordIndex, areSpansValid, tryRebuild, debouncedScrollToSpan])
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Compare two words for matching, handling punctuation and case differences */
function textMatch(a: string, b: string): boolean {
  if (a === b) return true
  const aNorm = a.replace(/[^a-zA-Z0-9]/g, "").toLowerCase()
  const bNorm = b.replace(/[^a-zA-Z0-9]/g, "").toLowerCase()
  if (!aNorm || !bNorm) return false
  if (aNorm === bNorm) return true
  // Containment check for partial matches (e.g., "[1]," vs "1")
  if (aNorm.length >= 2 && bNorm.length >= 2) {
    if (aNorm.includes(bNorm) || bNorm.includes(aNorm)) return true
  }
  return false
}

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement("style")
  style.id = STYLE_ID
  style.textContent = `
[data-tts-idx] {
  transition: color 0.08s ease-out, background-color 0.08s ease-out, opacity 0.08s ease-out;
  cursor: pointer;
  background-color: transparent;
  padding: 0;
  margin: 0;
  border: none;
}
[data-article-content] .tts-spoken {
  color: var(--foreground) !important;
}
[data-article-content] .tts-current {
  background-color: color-mix(in srgb, var(--primary) 30%, transparent) !important;
  border-radius: 3px;
  padding: 1px 2px;
  color: var(--foreground) !important;
}
[data-article-content] .tts-unspoken {
  opacity: 0.35 !important;
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

  // Mobile TTS player covers ~180px from bottom; use a larger buffer to keep
  // the current word above the floating player instead of hidden behind it.
  const bottomBuffer = mobileSc ? 200 : 100

  const isVisible =
    rect.top >= containerRect.top + 60 &&
    rect.bottom <= containerRect.bottom - bottomBuffer

  if (!isVisible) {
    span.scrollIntoView({ behavior: "smooth", block: "center" })
  }
}
