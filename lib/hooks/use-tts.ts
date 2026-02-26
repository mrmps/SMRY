"use client";

import { useState, useCallback, useRef, useEffect, type MutableRefObject } from "react";
import { useAuth } from "@clerk/nextjs";
import { extractTTSText } from "@/lib/tts-text";
import { cleanTextForTTS } from "@/lib/tts-chunk";
import { isVoiceAllowed, DEFAULT_VOICE_ID } from "@/lib/tts-provider";

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
    return { message: "Article too long for audio (200K char max).", canRetry: false, showUpgrade: false };
  if (lower.includes("premium") || lower.includes("subscription") || lower.includes("403"))
    return { message: "This voice is available with Premium.", canRetry: false, showUpgrade: true };
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

/**
 * Record a TTS usage entry. Each article+voice combination counts as one
 * credit because each generates a separate set of Inworld API calls.
 * Re-listening to the same article+voice is free (deduped).
 */
function addLocalUsage(articleUrl: string, voiceId: string): void {
  try {
    const key = `tts-usage-${getDayKey()}`;
    const entries = getLocalUsage();
    const entry = `${articleUrl}|${voiceId}`;
    if (!entries.includes(entry)) {
      entries.push(entry);
      localStorage.setItem(key, JSON.stringify(entries));
    }
  } catch { /* ignore */ }
}

// ─── Cache key for combined audio (SHA-256 of cleaned text + voice) ───
// Version must match CHUNK_CACHE_VERSION in tts-chunk.ts — bump both together.
const CLIENT_CACHE_VERSION = "v2";

async function computeCacheKey(text: string, voice: string): Promise<string> {
  const data = new TextEncoder().encode(CLIENT_CACHE_VERSION + "\0" + text + "\0" + voice);
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
  const [voice, setVoiceState] = useState(DEFAULT_VOICE_ID);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [alignment, setAlignment] = useState<CombinedAlignment | null>(null);
  const [durationMs, setDurationMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [usageCount, setUsageCount] = useState(() => getLocalUsage().length);

  const abortRef = useRef<AbortController | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  // In-memory cache: keep generated audio per voice so switching is instant
  const voiceCacheRef = useRef<Map<string, { blobUrl: string; alignment: CombinedAlignment; durationMs: number }>>(new Map());

  const canUse = process.env.NODE_ENV === "development" || isPremium || usageCount < FREE_TTS_LIMIT;

  const cleanup = useCallback(() => {
    // Don't revoke — the blob URL is saved in voiceCacheRef for instant voice switching.
    // It will be revoked on stop() or unmount.
    blobUrlRef.current = null;
    setAudioSrc(null);
    setAlignment(null);
    setDurationMs(0);
  }, []);

  const revokeAllBlobUrls = useCallback(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    for (const entry of voiceCacheRef.current.values()) {
      URL.revokeObjectURL(entry.blobUrl);
    }
    voiceCacheRef.current.clear();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      revokeAllBlobUrls();
    };
  }, [revokeAllBlobUrls]);

  const load = useCallback(async () => {
    if (!articleTextContent) return;
    if (status === "loading") return;

    // ─── L0: In-memory voice cache (instant, no async) ───
    const memoryCached = voiceCacheRef.current.get(voice);
    if (memoryCached) {
      if (process.env.NODE_ENV === "development") console.log("[TTS] L0 hit (memory cache) voice:", voice);
      blobUrlRef.current = memoryCached.blobUrl;
      setAudioSrc(memoryCached.blobUrl);
      setAlignment(memoryCached.alignment);
      setDurationMs(memoryCached.durationMs);
      setStatus("ready");
      setError(null);
      return;
    }

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
      // ─── L1: IndexedDB cache (no credits consumed) ───
      const cacheKey = await computeCacheKey(cleanedText, voice);
      const cached = await getCachedAudio(cacheKey);

      if (cached) {
        if (process.env.NODE_ENV === "development") console.log("[TTS] L1 hit (IndexedDB) voice:", voice);
        const url = URL.createObjectURL(cached.blob);
        blobUrlRef.current = url;
        // Save to in-memory cache for instant switching next time
        voiceCacheRef.current.set(voice, { blobUrl: url, alignment: cached.alignment, durationMs: cached.durationMs });
        setAudioSrc(url);
        setAlignment(cached.alignment);
        setDurationMs(cached.durationMs);
        setStatus("ready");
        return;
      }

      // ─── No cache hit — enforce credit limit before API call ───
      // Re-check usage count fresh (not from stale closure) to prevent
      // rapid voice switches from bypassing the limit.
      const freshUsage = getLocalUsage().length;
      const freshCanUse = process.env.NODE_ENV === "development" || isPremium || freshUsage < FREE_TTS_LIMIT;
      if (!freshCanUse) {
        setUsageCount(freshUsage);
        setError("Daily TTS limit reached. Upgrade to Premium for unlimited listening.");
        setStatus("error");
        return;
      }

      // ─── Fetch from server ───
      if (process.env.NODE_ENV === "development") console.log("[TTS] cache miss, fetching from server. voice:", voice, "textLen:", cleanedText.length);
      const fetchStart = performance.now();
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
        if (response.status === 403) {
          throw new Error(data.error || "This voice requires a Premium subscription.");
        }
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

      // Save to in-memory cache for instant switching
      voiceCacheRef.current.set(voice, { blobUrl: url, alignment: serverAlignment, durationMs: serverDuration });

      if (process.env.NODE_ENV === "development") {
        const elapsed = Math.round(performance.now() - fetchStart);
        console.log(`[TTS] server response: ${elapsed}ms, audioSize: ${(binaryStr.length / 1024).toFixed(0)}KB, duration: ${(serverDuration / 1000).toFixed(1)}s`);
      }

      setAudioSrc(url);
      setAlignment(serverAlignment);
      setDurationMs(serverDuration);
      setStatus("ready");

      // Sync usage count with server (server deduplicates by article+voice)
      const serverUsageCount = parseInt(response.headers.get("X-TTS-Usage-Count") || "", 10);
      if (!isNaN(serverUsageCount) && !isPremium) {
        setUsageCount(serverUsageCount);
      }

      // Track usage — each article+voice combo = 1 credit
      if (!isPremium) {
        addLocalUsage(articleUrl, voice);
        setUsageCount(getLocalUsage().length);
      }

      // ─── Cache to IndexedDB (fire-and-forget) ───
      setCachedAudio(cacheKey, blob, serverAlignment, serverDuration).catch(() => {});
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        setStatus("idle");
        return;
      }
      const errMsg = (err as Error).message || "TTS failed";
      if (process.env.NODE_ENV === "development") console.error("[TTS] error:", errMsg);
      setError(errMsg);
      setStatus("error");
    }
  }, [articleTextContent, articleUrl, canUse, cleanup, getToken, isPremium, status, voice]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    // Clear cache entries synchronously so subsequent load() won't find stale entries
    const staleUrls: string[] = [];
    if (blobUrlRef.current) staleUrls.push(blobUrlRef.current);
    for (const entry of voiceCacheRef.current.values()) {
      staleUrls.push(entry.blobUrl);
    }
    voiceCacheRef.current.clear();
    blobUrlRef.current = null;
    // Defer blob URL revocation to prevent MEDIA_ERR_SRC_NOT_SUPPORTED
    // during React's unmount cycle when audio element still references the URL
    queueMicrotask(() => {
      for (const url of staleUrls) URL.revokeObjectURL(url);
    });
    setAudioSrc(null);
    setAlignment(null);
    setDurationMs(0);
    setStatus("idle");
    setError(null);
  }, []);

  const loadRef = useRef(load) as MutableRefObject<typeof load>;
  useEffect(() => { loadRef.current = load; });

  const setVoice = useCallback((voiceId: string) => {
    if (!isVoiceAllowed(voiceId, isPremium)) return;
    setVoiceState((prev) => {
      if (prev === voiceId) return prev;
      return voiceId;
    });
  }, [isPremium]);

  // Auto-reload when voice changes while audio is ready/errored.
  // If the new voice is in the in-memory cache, load() will restore it instantly (no API call).
  const prevVoiceRef = useRef(voice);
  useEffect(() => {
    if (prevVoiceRef.current === voice) return;
    prevVoiceRef.current = voice;
    if (status === "ready" || status === "error") {
      abortRef.current?.abort();
      // Don't revoke blob URLs — they're kept in voiceCacheRef for instant switching
      blobUrlRef.current = null;
      setAudioSrc(null);
      setAlignment(null);
      setDurationMs(0);
      setStatus("idle");
      setError(null);
      // Trigger load in next tick (load checks in-memory cache first → instant if cached)
      queueMicrotask(() => { loadRef.current(); });
    }
  }, [voice, status]);

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
