"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Play,
  Pause,
  Forward,
  Backward,
  Speed,
  X,
  Loader2,
  Crown,
  VolumeHigh,
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

const RATE_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

function formatTime(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
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
  const [showRateMenu, setShowRateMenu] = React.useState(false);
  const rateMenuRef = React.useRef<HTMLDivElement>(null);

  // Close rate menu on outside click
  React.useEffect(() => {
    if (!showRateMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (rateMenuRef.current && !rateMenuRef.current.contains(e.target as Node)) {
        setShowRateMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showRateMenu]);

  const isActive = isPlaying || isPaused || isLoading;

  // Upgrade prompt for free users who've hit the limit
  if (!canUse && !isActive) {
    return (
      <div
        className={cn(
          "bg-background/95 backdrop-blur-xl border border-border/50 rounded-2xl shadow-lg p-4",
          className,
        )}
      >
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
            <Crown className="size-5 text-amber-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">TTS limit reached</p>
            <p className="text-xs text-muted-foreground">
              {usageCount}/3 articles this month. Upgrade for unlimited listening.
            </p>
          </div>
          <button
            onClick={onClose}
            className="size-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
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
        "bg-background/95 backdrop-blur-xl border border-border/50 rounded-2xl shadow-lg",
        className,
      )}
    >
      {/* Error banner */}
      {error && (
        <div className="px-4 py-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded-t-2xl border-b border-red-200 dark:border-red-900/50">
          {error}
        </div>
      )}

      {/* Progress bar */}
      <div className="px-4 pt-3 pb-1">
        <div className="h-1 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-[width] duration-150"
            style={{ width: `${Math.min(progress * 100, 100)}%` }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {formatTime(currentTime)}
          </span>
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {formatTime(duration)}
          </span>
        </div>
      </div>

      {/* Current word display */}
      {isActive && currentWord && (
        <div className="px-4 pb-1">
          <p className="text-xs text-muted-foreground truncate text-center">
            <span className="font-medium text-foreground">{currentWord}</span>
          </p>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-center gap-1 px-3 pb-3">
        {/* Speed */}
        <div className="relative" ref={rateMenuRef}>
          <button
            onClick={() => setShowRateMenu((prev) => !prev)}
            className={cn(
              "h-8 px-2 flex items-center gap-1 rounded-lg text-xs font-medium transition-colors",
              "text-muted-foreground hover:text-foreground hover:bg-muted",
            )}
            aria-label={`Speed: ${rate}x`}
          >
            <Speed className="size-3.5" />
            <span className="tabular-nums">{rate}x</span>
          </button>

          {showRateMenu && (
            <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 z-50 bg-popover border border-border/50 rounded-lg shadow-lg p-1 min-w-[80px]">
              {RATE_OPTIONS.map((r) => (
                <button
                  key={r}
                  onClick={() => {
                    onRateChange(r);
                    setShowRateMenu(false);
                  }}
                  className={cn(
                    "w-full px-3 py-1.5 text-xs text-left rounded-md transition-colors tabular-nums",
                    r === rate
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted",
                  )}
                >
                  {r}x
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Skip Backward */}
        <button
          onClick={onSkipBackward}
          disabled={!isActive}
          className="size-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30"
          aria-label="Skip backward 10 seconds"
        >
          <Backward className="size-4" />
        </button>

        {/* Play/Pause/Loading */}
        <button
          onClick={() => {
            if (isLoading) return;
            if (isPlaying) onPause();
            else if (isPaused) onResume();
            else onPlay();
          }}
          disabled={isLoading}
          className={cn(
            "size-11 flex items-center justify-center rounded-full transition-all",
            "bg-primary text-primary-foreground hover:bg-primary/90",
            "active:scale-95 disabled:opacity-60",
          )}
          aria-label={isLoading ? "Loading..." : isPlaying ? "Pause" : "Play"}
        >
          {isLoading ? (
            <Loader2 className="size-5 animate-spin" />
          ) : isPlaying ? (
            <Pause className="size-5" />
          ) : (
            <Play className="size-5" />
          )}
        </button>

        {/* Skip Forward */}
        <button
          onClick={onSkipForward}
          disabled={!isActive}
          className="size-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30"
          aria-label="Skip forward 10 seconds"
        >
          <Forward className="size-4" />
        </button>

        {/* Stop */}
        <button
          onClick={() => {
            onStop();
            onClose();
          }}
          className="size-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
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
