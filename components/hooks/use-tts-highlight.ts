"use client"

import { useCallback, useEffect, useRef } from "react"
import { buildWordPositions, type WordPosition } from "@/lib/tts-text"

type TranscriptWord = {
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
  /** Transcript words with timing data (used for click-to-seek) */
  words?: TranscriptWord[]
}

const STYLE_ID = "tts-highlight-styles"

/**
 * Highlights the current TTS word on the article DOM by wrapping every word
 * in a `<span data-tts-idx>` and toggling CSS classes as playback advances.
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
  const prevIndexRef = useRef<number>(-1)
  const initializedRef = useRef(false)
  const observerRef = useRef<MutationObserver | null>(null)
  const isMutatingRef = useRef(false)

  // Keep latest callbacks in refs to avoid stale closures in event handlers
  const seekToTimeRef = useRef(seekToTime)
  seekToTimeRef.current = seekToTime
  const playRef = useRef(play)
  playRef.current = play
  const wordsRef = useRef(words)
  wordsRef.current = words

  const buildSpans = useCallback((articleEl: Element): boolean => {
    isMutatingRef.current = true
    try {
      removeAllTTSSpans()
      spanMapRef.current.clear()

      const positions = buildWordPositions(articleEl)
      if (positions.length === 0) return false

      injectStyles()
      const map = wrapWords(positions)
      spanMapRef.current = map
      initializedRef.current = false
      prevIndexRef.current = -1

      return true
    } finally {
      queueMicrotask(() => {
        isMutatingRef.current = false
      })
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
    return buildSpans(articleEl)
  }, [buildSpans])

  // Activation/deactivation + MutationObserver + click-to-seek
  useEffect(() => {
    if (!isActive) {
      observerRef.current?.disconnect()
      observerRef.current = null
      isMutatingRef.current = true
      cleanupFully()
      spanMapRef.current.clear()
      prevIndexRef.current = -1
      initializedRef.current = false
      queueMicrotask(() => {
        isMutatingRef.current = false
      })
      return
    }

    injectStyles()

    const articleEl = document.querySelector("[data-article-content]")
    if (articleEl) {
      buildSpans(articleEl)
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
        buildSpans(el)
      }
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    })
    observerRef.current = observer

    // Click-to-seek: clicking a word span seeks audio to that word's time
    const handlePointerDown = (e: PointerEvent) => {
      const target = (e.target as HTMLElement)?.closest?.("[data-tts-idx]")
      if (!target) return
      const idx = target.getAttribute("data-tts-idx")
      if (idx == null) return

      const wordIndex = Number(idx)
      const w = wordsRef.current
      const seek = seekToTimeRef.current
      if (!w || !seek || wordIndex < 0 || wordIndex >= w.length) return

      e.preventDefault()
      e.stopPropagation()
      seek(w[wordIndex].startTime)
      // Small delay to let seek take effect before playing
      requestAnimationFrame(() => {
        playRef.current?.()
      })
    }
    document.addEventListener("pointerdown", handlePointerDown, true)

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true)
      observer.disconnect()
      observerRef.current = null
      isMutatingRef.current = true
      cleanupFully()
      spanMapRef.current.clear()
      prevIndexRef.current = -1
      initializedRef.current = false
      queueMicrotask(() => {
        isMutatingRef.current = false
      })
    }
  }, [isActive, buildSpans, areSpansValid, tryRebuild])

  // Toggle classes on word change
  useEffect(() => {
    if (!isActive) return

    let map = spanMapRef.current

    if (map.size === 0 || !areSpansValid()) {
      if (!tryRebuild()) return
      map = spanMapRef.current
    }

    if (currentWordIndex < 0 || currentWordIndex >= map.size) return

    // First run or after a rebuild: bulk-set all spans
    if (!initializedRef.current) {
      initializedRef.current = true
      for (const [idx, span] of map) {
        span.classList.remove("tts-spoken", "tts-current", "tts-unspoken")
        if (idx < currentWordIndex) span.classList.add("tts-spoken")
        else if (idx === currentWordIndex) span.classList.add("tts-current")
        else span.classList.add("tts-unspoken")
      }
      prevIndexRef.current = currentWordIndex
      scrollToSpan(map.get(currentWordIndex))
      return
    }

    const prev = prevIndexRef.current

    if (currentWordIndex < prev) {
      for (let i = currentWordIndex; i <= prev; i++) {
        const span = map.get(i)
        if (!span) continue
        span.classList.remove("tts-spoken", "tts-current", "tts-unspoken")
        if (i < currentWordIndex) span.classList.add("tts-spoken")
        else if (i === currentWordIndex) span.classList.add("tts-current")
        else span.classList.add("tts-unspoken")
      }
    } else {
      if (prev >= 0) {
        const prevSpan = map.get(prev)
        if (prevSpan) {
          prevSpan.classList.remove("tts-current")
          prevSpan.classList.add("tts-spoken")
        }
        for (let i = prev + 1; i < currentWordIndex; i++) {
          const span = map.get(i)
          if (span) {
            span.classList.remove("tts-unspoken")
            span.classList.add("tts-spoken")
          }
        }
      }
      const curSpan = map.get(currentWordIndex)
      if (curSpan) {
        curSpan.classList.remove("tts-unspoken")
        curSpan.classList.add("tts-current")
      }
    }

    prevIndexRef.current = currentWordIndex
    scrollToSpan(map.get(currentWordIndex))
  }, [isActive, currentWordIndex, areSpansValid, tryRebuild])
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
  transition: color 0.15s, background-color 0.15s;
  cursor: pointer;
}
.tts-spoken {
  color: inherit;
}
.tts-current {
  background-color: color-mix(in srgb, var(--primary) 15%, transparent);
  border-radius: 3px;
  padding: 1px 2px;
}
.tts-unspoken {
  color: var(--muted-foreground);
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

  const sc =
    document.querySelector("[data-desktop-scroll]") ??
    document.querySelector("[data-mobile-scroll]")
  if (!sc) return

  const rect = span.getBoundingClientRect()
  const containerRect = sc.getBoundingClientRect()

  const isVisible =
    rect.top >= containerRect.top + 60 &&
    rect.bottom <= containerRect.bottom - 100

  if (!isVisible) {
    span.scrollIntoView({ behavior: "smooth", block: "center" })
  }
}
