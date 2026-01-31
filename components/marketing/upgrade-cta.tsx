"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useIsPremium } from "@/lib/hooks/use-is-premium";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

interface UpgradeCTAProps {
  className?: string;
  dismissable?: boolean;
}

export function UpgradeCTA({ className, dismissable = true }: UpgradeCTAProps) {
  const t = useTranslations("promo");
  const { isPremium, isLoading } = useIsPremium();
  const [isDismissed, setIsDismissed] = useState(false);

  // Don't show while loading, if premium, or if dismissed (only when dismissable)
  if (isLoading || isPremium || (dismissable && isDismissed)) {
    return null;
  }

  return (
    <div
      className={cn(
        "mt-6 flex items-center gap-3 rounded-lg px-3.5 py-2.5",
        "bg-gradient-to-r from-black/[0.03] to-black/[0.05] dark:from-white/[0.03] dark:to-white/[0.05]",
        "ring-1 ring-black/[0.08] dark:ring-white/[0.08]",
        className
      )}
    >
      <span className="flex-1 text-[13px] tracking-[-0.01em] text-foreground/60">
        {t("sourceBenefit")}
      </span>
      <Link
        href="/pricing"
        className={cn(
          "shrink-0 flex items-center justify-center rounded-lg px-4 py-1.5 text-[14px] font-semibold",
          "bg-gradient-to-b from-[#ffdd73] to-[#ffbe25] text-black",
          "shadow-[inset_0_0_1px_1px_rgba(255,255,255,0.14),0_0_0_1px_rgba(0,0,0,0.08),0_2px_2px_rgba(0,0,0,0.04),0_0_0_1px_#fac83e]",
          "transition-all hover:brightness-105",
          "[text-shadow:0_0.5px_0_rgba(255,255,255,0.48)]"
        )}
      >
        {t("upgrade")}
      </Link>
      {dismissable && (
        <button
          onClick={() => setIsDismissed(true)}
          className="shrink-0 -mr-1 p-1 text-foreground/30 transition-colors hover:text-foreground/50"
          aria-label={t("dismiss")}
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}
