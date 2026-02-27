"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { CombinedAlignment } from "@/lib/hooks/use-tts"

// ─── Types ───

export type TranscriptWord = {
  kind: "word"
  text: string
  startTime: number
  endTime: number
  segmentIndex: number
}

export type TranscriptGap = {
  kind: "gap"
  text: string
  segmentIndex: number
}

export type TranscriptSegment = TranscriptWord | TranscriptGap

export type SegmentComposer = (alignment: CombinedAlignment) => TranscriptSegment[]

export interface UseTranscriptViewerResult {
  audioRef: React.RefObject<HTMLAudioElement | null>
  segments: TranscriptSegment[]
  spokenSegments: TranscriptSegment[]
  unspokenSegments: TranscriptSegment[]
  currentWord: TranscriptWord | null
  isPlaying: boolean
  play: () => void
  pause: () => void
  duration: number
  currentTime: number
  seekToTime: (time: number) => void
  startScrubbing: () => void
  endScrubbing: () => void
}

// ─── Default segment composer ───

/**
 * Converts character-level alignment into word + gap segments.
 * Groups consecutive non-whitespace characters into words with timing data.
 */
function defaultSegmentComposer(alignment: CombinedAlignment): TranscriptSegment[] {
  const { characters, characterStartTimesSeconds, characterEndTimesSeconds } = alignment
  if (!characters.length) return []

  const segments: TranscriptSegment[] = []
  let segIdx = 0
  let wordChars: string[] = []
  let wordStart = 0
  let wordEnd = 0

  for (let i = 0; i < characters.length; i++) {
    const char = characters[i]

    if (/\s/.test(char)) {
      // Flush accumulated word
      if (wordChars.length > 0) {
        segments.push({
          kind: "word",
          text: wordChars.join(""),
          startTime: wordStart,
          endTime: wordEnd,
          segmentIndex: segIdx++,
        })
        wordChars = []
      }
      // Add gap for whitespace
      segments.push({ kind: "gap", text: char, segmentIndex: segIdx++ })
    } else {
      if (wordChars.length === 0) {
        wordStart = characterStartTimesSeconds[i] ?? 0
      }
      wordEnd = characterEndTimesSeconds[i] ?? wordStart
      wordChars.push(char)
    }
  }

  // Flush last word
  if (wordChars.length > 0) {
    segments.push({
      kind: "word",
      text: wordChars.join(""),
      startTime: wordStart,
      endTime: wordEnd,
      segmentIndex: segIdx,
    })
  }

  return segments
}

// ─── Hook ───

export function useTranscriptViewer({
  alignment,
  hideAudioTags = true,
  segmentComposer,
  onPlay: onPlayCb,
  onPause: onPauseCb,
  onTimeUpdate: onTimeUpdateCb,
  onEnded: onEndedCb,
  onDurationChange: onDurationChangeCb,
}: {
  alignment: CombinedAlignment
  hideAudioTags?: boolean
  segmentComposer?: SegmentComposer
  onPlay?: () => void
  onPause?: () => void
  onTimeUpdate?: (time: number) => void
  onEnded?: () => void
  onDurationChange?: (duration: number) => void
}): UseTranscriptViewerResult {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const isScrubbing = useRef(false)

  const compose = segmentComposer ?? defaultSegmentComposer

  const segments = useMemo(() => {
    const segs = compose(alignment)
    if (!hideAudioTags) return segs
    // Filter out segments that look like SSML/audio tags
    return segs.filter((s) => !/^[<\[].*[>\]]$/.test(s.text.trim()))
  }, [alignment, compose, hideAudioTags])

  // Classify segments into spoken / current / unspoken based on currentTime
  const { spokenSegments, unspokenSegments, currentWord } = useMemo(() => {
    const spoken: TranscriptSegment[] = []
    const unspoken: TranscriptSegment[] = []
    let current: TranscriptWord | null = null
    let pastCurrent = false

    for (const seg of segments) {
      if (pastCurrent) {
        unspoken.push(seg)
        continue
      }

      if (seg.kind === "gap") {
        // Gaps before the current word are "spoken"
        spoken.push(seg)
        continue
      }

      // Word segment
      if (currentTime >= seg.endTime) {
        spoken.push(seg)
      } else if (currentTime >= seg.startTime) {
        current = seg
        pastCurrent = true
      } else {
        unspoken.push(seg)
        pastCurrent = true
      }
    }

    return { spokenSegments: spoken, unspokenSegments: unspoken, currentWord: current }
  }, [segments, currentTime])

  // Audio event listeners
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handlePlay = () => {
      setIsPlaying(true)
      onPlayCb?.()
    }
    const handlePause = () => {
      setIsPlaying(false)
      onPauseCb?.()
    }
    const handleTimeUpdate = () => {
      if (!isScrubbing.current) {
        setCurrentTime(audio.currentTime)
        onTimeUpdateCb?.(audio.currentTime)
      }
    }
    const handleEnded = () => {
      setIsPlaying(false)
      onEndedCb?.()
    }
    const handleDurationChange = () => {
      const d = audio.duration && Number.isFinite(audio.duration) ? audio.duration : 0
      setDuration(d)
      onDurationChangeCb?.(d)
    }

    audio.addEventListener("play", handlePlay)
    audio.addEventListener("pause", handlePause)
    audio.addEventListener("timeupdate", handleTimeUpdate)
    audio.addEventListener("ended", handleEnded)
    audio.addEventListener("durationchange", handleDurationChange)

    // Set initial duration if already loaded
    if (audio.duration && Number.isFinite(audio.duration)) {
      setDuration(audio.duration)
    }

    return () => {
      audio.removeEventListener("play", handlePlay)
      audio.removeEventListener("pause", handlePause)
      audio.removeEventListener("timeupdate", handleTimeUpdate)
      audio.removeEventListener("ended", handleEnded)
      audio.removeEventListener("durationchange", handleDurationChange)
    }
  }, [onPlayCb, onPauseCb, onTimeUpdateCb, onEndedCb, onDurationChangeCb])

  const play = useCallback(() => { audioRef.current?.play() }, [])
  const pause = useCallback(() => { audioRef.current?.pause() }, [])

  const seekToTime = useCallback((time: number) => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = time
    setCurrentTime(time)
  }, [])

  const startScrubbing = useCallback(() => { isScrubbing.current = true }, [])
  const endScrubbing = useCallback(() => { isScrubbing.current = false }, [])

  return {
    audioRef,
    segments,
    spokenSegments,
    unspokenSegments,
    currentWord,
    isPlaying,
    play,
    pause,
    duration,
    currentTime,
    seekToTime,
    startScrubbing,
    endScrubbing,
  }
}
