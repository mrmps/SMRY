"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react"
type CharacterAlignmentResponseModel = {
  characters: string[]
  characterStartTimesSeconds: number[]
  characterEndTimesSeconds: number[]
}

type ComposeSegmentsOptions = {
  hideAudioTags?: boolean
}

type BaseSegment = {
  segmentIndex: number
  text: string
}

type TranscriptWord = BaseSegment & {
  kind: "word"
  wordIndex: number
  startTime: number
  endTime: number
}

type GapSegment = BaseSegment & {
  kind: "gap"
}

type TranscriptSegment = TranscriptWord | GapSegment

type ComposeSegmentsResult = {
  segments: TranscriptSegment[]
  words: TranscriptWord[]
}

type SegmentComposer = (
  alignment: CharacterAlignmentResponseModel
) => ComposeSegmentsResult

function composeSegments(
  alignment: CharacterAlignmentResponseModel,
  options: ComposeSegmentsOptions = {}
): ComposeSegmentsResult {
  const {
    characters,
    characterStartTimesSeconds: starts,
    characterEndTimesSeconds: ends,
  } = alignment

  // Validate alignment arrays — truncate to shortest if mismatched
  if (!characters?.length || !starts?.length || !ends?.length) {
    return { segments: [], words: [] }
  }
  const minLen = Math.min(characters.length, starts.length, ends.length)
  if (characters.length !== starts.length || characters.length !== ends.length) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[TTS Player] alignment array length mismatch — chars:", characters.length, "starts:", starts.length, "ends:", ends.length, "truncating to:", minLen)
    }
    characters.length = minLen
    starts.length = minLen
    ends.length = minLen
  }

  const segments: TranscriptSegment[] = []
  const words: TranscriptWord[] = []

  let wordBuffer = ""
  let whitespaceBuffer = ""
  let wordStart = 0
  let wordEnd = 0
  let segmentIndex = 0
  let wordIndex = 0
  let insideAudioTag = false

  const hideAudioTags = options.hideAudioTags ?? false

  const flushWhitespace = () => {
    if (!whitespaceBuffer) return
    segments.push({
      kind: "gap",
      segmentIndex: segmentIndex++,
      text: whitespaceBuffer,
    })
    whitespaceBuffer = ""
  }

  const flushWord = () => {
    if (!wordBuffer) return
    const word: TranscriptWord = {
      kind: "word",
      segmentIndex: segmentIndex++,
      wordIndex: wordIndex++,
      text: wordBuffer,
      startTime: wordStart,
      endTime: wordEnd,
    }
    segments.push(word)
    words.push(word)
    wordBuffer = ""
  }

  for (let i = 0; i < characters.length; i++) {
    const char = characters[i]
    const start = starts[i] ?? 0
    const end = ends[i] ?? start

    if (hideAudioTags) {
      if (char === "[") {
        flushWord()
        whitespaceBuffer = ""
        insideAudioTag = true
        continue
      }

      if (insideAudioTag) {
        if (char === "]") insideAudioTag = false
        continue
      }
    }

    if (/\s/.test(char)) {
      flushWord()
      whitespaceBuffer += char
      continue
    }

    if (whitespaceBuffer) {
      flushWhitespace()
    }

    if (!wordBuffer) {
      wordBuffer = char
      wordStart = start
      wordEnd = end
    } else {
      wordBuffer += char
      wordEnd = end
    }
  }

  flushWord()
  flushWhitespace()

  return { segments, words }
}

type UseTranscriptViewerProps = {
  alignment: CharacterAlignmentResponseModel
  segmentComposer?: SegmentComposer
  hideAudioTags?: boolean
  onPlay?: () => void
  onPause?: () => void
  onTimeUpdate?: (time: number) => void
  onEnded?: () => void
  onDurationChange?: (duration: number) => void
  onAudioError?: (error: MediaError | null) => void
  onBuffering?: (isBuffering: boolean) => void
}

type UseTranscriptViewerResult = {
  segments: TranscriptSegment[]
  words: TranscriptWord[]
  spokenSegments: TranscriptSegment[]
  unspokenSegments: TranscriptSegment[]
  currentWord: TranscriptWord | null
  currentSegmentIndex: number
  currentWordIndex: number
  seekToTime: (time: number) => void
  seekToWord: (word: number | TranscriptWord) => void
  audioRef: RefObject<HTMLAudioElement | null>
  isPlaying: boolean
  isBuffering: boolean
  isScrubbing: boolean
  duration: number
  currentTime: number
  play: () => void
  pause: () => void
  toggle: () => void
  resume: () => void
  startScrubbing: () => void
  endScrubbing: () => void
}

function useTranscriptViewer({
  alignment,
  hideAudioTags = true,
  segmentComposer,
  onPlay,
  onPause,
  onTimeUpdate,
  onEnded,
  onDurationChange,
  onAudioError,
  onBuffering,
}: UseTranscriptViewerProps): UseTranscriptViewerResult {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const handleTimeUpdateRef = useRef<(time: number) => void>(() => {})
  const onDurationChangeRef = useRef<(duration: number) => void>(() => {})
  const onPlayRef = useRef<(() => void) | undefined>(onPlay)
  const onPauseRef = useRef<(() => void) | undefined>(onPause)
  const onEndedRef = useRef<(() => void) | undefined>(onEnded)
  const onTimeUpdateCallbackRef = useRef<((time: number) => void) | undefined>(onTimeUpdate)
  const onErrorRef = useRef<((error: MediaError | null) => void) | undefined>(onAudioError)
  const onBufferingRef = useRef<((isBuffering: boolean) => void) | undefined>(onBuffering)
  /** Set to true when audio auto-pauses at content end; cleared on seek */
  const reachedEndRef = useRef(false)
  /** Timestamp of last programmatic seek — used to suppress auto-pause and
   *  prevent browser seeked/timeupdate events from overwriting the optimistic update */
  const lastSeekTimeRef = useRef(0)

  const [isPlaying, setIsPlaying] = useState(false)
  const [isBuffering, setIsBuffering] = useState(false)
  const [isScrubbing, setIsScrubbing] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)

  const { segments, words } = useMemo(() => {
    const result = segmentComposer
      ? segmentComposer(alignment)
      : composeSegments(alignment, { hideAudioTags })
    if (process.env.NODE_ENV === "development") {
      console.log("[TTS Player] composeSegments: segments:", result.segments.length, "words:", result.words.length, "alignment chars:", alignment?.characters?.length ?? 0)
    }
    return result
  }, [segmentComposer, alignment, hideAudioTags])

  const guessedDuration = useMemo(() => {
    const ends = alignment?.characterEndTimesSeconds
    if (Array.isArray(ends) && ends.length) {
      const last = ends[ends.length - 1]
      return Number.isFinite(last) ? last : 0
    }
    if (words.length) {
      const lastWord = words[words.length - 1]
      return Number.isFinite(lastWord.endTime) ? lastWord.endTime : 0
    }
    return 0
  }, [alignment, words])

  // Content end time from alignment — used to auto-end and cap displayed duration
  const contentEndRef = useRef(guessedDuration)
  useEffect(() => { contentEndRef.current = guessedDuration }, [guessedDuration])

  const [currentWordIndex, setCurrentWordIndex] = useState<number>(() =>
    words.length ? 0 : -1
  )
  const currentWordIndexRef = useRef(currentWordIndex)
  const updateWordIndex = useCallback((idx: number) => {
    currentWordIndexRef.current = idx
    setCurrentWordIndex(idx)
  }, [])

  // Reset playback state when alignment changes (during render, not in effect)
  // Uses the useState-based pattern from React docs:
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [prevAlignment, setPrevAlignment] = useState(alignment)
  if (prevAlignment !== alignment) {
    setPrevAlignment(alignment)
    setCurrentTime(0)
    setDuration(guessedDuration)
    setIsPlaying(false)
    // Set word index directly (not via updateWordIndex which accesses a ref during render)
    setCurrentWordIndex(words.length ? 0 : -1)
  }

  // Keep ref in sync after render-phase reset
  useEffect(() => {
    currentWordIndexRef.current = currentWordIndex
  }, [currentWordIndex])

  const findWordIndex = useCallback(
    (time: number) => {
      if (!words.length) return -1
      let lo = 0
      let hi = words.length - 1
      let answer = -1
      while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2)
        const word = words[mid]
        if (time >= word.startTime && time < word.endTime) {
          answer = mid
          break
        }
        if (time < word.startTime) {
          hi = mid - 1
        } else {
          lo = mid + 1
        }
      }
      // When time falls in a gap between words, keep the preceding word highlighted
      if (answer === -1 && lo > 0) {
        answer = lo - 1
      }
      return answer
    },
    [words]
  )

  const handleTimeUpdate = useCallback(
    (currentTime: number) => {
      if (!words.length) return

      const idx = currentWordIndexRef.current
      const currentWord =
        idx >= 0 && idx < words.length ? words[idx] : undefined

      if (!currentWord) {
        const found = findWordIndex(currentTime)
        if (found !== -1) updateWordIndex(found)
        return
      }

      let next = idx
      if (currentTime >= currentWord.endTime && idx + 1 < words.length) {
        while (
          next + 1 < words.length &&
          currentTime >= words[next + 1].startTime
        ) {
          next++
        }
        updateWordIndex(next)
        return
      }

      if (currentTime < currentWord.startTime) {
        const found = findWordIndex(currentTime)
        if (found !== -1) updateWordIndex(found)
        return
      }

      const found = findWordIndex(currentTime)
      if (found !== -1 && found !== idx) {
        updateWordIndex(found)
      }
    },
    [findWordIndex, words, updateWordIndex]
  )

  useEffect(() => {
    handleTimeUpdateRef.current = handleTimeUpdate
  }, [handleTimeUpdate])

  useEffect(() => {
    onDurationChangeRef.current = onDurationChange ?? (() => {})
  }, [onDurationChange])

  useEffect(() => { onPlayRef.current = onPlay }, [onPlay])
  useEffect(() => { onPauseRef.current = onPause }, [onPause])
  useEffect(() => { onEndedRef.current = onEnded }, [onEnded])
  useEffect(() => { onTimeUpdateCallbackRef.current = onTimeUpdate }, [onTimeUpdate])
  useEffect(() => { onErrorRef.current = onAudioError }, [onAudioError])
  useEffect(() => { onBufferingRef.current = onBuffering }, [onBuffering])

  const stopRaf = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [])

  const startRaf = useCallback(() => {
    if (rafRef.current != null) return
    if (process.env.NODE_ENV === "development") console.log("[TTS Player] RAF loop started")
    const tick = () => {
      const node = audioRef.current
      if (!node) {
        if (process.env.NODE_ENV === "development") console.warn("[TTS Player] RAF tick: audio node is null, stopping loop")
        rafRef.current = null
        return
      }

      // If audio was paused externally (not by us), stop the RAF loop cleanly
      if (node.paused) {
        rafRef.current = null
        return
      }

      const time = node.currentTime
      const contentEnd = contentEndRef.current

      // Skip time/word updates during the 150ms suppression window after a
      // programmatic seek — the optimistic values from seekToTime are correct;
      // the browser's intermediate currentTime may not be.
      const msSinceSeek = Date.now() - lastSeekTimeRef.current
      if (msSinceSeek >= 150) {
        setCurrentTime(contentEnd > 0 ? Math.min(time, contentEnd) : time)
        handleTimeUpdateRef.current(time)
      }

      // Auto-pause when all article text has been spoken (skip trailing silence).
      // After a seek, give 2s grace so scrubbing near the end doesn't
      // immediately auto-pause — the user expects to hear audio from that point.
      if (contentEnd > 0 && time >= contentEnd && !node.paused) {
        if (msSinceSeek > 2000) {
          reachedEndRef.current = true
          node.pause()
          rafRef.current = null
          return
        }
      }

      if (Number.isFinite(node.duration) && node.duration > 0) {
        setDuration((prev) => {
          if (!prev) {
            const effective = contentEnd > 0 ? contentEnd : node.duration
            onDurationChangeRef.current(effective)
            return effective
          }
          return prev
        })
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [audioRef])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) {
      if (process.env.NODE_ENV === "development") console.warn("[TTS Player] audio element not found in setup effect")
      return
    }
    if (process.env.NODE_ENV === "development") {
      console.log("[TTS Player] audio element setup. src:", audio.src ? audio.src.slice(0, 50) + "..." : "none", "words:", words.length, "guessedDuration:", guessedDuration.toFixed(2))
    }

    const syncPlayback = () => setIsPlaying(!audio.paused)
    const syncTime = () => {
      const contentEnd = contentEndRef.current
      const raw = audio.currentTime
      setCurrentTime(contentEnd > 0 ? Math.min(raw, contentEnd) : raw)
    }
    const syncDuration = () => {
      const contentEnd = contentEndRef.current
      const raw = Number.isFinite(audio.duration) ? audio.duration : 0
      setDuration(contentEnd > 0 ? contentEnd : raw)
    }

    const handlePlay = () => {
      if (process.env.NODE_ENV === "development") console.log("[TTS Player] play at", audio.currentTime.toFixed(2))
      syncPlayback()
      startRaf()
      onPlayRef.current?.()
    }
    const handlePause = () => {
      if (process.env.NODE_ENV === "development") console.log("[TTS Player] pause at", audio.currentTime.toFixed(2))
      syncPlayback()
      syncTime()
      stopRaf()
      onPauseRef.current?.()
    }
    const handleEnded = () => {
      if (process.env.NODE_ENV === "development") console.log("[TTS Player] ended at", audio.currentTime.toFixed(2))
      reachedEndRef.current = true
      syncPlayback()
      syncTime()
      stopRaf()
      onEndedRef.current?.()
    }
    const handleTimeUpdateEvt = () => {
      // During programmatic seeks, skip browser time updates for 150ms to
      // prevent the optimistic state from being reverted to a stale position
      const msSinceSeek = Date.now() - lastSeekTimeRef.current
      if (msSinceSeek < 150) return
      syncTime()
      onTimeUpdateCallbackRef.current?.(audio.currentTime)
    }
    const handleSeeked = () => {
      // The browser finished seeking — sync to the actual audio position.
      // Only update word index if NOT in the immediate aftermath of a
      // programmatic seek (which already did an optimistic update).
      const msSinceSeek = Date.now() - lastSeekTimeRef.current
      lastSeekTimeRef.current = Date.now()
      syncTime()
      if (msSinceSeek > 150) {
        handleTimeUpdateRef.current(audio.currentTime)
      }
    }
    const handleDuration = () => {
      syncDuration()
      const contentEnd = contentEndRef.current
      const effective = contentEnd > 0 ? contentEnd : audio.duration
      onDurationChangeRef.current(effective)
    }

    syncPlayback()
    syncTime()
    syncDuration()
    if (!audio.paused) {
      startRaf()
    } else {
      stopRaf()
    }

    const handleError = () => {
      stopRaf()
      syncPlayback()
      setIsBuffering(false)
      onErrorRef.current?.(audio.error)
    }
    const handleWaiting = () => {
      setIsBuffering(true)
      onBufferingRef.current?.(true)
    }
    const handlePlaying = () => {
      setIsBuffering(false)
      onBufferingRef.current?.(false)
    }

    audio.addEventListener("play", handlePlay)
    audio.addEventListener("pause", handlePause)
    audio.addEventListener("ended", handleEnded)
    audio.addEventListener("timeupdate", handleTimeUpdateEvt)
    audio.addEventListener("seeked", handleSeeked)
    audio.addEventListener("durationchange", handleDuration)
    audio.addEventListener("loadedmetadata", handleDuration)
    audio.addEventListener("error", handleError)
    audio.addEventListener("waiting", handleWaiting)
    audio.addEventListener("playing", handlePlaying)

    return () => {
      stopRaf()
      audio.removeEventListener("play", handlePlay)
      audio.removeEventListener("pause", handlePause)
      audio.removeEventListener("ended", handleEnded)
      audio.removeEventListener("timeupdate", handleTimeUpdateEvt)
      audio.removeEventListener("seeked", handleSeeked)
      audio.removeEventListener("durationchange", handleDuration)
      audio.removeEventListener("loadedmetadata", handleDuration)
      audio.removeEventListener("error", handleError)
      audio.removeEventListener("waiting", handleWaiting)
      audio.removeEventListener("playing", handlePlaying)
    }
  }, [audioRef, startRaf, stopRaf])

  const seekToTime = useCallback(
    (time: number) => {
      const node = audioRef.current
      if (!node) return
      const wasPlaying = !node.paused

      // Clamp to valid range — stay 0.1s before both audio end and content end
      // to prevent the browser from firing 'ended' and the auto-pause from
      // immediately triggering, which causes the "click end breaks audio" bug.
      const audioDuration = Number.isFinite(node.duration) ? node.duration : Infinity
      const contentEnd = contentEndRef.current
      const effectiveMax = Math.min(
        audioDuration > 0.2 ? audioDuration - 0.1 : audioDuration,
        contentEnd > 0.2 ? contentEnd - 0.1 : contentEnd > 0 ? contentEnd : Infinity,
      )
      const clamped = Math.max(0, Math.min(time, effectiveMax))

      reachedEndRef.current = false
      lastSeekTimeRef.current = Date.now()

      // Optimistic UI update — React state updates immediately so the
      // scrub bar and word highlights respond without waiting for the
      // browser's async seek to complete.
      setCurrentTime(clamped)
      handleTimeUpdateRef.current(clamped)

      // Set the actual audio position
      node.currentTime = clamped

      // Resume playback if it was playing before the seek.
      // Some browsers briefly pause during seeking, so check paused state.
      if (wasPlaying && node.paused) {
        void node.play()
      }

      // Ensure RAF is running when audio should be playing.
      // This handles edge cases where the RAF stopped (auto-pause, event race)
      // but audio is still active after the seek.
      if (!node.paused && rafRef.current == null) {
        startRaf()
      }
    },
    [audioRef, startRaf]
  )

  const seekToWord = useCallback(
    (word: number | TranscriptWord) => {
      const target = typeof word === "number" ? words[word] : word
      if (!target) return
      seekToTime(target.startTime)
    },
    [seekToTime, words]
  )

  /** Resume playback from current position — never restarts from beginning */
  const resume = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    reachedEndRef.current = false
    if (audio.paused) {
      void audio.play()
    }
    // Safety: ensure RAF is running whenever audio is playing
    if (!audio.paused && rafRef.current == null) {
      startRaf()
    }
  }, [audioRef, startRaf])

  /** Start playback — only restarts from beginning if audio reached the end */
  const play = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (reachedEndRef.current) {
      reachedEndRef.current = false
      audio.currentTime = 0
      setCurrentTime(0)
      updateWordIndex(words.length ? 0 : -1)
      handleTimeUpdateRef.current(0)
    }
    if (audio.paused) {
      void audio.play()
    }
  }, [audioRef, words.length, updateWordIndex])

  const pause = useCallback(() => {
    const audio = audioRef.current
    if (audio && !audio.paused) {
      audio.pause()
    }
  }, [audioRef])

  /**
   * Toggle play/pause — used by the play button and keyboard shortcuts.
   * If audio reached the end, restarts. Otherwise resumes from current position.
   */
  const toggle = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
      // Only restart from beginning if the audio actually finished
      if (reachedEndRef.current) {
        play()
      } else {
        resume()
      }
    } else {
      audio.pause()
    }
  }, [audioRef, play, resume])

  const startScrubbing = useCallback(() => {
    setIsScrubbing(true)
    stopRaf()
  }, [stopRaf])

  const endScrubbing = useCallback(() => {
    setIsScrubbing(false)
    const node = audioRef.current
    if (!node) return
    // Always restart RAF when audio is playing after scrub.
    // Stop first to reset any stale tick, then start fresh.
    if (!node.paused) {
      stopRaf()
      startRaf()
    }
  }, [audioRef, startRaf, stopRaf])

  const currentWord =
    currentWordIndex >= 0 && currentWordIndex < words.length
      ? words[currentWordIndex]
      : null
  const currentSegmentIndex = currentWord?.segmentIndex ?? -1

  const spokenSegments = useMemo(() => {
    if (!segments.length || currentSegmentIndex <= 0) return []
    return segments.slice(0, currentSegmentIndex)
  }, [segments, currentSegmentIndex])

  const unspokenSegments = useMemo(() => {
    if (!segments.length) return []
    if (currentSegmentIndex === -1) return segments
    if (currentSegmentIndex + 1 >= segments.length) return []
    return segments.slice(currentSegmentIndex + 1)
  }, [segments, currentSegmentIndex])

  return {
    segments,
    words,
    spokenSegments,
    unspokenSegments,
    currentWord,
    currentSegmentIndex,
    currentWordIndex,
    seekToTime,
    seekToWord,
    audioRef,
    isPlaying,
    isBuffering,
    isScrubbing,
    duration,
    currentTime,
    play,
    pause,
    toggle,
    resume,
    startScrubbing,
    endScrubbing,
  }
}

export { useTranscriptViewer }
export type {
  UseTranscriptViewerProps,
  UseTranscriptViewerResult,
  ComposeSegmentsOptions,
  ComposeSegmentsResult,
  SegmentComposer,
  TranscriptSegment,
  TranscriptWord,
  CharacterAlignmentResponseModel,
}
