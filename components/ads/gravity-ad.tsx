"use client";

/**
 * GravityAd - Contextual ad display component
 *
 * Renders below summary content. Uses IntersectionObserver to fire
 * impression tracking when 50% visible.
 */

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GravityAd as GravityAdType } from "@/lib/hooks/use-gravity-ad";

interface GravityAdProps {
  ad: GravityAdType;
  onVisible: () => void;
  onDismiss?: () => void;
  onClick?: () => void;
  className?: string;
  /** Compact variant for mobile, sidebar variant for native feel, bar for minimal bottom placement */
  variant?: "default" | "compact" | "sidebar" | "bar";
}

export function GravityAd({ ad, onVisible, onDismiss, onClick, className, variant = "default" }: GravityAdProps) {
  const adRef = useRef<HTMLAnchorElement>(null);
  const [hasTrackedImpression, setHasTrackedImpression] = useState(false);

  // Reset impression tracking when ad changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional reset when ad prop changes
    setHasTrackedImpression(false);
  }, [ad.clickUrl]);

  // Fire impression when ad is 50% visible
  useEffect(() => {
    if (hasTrackedImpression || !adRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && !hasTrackedImpression) {
          setHasTrackedImpression(true);
          onVisible();
        }
      },
      {
        threshold: 0.5, // Fire when 50% visible
      }
    );

    observer.observe(adRef.current);

    return () => {
      observer.disconnect();
    };
  }, [hasTrackedImpression, onVisible]);

  // Bar variant - ultra-compact for bottom placement with dismiss
  if (variant === "bar") {
    return (
      <div
        className={cn(
          "flex items-start gap-2 px-3 py-1.5 bg-card border-t border-border/40",
          className
        )}
      >
        <a
          ref={adRef}
          href={ad.clickUrl}
          target="_blank"
          rel="sponsored noopener"
          onClick={onClick}
          className="flex-1 flex items-start gap-2 min-w-0 group py-0.5"
        >
          {ad.favicon && (
            <Image
              src={ad.favicon}
              alt=""
              width={18}
              height={18}
              className="size-[18px] rounded shrink-0 mt-0.5 bg-white dark:bg-white/90"
              unoptimized
            />
          )}
          <span className="flex-1 text-[12px] leading-[1.35] text-muted-foreground group-hover:text-foreground transition-colors line-clamp-2">
            {ad.adText || ad.title}
            <span className="text-[10px] opacity-50 ml-1">· Ad</span>
          </span>
        </a>
        {onDismiss && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDismiss();
            }}
            className="p-1 -m-0.5 text-muted-foreground/40 hover:text-muted-foreground transition-colors shrink-0"
            aria-label="Dismiss ad"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
    );
  }

  // Compact variant - refined native styling
  if (variant === "compact") {
    return (
      <div className={cn("mb-4", className)}>
        <a
          ref={adRef}
          href={ad.clickUrl}
          target="_blank"
          rel="sponsored noopener"
          onClick={onClick}
          className="group flex items-center gap-2.5 rounded-lg p-2 -mx-2 transition-colors hover:bg-muted/30"
        >
          {ad.favicon && (
            <Image
              src={ad.favicon}
              alt=""
              width={28}
              height={28}
              className="size-7 rounded-[8px] shrink-0 shadow-sm bg-white dark:bg-white/90"
              unoptimized
            />
          )}
          <div className="flex-1 min-w-0">
            {/* Single-line attribution */}
            <p className="text-[11px] leading-tight text-muted-foreground/70 mb-0.5 flex items-center gap-1">
              <span className="font-medium text-muted-foreground truncate">{ad.brandName}</span>
              <span className="opacity-50">·</span>
              <span className="shrink-0">Sponsored</span>
            </p>
            {/* Value proposition */}
            <p className="text-[13px] leading-snug text-foreground group-hover:text-primary transition-colors line-clamp-2">
              {ad.adText || ad.title}
            </p>
          </div>
        </a>
      </div>
    );
  }

  // Sidebar variant - native feel without card borders
  if (variant === "sidebar") {
    return (
      <a
        ref={adRef}
        href={ad.clickUrl}
        target="_blank"
        rel="sponsored noopener"
        onClick={onClick}
        className={cn(
          "group block py-1 transition-colors hover:opacity-80",
          className
        )}
      >
        <div className="flex items-start gap-3">
          {ad.favicon && (
            <Image
              src={ad.favicon}
              alt=""
              width={36}
              height={36}
              className="size-9 rounded-[10px] shrink-0 shadow-sm bg-white dark:bg-white/90"
              unoptimized
            />
          )}

          <div className="flex-1 min-w-0">
            {/* Single-line attribution */}
            <p className="text-[11px] leading-tight mb-1.5 flex items-center gap-1.5">
              <span className="font-medium text-foreground/80 truncate">{ad.brandName}</span>
              <span className="text-muted-foreground/40">·</span>
              <span className="text-muted-foreground/60 shrink-0">Sponsored</span>
            </p>

            {/* Value proposition */}
            <p className="text-[14px] leading-snug text-foreground font-medium">
              {ad.adText || ad.title}
            </p>

            {/* CTA */}
            {ad.cta && (
              <p className="mt-2 text-[13px] font-medium text-foreground">
                {ad.cta} →
              </p>
            )}
          </div>
        </div>
      </a>
    );
  }

  // Default variant - clean card style for desktop
  return (
    <a
      ref={adRef}
      href={ad.clickUrl}
      target="_blank"
      rel="sponsored noopener"
      onClick={onClick}
      className={cn(
        "group block rounded-xl border border-border/60 bg-card p-4 transition-all duration-150 hover:bg-accent/50 hover:border-border",
        className
      )}
    >
      <div className="flex items-start gap-3">
        {ad.favicon && (
          <Image
            src={ad.favicon}
            alt=""
            width={36}
            height={36}
            className="size-9 rounded-[10px] shrink-0 shadow-sm ring-1 ring-black/[0.04] bg-white dark:bg-white/90"
            unoptimized
          />
        )}

        <div className="flex-1 min-w-0">
          {/* Single-line attribution */}
          <p className="text-[11px] leading-tight mb-1.5 flex items-center gap-1.5">
            <span className="font-medium text-foreground/80 truncate">{ad.brandName}</span>
            <span className="text-muted-foreground/40">·</span>
            <span className="text-muted-foreground/60 shrink-0">Sponsored</span>
          </p>

          {/* Value proposition */}
          <p className="text-[14px] leading-snug text-foreground font-medium">
            {ad.adText || ad.title}
          </p>

          {/* CTA */}
          {ad.cta && (
            <p className="mt-2 text-[13px] font-medium text-foreground">
              {ad.cta} →
            </p>
          )}
        </div>
      </div>
    </a>
  );
}
