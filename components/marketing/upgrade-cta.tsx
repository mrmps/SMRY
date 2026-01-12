"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useIsPremium } from "@/lib/hooks/use-is-premium";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import Image from "next/image";

interface UpgradeCTAProps {
  className?: string;
}

export function UpgradeCTA({ className }: UpgradeCTAProps) {
  const { isPremium, isLoading } = useIsPremium();
  const [isDismissed, setIsDismissed] = useState(false);

  // Don't show while loading, if premium, or if dismissed
  if (isLoading || isPremium || isDismissed) {
    return null;
  }

  return (
    <div
      className={cn(
        "relative mt-12 overflow-hidden rounded-2xl",
        "bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900",
        "border border-blue-400/20",
        className
      )}
    >
      {/* Metallic gradient orbs for depth */}
      <div className="absolute -left-20 -top-20 size-40 rounded-full bg-blue-500/20 blur-3xl" />
      <div className="absolute -bottom-20 -right-20 size-40 rounded-full bg-cyan-500/15 blur-3xl" />
      <div className="absolute left-1/2 top-0 size-32 -translate-x-1/2 rounded-full bg-blue-400/10 blur-2xl" />

      {/* Dismiss button */}
      <button
        onClick={() => setIsDismissed(true)}
        className="absolute right-3 top-3 z-10 rounded-full p-1.5 text-white/40 transition-colors hover:bg-white/10 hover:text-white/70"
        aria-label="Dismiss"
      >
        <X className="size-4" />
      </button>

      <div className="relative px-6 py-8 sm:px-8 sm:py-10">
        <div className="flex flex-col items-center text-center">
          {/* Custom 3D Crown */}
          <div className="mb-2 relative">
            <Image
              src="/crown.png"
              alt=""
              width={72}
              height={72}
              className="drop-shadow-[0_0_20px_rgba(94,105,209,0.5)]"
            />
          </div>

          {/* Headline */}
          <h3 className="text-xl font-semibold text-white sm:text-2xl">
            Stop guessing.
          </h3>

          {/* Subtext */}
          <p className="mt-2 max-w-md text-sm text-white/70 sm:text-base">
            See exactly which sources got the full article. Plus faster summaries with premium AI.
          </p>

          {/* Price highlight */}
          <div className="mt-4 flex items-center gap-2">
            <span className="text-2xl font-bold text-white">$3.99</span>
            <span className="text-white/50">/month</span>
            <span className="ml-2 rounded-full bg-green-500/20 px-2 py-0.5 text-xs font-medium text-green-400">
              Save 20%
            </span>
          </div>

          {/* CTA Button */}
          <Link
            href="/pricing"
            className={cn(
              "group mt-6 inline-flex items-center gap-3 rounded-full px-7 py-3.5",
              "bg-gradient-to-b from-white to-slate-50",
              "font-semibold text-slate-800",
              // Layered shadow for depth
              "shadow-[0px_0px_0px_1px_rgba(0,0,0,0.06),0px_1px_2px_-1px_rgba(0,0,0,0.06),0px_2px_4px_0px_rgba(0,0,0,0.04)]",
              // Hover state with slightly darker shadow
              "hover:shadow-[0px_0px_0px_1px_rgba(0,0,0,0.08),0px_2px_4px_-1px_rgba(0,0,0,0.08),0px_4px_8px_0px_rgba(0,0,0,0.06)]",
              "transition-[box-shadow,transform] duration-200",
              "hover:scale-[1.02] active:scale-[0.98]"
            )}
          >
            <Image
              src="/key.png"
              alt=""
              width={28}
              height={28}
              className="transition-transform duration-200 group-hover:-rotate-12"
            />
            <span>Unlock Pro</span>
          </Link>

          {/* Trust line */}
          <p className="mt-4 text-xs text-white/40">
            Cancel anytime · No questions asked
          </p>
        </div>
      </div>
    </div>
  );
}
