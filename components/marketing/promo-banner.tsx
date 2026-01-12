"use client";

import { useState, useSyncExternalStore } from "react";
import { X } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useIsPremium } from "@/lib/hooks/use-is-premium";

const STORAGE_KEY = "promo-banner-dismissed";

const emptySubscribe = () => () => {};

function useIsClient() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

export function PromoBanner() {
  const isClient = useIsClient();
  const { isPremium, isLoading } = useIsPremium();
  const [isDismissed, setIsDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(STORAGE_KEY) === "true";
  });

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem(STORAGE_KEY, "true");
  };

  if (!isClient || isLoading) return null;
  if (isPremium || isDismissed) return null;

  return (
    <div className="relative z-40 w-full shrink-0 bg-foreground/5 border-b border-border">
      <div className="px-4 py-1.5 text-center text-xs text-muted-foreground">
        <span className="font-medium text-foreground">No ads, instant bypass check, faster AI</span>
        <span className="mx-1.5">·</span>
        <span>$4.99/mo or $30/yr</span>
        <span className="mx-1.5">·</span>
        <span>Deal ends Feb 15</span>
        <span className="mx-1.5">·</span>
        <Link
          href="/pricing"
          className="font-medium text-foreground underline underline-offset-2 hover:text-muted-foreground"
        >
          Try it
        </Link>
      </div>
      <button
        onClick={handleDismiss}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Dismiss"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
