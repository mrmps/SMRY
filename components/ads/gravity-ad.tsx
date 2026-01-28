"use client";

/**
 * GravityAd - Contextual ad display component
 *
 * Design principles:
 * 1. Native feel - ads should feel like content, not interruptions
 * 2. Value-first - lead with what the user gets, not the brand
 * 3. Clear CTA - make the action obvious and appealing
 * 4. Minimal disclosure - "Ad" is compliant but unobtrusive
 */

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { X, ArrowUpRight } from "lucide-react";
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
   * - mobile: Responsive bottom bar that scales up for tablets
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
      { threshold: 0.5 }
    );

    observer.observe(adRef.current);
    return () => observer.disconnect();
  }, [hasTrackedImpression, onVisible]);

  // Mobile variant - optimized for thumb zones and quick scanning
  if (variant === "mobile") {
    return (
      <div
        className={cn(
          "relative bg-card/95 backdrop-blur-md border-t border-border/50",
          // Mobile: full-width sticky bar
          "px-4 py-3",
          // Tablet+: floating card with elevation
          "md:mx-4 md:mb-3 md:rounded-2xl md:border md:border-border/40 md:shadow-xl md:shadow-black/[0.08]",
          className
        )}
      >
        {/* Subtle "Ad" indicator - top right, minimal */}
        <span className="absolute top-2 right-2 md:top-3 md:right-3 text-[9px] font-medium text-muted-foreground/50 uppercase tracking-wider">
          Ad
        </span>

        <a
          ref={adRef}
          href={ad.clickUrl}
          target="_blank"
          rel="sponsored noopener"
          onClick={onClick}
          className="flex items-center gap-3 md:gap-4 group"
        >
          {/* Logo - larger for brand recognition */}
          {ad.favicon && (
            <div className="relative shrink-0">
              <Image
                src={ad.favicon}
                alt={ad.brandName}
                width={48}
                height={48}
                className="size-11 md:size-14 rounded-xl bg-white shadow-sm ring-1 ring-black/[0.04]"
                unoptimized
              />
            </div>
          )}

          {/* Content - value prop is the hero */}
          <div className="flex-1 min-w-0 pr-6">
            {/* Value proposition - primary focus */}
            <p className={cn(
              "font-semibold text-foreground leading-snug",
              "text-[14px] line-clamp-2",
              "md:text-[15px]",
              "group-hover:text-primary transition-colors"
            )}>
              {ad.adText || ad.title}
            </p>
            {/* Brand - secondary, builds trust */}
            <p className="mt-1 text-[12px] md:text-[13px] text-muted-foreground truncate">
              {ad.brandName}
            </p>
          </div>

          {/* CTA - prominent action button */}
          <div className="shrink-0">
            {ad.cta ? (
              <span className={cn(
                "inline-flex items-center gap-1 font-semibold rounded-full",
                "bg-primary text-primary-foreground",
                "text-[12px] px-3.5 py-2",
                "md:text-[13px] md:px-4 md:py-2.5",
                "shadow-sm group-hover:shadow-md transition-shadow"
              )}>
                {ad.cta}
                <ArrowUpRight className="size-3.5 md:size-4 opacity-70" />
              </span>
            ) : (
              <span className="inline-flex items-center justify-center size-10 md:size-11 rounded-full bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <ArrowUpRight className="size-5" />
              </span>
            )}
          </div>
        </a>

        {/* Dismiss button - subtle, accessible */}
        {onDismiss && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDismiss();
            }}
            className="absolute bottom-2 right-2 md:bottom-3 md:right-3 p-1.5 rounded-full text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/60 transition-colors"
            aria-label="Dismiss"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
    );
  }

  // Compact variant - minimal footprint for inline placement
  if (variant === "compact") {
    return (
      <div className={cn("relative", className)}>
        <a
          ref={adRef}
          href={ad.clickUrl}
          target="_blank"
          rel="sponsored noopener"
          onClick={onClick}
          className="group flex items-center gap-3 rounded-xl p-2.5 -mx-2.5 transition-colors hover:bg-muted/40"
        >
          {ad.favicon && (
            <Image
              src={ad.favicon}
              alt={ad.brandName}
              width={32}
              height={32}
              className="size-8 rounded-lg shrink-0 bg-white shadow-sm ring-1 ring-black/[0.04]"
              unoptimized
            />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[13px] leading-snug font-medium text-foreground group-hover:text-primary transition-colors line-clamp-2">
              {ad.adText || ad.title}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground flex items-center gap-1">
              <span className="truncate">{ad.brandName}</span>
              <span className="opacity-40">·</span>
              <span className="opacity-60 shrink-0">Ad</span>
            </p>
          </div>
          {ad.cta && (
            <span className="shrink-0 text-[11px] font-semibold text-primary">
              {ad.cta} →
            </span>
          )}
        </a>
      </div>
    );
  }

  // Sidebar variant - native content feel
  if (variant === "sidebar") {
    return (
      <a
        ref={adRef}
        href={ad.clickUrl}
        target="_blank"
        rel="sponsored noopener"
        onClick={onClick}
        className={cn(
          "group block rounded-xl p-3 -mx-3 transition-all",
          "hover:bg-muted/50",
          className
        )}
      >
        <div className="flex items-start gap-3">
          {ad.favicon && (
            <Image
              src={ad.favicon}
              alt={ad.brandName}
              width={40}
              height={40}
              className="size-10 rounded-xl shrink-0 bg-white shadow-sm ring-1 ring-black/[0.04]"
              unoptimized
            />
          )}

          <div className="flex-1 min-w-0">
            {/* Value prop first */}
            <p className="text-[14px] leading-snug font-medium text-foreground group-hover:text-primary transition-colors">
              {ad.adText || ad.title}
            </p>

            {/* Brand + disclosure */}
            <p className="mt-1.5 text-[12px] text-muted-foreground flex items-center gap-1.5">
              <span className="font-medium truncate">{ad.brandName}</span>
              <span className="opacity-40">·</span>
              <span className="opacity-50 shrink-0">Sponsored</span>
            </p>

            {/* CTA as text link */}
            {ad.cta && (
              <p className="mt-2.5 text-[13px] font-semibold text-primary flex items-center gap-1">
                {ad.cta}
                <ArrowUpRight className="size-3.5 opacity-70" />
              </p>
            )}
          </div>
        </div>
      </a>
    );
  }

  // Default variant - premium floating card for desktop
  return (
    <a
      ref={adRef}
      href={ad.clickUrl}
      target="_blank"
      rel="sponsored noopener"
      onClick={onClick}
      className={cn(
        "group block rounded-2xl bg-card border border-border/50 p-4",
        "shadow-lg shadow-black/[0.04] hover:shadow-xl hover:shadow-black/[0.08]",
        "transition-all duration-200 hover:border-border/80",
        className
      )}
    >
      {/* Ad label - subtle top right */}
      <span className="float-right text-[9px] font-medium text-muted-foreground/40 uppercase tracking-wider ml-2">
        Ad
      </span>

      <div className="flex items-start gap-3.5">
        {ad.favicon && (
          <Image
            src={ad.favicon}
            alt={ad.brandName}
            width={44}
            height={44}
            className="size-11 rounded-xl shrink-0 bg-white shadow-sm ring-1 ring-black/[0.04]"
            unoptimized
          />
        )}

        <div className="flex-1 min-w-0">
          {/* Value proposition - the hero */}
          <p className="text-[15px] leading-snug font-semibold text-foreground group-hover:text-primary transition-colors">
            {ad.adText || ad.title}
          </p>

          {/* Brand name - trust signal */}
          <p className="mt-1 text-[13px] text-muted-foreground truncate">
            {ad.brandName}
          </p>

          {/* CTA - prominent action */}
          {ad.cta && (
            <div className="mt-3">
              <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary-foreground bg-primary px-4 py-2 rounded-full shadow-sm group-hover:shadow transition-shadow">
                {ad.cta}
                <ArrowUpRight className="size-4 opacity-80" />
              </span>
            </div>
          )}
        </div>
      </div>
    </a>
  );
}
