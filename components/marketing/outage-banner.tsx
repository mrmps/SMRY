"use client";

import { useState, useSyncExternalStore } from "react";
import { X } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "outage-banner-dismissed-2026-01-29";

const emptySubscribe = () => () => {};

function useIsClient() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

interface OutageBannerProps {
  className?: string;
}

export function OutageBanner({ className }: OutageBannerProps) {
  const isClient = useIsClient();
  const [isDismissed, setIsDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(STORAGE_KEY) === "true";
  });

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem(STORAGE_KEY, "true");
  };

  if (!isClient || isDismissed) return null;

  return (
    <div
      className={cn(
        "relative z-40 w-full shrink-0 border-b border-amber-300/40 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-950/30",
        className
      )}
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      <div className="px-8 py-1.5 text-center text-xs text-amber-800 dark:text-amber-200">
        <span className="font-medium">Resolved:</span>
        <span className="mx-1.5">
          We experienced an outage from 2:00 AM to 11:00 AM PST on Jan 29. All services are now stable.
        </span>
        <a
          href="https://smry.openstatus.dev/"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium underline underline-offset-2 hover:text-amber-900 dark:hover:text-amber-100"
        >
          Status page
        </a>
      </div>
      <button
        onClick={handleDismiss}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200 transition-colors"
        aria-label="Dismiss outage notice"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
