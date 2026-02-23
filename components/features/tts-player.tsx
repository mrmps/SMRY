"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Play,
  Pause,
  Forward,
  Backward,
  X,
  Loader2,
  Crown,
  VolumeHigh,
  ChevronRight,
} from "@/components/ui/icons";

interface TTSPlayerProps {
  isPlaying: boolean;
  isPaused: boolean;
  isLoading: boolean;
  progress: number;
  currentTime: number;
  duration: number;
  rate: number;
  currentWord: string;
  canUse: boolean;
  usageCount: number;
  error: string | null;
  articleTitle?: string;
  onPlay: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onSkipForward: () => void;
  onSkipBackward: () => void;
  onRateChange: (rate: number) => void;
  onClose: () => void;
  className?: string;
}

const RATE_PRESETS = [0.75, 1, 1.25, 1.5, 2, 2.5];

function formatTime(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function getSpeedLabel(rate: number): string {
  if (rate <= 0.75) return "Slow";
  if (rate <= 1) return "Normal";
  if (rate <= 1.5) return "Fast";
  return "Very Fast";
}

export function TTSPlayer({
  isPlaying,
  isPaused,
  isLoading,
  progress,
  currentTime,
  duration,
  rate,
  currentWord,
  canUse,
  usageCount,
  error,
  articleTitle,
  onPlay,
  onPause,
  onResume,
  onStop,
  onSkipForward,
  onSkipBackward,
  onRateChange,
  onClose,
  className,
}: TTSPlayerProps) {
  const [showSpeedPanel, setShowSpeedPanel] = React.useState(false);
  const speedPanelRef = React.useRef<HTMLDivElement>(null);

  // Close speed panel on outside click
  React.useEffect(() => {
    if (!showSpeedPanel) return;
    const handleClick = (e: MouseEvent) => {
      if (speedPanelRef.current && !speedPanelRef.current.contains(e.target as Node)) {
        setShowSpeedPanel(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showSpeedPanel]);

  const isActive = isPlaying || isPaused || isLoading;

  // Upgrade prompt for free users who've hit the limit
  if (!canUse && !isActive) {
    return (
      <div
        className={cn(
          "bg-card/95 backdrop-blur-xl border border-border/50 rounded-2xl shadow-2xl p-4",
          className,
        )}
      >
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0">
            <Crown className="size-5 text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">TTS limit reached</p>
            <p className="text-xs text-muted-foreground">
              {usageCount}/3 today. Upgrade for unlimited listening.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ touchAction: "manipulation" }}
            className="size-10 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "bg-card/95 backdrop-blur-xl border border-border/50 rounded-2xl shadow-2xl relative",
        className,
      )}
    >
      {/* Progress bar — thin line at very top */}
      <div className="absolute top-0 left-4 right-4 h-0.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-[width] duration-200"
          style={{ width: `${Math.min(progress * 100, 100)}%` }}
        />
      </div>

      {/* Error banner */}
      {error && (
        <div className="px-4 pt-3 pb-0">
          <p className="text-[11px] text-destructive truncate text-center">{error}</p>
        </div>
      )}

      {/* Row 1: Time + Article Title + Time */}
      <div className="flex items-center justify-between px-4 pt-3.5 pb-1">
        <span className="text-xs tabular-nums text-primary shrink-0 w-10">
          {formatTime(currentTime)}
        </span>
        <div className="flex-1 min-w-0 flex items-center justify-center gap-1 px-2">
          <span className="text-xs text-muted-foreground font-medium truncate">
            {isActive && currentWord
              ? currentWord
              : articleTitle
                ? articleTitle.length > 30
                  ? articleTitle.slice(0, 30) + "..."
                  : articleTitle
                : "Ready to play"
            }
          </span>
          {articleTitle && !currentWord && (
            <ChevronRight className="size-3 text-muted-foreground/50 shrink-0" />
          )}
        </div>
        <span className="text-xs tabular-nums text-muted-foreground shrink-0 w-10 text-right">
          {formatTime(duration)}
        </span>
      </div>

      {/* Row 2: Controls */}
      <div className="flex items-center justify-center gap-2 px-4 pb-3 pt-1">
        {/* Speed circle button — left side */}
        <div className="relative" ref={speedPanelRef}>
          <button
            onClick={() => setShowSpeedPanel((prev) => !prev)}
            style={{ touchAction: "manipulation" }}
            className={cn(
              "size-11 flex items-center justify-center rounded-full transition-colors",
              "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground",
              "text-xs font-semibold tabular-nums",
              showSpeedPanel && "bg-accent text-foreground",
            )}
            aria-label={`Speed: ${rate}x`}
          >
            {rate}x
          </button>

          {/* Speed popover */}
          {showSpeedPanel && (
            <div className="absolute bottom-full mb-2 left-0 z-50 bg-popover border border-border rounded-2xl shadow-2xl p-4 w-[220px]">
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{getSpeedLabel(rate)}</p>
                  {duration > 0 && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Duration ~{formatTime(duration / rate)}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setShowSpeedPanel(false)}
                  style={{ touchAction: "manipulation" }}
                  className="size-8 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-colors -mr-1 -mt-1"
                  aria-label="Close speed menu"
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* +/- with current speed */}
              <div className="flex items-center justify-center gap-3 mb-3">
                <button
                  onClick={() => {
                    const newRate = Math.max(0.5, Math.round((rate - 0.25) * 100) / 100);
                    onRateChange(newRate);
                  }}
                  style={{ touchAction: "manipulation" }}
                  className="size-10 flex items-center justify-center rounded-xl bg-muted text-muted-foreground hover:bg-accent hover:text-foreground transition-colors text-lg font-medium active:scale-95"
                  aria-label="Decrease speed"
                >
                  −
                </button>
                <span className="text-xl font-bold text-foreground tabular-nums min-w-[48px] text-center">
                  {rate}×
                </span>
                <button
                  onClick={() => {
                    const newRate = Math.min(3, Math.round((rate + 0.25) * 100) / 100);
                    onRateChange(newRate);
                  }}
                  style={{ touchAction: "manipulation" }}
                  className="size-10 flex items-center justify-center rounded-xl bg-muted text-muted-foreground hover:bg-accent hover:text-foreground transition-colors text-lg font-medium active:scale-95"
                  aria-label="Increase speed"
                >
                  +
                </button>
              </div>

              {/* Preset grid */}
              <div className="grid grid-cols-3 gap-1.5">
                {RATE_PRESETS.map((r) => (
                  <button
                    key={r}
                    onClick={() => {
                      onRateChange(r);
                    }}
                    style={{ touchAction: "manipulation" }}
                    className={cn(
                      "h-9 rounded-lg text-xs font-medium tabular-nums transition-colors active:scale-95",
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

        {/* Skip Backward 10s */}
        <button
          onClick={onSkipBackward}
          disabled={!isActive}
          style={{ touchAction: "manipulation" }}
          className="size-11 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-30 active:scale-95"
          aria-label="Skip backward 10 seconds"
        >
          <Backward className="size-5" />
        </button>

        {/* Play/Pause — large accent circle */}
        <button
          onClick={() => {
            if (isLoading) return;
            if (isPlaying) onPause();
            else if (isPaused) onResume();
            else onPlay();
          }}
          disabled={isLoading}
          style={{ touchAction: "manipulation" }}
          className={cn(
            "size-14 flex items-center justify-center rounded-full transition-all",
            "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/25",
            "active:scale-95 disabled:opacity-60",
          )}
          aria-label={isLoading ? "Loading..." : isPlaying ? "Pause" : "Play"}
        >
          {isLoading ? (
            <Loader2 className="size-6 animate-spin" />
          ) : isPlaying ? (
            <Pause className="size-6" />
          ) : (
            <Play className="size-6" />
          )}
        </button>

        {/* Skip Forward 10s */}
        <button
          onClick={onSkipForward}
          disabled={!isActive}
          style={{ touchAction: "manipulation" }}
          className="size-11 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-30 active:scale-95"
          aria-label="Skip forward 10 seconds"
        >
          <Forward className="size-5" />
        </button>

        {/* Close button — right side */}
        <button
          onClick={() => {
            onStop();
            onClose();
          }}
          style={{ touchAction: "manipulation" }}
          className="size-9 flex items-center justify-center rounded-full text-muted-foreground/50 hover:text-muted-foreground hover:bg-accent transition-colors active:scale-95"
          aria-label="Stop and close"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}

/**
 * Compact TTS button for toolbars — shows play icon + "Listen" label.
 */
export function TTSButton({
  isActive,
  isLoading,
  onClick,
  className,
}: {
  isActive: boolean;
  isLoading: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "size-10 flex items-center justify-center rounded-lg transition-all duration-150",
        "hover:bg-accent hover:text-accent-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "active:scale-95",
        isActive
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground",
        className,
      )}
      aria-label={isActive ? "Stop listening" : "Listen to article"}
    >
      {isLoading ? (
        <Loader2 className="size-5 animate-spin" />
      ) : (
        <VolumeHigh className="size-5" />
      )}
    </button>
  );
}
