"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useArticleAuto } from "@/lib/hooks/use-articles";
import { addArticleToHistory } from "@/lib/hooks/use-history";
import { useIsPremium } from "@/lib/hooks/use-is-premium";
import { ArrowLeft, AiMagic, Highlighter } from "@/components/ui/icons";
import { Kbd } from "@/components/ui/kbd";
import Link from "next/link";
import { cn } from "@/lib/utils";

import { ArticleContent } from "@/components/article/content";
import { TabbedSidebar, TabbedSidebarHandle } from "@/components/features/tabbed-sidebar";
import { MobileBottomBar } from "@/components/features/mobile-bottom-bar";
import { FloatingToolbar } from "@/components/features/floating-toolbar";
import { SettingsPopover } from "@/components/features/settings-popover";
import { SettingsDrawer, SettingsDrawerHandle } from "@/components/features/settings-drawer";
import { useChatThreads, type ThreadMessage } from "@/lib/hooks/use-chat-threads";
import { useIsDesktop } from "@/lib/hooks/use-media-query";
import { useGravityAd } from "@/lib/hooks/use-gravity-ad";
import { GravityAd } from "@/components/ads/gravity-ad";
import { PromoBanner } from "@/components/marketing/promo-banner";
import { UpdateBanner } from "@/components/marketing/update-banner";
import {
  useQueryStates,
  parseAsStringLiteral,
  parseAsBoolean,
  parseAsString,
} from "nuqs";
import { Source } from "@/types/api";
import { saveReadingProgress } from "@/lib/hooks/use-reading-progress";
import { isTextUIPart, type UIMessage } from "ai";
import { KeyboardShortcutsDialog } from "@/components/features/keyboard-shortcuts-dialog";
import { HighlightsProvider } from "@/lib/contexts/highlights-context";
import { AnnotationsSidebar } from "@/components/features/annotations-sidebar";
import { MobileChatDrawer, type MobileChatDrawerHandle } from "@/components/features/mobile-chat-drawer";
import { MobileAnnotationsDrawer } from "@/components/features/mobile-annotations-drawer";
import { useTTS } from "@/lib/hooks/use-tts";
import {
  TranscriptViewerContainer,
  TranscriptViewerAudio,
  TranscriptViewerPlayPauseButton,
  TranscriptViewerScrubBar,
  useTranscriptViewerContext,
} from "@/components/ui/transcript-viewer";
import { useTTSHighlight } from "@/components/hooks/use-tts-highlight";
import { VOICE_PRESETS, getVoiceAvatarGradient, isVoiceAllowed } from "@/lib/tts-provider";
import {
  SkipBack10,
  SkipForward10,
  X,
  AlertTriangle,
  Lock,
  Crown,
  Headphones,
} from "@/components/ui/icons";
import { type ArticleExportData } from "@/components/features/export-article";
import {
  Sidebar,
  SidebarContent,
  SidebarProvider,
} from "@/components/ui/sidebar";

// ─── TTS Player Controls (used inside TranscriptViewerContainer) ───

const RATE_PRESETS = [0.75, 1, 1.25, 1.5, 2];

interface TTSControlsProps {
  onClose: () => void;
  voice: string;
  onVoiceChange: (voiceId: string) => void;
  isPremium?: boolean;
  usageCount?: number;
  usageLimit?: number;
}

function TTSControls({ onClose, voice, onVoiceChange, isPremium, usageCount = 0, usageLimit = 3 }: TTSControlsProps) {
  const {
    seekToTime,
    currentTime,
    duration,
    audioRef,
  } = useTranscriptViewerContext();

  const [rate, setRate] = React.useState(1);
  const [showSpeed, setShowSpeed] = React.useState(false);
  const [showVoice, setShowVoice] = React.useState(false);
  const speedRef = React.useRef<HTMLDivElement>(null);
  const voiceRef = React.useRef<HTMLDivElement>(null);

  // Close panels on outside click
  React.useEffect(() => {
    if (!showSpeed && !showVoice) return;
    const handler = (e: MouseEvent) => {
      if (showSpeed && speedRef.current && !speedRef.current.contains(e.target as Node)) {
        setShowSpeed(false);
      }
      if (showVoice && voiceRef.current && !voiceRef.current.contains(e.target as Node)) {
        setShowVoice(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showSpeed, showVoice]);

  const handleRateChange = React.useCallback((newRate: number) => {
    setRate(newRate);
    const audio = audioRef.current;
    if (audio) audio.playbackRate = newRate;
  }, [audioRef]);

  // Apply rate when audio element changes (e.g. on first load)
  React.useEffect(() => {
    const audio = audioRef.current;
    if (audio && audio.playbackRate !== rate) {
      audio.playbackRate = rate;
    }
  });

  const skipForward = React.useCallback(() => {
    seekToTime(Math.min(currentTime + 10, duration));
  }, [seekToTime, currentTime, duration]);

  const skipBackward = React.useCallback(() => {
    seekToTime(Math.max(currentTime - 10, 0));
  }, [seekToTime, currentTime]);

  return (
    <div className="flex flex-col">
      {/* Credits banner for free users — flush at top of player */}
      {!isPremium && (
        <div className="flex items-center gap-2 rounded-t-2xl bg-amber-500/10 border-b border-amber-500/20 px-4 py-2">
          <AlertTriangle className="size-3.5 text-amber-500 shrink-0" />
          <span className="text-[11px] text-amber-700 dark:text-amber-400">
            You only have <span className="font-semibold">{Math.max(0, usageLimit - usageCount)}</span> credit{usageLimit - usageCount !== 1 ? "s" : ""} remaining.
          </span>
          <Link href="/pricing" className="text-[11px] font-medium text-amber-600 dark:text-amber-300 hover:underline ml-auto shrink-0 whitespace-nowrap">
            Subscribe now
          </Link>
        </div>
      )}

      {/* Header row: label + close button */}
      <div className={cn("flex items-center justify-between px-3 pb-0", isPremium ? "pt-2.5" : "pt-1.5")}>
        <span className="text-[11px] font-medium text-muted-foreground tracking-wide uppercase">Now Playing</span>
        <button
          onClick={onClose}
          className="size-9 flex items-center justify-center rounded-full text-muted-foreground/60 hover:text-muted-foreground hover:bg-accent transition-colors active:scale-95 transition-transform duration-100"
          aria-label="Close"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {/* Scrub bar — top */}
      <div className="px-3 pb-1.5">
        <TranscriptViewerScrubBar className="w-full" />
      </div>

      {/* Controls row — bottom */}
      <div className="flex items-center justify-center gap-3 px-3 pb-3">
        {/* Voice picker */}
        <div className="relative" ref={voiceRef}>
          <button
            onClick={() => { setShowVoice((p) => !p); setShowSpeed(false); }}
            className={cn(
              "h-9 sm:h-11 px-2.5 flex items-center gap-1.5 rounded-full text-xs font-medium transition-colors truncate max-w-[90px] active:scale-95 transition-transform duration-100",
              "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground",
              showVoice && "bg-accent text-foreground",
            )}
            aria-label="Change voice"
          >
            <span
              className="size-[18px] rounded-full shrink-0"
              style={{ background: getVoiceAvatarGradient(voice) }}
            />
            {VOICE_PRESETS.find((v) => v.id === voice)?.name ?? "Voice"}
          </button>
          {showVoice && (
            <div className="absolute bottom-full mb-2 left-0 z-50 bg-popover border rounded-xl shadow-2xl p-2 w-[240px] max-h-[280px] overflow-y-auto scrollbar-hide">
              {(["female", "male"] as const).map((gender, gi) => (
                <React.Fragment key={gender}>
                  <div className={cn("text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-2 py-1.5", gi > 0 && "mt-2")}>{gender === "female" ? "Female" : "Male"}</div>
                  {VOICE_PRESETS.filter((v) => v.gender === gender).map((v) => {
                    const locked = !isPremium && !isVoiceAllowed(v.id, !!isPremium);
                    return (
                      <button
                        key={v.id}
                        onClick={() => {
                          if (locked) {
                            window.location.href = "/pricing";
                            return;
                          }
                          onVoiceChange(v.id);
                          setShowVoice(false);
                        }}
                        className={cn(
                          "group/voice w-full flex items-center gap-2.5 px-2 py-2.5 rounded-lg text-left transition-colors relative",
                          locked
                            ? "opacity-60 hover:opacity-90 cursor-pointer"
                            : v.id === voice
                              ? "bg-primary/15 text-primary"
                              : "hover:bg-accent hover:text-foreground text-foreground",
                        )}
                      >
                        <span
                          className={cn("size-7 rounded-full shrink-0", locked && "grayscale-[40%]")}
                          style={{ background: getVoiceAvatarGradient(v.id) }}
                        />
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="text-sm font-medium truncate">{v.name}</span>
                          <span className="text-[10px] text-muted-foreground truncate">{v.accent} · {v.description}</span>
                        </div>
                        {locked && (
                          <span className="shrink-0 flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5">
                            <Lock className="size-3" />
                            <span className="text-[9px] font-medium text-muted-foreground leading-none">PRO</span>
                          </span>
                        )}
                        {locked && (
                          <span className="pointer-events-none absolute right-0 -top-7 z-50 hidden group-hover/voice:block rounded-md bg-foreground text-background px-2 py-1 text-[10px] font-medium shadow-lg whitespace-nowrap">
                            Upgrade to unlock
                          </span>
                        )}
                      </button>
                    );
                  })}
                </React.Fragment>
              ))}
              {!isPremium && (
                <div className="text-[10px] text-muted-foreground text-center pt-2 pb-1 border-t mt-2">
                  <Link href="/pricing" className="hover:text-foreground transition-colors">Unlock all voices with Premium</Link>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Skip backward */}
        <button
          onClick={skipBackward}
          className="size-9 sm:size-11 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-colors active:scale-95 transition-transform duration-100"
          aria-label="Skip backward 10 seconds"
        >
          <SkipBack10 className="size-5" />
        </button>

        {/* Play/Pause */}
        <TranscriptViewerPlayPauseButton size="icon" variant="ghost" className="size-10 sm:size-12 active:scale-95 transition-transform duration-100" />

        {/* Skip forward */}
        <button
          onClick={skipForward}
          className="size-9 sm:size-11 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-colors active:scale-95 transition-transform duration-100"
          aria-label="Skip forward 10 seconds"
        >
          <SkipForward10 className="size-5" />
        </button>

        {/* Speed button */}
        <div className="relative" ref={speedRef}>
          <button
            onClick={() => { setShowSpeed((p) => !p); setShowVoice(false); }}
            className={cn(
              "size-9 sm:size-11 flex items-center justify-center rounded-full text-xs font-semibold tabular-nums transition-colors active:scale-95 transition-transform duration-100",
              "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground",
              showSpeed && "bg-accent text-foreground",
            )}
          >
            {rate}x
          </button>
          {showSpeed && (
            <div className="absolute bottom-full mb-2 right-0 z-50 bg-popover border rounded-xl shadow-2xl p-3 w-[200px]">
              <div className="flex items-center justify-center gap-2 mb-2">
                <button
                  onClick={() => handleRateChange(Math.max(0.5, Math.round((rate - 0.25) * 100) / 100))}
                  className="size-8 flex items-center justify-center rounded-lg bg-muted text-muted-foreground hover:bg-accent hover:text-foreground text-sm font-medium"
                >−</button>
                <span className="text-lg font-bold tabular-nums min-w-[40px] text-center">{rate}×</span>
                <button
                  onClick={() => handleRateChange(Math.min(2, Math.round((rate + 0.25) * 100) / 100))}
                  className="size-8 flex items-center justify-center rounded-lg bg-muted text-muted-foreground hover:bg-accent hover:text-foreground text-sm font-medium"
                >+</button>
              </div>
              <div className="grid grid-cols-3 gap-1">
                {RATE_PRESETS.map((r) => (
                  <button
                    key={r}
                    onClick={() => handleRateChange(r)}
                    className={cn(
                      "h-7 rounded-md text-xs font-medium tabular-nums transition-colors",
                      r === rate
                        ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                        : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                  >
                    {r}×
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Bridge component: lives inside TranscriptViewerContainer, reads the current
 * word index from context and highlights it on the article DOM via <mark>.
 */
function TTSArticleHighlight() {
  const { currentWordIndex, seekToTime, resume, toggle, words, isPlaying, currentTime, duration } = useTranscriptViewerContext();
  useTTSHighlight({ currentWordIndex, isActive: true, seekToTime, play: resume, words });

  // Listen for keyboard-dispatched TTS commands (Space, ArrowLeft, ArrowRight)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail?.action) return;
      switch (detail.action) {
        case "toggle":
          toggle();
          break;
        case "seek-backward":
          seekToTime(Math.max(currentTime - 10, 0));
          break;
        case "seek-forward":
          seekToTime(Math.min(currentTime + 10, duration));
          break;
      }
    };
    document.addEventListener("tts-command", handler);
    return () => document.removeEventListener("tts-command", handler);
  }, [toggle, seekToTime, currentTime, duration]);

  // Debug: log word index updates to diagnose desktop vs mobile sync
  const prevRef = useRef({ wordIndex: -1, loggedAt: 0 });
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    const now = Date.now();
    // Log at most every 2 seconds to avoid flooding
    if (currentWordIndex !== prevRef.current.wordIndex && now - prevRef.current.loggedAt > 2000) {
      console.log("[TTS Sync] wordIndex:", currentWordIndex, "time:", currentTime.toFixed(2), "playing:", isPlaying, "wordsTotal:", words.length);
      prevRef.current = { wordIndex: currentWordIndex, loggedAt: now };
    }
  }, [currentWordIndex, currentTime, isPlaying, words.length]);

  return null;
}

/** Subtle animated waveform bars for TTS loading state */
function TTSWaveAnimation() {
  return (
    <div className="flex items-center justify-center gap-[2px] h-6">
      {Array.from({ length: 16 }, (_, i) => (
        <div
          key={i}
          className="tts-wave-bar-subtle"
          style={{
            animationDelay: `${i * 0.07}s`,
            animationDuration: `${1.2 + 0.3 * Math.sin((i / 15) * Math.PI)}s`,
          }}
        />
      ))}
    </div>
  );
}

/** Structured TTS error card */
function TTSErrorCard({ error, parsedError, onClose, onRetry }: {
  error: string;
  parsedError: { message: string; canRetry: boolean; showUpgrade: boolean } | null;
  onClose: () => void;
  onRetry: () => void;
}) {
  const display = parsedError ?? { message: error, canRetry: true, showUpgrade: false };

  // Show a richer upgrade prompt for credit/limit errors
  if (display.showUpgrade) {
    return (
      <div className="flex flex-col items-center text-center gap-3 py-2">
        <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Headphones className="size-6 text-primary" />
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold text-foreground">{display.message}</p>
          <p className="text-xs text-muted-foreground">Upgrade to Premium for unlimited listening with all voices.</p>
        </div>
        <div className="flex items-center gap-2.5">
          <Link
            href="/pricing"
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors active:scale-95 transition-transform duration-100"
          >
            <Crown className="size-3.5" />
            Upgrade to Premium
          </Link>
          <button
            onClick={onClose}
            className="rounded-full px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="size-4 text-destructive shrink-0 mt-0.5" />
        <p className="text-sm text-foreground">{display.message}</p>
      </div>
      <div className="flex items-center gap-2 pl-6">
        {display.canRetry && (
          <button
            onClick={onRetry}
            className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
          >
            Try again
          </button>
        )}
        <button
          onClick={onClose}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}

// ─── Shared TTS Floating Player (used in both desktop and mobile views) ───

const MOBILE_TTS_BOTTOM_STYLE = { bottom: 'calc(3.5rem + env(safe-area-inset-bottom, 0px) + 0.5rem)' } as const;
/** Approx height of the TTS player + bottom bar gap so content isn't hidden */
const MOBILE_TTS_SCROLL_PADDING = 180;

/** Map MediaError codes to user-friendly messages */
function mediaErrorMessage(err: MediaError | null): string {
  if (!err) return "Audio playback failed.";
  switch (err.code) {
    case MediaError.MEDIA_ERR_ABORTED: return "Audio playback was interrupted.";
    case MediaError.MEDIA_ERR_NETWORK: return "Network error while loading audio.";
    case MediaError.MEDIA_ERR_DECODE: return "Audio could not be decoded.";
    case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED: return "Audio format not supported.";
    default: return "Audio playback failed.";
  }
}

function TTSFloatingPlayer({
  tts,
  ttsOpen,
  onClose,
  isPremium,
  isMobile,
}: {
  tts: import("@/lib/hooks/use-tts").UseTTSReturn;
  ttsOpen: boolean;
  onClose: () => void;
  isPremium: boolean;
  isMobile: boolean;
}) {
  const [audioError, setAudioError] = React.useState<string | null>(null);
  const [bufferingState, setBufferingState] = React.useState(false);
  const bufferingTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleAudioError = React.useCallback((err: MediaError | null) => {
    setAudioError(mediaErrorMessage(err));
  }, []);

  const handleBuffering = React.useCallback((isBuffering: boolean) => {
    setBufferingState(isBuffering);
    // Clear previous slow-connection timer
    if (bufferingTimerRef.current) {
      clearTimeout(bufferingTimerRef.current);
      bufferingTimerRef.current = null;
    }
    if (isBuffering) {
      // After 10s of buffering, the message will naturally show via bufferingState
      bufferingTimerRef.current = setTimeout(() => {
        bufferingTimerRef.current = null;
      }, 10000);
    }
  }, []);

  // Reset error/buffering state when player closes or audio changes
  React.useEffect(() => {
    if (!ttsOpen) {
      setAudioError(null);
      setBufferingState(false);
    }
  }, [ttsOpen]);

  // Clean up buffering timer
  React.useEffect(() => {
    return () => {
      if (bufferingTimerRef.current) clearTimeout(bufferingTimerRef.current);
    };
  }, []);

  // Auto-scroll mobile content so it isn't hidden behind the player
  useEffect(() => {
    if (!isMobile || !ttsOpen) return;
    const sc = document.querySelector("[data-mobile-scroll]");
    if (!sc) return;
    // Add padding so content at bottom isn't obscured
    (sc as HTMLElement).style.paddingBottom = `${MOBILE_TTS_SCROLL_PADDING}px`;
    // Scroll up a bit to reveal content behind the player
    sc.scrollBy({ top: 60, behavior: "smooth" });
    return () => {
      // Remove padding when player closes
      (sc as HTMLElement).style.paddingBottom = "";
    };
  }, [isMobile, ttsOpen]);

  if (!ttsOpen) return null;

  // Ready — full player
  if (tts.isReady && tts.audioSrc && tts.alignment) {
    return (
      <TranscriptViewerContainer
        audioSrc={tts.audioSrc}
        audioType="audio/mpeg"
        alignment={tts.alignment}
        hideAudioTags={false}
        onAudioError={handleAudioError}
        onBuffering={handleBuffering}
        className={cn(
          "fixed left-1/2 -translate-x-1/2 z-40 rounded-2xl bg-card/95 backdrop-blur-xl border shadow-2xl space-y-0 p-0",
          "animate-in slide-in-from-bottom-4 fade-in duration-300",
          isMobile
            ? "w-[calc(100vw-1.5rem)] max-w-[520px]"
            : "bottom-6 w-[520px] max-w-[calc(100vw-2rem)]"
        )}
        style={isMobile ? MOBILE_TTS_BOTTOM_STYLE : undefined}
      >
        <TranscriptViewerAudio />
        <TTSArticleHighlight />
        {/* Inline audio error with retry */}
        {audioError && (
          <div className="px-3 pb-2">
            <TTSErrorCard
              error={audioError}
              parsedError={{ message: audioError, canRetry: true, showUpgrade: false }}
              onClose={() => setAudioError(null)}
              onRetry={() => { setAudioError(null); tts.stop(); tts.load(); }}
            />
          </div>
        )}
        {/* Buffering indicator */}
        {bufferingState && !audioError && (
          <div className="flex items-center justify-center gap-2 px-3 pb-1.5">
            <div className="size-3 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
            <span className="text-[11px] text-muted-foreground">Buffering...</span>
          </div>
        )}
        <TTSControls onClose={onClose} voice={tts.voice} onVoiceChange={tts.setVoice} isPremium={isPremium} usageCount={tts.usageCount} usageLimit={tts.usageLimit} />
      </TranscriptViewerContainer>
    );
  }

  // Loading
  if (tts.isLoading) {
    return (
      <div
        className={cn(
          "fixed z-40 rounded-xl bg-card/95 backdrop-blur-xl border px-6 py-4 shadow-2xl flex flex-col items-center gap-2",
          "animate-in slide-in-from-bottom-4 fade-in duration-300",
          isMobile ? "left-3 right-3" : "bottom-6 left-1/2 -translate-x-1/2"
        )}
        style={isMobile ? MOBILE_TTS_BOTTOM_STYLE : undefined}
      >
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Headphones className="size-4 text-primary animate-pulse" />
          </div>
          <div className="flex flex-col gap-0.5">
            <p className="text-xs font-medium text-foreground">Generating audio</p>
            <TTSWaveAnimation />
          </div>
        </div>
      </div>
    );
  }

  // Error
  if (tts.error) {
    const isUpgradeError = tts.parsedError?.showUpgrade;
    return (
      <div
        className={cn(
          "fixed z-40 rounded-2xl bg-card/95 backdrop-blur-xl border shadow-2xl",
          "animate-in slide-in-from-bottom-4 fade-in duration-300",
          isUpgradeError ? "border-primary/20" : "border-destructive/20",
          isMobile
            ? "left-3 right-3 px-4 py-3.5"
            : isUpgradeError
              ? "bottom-6 left-1/2 -translate-x-1/2 px-6 py-4 max-w-[420px]"
              : "bottom-6 left-1/2 -translate-x-1/2 px-5 py-3.5 max-w-[400px]"
        )}
        style={isMobile ? MOBILE_TTS_BOTTOM_STYLE : undefined}
      >
        <TTSErrorCard error={tts.error} parsedError={tts.parsedError} onClose={onClose} onRetry={() => { tts.stop(); tts.load(); }} />
      </div>
    );
  }

  return null;
}

// Check if the user is typing in an input/textarea/contentEditable
function isTypingInInput(e: KeyboardEvent): boolean {
  const target = e.target as HTMLElement | null;
  if (!target) return false;
  const tagName = target.tagName;
  if (tagName === "INPUT" || tagName === "TEXTAREA") return true;
  if (target.isContentEditable) return true;
  return false;
}

interface ProxyContentProps {
  url: string;
  initialSource?: Source;
  initialViewMode?: "markdown" | "html" | "iframe";
}

export function ProxyContent({ url }: ProxyContentProps) {
  // Use the new auto endpoint - single request, races all sources server-side
  const articleQuery = useArticleAuto(url);
  const { isPremium } = useIsPremium();
  const isDesktop = useIsDesktop();
  const showDesktopPromo = isDesktop !== false;
  const showMobilePromo = isDesktop === false;

  // Get the source that was actually used by the auto endpoint
  const source = articleQuery.data?.source || "smry-fast";


  const viewModes = ["markdown", "html", "iframe"] as const;

  const [query, setQuery] = useQueryStates(
    {
      url: parseAsString.withDefault(url),
      view: parseAsStringLiteral(viewModes).withDefault("markdown"),
      sidebar: parseAsBoolean.withDefault(false),
    },
    {
      history: "replace",
      shallow: true,
    }
  );
  const viewMode = query.view as (typeof viewModes)[number];
  const sidebarOpen = query.sidebar as boolean;

  const activeArticle = articleQuery.data?.article;
  const articleTitle = activeArticle?.title;
  const articleTextContent = activeArticle?.textContent;

  // Build article export data for share popover/drawer
  const articleExportData: ArticleExportData | undefined = useMemo(() => {
    if (!activeArticle) return undefined;
    return {
      title: activeArticle.title,
      url,
      byline: activeArticle.byline ?? undefined,
      textContent: activeArticle.textContent,
      content: activeArticle.content,
      siteName: activeArticle.siteName ?? undefined,
      publishedTime: activeArticle.publishedTime ?? undefined,
      lang: activeArticle.lang ?? undefined,
    };
  }, [activeArticle, url]);

  // Track initialization state per URL
  const initializedUrlRef = useRef<string | null>(null);

  // With the auto endpoint, we get a single result - no need for complex selection logic
  const firstSuccessfulArticle = articleQuery.data?.article || null;

  // Fetch ad - pass article data for better targeting
  // Ads refresh every 45 seconds for users who stay on the page
  const { ads: gravityAds, fireImpression, fireClick, fireDismiss } = useGravityAd({
    url,
    title: firstSuccessfulArticle?.title,
    textContent: firstSuccessfulArticle?.textContent,
    isPremium,
    // Additional metadata for better ad targeting
    byline: firstSuccessfulArticle?.byline,
    siteName: firstSuccessfulArticle?.siteName,
    publishedTime: firstSuccessfulArticle?.publishedTime,
    lang: firstSuccessfulArticle?.lang,
  });

  // Ad distribution: Show UNIQUE ads only - don't duplicate the same ad across placements
  // Gravity may return 1-5 ads. We assign each unique ad to exactly one placement.
  // This prevents the same ad from being tracked multiple times as different impressions.
  const sidebarAd = gravityAds[0] ?? null;        // Fixed position ad (always visible)
  const inlineAd = gravityAds[1] ?? null;         // Mid-article ad - only if we have a 2nd ad
  const footerAd = gravityAds[2] ?? null;         // End-of-article ad - only if we have a 3rd ad
  const chatAd = gravityAds[3] ?? null;           // Chat header ad - only if we have a 4th ad
  const microAd = gravityAds[4] ?? null;          // Below chat input - only if we have a 5th ad

  // Mobile chat header fallback: when chat drawer is open, article ads aren't visible,
  // so we can reuse inlineAd/footerAd as fallback if chatAd is unavailable
  const mobileChatAd = chatAd ?? inlineAd ?? footerAd ?? null;

  // Stable ad callbacks for ArticleContent (prevents breaking its React.memo on sidebar toggle)
  const onInlineAdVisible = useCallback(() => { if (inlineAd) fireImpression(inlineAd); }, [inlineAd, fireImpression]);
  const onInlineAdClick = useCallback(() => { if (inlineAd) fireClick(inlineAd); }, [inlineAd, fireClick]);
  const onFooterAdVisible = useCallback(() => { if (footerAd) fireImpression(footerAd); }, [footerAd, fireImpression]);
  const onFooterAdClick = useCallback(() => { if (footerAd) fireClick(footerAd); }, [footerAd, fireClick]);

  // Debug: Log only when ads actually change
  const prevAdKeyRef = useRef("");
  useEffect(() => {
    const adKey = gravityAds.map(a => a.brandName).join(",");
    if (adKey && adKey !== prevAdKeyRef.current) {
      prevAdKeyRef.current = adKey;
      const providers = [...new Set(gravityAds.map(a => a.ad_provider || 'gravity'))];
      console.log(`[Ads] New rotation (${providers.join(' + ')}):`,
        gravityAds.map((a, i) => `[${i}] ${a.brandName}`).join(', '));
    }
  }, [gravityAds]);

  // Handle article load: save to history
  useEffect(() => {
    if (!firstSuccessfulArticle || initializedUrlRef.current === url) return;

    initializedUrlRef.current = url;

    // Save to history
    addArticleToHistory(url, firstSuccessfulArticle.title || "Untitled Article");
  }, [firstSuccessfulArticle, url]);

  // TTS (Text-to-Speech) — TranscriptViewer with word-level highlighting
  const [ttsOpen, setTTSOpen] = useState(false);
  const tts = useTTS(articleTextContent, url, isPremium);
  const ttsRef = useRef(tts);
  useEffect(() => { ttsRef.current = tts; });

  const handleTTSToggle = React.useCallback(() => {
    const t = ttsRef.current;
    if (t.isReady || t.isLoading) {
      t.stop();
      setTTSOpen(false);
    } else {
      setTTSOpen(true);
      t.load();
    }
  }, []);

  const handleTTSClose = React.useCallback(() => {
    ttsRef.current.stop();
    setTTSOpen(false);
  }, []);

  const [mobileSummaryOpen, setMobileSummaryOpenRaw] = useState(false);
  const [mobileAnnotationsOpen, setMobileAnnotationsOpenRaw] = useState(false);
  const setMobileSummaryOpen = React.useCallback((val: boolean) => {
    setMobileSummaryOpenRaw(val);
    if (val) setMobileAnnotationsOpenRaw(false);
  }, []);
  const setMobileAnnotationsOpen = React.useCallback((val: boolean) => {
    setMobileAnnotationsOpenRaw(val);
    if (val) setMobileSummaryOpenRaw(false);
  }, []);
  const [mobileAdDismissed, setMobileAdDismissed] = useState(false);
  const [desktopAdDismissed, setDesktopAdDismissed] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [shortcutsDialogOpen, setShortcutsDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [styleOptionsOpen, setStyleOptionsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [sidebarActiveTab, setSidebarActiveTab] = useState<"chat" | "history">("chat");
  const [annotationsSidebarOpen, setAnnotationsSidebarOpenRaw] = useState(false);
  const [noteEditHighlightId, setNoteEditHighlightId] = useState<string | null>(null);
  const annotationsSidebarOpenRef = useRef(annotationsSidebarOpen);
  useEffect(() => { annotationsSidebarOpenRef.current = annotationsSidebarOpen; }, [annotationsSidebarOpen]);
  const setAnnotationsSidebarOpen = React.useCallback(
    (value: boolean | ((prev: boolean) => boolean)) => {
      const next = typeof value === "function" ? value(annotationsSidebarOpenRef.current) : value;
      setAnnotationsSidebarOpenRaw(next);
      // Close chat sidebar when opening annotations
      if (next) setQuery({ sidebar: null });
    },
    [setQuery]
  );

  // Handle "Add Note" from highlight action popover — open drawer/sidebar and focus note editor
  const noteEditTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleOpenNoteEditor = React.useCallback((id: string) => {
    setNoteEditHighlightId(id);
    if (isDesktop) {
      setAnnotationsSidebarOpen(true);
    } else {
      setMobileAnnotationsOpen(true);
    }
    // Reset after trigger so same highlight can be re-triggered later
    if (noteEditTimeoutRef.current) clearTimeout(noteEditTimeoutRef.current);
    noteEditTimeoutRef.current = setTimeout(() => setNoteEditHighlightId(null), 600);
  }, [isDesktop, setAnnotationsSidebarOpen, setMobileAnnotationsOpen]);

  const tabbedSidebarRef = useRef<TabbedSidebarHandle>(null);
  const mobileChatDrawerRef = useRef<MobileChatDrawerHandle>(null);
  const mobileSettingsRef = useRef<SettingsDrawerHandle>(null);
  const creatingThreadRef = useRef(false);
  const askAiTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const {
    threads,
    activeThread: _activeThread,
    activeThreadId: currentThreadId,
    createThread,
    updateThread,
    setActiveThreadId,
    deleteThread,
    togglePin,
    renameThread,
    groupedThreads,
    isLoaded: threadsLoaded,
    loadMore,
    hasMore,
    isLoadingMore,
    searchThreads,
    getThreadWithMessages,
    findThreadByArticleUrl,
  } = useChatThreads(isPremium, url);

  // Compute initialMessages from active thread (ThreadMessage is UIMessage-compatible)
  const threadInitialMessages: UIMessage[] = useMemo(() => {
    if (!_activeThread?.messages.length) return [];
    return _activeThread.messages as UIMessage[];
  }, [_activeThread]);

  const handleViewModeChange = React.useCallback(
    (mode: (typeof viewModes)[number]) => {
      setQuery({ view: mode });
    },
    [setQuery]
  );

  const handleSidebarChange = React.useCallback(
    (next: boolean) => {
      setQuery({ sidebar: next ? true : null });
      // Close annotations sidebar when opening chat sidebar
      if (next) setAnnotationsSidebarOpen(false);
    },
    [setQuery, setAnnotationsSidebarOpen]
  );

  // Copy page as markdown (used by ⌘C keyboard shortcut)
  // Note: Visual feedback is handled internally by FloatingToolbar when using the menu
  const handleCopyPage = React.useCallback(async () => {
    try {
      let markdown = `# ${articleTitle || "Article"}\n\n`;
      markdown += `**Source:** ${url}\n\n`;
      if (articleTextContent) {
        markdown += `---\n\n${articleTextContent}\n\n`;
      }
      await navigator.clipboard.writeText(markdown);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  }, [articleTitle, articleTextContent, url]);

  // Handle Ask AI from highlight toolbar
  const handleAskAI = React.useCallback((text: string) => {
    if (askAiTimeoutRef.current) clearTimeout(askAiTimeoutRef.current);
    if (isDesktop) {
      // Desktop: open sidebar → set chat tab → set quoted text + focus
      if (!sidebarOpen) {
        handleSidebarChange(true);
      }
      tabbedSidebarRef.current?.setActiveTab("chat");
      setSidebarActiveTab("chat");
      // Small delay for sidebar to open/tab to switch
      askAiTimeoutRef.current = setTimeout(() => {
        tabbedSidebarRef.current?.setQuotedText(text);
        tabbedSidebarRef.current?.focusInput();
      }, 100);
    } else {
      // Mobile: open drawer → set quoted text + focus
      setMobileSummaryOpen(true);
      // Delay for drawer animation
      askAiTimeoutRef.current = setTimeout(() => {
        mobileChatDrawerRef.current?.setQuotedText(text);
        mobileChatDrawerRef.current?.focusInput();
      }, 300);
    }
  }, [isDesktop, sidebarOpen, handleSidebarChange, setMobileSummaryOpen]);

  // Cleanup Ask AI timeout on unmount
  useEffect(() => () => {
    if (askAiTimeoutRef.current) clearTimeout(askAiTimeoutRef.current);
  }, []);

  // Open in external AI service
  const handleOpenInAI = React.useCallback((service: "chatgpt" | "claude") => {
    const proxyUrlObj = new URL("https://www.smry.ai/proxy");
    proxyUrlObj.searchParams.set("url", url);
    if (source) {
      proxyUrlObj.searchParams.set("source", source);
    }
    const smryUrl = proxyUrlObj.toString();
    let aiUrl: string;
    if (service === "chatgpt") {
      const prompt = `Read from '${smryUrl}' so I can ask questions about it.`;
      aiUrl = `https://chatgpt.com/?hints=search&prompt=${encodeURIComponent(prompt)}`;
    } else {
      const prompt = `Read from '${smryUrl}' so I can ask questions about it.`;
      aiUrl = `https://claude.ai/new?q=${encodeURIComponent(prompt)}`;
    }
    window.open(aiUrl, "_blank", "noopener,noreferrer");
  }, [url, source]);

  // Scroll refs (shared between progress tracking and header hide)
  const desktopScrollRef = useRef<HTMLDivElement>(null);
  const mobileScrollRef = useRef<HTMLDivElement>(null);

  // Reading progress tracking (throttled save to localStorage)
  const progressSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const calculateProgress = (scrollEl: HTMLElement): number => {
      const scrollTop = scrollEl.scrollTop;
      const scrollHeight = scrollEl.scrollHeight - scrollEl.clientHeight;
      if (scrollHeight <= 0) return 100;
      return Math.min(100, Math.max(0, (scrollTop / scrollHeight) * 100));
    };

    const handleScroll = (scrollEl: HTMLElement) => {
      if (progressSaveTimerRef.current) return; // throttled
      progressSaveTimerRef.current = setTimeout(() => {
        progressSaveTimerRef.current = null;
        const progress = calculateProgress(scrollEl);
        saveReadingProgress(url, progress);
      }, 3000);
    };

    const desktopEl = desktopScrollRef.current;
    const mobileEl = mobileScrollRef.current;

    const onDesktopScroll = () => desktopEl && handleScroll(desktopEl);
    const onMobileScroll = () => mobileEl && handleScroll(mobileEl);

    desktopEl?.addEventListener("scroll", onDesktopScroll, { passive: true });
    mobileEl?.addEventListener("scroll", onMobileScroll, { passive: true });

    return () => {
      desktopEl?.removeEventListener("scroll", onDesktopScroll);
      mobileEl?.removeEventListener("scroll", onMobileScroll);
      if (progressSaveTimerRef.current) {
        clearTimeout(progressSaveTimerRef.current);
      }
    };
  }, [url, isDesktop]);

  // Save progress on unmount (page navigation)
  useEffect(() => {
    const desktopEl = desktopScrollRef.current;
    const mobileEl = mobileScrollRef.current;
    return () => {
      const scrollEl = desktopEl || mobileEl;
      if (!scrollEl) return;
      const scrollTop = scrollEl.scrollTop;
      const scrollHeight = scrollEl.scrollHeight - scrollEl.clientHeight;
      if (scrollHeight <= 0) return;
      const progress = Math.min(100, Math.max(0, (scrollTop / scrollHeight) * 100));
      saveReadingProgress(url, progress);
    };
  }, [url, isDesktop]);

  // Mobile header hide-on-scroll state
  const [mobileHeaderVisible, setMobileHeaderVisible] = useState(true);
  const lastScrollY = useRef(0);
  const scrollDeltaAccum = useRef(0);
  const headerVisibleRef = useRef(true);
  const lastToggleTime = useRef(0); // Cooldown to prevent mid-animation reversal

  // Track scroll direction to hide/show mobile header (like X/Twitter)
  useEffect(() => {
    const scrollEl = mobileScrollRef.current;
    if (!scrollEl || isDesktop !== false) return;

    const handleScroll = () => {
      const currentY = scrollEl.scrollTop;
      const delta = currentY - lastScrollY.current;
      const now = Date.now();
      lastScrollY.current = currentY;

      // Cooldown: ignore state changes for 300ms after last toggle (animation duration)
      const inCooldown = now - lastToggleTime.current < 300;

      // Always show at top (bypass cooldown for this)
      if (currentY < 50) {
        if (!headerVisibleRef.current) {
          headerVisibleRef.current = true;
          setMobileHeaderVisible(true);
          lastToggleTime.current = now;
        }
        scrollDeltaAccum.current = 0;
        return;
      }

      // Accumulate scroll in same direction, reset on direction change
      if ((delta > 0 && scrollDeltaAccum.current < 0) || (delta < 0 && scrollDeltaAccum.current > 0)) {
        scrollDeltaAccum.current = 0;
      }
      scrollDeltaAccum.current += delta;

      // Skip state changes during cooldown
      if (inCooldown) return;

      // Trigger after accumulating ~60px in one direction (hysteresis)
      if (scrollDeltaAccum.current > 60 && headerVisibleRef.current) {
        headerVisibleRef.current = false;
        setMobileHeaderVisible(false);
        scrollDeltaAccum.current = 0;
        lastToggleTime.current = now;
      } else if (scrollDeltaAccum.current < -60 && !headerVisibleRef.current) {
        headerVisibleRef.current = true;
        setMobileHeaderVisible(true);
        scrollDeltaAccum.current = 0;
        lastToggleTime.current = now;
      }
    };

    scrollEl.addEventListener("scroll", handleScroll, { passive: true });
    return () => scrollEl.removeEventListener("scroll", handleScroll);
  }, [isDesktop]);

  // Handle new chat from history sidebar
  const handleNewChat = React.useCallback(() => {
    let articleDomain: string | undefined;
    try {
      articleDomain = new URL(url).hostname.replace("www.", "");
    } catch {}
    createThread(undefined, {
      articleUrl: url,
      articleTitle: articleTitle,
      articleDomain,
    });
    // Clear current chat messages for the new thread
    tabbedSidebarRef.current?.clearMessages();
  }, [createThread, url, articleTitle]);

  // Use ref for currentThreadId so the callback always reads the latest value
  // without needing it as a dependency (which would cause recreations and re-fires)
  const currentThreadIdRef = useRef(currentThreadId);
  useEffect(() => {
    currentThreadIdRef.current = currentThreadId;
    // Reset the guard so a new thread can be created after switching/deleting
    creatingThreadRef.current = false;
  }, [currentThreadId]);

  // Guard: skip onMessagesChange echo when loading messages from a thread selection
  const isLoadingThreadRef = useRef(false);

  // Auto-load the most recent thread for this article URL on page load.
  // Uses tabbedSidebarRef.setMessages() to push messages into the already-mounted chat
  // (since the initialMessages prop is ignored after mount by useChat's useState).
  //
  // Guard: `currentThreadId` is null on fresh load, set once a thread is loaded.
  // This naturally prevents re-running after auto-load or user actions, and avoids
  // the timing issue where threads haven't loaded from IDB yet (the effect re-fires
  // when findThreadByArticleUrl updates with new threads data).
  useEffect(() => {
    if (!isPremium || !threadsLoaded || currentThreadId) return;

    const match = findThreadByArticleUrl(url);
    if (!match) return;

    // Use the same flow as handleSelectThread to properly load messages
    isLoadingThreadRef.current = true;
    currentThreadIdRef.current = match.id;
    setActiveThreadId(match.id);

    // Async: fetch full messages if needed (cross-device), then push to chat
    (async () => {
      const thread = await getThreadWithMessages(match.id);
      if (thread && thread.messages.length > 0) {
        tabbedSidebarRef.current?.setMessages(thread.messages as UIMessage[]);
      }
      requestAnimationFrame(() => {
        isLoadingThreadRef.current = false;
      });
    })();
  }, [isPremium, threadsLoaded, currentThreadId, url, findThreadByArticleUrl, setActiveThreadId, getThreadWithMessages]);

  // Handle thread selection from history sidebar
  const handleSelectThread = React.useCallback(async (threadId: string) => {
    // Update ref synchronously BEFORE setting messages to prevent race condition
    // (otherwise onMessagesChange fires with the old thread ID and overwrites it)
    isLoadingThreadRef.current = true;
    currentThreadIdRef.current = threadId;
    setActiveThreadId(threadId);

    // Try local messages first, then fetch from server if empty (cross-device)
    const thread = await getThreadWithMessages(threadId);
    if (thread && thread.messages.length > 0) {
      tabbedSidebarRef.current?.setMessages(thread.messages as UIMessage[]);
    } else {
      tabbedSidebarRef.current?.clearMessages();
    }

    // Allow the echo effect to fire and be skipped before re-enabling saves
    requestAnimationFrame(() => {
      isLoadingThreadRef.current = false;
    });

    // Ensure the chat sidebar is open on desktop so the user sees the loaded thread
    if (!sidebarOpen) {
      handleSidebarChange(true);
    }
  }, [setActiveThreadId, getThreadWithMessages, sidebarOpen, handleSidebarChange]);

  // Sync chat messages back to the active thread (premium only)
  const handleMessagesChange = useCallback((messages: UIMessage[]) => {
    if (!isPremium) return;
    // Skip echo-save when loading messages from thread selection
    if (isLoadingThreadRef.current) return;
    // Don't create/update threads when there are no messages (e.g. on mount or clear)
    if (messages.length === 0) return;
    // Save as ThreadMessage[] directly (no lossy {role,content} conversion)
    const threadMessages: ThreadMessage[] = messages.map((msg) => ({
      id: msg.id,
      role: msg.role as "user" | "assistant",
      parts: msg.parts.filter((p) => isTextUIPart(p)).map((p) => ({ type: "text" as const, text: (p as { text: string }).text })),
    }));
    // Auto-title from first user message
    const firstUserMsg = threadMessages.find((m) => m.role === "user");
    const firstUserText = firstUserMsg?.parts[0]?.text || "";
    const title = firstUserText
      ? firstUserText.slice(0, 50) + (firstUserText.length > 50 ? "..." : "")
      : "New Chat";

    const threadId = currentThreadIdRef.current;
    if (threadId) {
      updateThread(threadId, { messages: threadMessages, title });
    } else if (!creatingThreadRef.current) {
      // Guard against duplicate creates during rapid message updates
      creatingThreadRef.current = true;
      let articleDomain: string | undefined;
      try {
        articleDomain = new URL(url).hostname.replace("www.", "");
      } catch {}
      const newThread = createThread(title, {
        articleUrl: url,
        articleTitle: articleTitle,
        articleDomain,
      }, threadMessages);
      // Set ref synchronously so the next onMessagesChange (which fires fast during streaming)
      // can update the thread instead of being silently dropped
      currentThreadIdRef.current = newThread.id;
    }
  }, [isPremium, updateThread, createThread, url, articleTitle]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;

      // ⌘I — Toggle AI chat
      if (mod && e.key === "i") {
        e.preventDefault();
        if (sidebarOpen && sidebarActiveTab === "chat") {
          // Already on chat tab, close sidebar
          handleSidebarChange(false);
        } else {
          // Open sidebar and switch to chat tab
          if (!sidebarOpen) {
            handleSidebarChange(true);
          }
          tabbedSidebarRef.current?.setActiveTab("chat");
          setSidebarActiveTab("chat");
        }
        return;
      }
      // ⌘⇧H — Toggle history tab in sidebar
      if (mod && e.shiftKey && (e.key === "h" || e.key === "H")) {
        e.preventDefault();
        if (sidebarOpen && sidebarActiveTab === "history") {
          // Already on history tab, close sidebar
          handleSidebarChange(false);
        } else {
          // Open sidebar and switch to history tab
          if (!sidebarOpen) {
            handleSidebarChange(true);
          }
          tabbedSidebarRef.current?.setActiveTab("history");
          setSidebarActiveTab("history");
        }
        return;
      }
      // ⌘⇧N — New chat thread
      if (mod && e.shiftKey && (e.key === "n" || e.key === "N")) {
        e.preventDefault();
        handleNewChat();
        return;
      }
      // ⌘⇧C — Copy last AI response
      if (mod && e.shiftKey && (e.key === "c" || e.key === "C")) {
        e.preventDefault();
        tabbedSidebarRef.current?.copyLastResponse();
        return;
      }
      // ⌘⇧E — Export article (opens share popover)
      if (mod && e.shiftKey && (e.key === "e" || e.key === "E")) {
        e.preventDefault();
        setShareOpen(true);
        return;
      }
      // Esc — Stop AI generation (don't preventDefault so dialogs still close)
      if (e.key === "Escape") {
        tabbedSidebarRef.current?.stopGeneration();
        return;
      }

      // Guard: don't fire plain-key shortcuts while typing
      if (isTypingInInput(e)) return;

      // ? — Toggle shortcuts cheat sheet
      if (e.key === "?" && !mod) {
        e.preventDefault();
        setShortcutsDialogOpen((prev) => !prev);
        return;
      }
      // / — Focus chat input (only when sidebar is open)
      if (e.key === "/" && !mod && sidebarOpen) {
        e.preventDefault();
        tabbedSidebarRef.current?.focusInput();
        return;
      }
      // V — Cycle view mode (Reader → Original → Frame)
      if ((e.key === "v" || e.key === "V") && !mod) {
        e.preventDefault();
        const modes: Array<"markdown" | "html" | "iframe"> = ["markdown", "html", "iframe"];
        const currentIndex = modes.indexOf(viewMode);
        const nextIndex = (currentIndex + 1) % modes.length;
        handleViewModeChange(modes[nextIndex]);
        return;
      }
      // O — Open original URL
      if ((e.key === "o" || e.key === "O") && !mod) {
        e.preventDefault();
        window.open(url, "_blank", "noopener,noreferrer");
        return;
      }
      // H — Open Reading History
      if ((e.key === "h" || e.key === "H") && !mod && !e.shiftKey) {
        e.preventDefault();
        window.location.href = "/history";
        return;
      }
      // , — Toggle settings popover
      if (e.key === "," && !mod) {
        e.preventDefault();
        setSettingsOpen((prev) => !prev);
        return;
      }
      // ⌘C — Copy page as markdown (only when no text is selected and not in input)
      if (mod && (e.key === "c" || e.key === "C") && !e.shiftKey) {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) {
          e.preventDefault();
          handleCopyPage();
        }
        return;
      }
      // ⌘⇧G — Open in ChatGPT (uses modifier to prevent accidental triggers)
      if (mod && e.shiftKey && (e.key === "g" || e.key === "G")) {
        e.preventDefault();
        handleOpenInAI("chatgpt");
        return;
      }
      // ⌘⇧A — Open in Claude (uses modifier to prevent accidental triggers)
      if (mod && e.shiftKey && (e.key === "a" || e.key === "A")) {
        e.preventDefault();
        handleOpenInAI("claude");
        return;
      }
      // ⇧S — Open Share modal (Shift+S must be before plain S)
      if (e.shiftKey && (e.key === "s" || e.key === "S") && !mod) {
        e.preventDefault();
        setShareOpen(true);
        return;
      }
      // A — Toggle annotations sidebar
      if ((e.key === "a" || e.key === "A") && !mod && !e.shiftKey) {
        e.preventDefault();
        setAnnotationsSidebarOpen((prev) => !prev);
        return;
      }
      // S — Toggle Style Options popover
      if ((e.key === "s" || e.key === "S") && !mod && !e.shiftKey) {
        e.preventDefault();
        setStyleOptionsOpen((prev) => !prev);
        return;
      }
      // L — Toggle TTS (Listen)
      if ((e.key === "l" || e.key === "L") && !mod && !e.shiftKey) {
        e.preventDefault();
        handleTTSToggle();
        return;
      }
      // Space — Play/Pause TTS (when TTS player is open)
      if (e.key === " " && !mod && ttsOpen) {
        e.preventDefault();
        document.dispatchEvent(new CustomEvent("tts-command", { detail: { action: "toggle" } }));
        return;
      }
      // ArrowLeft — Seek backward 10s (when TTS player is open)
      if (e.key === "ArrowLeft" && !mod && ttsOpen) {
        e.preventDefault();
        document.dispatchEvent(new CustomEvent("tts-command", { detail: { action: "seek-backward" } }));
        return;
      }
      // ArrowRight — Seek forward 10s (when TTS player is open)
      if (e.key === "ArrowRight" && !mod && ttsOpen) {
        e.preventDefault();
        document.dispatchEvent(new CustomEvent("tts-command", { detail: { action: "seek-forward" } }));
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [sidebarOpen, sidebarActiveTab, handleSidebarChange, handleNewChat, viewMode, handleViewModeChange, url, handleCopyPage, handleOpenInAI, setAnnotationsSidebarOpen, handleTTSToggle, ttsOpen]);

  // Measure combined banner height so fixed sidebars can start below it
  const bannerRef = useRef<HTMLDivElement>(null);
  const [bannerHeight, setBannerHeight] = useState(0);
  useEffect(() => {
    const el = bannerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBannerHeight(el.offsetHeight));
    ro.observe(el);
    setBannerHeight(el.offsetHeight);
    return () => ro.disconnect();
  }, []);
  const sidebarOffsetStyle = bannerHeight > 0
    ? { top: `${bannerHeight}px`, height: `calc(100svh - ${bannerHeight}px)` } as React.CSSProperties
    : undefined;

  return (
    <div className="flex h-dvh flex-col bg-background">
      {/* Promo Banner - desktop/tablet */}
      <div ref={bannerRef}>
        {showDesktopPromo && <PromoBanner />}
        <UpdateBanner className="hidden md:block" />
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Content Area - conditionally render desktop or mobile layout */}
        <main className="flex-1 overflow-hidden">
        <HighlightsProvider articleUrl={url} articleTitle={articleTitle}>
          {isDesktop === null ? (
            // SSR/hydration: render nothing to avoid layout shift
            // The layout will render on client after hydration
            <div className="h-full bg-background" />
          ) : isDesktop ? (
            // Desktop: Sidebar layout — content shifts left when chat opens
            <SidebarProvider
              open={sidebarOpen}
              onOpenChange={handleSidebarChange}
              className="h-full min-h-0!"
              style={{ "--sidebar-width": "440px" } as React.CSSProperties}
            >
              {/* Main content area — flex-1 shrinks when sidebar gap appears */}
              <div className="flex-1 min-w-0 relative h-full">
                {/* Back arrow - top left */}
                <button
                  onClick={() => window.history.back()}
                  className="absolute top-4 left-4 z-50 size-10 flex items-center justify-center rounded-xl border border-border/60 bg-background/60 backdrop-blur-sm text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                  aria-label="Go back"
                >
                  <ArrowLeft className="size-5" />
                </button>

                {/* Top-right action buttons — AI Chat + Annotations */}
                <div
                  className="absolute top-4 z-50 flex flex-col gap-2 transition-[right] duration-200 ease-linear"
                  style={{ right: annotationsSidebarOpen ? 'calc(320px + 1rem)' : '1rem' }}
                >
                  {/* AI Chat toggle */}
                  {(sidebarOpen || annotationsSidebarOpen) ? (
                    <div className="relative group">
                      <button
                        onClick={() => {
                          if (sidebarOpen) {
                            handleSidebarChange(false);
                          } else {
                            handleSidebarChange(true);
                            tabbedSidebarRef.current?.setActiveTab("chat");
                            setSidebarActiveTab("chat");
                          }
                        }}
                        className={cn(
                          "size-10 flex items-center justify-center rounded-xl border backdrop-blur-md shadow-sm transition-colors",
                          sidebarOpen
                            ? "border-primary/30 bg-primary/10 text-primary hover:bg-primary/20"
                            : "border-border/60 bg-background/80 text-muted-foreground hover:text-foreground hover:bg-muted/80"
                        )}
                        aria-label={sidebarOpen ? "Close AI Chat (⌘I)" : "Open AI Chat (⌘I)"}
                      >
                        <AiMagic className="size-4" />
                      </button>
                      <div className="absolute right-full mr-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-popover text-popover-foreground text-xs px-2 py-1 rounded-md border shadow-sm">
                        {sidebarOpen ? "Close" : "Open"} AI Chat <Kbd className="ml-1 text-[10px] px-1 py-0.5">⌘I</Kbd>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        handleSidebarChange(true);
                        tabbedSidebarRef.current?.setActiveTab("chat");
                        setSidebarActiveTab("chat");
                      }}
                      className="flex items-center gap-2.5 h-10 pl-3.5 pr-3 rounded-xl border border-border/60 bg-background/80 backdrop-blur-md shadow-sm text-foreground hover:bg-muted/80 transition-colors"
                      aria-label="Ask AI (⌘I)"
                    >
                      <AiMagic className="size-4" />
                      <span className="text-sm font-medium">AI Chat</span>
                      <Kbd className="ml-0.5 text-[10px] px-1.5 py-0.5 bg-muted/80">⌘I</Kbd>
                    </button>
                  )}

                  {/* Annotations toggle */}
                  {(sidebarOpen || annotationsSidebarOpen) ? (
                    <div className="relative group">
                      <button
                        onClick={() => setAnnotationsSidebarOpen((prev) => !prev)}
                        className={cn(
                          "size-10 flex items-center justify-center rounded-xl border backdrop-blur-md shadow-sm transition-colors",
                          annotationsSidebarOpen
                            ? "border-primary/30 bg-primary/10 text-primary hover:bg-primary/20"
                            : "border-border/60 bg-background/80 text-muted-foreground hover:text-foreground hover:bg-muted/80"
                        )}
                        aria-label="Toggle Annotations (A)"
                      >
                        <Highlighter className="size-4" />
                      </button>
                      <div className="absolute right-full mr-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-popover text-popover-foreground text-xs px-2 py-1 rounded-md border shadow-sm">
                        {annotationsSidebarOpen ? "Close" : "Open"} Annotations <Kbd className="ml-1 text-[10px] px-1 py-0.5">A</Kbd>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAnnotationsSidebarOpen(true)}
                      className="flex items-center gap-2.5 h-10 pl-3.5 pr-3 rounded-xl border border-border/60 bg-background/80 backdrop-blur-md shadow-sm text-foreground hover:bg-muted/80 transition-colors"
                      aria-label="Annotations (A)"
                    >
                      <Highlighter className="size-4" />
                      <span className="text-sm font-medium">Annotations</span>
                      <Kbd className="ml-0.5 text-[10px] px-1.5 py-0.5 bg-muted/80">A</Kbd>
                    </button>
                  )}
                </div>

                <div ref={desktopScrollRef} data-desktop-scroll className="h-full overflow-y-auto bg-background scrollbar-hide">
                  <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-6">
                    <ArticleContent
                      data={articleQuery.data}
                      isLoading={articleQuery.isLoading}
                      isError={articleQuery.isError}
                      error={articleQuery.error}
                      source={source}
                      url={url}
                      viewMode={viewMode}
                      isFullScreen={isFullScreen}
                      onFullScreenChange={setIsFullScreen}
                      inlineAd={!isPremium ? inlineAd : null}
                      onInlineAdVisible={inlineAd ? onInlineAdVisible : undefined}
                      onInlineAdClick={inlineAd ? onInlineAdClick : undefined}
                      showInlineAd={!isPremium}
                      footerAd={!isPremium ? footerAd : null}
                      onFooterAdVisible={footerAd ? onFooterAdVisible : undefined}
                      onFooterAdClick={footerAd ? onFooterAdClick : undefined}
                      onAskAI={handleAskAI}
                      onOpenNoteEditor={handleOpenNoteEditor}
                    />
                  </div>
                </div>

                {/* Fixed bottom-right ad when sidebar is closed */}
                {!sidebarOpen && !isPremium && sidebarAd && !desktopAdDismissed && (
                  <div className="fixed bottom-4 right-4 z-40 w-[280px] lg:w-[320px] xl:w-[360px] max-w-[calc(100vw-2rem)]">
                    <GravityAd
                      ad={sidebarAd}
                      onVisible={() => fireImpression(sidebarAd)}
                      onClick={() => fireClick(sidebarAd)}
                      onDismiss={() => {
                        fireDismiss(sidebarAd);
                        setDesktopAdDismissed(true);
                      }}
                      variant={sidebarOpen ? "compact" : "default"}
                    />
                  </div>
                )}

                {/* Floating Toolbar - Desktop only */}
                <FloatingToolbar
                  viewMode={viewMode}
                  onViewModeChange={handleViewModeChange}
                  originalUrl={url}
                  shareUrl={`https://smry.ai/proxy?url=${encodeURIComponent(url)}`}
                  articleTitle={articleTitle}
                  source={source || "smry-fast"}
                  sidebarOpen={sidebarOpen}
                  onOpenSettings={() => setSettingsOpen((prev) => !prev)}
                  articleExportData={articleExportData}
                  styleOptionsOpen={styleOptionsOpen}
                  onStyleOptionsOpenChange={setStyleOptionsOpen}
                  shareOpen={shareOpen}
                  onShareOpenChange={setShareOpen}
                  onTTSToggle={handleTTSToggle}
                  isTTSActive={tts.isReady || tts.isLoading}
                  isTTSLoading={tts.isLoading}
                />

                {/* TTS floating player (shared component) */}
                <TTSFloatingPlayer tts={tts} ttsOpen={ttsOpen} onClose={handleTTSClose} isPremium={isPremium} isMobile={false} />

                {/* Settings Popover - Desktop dialog, Mobile drawer */}
                <SettingsPopover
                  open={settingsOpen}
                  onOpenChange={setSettingsOpen}
                />

                {/* Annotations Sidebar — slides from right as overlay */}
                <AnnotationsSidebar
                  open={annotationsSidebarOpen}
                  onOpenChange={setAnnotationsSidebarOpen}
                  articleUrl={url}
                  articleTitle={articleTitle}
                  noteEditId={noteEditHighlightId}
                  sidebarOffsetStyle={sidebarOffsetStyle}
                />
              </div>

              {/* Chat Sidebar — pushes content left when open */}
              <Sidebar side="right" collapsible="offcanvas" style={sidebarOffsetStyle}>
                <SidebarContent className="overflow-hidden">
                  <div className="h-full">
                    <TabbedSidebar
                      ref={tabbedSidebarRef}
                      articleContent={articleTextContent || ""}
                      articleTitle={articleTitle}
                      isOpen={sidebarOpen}
                      onOpenChange={handleSidebarChange}
                      isPremium={isPremium}
                      initialMessages={threadInitialMessages}
                      onMessagesChange={isPremium ? handleMessagesChange : undefined}
                      activeThreadTitle={_activeThread?.title}
                      headerAd={!isPremium ? chatAd : null}
                      onHeaderAdVisible={chatAd ? () => fireImpression(chatAd) : undefined}
                      onHeaderAdClick={chatAd ? () => fireClick(chatAd) : undefined}
                      ad={!isPremium ? (inlineAd ?? footerAd) : null}
                      onAdVisible={inlineAd ? () => fireImpression(inlineAd) : footerAd ? () => fireImpression(footerAd) : undefined}
                      onAdClick={inlineAd ? () => fireClick(inlineAd) : footerAd ? () => fireClick(footerAd) : undefined}
                      microAd={!isPremium ? microAd : null}
                      onMicroAdVisible={microAd ? () => fireImpression(microAd) : undefined}
                      onMicroAdClick={microAd ? () => fireClick(microAd) : undefined}
                      threads={threads}
                      activeThreadId={currentThreadId}
                      onNewChat={handleNewChat}
                      onSelectThread={handleSelectThread}
                      onDeleteThread={deleteThread}
                      onTogglePin={togglePin}
                      onRenameThread={renameThread}
                      groupedThreads={groupedThreads}
                      hasMore={hasMore}
                      isLoadingMore={isLoadingMore}
                      onLoadMore={loadMore}
                      searchThreads={searchThreads}
                      onTabChange={setSidebarActiveTab}
                    />
                  </div>
                </SidebarContent>
              </Sidebar>
            </SidebarProvider>
          ) : (
            // Mobile: Clean article-first layout with bottom bar
            <div className="h-full relative">
              {/* Scrollable content area */}
              <div
                ref={mobileScrollRef}
                data-mobile-scroll
                className={cn(
                  "h-full overflow-y-auto bg-background touch-pan-y",
                  !isPremium && sidebarAd && !mobileAdDismissed ? "pb-36" : "pb-16"
                )}
              >
                {/* Mobile promo + header stack with safe-area support */}
                <div
                  className={cn(
                    "sticky top-0 z-40 bg-background transition-transform duration-300 ease-out",
                    !mobileHeaderVisible && "-translate-y-full"
                  )}
                >
                  {showMobilePromo && <PromoBanner className="md:hidden" />}
                  <UpdateBanner className="md:hidden" />
                  <header className="flex h-14 items-center bg-background px-4">
                    {/* Back button - left */}
                    <div className="flex items-center gap-3 shrink-0">
                      <button
                        onClick={() => window.history.back()}
                        className="size-9 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        aria-label="Go back"
                      >
                        <ArrowLeft className="size-5" />
                      </button>
                    </div>

                    {/* Domain name - center */}
                    <div className="flex-1 flex items-center justify-center">
                      <span className="text-sm font-medium text-muted-foreground truncate max-w-[200px]">
                        {(() => {
                          try {
                            return new URL(url).hostname.replace('www.', '').toUpperCase();
                          } catch {
                            return '';
                          }
                        })()}
                      </span>
                    </div>

                    {/* Right buttons: annotations + AI chat */}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setMobileAnnotationsOpen(true)}
                        className={cn(
                          "size-9 flex items-center justify-center rounded-full transition-colors",
                          mobileAnnotationsOpen
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        )}
                        aria-label="Open annotations"
                      >
                        <Highlighter className="size-5" />
                      </button>
                      <button
                        onClick={() => setMobileSummaryOpen(true)}
                        className={cn(
                          "size-9 flex items-center justify-center rounded-full transition-colors",
                          mobileSummaryOpen
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        )}
                        aria-label="Open chat"
                      >
                        <AiMagic className="size-5" />
                      </button>
                    </div>
                  </header>
                </div>

                <div
                  className={cn(
                    viewMode === "html"
                      ? "px-2 pt-2"
                      : "mx-auto max-w-3xl px-4 sm:px-6 py-4"
                  )}
                >
                  <ArticleContent
                    data={articleQuery.data}
                    isLoading={articleQuery.isLoading}
                    isError={articleQuery.isError}
                    error={articleQuery.error}
                    source={source}
                    url={url}
                    viewMode={viewMode}
                    isFullScreen={isFullScreen}
                    onFullScreenChange={setIsFullScreen}
                    inlineAd={!isPremium ? inlineAd : null}
                    onInlineAdVisible={inlineAd ? onInlineAdVisible : undefined}
                    onInlineAdClick={inlineAd ? onInlineAdClick : undefined}
                    showInlineAd={!isPremium}
                    footerAd={!isPremium ? footerAd : null}
                    onFooterAdVisible={footerAd ? onFooterAdVisible : undefined}
                    onFooterAdClick={footerAd ? onFooterAdClick : undefined}
                    onAskAI={handleAskAI}
                    onOpenNoteEditor={handleOpenNoteEditor}
                  />
                </div>
              </div>

              {/* Mobile Chat Drawer — fullscreen vaul drawer */}
              <MobileChatDrawer
                ref={mobileChatDrawerRef}
                open={mobileSummaryOpen}
                onOpenChange={setMobileSummaryOpen}
                articleContent={articleTextContent || ""}
                articleTitle={articleTitle}
                chatAd={!isPremium ? mobileChatAd : null}
                onChatAdVisible={mobileChatAd ? () => fireImpression(mobileChatAd) : undefined}
                onChatAdClick={mobileChatAd ? () => fireClick(mobileChatAd) : undefined}
                inlineChatAd={!isPremium ? (inlineAd ?? footerAd) : null}
                onInlineChatAdVisible={inlineAd ? () => fireImpression(inlineAd) : footerAd ? () => fireImpression(footerAd) : undefined}
                onInlineChatAdClick={inlineAd ? () => fireClick(inlineAd) : footerAd ? () => fireClick(footerAd) : undefined}
                isPremium={isPremium}
                initialMessages={threadInitialMessages}
                onMessagesChange={isPremium ? handleMessagesChange : undefined}
                threads={threads}
                activeThreadId={currentThreadId}
                onSelectThread={handleSelectThread}
                onNewChat={handleNewChat}
                onDeleteThread={deleteThread}
                groupedThreads={groupedThreads}
                hasMore={hasMore}
                isLoadingMore={isLoadingMore}
                onLoadMore={loadMore}
                searchThreads={searchThreads}
                getThreadWithMessages={getThreadWithMessages}
              />

              {/* Mobile Annotations Drawer — bottom sheet */}
              <MobileAnnotationsDrawer
                open={mobileAnnotationsOpen}
                onOpenChange={setMobileAnnotationsOpen}
                articleUrl={url}
                articleTitle={articleTitle}
                noteEditId={noteEditHighlightId}
              />

              {/* Fixed ad above bottom bar - responsive CSS handles phone vs tablet sizing */}
              {!isPremium && sidebarAd && !mobileAdDismissed && (
                <div
                  className="fixed left-0 right-0 z-20"
                  style={{ bottom: 'calc(3.5rem + env(safe-area-inset-bottom, 0px))' }}
                >
                  <GravityAd
                    ad={sidebarAd}
                    variant="mobile"
                    onVisible={() => fireImpression(sidebarAd)}
                    onClick={() => fireClick(sidebarAd)}
                    onDismiss={() => {
                      fireDismiss(sidebarAd);
                      setMobileAdDismissed(true);
                    }}
                  />
                </div>
              )}

              {/* TTS floating player (shared component) */}
              <TTSFloatingPlayer tts={tts} ttsOpen={ttsOpen} onClose={handleTTSClose} isPremium={isPremium} isMobile={true} />

              {/* Mobile Bottom Bar */}
              <MobileBottomBar
                viewMode={viewMode || "markdown"}
                onViewModeChange={handleViewModeChange}
                smryUrl={`https://smry.ai/proxy?url=${encodeURIComponent(url)}`}
                originalUrl={url}
                articleTitle={articleTitle}
                onOpenSettings={() => mobileSettingsRef.current?.open()}
                onTTSToggle={handleTTSToggle}
                isTTSActive={tts.isReady || tts.isLoading}
                isTTSLoading={tts.isLoading}
                articleExportData={articleExportData}
              />

              {/* Mobile Settings Drawer - native iOS style */}
              <SettingsDrawer
                ref={mobileSettingsRef}
                viewMode={viewMode || "markdown"}
                onViewModeChange={handleViewModeChange}
              />
            </div>
          )}
        </HighlightsProvider>
        </main>
      </div>
      <KeyboardShortcutsDialog
        open={shortcutsDialogOpen}
        onOpenChange={setShortcutsDialogOpen}
      />

    </div>
  );
}
