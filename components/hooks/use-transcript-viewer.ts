"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react"
import type { CharacterAlignmentResponseModel } from "@elevenlabs/elevenlabs-js/api/types/CharacterAlignmentResponseModel"

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
  isScrubbing: boolean
  duration: number
  currentTime: number
  play: () => void
  pause: () => void
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
}: UseTranscriptViewerProps): UseTranscriptViewerResult {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const handleTimeUpdateRef = useRef<(time: number) => void>(() => {})
  const onDurationChangeRef = useRef<(duration: number) => void>(() => {})
  const onPlayRef = useRef<(() => void) | undefined>(onPlay)
  const onPauseRef = useRef<(() => void) | undefined>(onPause)
  const onEndedRef = useRef<(() => void) | undefined>(onEnded)
  const onTimeUpdateCallbackRef = useRef<((time: number) => void) | undefined>(onTimeUpdate)
  const seekTargetRef = useRef<number | null>(null)
  /** Set to true when audio auto-pauses at content end; cleared on seek */
  const reachedEndRef = useRef(false)
  /** Timestamp of last seek completion — used to suppress auto-pause briefly after seeking */
  const lastSeekDoneRef = useRef(0)

  const [isPlaying, setIsPlaying] = useState(false)
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

  // Reset playback state when alignment changes (during render, not in effect)
  // Uses the useState-based pattern from React docs:
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [prevAlignment, setPrevAlignment] = useState(alignment)
  if (prevAlignment !== alignment) {
    setPrevAlignment(alignment)
    setCurrentTime(0)
    setDuration(guessedDuration)
    setIsPlaying(false)
    setCurrentWordIndex(words.length ? 0 : -1)
  }

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
      return answer
    },
    [words]
  )

  const handleTimeUpdate = useCallback(
    (currentTime: number) => {
      if (!words.length) return

      const currentWord =
        currentWordIndex >= 0 && currentWordIndex < words.length
          ? words[currentWordIndex]
          : undefined

      if (!currentWord) {
        const found = findWordIndex(currentTime)
        if (found !== -1) setCurrentWordIndex(found)
        return
      }

      let next = currentWordIndex
      if (
        currentTime >= currentWord.endTime &&
        currentWordIndex + 1 < words.length
      ) {
        while (
          next + 1 < words.length &&
          currentTime >= words[next + 1].startTime
        ) {
          next++
        }
        if (currentTime < words[next].endTime) {
          setCurrentWordIndex(next)
          return
        }
        setCurrentWordIndex(next)
        return
      }

      if (currentTime < currentWord.startTime) {
        const found = findWordIndex(currentTime)
        if (found !== -1) setCurrentWordIndex(found)
        return
      }

      const found = findWordIndex(currentTime)
      if (found !== -1 && found !== currentWordIndex) {
        setCurrentWordIndex(found)
      }
    },
    [findWordIndex, currentWordIndex, words]
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

      // Skip RAF state updates while a seek is in progress —
      // browser may report stale currentTime until the seek completes
      if (seekTargetRef.current != null) {
        rafRef.current = requestAnimationFrame(tick)
        return
      }

      const time = node.currentTime
      const contentEnd = contentEndRef.current

      setCurrentTime(contentEnd > 0 ? Math.min(time, contentEnd) : time)
      handleTimeUpdateRef.current(time)

      // Auto-pause when all article text has been spoken (skip trailing silence).
      // The player stays open — user can re-play or seek back.
      // Skip auto-pause within 500ms of a seek completing — the user explicitly
      // scrubbed near the end and expects playback to continue from there.
      if (contentEnd > 0 && time >= contentEnd && !node.paused) {
        const msSinceSeek = Date.now() - lastSeekDoneRef.current
        if (msSinceSeek > 500) {
          reachedEndRef.current = true
          node.pause()
          rafRef.current = null
          return
        }
      }

      if (Number.isFinite(node.duration) && node.duration > 0) {
        setDuration((prev) => {
          if (!prev) {
            // Use content-based duration, not raw audio duration
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
      // Never override React state while a seek is in flight — the browser
      // may report a stale currentTime until the `seeked` event fires.
      if (seekTargetRef.current != null) return
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
      if (process.env.NODE_ENV === "development") console.log("[TTS Player] pause at", audio.currentTime.toFixed(2), seekTargetRef.current != null ? "(seek in progress)" : "")
      syncPlayback()
      // Don't sync time during an active seek — pause can fire transiently
      // when the browser interrupts playback to fulfil a seek request.
      if (seekTargetRef.current == null) {
        syncTime()
      }
      stopRaf()
      onPauseRef.current?.()
    }
    const handleEnded = () => {
      if (process.env.NODE_ENV === "development") console.log("[TTS Player] ended at", audio.currentTime.toFixed(2))
      syncPlayback()
      syncTime()
      stopRaf()
      onEndedRef.current?.()
    }
    const handleTimeUpdateEvt = () => {
      // Skip stale timeupdate events fired during an active seek
      if (seekTargetRef.current != null) return
      syncTime()
      onTimeUpdateCallbackRef.current?.(audio.currentTime)
    }
    const handleSeeked = () => {
      if (seekTargetRef.current != null) {
        const target = seekTargetRef.current
        seekTargetRef.current = null
        // Browser quirk: if audio jumped away from target, re-seek
        if (Math.abs(audio.currentTime - target) > 0.5) {
          seekTargetRef.current = target // re-arm guard for the retry
          audio.currentTime = target
          return
        }
      }
      // Record seek completion time — used to suppress auto-pause briefly
      // so scrubbing near content end doesn't immediately kill playback.
      lastSeekDoneRef.current = Date.now()
      // Now safe to sync — seekTargetRef is cleared, audio.currentTime is final
      const contentEnd = contentEndRef.current
      const raw = audio.currentTime
      setCurrentTime(contentEnd > 0 ? Math.min(raw, contentEnd) : raw)
      handleTimeUpdateRef.current(audio.currentTime)
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

    audio.addEventListener("play", handlePlay)
    audio.addEventListener("pause", handlePause)
    audio.addEventListener("ended", handleEnded)
    audio.addEventListener("timeupdate", handleTimeUpdateEvt)
    audio.addEventListener("seeked", handleSeeked)
    audio.addEventListener("durationchange", handleDuration)
    audio.addEventListener("loadedmetadata", handleDuration)

    return () => {
      stopRaf()
      audio.removeEventListener("play", handlePlay)
      audio.removeEventListener("pause", handlePause)
      audio.removeEventListener("ended", handleEnded)
      audio.removeEventListener("timeupdate", handleTimeUpdateEvt)
      audio.removeEventListener("seeked", handleSeeked)
      audio.removeEventListener("durationchange", handleDuration)
      audio.removeEventListener("loadedmetadata", handleDuration)
    }
  }, [audioRef, startRaf, stopRaf])

  const seekToTime = useCallback(
    (time: number) => {
      const node = audioRef.current
      if (!node) return
      const wasPlaying = !node.paused
      reachedEndRef.current = false
      seekTargetRef.current = time
      setCurrentTime(time)
      node.currentTime = time
      handleTimeUpdateRef.current(time)
      // Resume playback immediately if audio was playing — don't defer to
      // a RAF callback which creates a window for stale events to interfere.
      if (wasPlaying && node.paused) {
        void node.play()
      }
    },
    [audioRef]
  )

  const seekToWord = useCallback(
    (word: number | TranscriptWord) => {
      const target = typeof word === "number" ? words[word] : word
      if (!target) return
      seekToTime(target.startTime)
    },
    [seekToTime, words]
  )

  const play = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    // Only restart from beginning if audio naturally reached the end
    // (reachedEndRef is set by the RAF auto-pause). If the user manually
    // scrubbed near the end, play from the current position instead.
    if (reachedEndRef.current) {
      reachedEndRef.current = false
      seekTargetRef.current = 0
      audio.currentTime = 0
      setCurrentTime(0)
      setCurrentWordIndex(words.length ? 0 : -1)
      handleTimeUpdateRef.current(0)
    }
    if (audio.paused) {
      void audio.play()
    }
  }, [audioRef, words.length])

  const pause = useCallback(() => {
    const audio = audioRef.current
    if (audio && !audio.paused) {
      audio.pause()
    }
  }, [audioRef])

  const startScrubbing = useCallback(() => {
    setIsScrubbing(true)
    stopRaf()
  }, [stopRaf])

  const endScrubbing = useCallback(() => {
    setIsScrubbing(false)
    const node = audioRef.current
    if (node && !node.paused) {
      startRaf()
    }
  }, [audioRef, startRaf])

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
    isScrubbing,
    duration,
    currentTime,
    play,
    pause,
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
