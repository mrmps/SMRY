"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useIsPremium } from "@/lib/hooks/use-is-premium";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { useTranslations } from "next-intl";

interface UpgradeCTAProps {
  className?: string;
}

export function UpgradeCTA({ className }: UpgradeCTAProps) {
  const t = useTranslations("promo");
  const { isPremium, isLoading } = useIsPremium();
  const [isDismissed, setIsDismissed] = useState(false);

  // Don't show while loading, if premium, or if dismissed
  if (isLoading || isPremium || isDismissed) {
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
      <Image src="/crown.png" alt="" width={20} height={20} className="shrink-0" />
      <span className="flex-1 text-[13px] tracking-[-0.01em] text-foreground/60">
        {t("sourceBenefit")}
      </span>
      <Link
        href="/pricing"
        className={cn(
          "shrink-0 rounded-md px-3 py-1 text-[13px] font-medium",
          "bg-white text-slate-900",
          "shadow-[0_1px_2px_rgba(0,0,0,0.1)]",
          "transition-all hover:shadow-[0_2px_4px_rgba(0,0,0,0.15)] hover:brightness-105"
        )}
      >
        {t("upgrade")}
      </Link>
      <button
        onClick={() => setIsDismissed(true)}
        className="shrink-0 -mr-1 p-1 text-foreground/30 transition-colors hover:text-foreground/50"
        aria-label={t("dismiss")}
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
