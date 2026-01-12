"use client";

import { useState, useSyncExternalStore } from "react";
import { X } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useIsPremium } from "@/lib/hooks/use-is-premium";

const STORAGE_KEY = "promo-banner-dismissed";

// Empty subscribe function for useSyncExternalStore
const emptySubscribe = () => () => {};

// Hook to detect client-side hydration safely
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

  // Don't render on server or while loading
  if (!isClient || isLoading) return null;

  // Don't show for premium users or if dismissed
  if (isPremium || isDismissed) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[60] bg-glow text-white">
      <div className="flex items-center justify-center px-4 py-2 text-center text-sm">
        <p className="flex flex-wrap items-center justify-center gap-x-1">
          <span className="font-medium">Go Premium for $4.99/mo or $30/year</span>
          <span className="opacity-80">— deal ends February 15th.</span>
          <Link
            href="/pricing"
            className="ml-2 inline-flex items-center rounded-full bg-white/20 px-3 py-0.5 text-xs font-medium transition-colors hover:bg-white/30"
          >
            Try it now
          </Link>
        </p>
        <button
          onClick={handleDismiss}
          className="ml-4 rounded-full p-1 transition-colors hover:bg-white/20"
          aria-label="Dismiss banner"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
