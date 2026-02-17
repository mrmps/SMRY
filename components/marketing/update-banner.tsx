"use client";

import { useState, useSyncExternalStore } from "react";
import { X } from "@/components/ui/icons";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

const STORAGE_KEY = "update-banner-dismissed-v3"; // Increment version for new announcements

const emptySubscribe = () => () => {};

function useIsClient() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

interface UpdateBannerProps {
  className?: string;
}

export function UpdateBanner({ className }: UpdateBannerProps) {
  const t = useTranslations("updateBanner");
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
        "relative z-40 w-full shrink-0 bg-foreground/3 border-b border-border",
        className
      )}
    >
      <div className="px-4 py-1.5 text-center text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{t("new")}</span>
        <span className="mx-1.5">{t("message")}</span>
        <span className="mx-1">·</span>
        <Link
          href="/changelog"
          className="font-medium text-foreground underline underline-offset-2 hover:text-muted-foreground transition-colors"
        >
          {t("changelog")}
        </Link>
      </div>
      <button
        onClick={handleDismiss}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Dismiss update banner"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
