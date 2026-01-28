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
  /**
   * Variant controls the layout:
   * - default: Card style for desktop floating ads
   * - sidebar: Native feel for sidebar placement
   * - compact: Minimal for inline placement
   * - mobile: Responsive bottom bar that scales up for tablets (CSS-only, no JS detection)
   */
  variant?: "default" | "compact" | "sidebar" | "mobile";
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

  // Mobile variant - responsive bottom bar that scales up beautifully for tablets
  // Uses CSS breakpoints so no JS detection needed - works perfectly on all viewports
  if (variant === "mobile") {
    return (
      <div
        className={cn(
          // Base: prominent gradient background for visibility
          "relative flex items-center gap-2 bg-gradient-to-r from-accent to-accent/80 border-t border-border/60 backdrop-blur-sm",
          // Mobile: compact padding
          "px-3 py-2",
          // Tablet (md:768px+): more spacious, card-like appearance
          "md:mx-4 md:mb-2 md:px-4 md:py-3 md:rounded-xl md:border md:shadow-lg md:shadow-black/5",
          className
        )}
      >
        <a
          ref={adRef}
          href={ad.clickUrl}
          target="_blank"
          rel="sponsored noopener"
          onClick={onClick}
          className="flex-1 flex items-center gap-2 md:gap-3 min-w-0 group"
        >
          {ad.favicon && (
            <Image
              src={ad.favicon}
              alt=""
              width={40}
              height={40}
              className={cn(
                "rounded-lg shrink-0 bg-white dark:bg-white/90 shadow-sm",
                // Mobile: smaller icon
                "size-8",
                // Tablet: larger icon
                "md:size-10"
              )}
              unoptimized
            />
          )}
          <div className="flex-1 min-w-0">
            {/* Brand + Sponsored label */}
            <span className={cn(
              "block leading-tight font-semibold text-foreground group-hover:text-primary transition-colors truncate",
              "text-[13px] md:text-[14px]"
            )}>
              {ad.brandName}
              <span className="font-normal text-muted-foreground/60 ml-1.5 text-[10px] md:text-[11px]">· Sponsored</span>
            </span>
            {/* Ad text - show more on tablets */}
            <span className={cn(
              "block leading-snug text-muted-foreground mt-0.5",
              "text-[12px] line-clamp-1",
              "md:text-[13px] md:line-clamp-2"
            )}>
              {ad.adText || ad.title}
            </span>
          </div>
          {/* CTA button - hidden on small phones, visible on larger screens */}
          {ad.cta && (
            <span className={cn(
              "shrink-0 font-semibold text-primary-foreground bg-primary rounded-lg shadow-sm transition-shadow group-hover:shadow",
              "hidden xs:inline-flex", // Hide on very small screens
              "text-[11px] px-2.5 py-1.5",
              "md:text-[12px] md:px-3 md:py-2"
            )}>
              {ad.cta}
            </span>
          )}
        </a>
        {onDismiss && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDismiss();
            }}
            className={cn(
              "shrink-0 text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/50 rounded-full transition-colors",
              "p-1.5 -mr-1",
              "md:p-2 md:-mr-1"
            )}
            aria-label="Dismiss ad"
          >
            <X className="size-4" />
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
