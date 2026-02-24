"use client";

import { useState, useCallback, useRef, useEffect, type MutableRefObject } from "react";
import { useAuth } from "@clerk/nextjs";
import { extractTTSText } from "@/lib/tts-text";
import { cleanTextForTTS } from "@/lib/tts-chunk";

// Free user daily limit
const FREE_TTS_LIMIT = 3;

// ─── Types ───

export interface CombinedAlignment {
  characters: string[];
  characterStartTimesSeconds: number[];
  characterEndTimesSeconds: number[];
}

export interface CombinedTTSResult {
  audioSrc: string; // blob URL
  alignment: CombinedAlignment;
  durationMs: number;
}

type TTSStatus = "idle" | "loading" | "ready" | "error";

export interface ParsedTTSError {
  message: string;
  canRetry: boolean;
  showUpgrade: boolean;
}

function parseTTSError(raw: string): ParsedTTSError {
  const lower = raw.toLowerCase();

  if (lower.includes("quota_exceeded"))
    return { message: "Speech service is at capacity. Try again later.", canRetry: true, showUpgrade: false };
  if (lower.includes("daily tts limit"))
    return { message: "You've used all your free listens for today.", canRetry: false, showUpgrade: true };
  if (lower.includes("too many") || lower.includes("rate limit"))
    return { message: "Too many requests. Wait a moment.", canRetry: true, showUpgrade: false };
  if (lower.includes("service busy") || lower.includes("503"))
    return { message: "Speech service is busy. Try again shortly.", canRetry: true, showUpgrade: false };
  if (lower.includes("timed out"))
    return { message: "Timed out. Try a shorter article.", canRetry: true, showUpgrade: false };
  if (lower.includes("too long"))
    return { message: "Article too long for audio (50K char max).", canRetry: false, showUpgrade: false };
  if (lower.includes("401") || lower.includes("unauthorized"))
    return { message: "Service configuration error. Try again later.", canRetry: true, showUpgrade: false };

  return { message: "Something went wrong. Please try again.", canRetry: true, showUpgrade: false };
}

export interface UseTTSReturn {
  status: TTSStatus;
  isLoading: boolean;
  isReady: boolean;
  /** Fetches combined audio + alignment. Populates audioSrc/alignment when done. */
  load: () => void;
  stop: () => void;
  voice: string;
  setVoice: (voiceId: string) => void;
  audioSrc: string | null;
  alignment: CombinedAlignment | null;
  durationMs: number;
  canUse: boolean;
  usageCount: number;
  usageLimit: number;
  error: string | null;
  parsedError: ParsedTTSError | null;
}

// ─── Client-side cache (IndexedDB) ───

const IDB_NAME = "smry-tts-combined";
const IDB_VERSION = 1;
const IDB_STORE = "audio";
const IDB_MAX_ENTRIES = 50;
const IDB_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface CachedAudio {
  key: string;
  blob: Blob;
  alignment: CombinedAlignment;
  durationMs: number;
  createdAt: number;
}

function openCacheDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB not available"));
      return;
    }
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getCachedAudio(key: string): Promise<CachedAudio | null> {
  try {
    const db = await openCacheDB();
    const tx = db.transaction(IDB_STORE, "readonly");
    const store = tx.objectStore(IDB_STORE);
    const result = await new Promise<CachedAudio | undefined>((resolve, reject) => {
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result as CachedAudio | undefined);
      req.onerror = () => reject(req.error);
    });
    if (!result) return null;
    // TTL check
    if (Date.now() - result.createdAt > IDB_TTL_MS) {
      // Expired — delete fire-and-forget
      try {
        const dtx = db.transaction(IDB_STORE, "readwrite");
        dtx.objectStore(IDB_STORE).delete(key);
      } catch { /* ignore */ }
      return null;
    }
    return result;
  } catch {
    return null;
  }
}

async function setCachedAudio(key: string, blob: Blob, alignment: CombinedAlignment, durationMs: number): Promise<void> {
  try {
    const db = await openCacheDB();
    // Evict old entries if over limit
    const countTx = db.transaction(IDB_STORE, "readonly");
    const countReq = countTx.objectStore(IDB_STORE).count();
    const count = await new Promise<number>((resolve) => {
      countReq.onsuccess = () => resolve(countReq.result);
      countReq.onerror = () => resolve(0);
    });
    if (count >= IDB_MAX_ENTRIES) {
      // Delete all and start fresh (simple eviction for bounded cache)
      const clearTx = db.transaction(IDB_STORE, "readwrite");
      clearTx.objectStore(IDB_STORE).clear();
      await new Promise<void>((resolve) => {
        clearTx.oncomplete = () => resolve();
        clearTx.onerror = () => resolve();
      });
    }
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put({
      key,
      blob,
      alignment,
      durationMs,
      createdAt: Date.now(),
    } satisfies CachedAudio);
    await new Promise<void>((resolve) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Non-critical — audio still plays from memory
  }
}

// ─── Usage tracking ───

function getDayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function getLocalUsage(): string[] {
  try {
    const key = `tts-usage-${getDayKey()}`;
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function addLocalUsage(articleUrl: string): void {
  try {
    const key = `tts-usage-${getDayKey()}`;
    const urls = getLocalUsage();
    if (!urls.includes(articleUrl)) {
      urls.push(articleUrl);
      localStorage.setItem(key, JSON.stringify(urls));
    }
  } catch { /* ignore */ }
}

// ─── Cache key for combined audio (SHA-256 of cleaned text + voice) ───

async function computeCacheKey(text: string, voice: string): Promise<string> {
  const data = new TextEncoder().encode(text + "\0" + voice);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

// ─── Hook ───

export function useTTS(
  articleTextContent: string | undefined,
  articleUrl: string,
  isPremium: boolean,
): UseTTSReturn {
  const { getToken } = useAuth();

  const [status, setStatus] = useState<TTSStatus>("idle");
  const [voice, setVoiceState] = useState("21m00Tcm4TlvDq8ikWAM");
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [alignment, setAlignment] = useState<CombinedAlignment | null>(null);
  const [durationMs, setDurationMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [usageCount, setUsageCount] = useState(() => getLocalUsage().length);

  const abortRef = useRef<AbortController | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  const canUse = process.env.NODE_ENV === "development" || isPremium || usageCount < FREE_TTS_LIMIT;

  const cleanup = useCallback(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setAudioSrc(null);
    setAlignment(null);
    setDurationMs(0);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, []);

  const load = useCallback(async () => {
    if (!articleTextContent) return;
    if (status === "loading") return;

    // Extract clean text from DOM
    let ttsText = articleTextContent;
    try {
      const articleEl = document.querySelector("[data-article-content]");
      if (articleEl) {
        const domText = extractTTSText(articleEl);
        if (domText.length > 50) ttsText = domText;
      }
    } catch { /* use raw text */ }

    const cleanedText = cleanTextForTTS(ttsText);
    if (!cleanedText) {
      setError("No readable text");
      return;
    }

    // Abort previous request
    abortRef.current?.abort();
    cleanup();

    setStatus("loading");
    setError(null);

    const abortController = new AbortController();
    abortRef.current = abortController;

    try {
      // ─── Check client-side IndexedDB cache first (no credits consumed) ───
      const cacheKey = await computeCacheKey(cleanedText, voice);
      const cached = await getCachedAudio(cacheKey);

      if (cached) {
        const url = URL.createObjectURL(cached.blob);
        blobUrlRef.current = url;
        setAudioSrc(url);
        setAlignment(cached.alignment);
        setDurationMs(cached.durationMs);
        setStatus("ready");
        // Cached replays don't consume credits
        return;
      }

      // ─── No cache hit — enforce credit limit before API call ───
      if (!canUse) {
        setError("Daily TTS limit reached. Upgrade to Premium for unlimited listening.");
        setStatus("error");
        return;
      }

      // ─── Fetch from server ───
      const token = await getToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const response = await fetch("/api/tts", {
        method: "POST",
        headers,
        body: JSON.stringify({ text: cleanedText, voice, articleUrl }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        if (response.status === 429) {
          throw new Error(data.error || "Daily TTS limit reached. Upgrade to Premium for unlimited listening.");
        }
        if (response.status === 503) {
          throw new Error(data.error || "TTS service is busy. Please try again shortly.");
        }
        throw new Error(data.error || `TTS request failed (${response.status})`);
      }

      const data = await response.json();
      const { audioBase64, alignment: serverAlignment, durationMs: serverDuration } = data;

      if (!audioBase64) throw new Error("No audio data received");

      // Convert base64 → blob URL
      const binaryStr = atob(audioBase64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "audio/mpeg" });
      const url = URL.createObjectURL(blob);
      blobUrlRef.current = url;

      setAudioSrc(url);
      setAlignment(serverAlignment);
      setDurationMs(serverDuration);
      setStatus("ready");

      // Track usage
      if (!isPremium) {
        addLocalUsage(articleUrl);
        setUsageCount(getLocalUsage().length);
      }

      // ─── Cache to IndexedDB (fire-and-forget) ───
      setCachedAudio(cacheKey, blob, serverAlignment, serverDuration).catch(() => {});
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        setStatus("idle");
        return;
      }
      setError((err as Error).message || "TTS failed");
      setStatus("error");
    }
  }, [articleTextContent, articleUrl, canUse, cleanup, getToken, isPremium, status, voice]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    cleanup();
    setStatus("idle");
    setError(null);
  }, [cleanup]);

  const [pendingReload, setPendingReload] = useState(false);
  const loadRef = useRef(load) as MutableRefObject<typeof load>;
  useEffect(() => { loadRef.current = load; });

  const setVoice = useCallback((voiceId: string) => {
    setVoiceState((prev) => {
      if (prev === voiceId) return prev;
      return voiceId;
    });
  }, []);

  // Auto-reload when voice changes while audio is ready/errored
  const prevVoiceRef = useRef(voice);
  useEffect(() => {
    if (prevVoiceRef.current === voice) return;
    prevVoiceRef.current = voice;
    if (status === "ready" || status === "error") {
      // Cleanup old audio without closing player
      abortRef.current?.abort();
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
      setAudioSrc(null);
      setAlignment(null);
      setDurationMs(0);
      setStatus("idle");
      setError(null);
      setPendingReload(true);
    }
  }, [voice, status]);

  // Trigger load after voice change cleanup
  useEffect(() => {
    if (!pendingReload) return;
    setPendingReload(false);
    loadRef.current();
  }, [pendingReload]);

  return {
    status,
    isLoading: status === "loading",
    isReady: status === "ready",
    load,
    stop,
    voice,
    setVoice,
    audioSrc,
    alignment,
    durationMs,
    canUse,
    usageCount,
    usageLimit: FREE_TTS_LIMIT,
    error,
    parsedError: error ? parseTTSError(error) : null,
  };
}
