"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";

// Free user monthly limit
const FREE_TTS_LIMIT = 3;

interface WordBoundary {
  text: string;
  offset: number; // ms from audio start
  duration: number; // ms
  textOffset: number;
  textLength: number;
}

type TTSStatus = "idle" | "loading" | "playing" | "paused" | "error";

interface UseTTSReturn {
  status: TTSStatus;
  isPlaying: boolean;
  isPaused: boolean;
  isLoading: boolean;
  play: () => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  skipForward: () => void;
  skipBackward: () => void;
  rate: number;
  setRate: (rate: number) => void;
  voice: string;
  setVoice: (voiceId: string) => void;
  currentWordIndex: number;
  currentWord: string;
  progress: number; // 0-1
  currentTime: number;
  duration: number;
  canUse: boolean;
  usageCount: number;
  error: string | null;
}

function getMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getLocalUsage(): string[] {
  try {
    const key = `tts-articles-${getMonthKey()}`;
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function addLocalUsage(articleUrl: string): void {
  try {
    const key = `tts-articles-${getMonthKey()}`;
    const urls = getLocalUsage();
    if (!urls.includes(articleUrl)) {
      urls.push(articleUrl);
      localStorage.setItem(key, JSON.stringify(urls));
    }
  } catch {
    // localStorage unavailable
  }
}

export function useTTS(
  articleTextContent: string | undefined,
  articleUrl: string,
  isPremium: boolean,
): UseTTSReturn {
  const { getToken } = useAuth();

  const [status, setStatus] = useState<TTSStatus>("idle");
  const [rate, setRateState] = useState(1);
  const [voice, setVoiceState] = useState("en-US-AriaNeural");
  const [currentWordIndex, setCurrentWordIndex] = useState(-1);
  const [currentWord, setCurrentWord] = useState("");
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [usageCount, setUsageCount] = useState(() => getLocalUsage().length);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null); // Track blob URL for cleanup
  const boundariesRef = useRef<WordBoundary[]>([]);
  const audioChunksRef = useRef<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const animFrameRef = useRef<number>(0);
  const lastWordIdxRef = useRef(-1); // Avoid redundant state updates

  const canUse = process.env.NODE_ENV === "development" || isPremium || usageCount < FREE_TTS_LIMIT || getLocalUsage().includes(articleUrl);

  /** Clean up audio resources (blob URL, element, animation frame) */
  const cleanupAudio = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = 0;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute("src");
      audioRef.current.load(); // Force release
      audioRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
      cleanupAudio();
    };
  }, [cleanupAudio]);

  // Track word highlighting during playback (optimized: forward-only index scan)
  const trackPlayback = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || audio.paused) return;

    const timeMs = audio.currentTime * 1000;
    const boundaries = boundariesRef.current;

    // Forward scan from last known position (words only advance)
    let idx = Math.max(0, lastWordIdxRef.current);
    while (idx < boundaries.length - 1 && boundaries[idx + 1].offset <= timeMs) {
      idx++;
    }
    // Handle initial seek or backward skip
    if (idx > 0 && boundaries[idx].offset > timeMs) {
      // Binary search fallback for backward seeks
      let lo = 0, hi = boundaries.length - 1;
      idx = 0;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (boundaries[mid].offset <= timeMs) {
          idx = mid;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }
    }

    if (idx >= 0 && idx !== lastWordIdxRef.current) {
      lastWordIdxRef.current = idx;
      setCurrentWordIndex(idx);
      setCurrentWord(boundaries[idx].text);
    }

    if (audio.duration > 0) {
      setProgress(audio.currentTime / audio.duration);
      setCurrentTime(audio.currentTime);
      setDuration(audio.duration);
    }

    animFrameRef.current = requestAnimationFrame(trackPlayback);
  }, []);

  const play = useCallback(async () => {
    if (!articleTextContent) return;

    // Prevent concurrent playback — if already loading/playing, ignore
    if (status === "loading" || status === "playing") return;

    if (!canUse) {
      setError("Monthly TTS limit reached. Upgrade to Premium for unlimited listening.");
      return;
    }

    // Abort any previous request and clean up
    if (abortRef.current) abortRef.current.abort();
    cleanupAudio();

    setStatus("loading");
    setError(null);
    setCurrentWordIndex(-1);
    setCurrentWord("");
    setProgress(0);
    lastWordIdxRef.current = -1;
    boundariesRef.current = [];
    audioChunksRef.current = [];

    abortRef.current = new AbortController();

    try {
      const token = await getToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      // Convert rate number to edge-tts rate string
      const rateStr = rate === 1 ? "+0%"
        : rate > 1 ? `+${Math.round((rate - 1) * 100)}%`
        : `-${Math.round((1 - rate) * 100)}%`;

      const response = await fetch("/api/tts", {
        method: "POST",
        headers,
        body: JSON.stringify({
          text: articleTextContent,
          voice,
          rate: rateStr,
          articleUrl,
        }),
        signal: abortRef.current.signal,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        if (response.status === 429) {
          setError(data.error || "Monthly TTS limit reached. Upgrade to Premium for unlimited listening.");
          setStatus("error");
          return;
        }
        if (response.status === 503) {
          setError(data.error || "TTS service is busy. Please try again shortly.");
          setStatus("error");
          return;
        }
        throw new Error(data.error || "TTS request failed");
      }

      // Parse SSE stream
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        let eventType = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            eventType = line.slice(7);
          } else if (line.startsWith("data: ") && eventType) {
            try {
              const data = JSON.parse(line.slice(6));
              if (eventType === "boundary") {
                boundariesRef.current.push(data as WordBoundary);
              } else if (eventType === "audio") {
                audioChunksRef.current.push(data.chunk);
              } else if (eventType === "error") {
                throw new Error(data.error || "TTS generation failed");
              }
            } catch (parseErr) {
              if (eventType === "error") throw parseErr;
            }
            eventType = "";
          }
        }
      }

      // Combine audio chunks and create blob
      const base64 = audioChunksRef.current.join("");
      audioChunksRef.current = []; // Free memory immediately
      if (!base64) throw new Error("No audio data received");

      const binaryStr = atob(base64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: "audio/mpeg" });
      const audioUrl = URL.createObjectURL(blob);
      audioUrlRef.current = audioUrl;

      // Create and play audio
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onended = () => {
        setStatus("idle");
        setCurrentWordIndex(-1);
        setCurrentWord("");
        setProgress(1);
        lastWordIdxRef.current = -1;
        if (animFrameRef.current) {
          cancelAnimationFrame(animFrameRef.current);
          animFrameRef.current = 0;
        }
      };

      audio.onerror = () => {
        setStatus("error");
        setError("Audio playback failed");
      };

      await audio.play();
      setStatus("playing");

      // Track usage for free users
      if (!isPremium) {
        addLocalUsage(articleUrl);
        setUsageCount(getLocalUsage().length);
      }

      // Start word tracking
      animFrameRef.current = requestAnimationFrame(trackPlayback);
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        setStatus("idle");
        return;
      }
      setError((err as Error).message || "TTS failed");
      setStatus("error");
    }
  }, [articleTextContent, articleUrl, canUse, cleanupAudio, getToken, isPremium, rate, status, trackPlayback, voice]);

  const pause = useCallback(() => {
    if (audioRef.current && status === "playing") {
      audioRef.current.pause();
      setStatus("paused");
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = 0;
      }
    }
  }, [status]);

  const resume = useCallback(() => {
    if (audioRef.current && status === "paused") {
      audioRef.current.play();
      setStatus("playing");
      animFrameRef.current = requestAnimationFrame(trackPlayback);
    }
  }, [status, trackPlayback]);

  const stop = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    cleanupAudio();
    setStatus("idle");
    setCurrentWordIndex(-1);
    setCurrentWord("");
    setProgress(0);
    setCurrentTime(0);
    setDuration(0);
    lastWordIdxRef.current = -1;
    boundariesRef.current = [];
    audioChunksRef.current = [];
  }, [cleanupAudio]);

  const skipForward = useCallback(() => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.min(
      audioRef.current.currentTime + 10,
      audioRef.current.duration,
    );
  }, []);

  const skipBackward = useCallback(() => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.max(audioRef.current.currentTime - 10, 0);
    // Reset forward-scan index so binary search kicks in
    lastWordIdxRef.current = -1;
  }, []);

  const setRate = useCallback((newRate: number) => {
    setRateState(newRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = newRate;
    }
  }, []);

  const setVoice = useCallback((voiceId: string) => {
    setVoiceState(voiceId);
    // Voice change requires regeneration — stop current playback
    if (status === "playing" || status === "paused") {
      stop();
    }
  }, [status, stop]);

  return {
    status,
    isPlaying: status === "playing",
    isPaused: status === "paused",
    isLoading: status === "loading",
    play,
    pause,
    resume,
    stop,
    skipForward,
    skipBackward,
    rate,
    setRate,
    voice,
    setVoice,
    currentWordIndex,
    currentWord,
    progress,
    currentTime,
    duration,
    canUse,
    usageCount,
    error,
  };
}
