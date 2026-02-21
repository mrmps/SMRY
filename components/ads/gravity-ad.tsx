"use client";

/**
 * GravityAd - Contextual ad display component
 *
 * Design principles (after 15 rounds of review):
 * 1. Compact & respectful - minimal intrusion
 * 2. Title + description hierarchy when space allows
 * 3. Always-visible CTA with smart fallback
 * 4. Dismiss on most variants (sidebar is non-dismissable on desktop)
 * 5. Great at every breakpoint
 */

import { useLayoutEffect, useRef, useState } from "react";
import { X } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import type { GravityAd as GravityAdType } from "@/lib/hooks/use-gravity-ad";

interface GravityAdProps {
  ad: GravityAdType;
  onVisible: () => void;
  onDismiss?: () => void;
  onClick?: () => void;
  className?: string;
  variant?: "default" | "compact" | "sidebar" | "mobile" | "inline" | "micro" | "inline-chat" | "chat-prompt";
}

// Dismiss button - consistent across all variants
function DismissButton({
  onDismiss,
  className,
}: {
  onDismiss?: () => void;
  className?: string;
}) {
  if (!onDismiss) return null;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onDismiss();
      }}
      className={cn(
        "shrink-0 flex items-center justify-center rounded-full transition-all",
        "size-6 text-muted-foreground/30 hover:text-muted-foreground/60 hover:bg-muted/60",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
      aria-label="Dismiss ad"
    >
      <X className="size-3" />
    </button>
  );
}

/**
 * AdFavicon - Simple favicon with cascading fallbacks
 *
 * Tries in order:
 * 1. Gravity-provided favicon (src prop)
 * 2. DuckDuckGo favicon lookup (from fallbackUrl domain)
 * 3. Letter icon (first letter of brandName)
 */
function AdFavicon({
  src,
  fallbackUrl,
  brandName,
  size = 32,
  className,
}: {
  src?: string;
  fallbackUrl?: string;
  brandName: string;
  size?: number;
  className?: string;
}) {
  const [stage, setStage] = useState(0); // 0=primary, 1=ddg, 2=letter

  // Build DuckDuckGo fallback URL from domain
  const ddgUrl = fallbackUrl ? (() => {
    try {
      const domain = new URL(fallbackUrl).hostname;
      return `/api/favicon?domain=${domain}`;
    } catch {
      return null;
    }
  })() : null;

  // Determine current src based on stage
  const currentSrc = stage === 0 && src ? src
    : stage <= 1 && ddgUrl ? ddgUrl
    : null;

  // Reset stage when src changes (new ad)
  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional reset when src prop changes
    setStage(0);
  }, [src]);

  // Letter fallback
  if (!currentSrc) {
    return (
      <div className={cn("size-full rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center", className)}>
        <span className="text-primary font-bold text-xs">
          {brandName.charAt(0).toUpperCase()}
        </span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={currentSrc}
      alt=""
      width={size}
      height={size}
      className={cn("size-full object-cover", className)}
      onError={() => setStage(s => s + 1)}
    />
  );
}

export function GravityAd({ ad, onVisible, onDismiss, onClick, className, variant = "default" }: GravityAdProps) {
  const adRef = useRef<HTMLAnchorElement>(null);
  const [hasTrackedImpression, setHasTrackedImpression] = useState(false);

  // Reset on ad change
  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional reset when ad changes
    setHasTrackedImpression(false);
  }, [ad.impUrl]);

  // Impression tracking - useLayoutEffect ensures ref is available after DOM mount
  useLayoutEffect(() => {
    if (hasTrackedImpression) return;

    const element = adRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setHasTrackedImpression(true);
          onVisible();
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [hasTrackedImpression, onVisible, ad.impUrl]);

  // Derived content - prioritize VALUE (adText) over brand repetition
  const valueProp = ad.adText || ad.title;
  const ctaText = ad.cta || "Learn more";

  // ============================================
  // MOBILE VARIANT - Clean, minimal, no button
  // ============================================
  if (variant === "mobile") {
    return (
      <a
        ref={adRef}
        href={ad.clickUrl}
        target="_blank"
        rel="sponsored noopener"
        onClick={onClick}
        className={cn(
          "flex items-center gap-3 bg-card",
          "px-3 py-2.5",
          "sm:px-4",
          "md:mx-3 md:mb-2 md:rounded-lg md:border md:shadow-sm",
          "group",
          className
        )}
      >
        <div className="size-8 rounded-lg overflow-hidden bg-white shrink-0 ring-1 ring-border/20">
          <AdFavicon src={ad.favicon} fallbackUrl={ad.url} brandName={ad.brandName} size={32} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors">
            {valueProp}
          </p>
          <p className="text-[11px] text-muted-foreground/50 mt-0.5">
            {ad.brandName} · Ad
          </p>
        </div>
        <DismissButton onDismiss={onDismiss} />
      </a>
    );
  }

  // ============================================
  // COMPACT VARIANT - Minimal inline (smaller for desktop sidebar)
  // ============================================
  if (variant === "compact") {
    return (
      <div className={cn("flex items-center gap-1.5", className)}>
        <a
          ref={adRef}
          href={ad.clickUrl}
          target="_blank"
          rel="sponsored noopener"
          onClick={onClick}
          className="flex-1 flex items-center gap-1.5 min-w-0 group rounded-md p-1 -m-1 hover:bg-muted/40 transition-colors"
        >
          <div className="size-5 rounded overflow-hidden bg-white shrink-0 ring-1 ring-border/20">
            <AdFavicon src={ad.favicon} fallbackUrl={ad.url} brandName={ad.brandName} size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-foreground/80 group-hover:text-primary transition-colors line-clamp-1">
              {valueProp}
            </p>
          </div>
        </a>
        <span className="shrink-0 text-[11px] text-muted-foreground/40">Ad</span>
        <DismissButton onDismiss={onDismiss} className="size-5" />
      </div>
    );
  }

  // ============================================
  // SIDEBAR VARIANT - Native content feel
  // ============================================
  if (variant === "sidebar") {
    return (
      <div className={cn("flex items-start gap-2.5 group", className)}>
        <a
          ref={adRef}
          href={ad.clickUrl}
          target="_blank"
          rel="sponsored noopener"
          onClick={onClick}
          className="flex-1 flex items-start gap-2.5 min-w-0 rounded-lg p-2 -m-2 hover:bg-muted/40 transition-colors"
        >
          <div className="size-8 rounded-lg overflow-hidden bg-white shrink-0 ring-1 ring-border/20">
            <AdFavicon src={ad.favicon} fallbackUrl={ad.url} brandName={ad.brandName} size={32} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-foreground leading-snug group-hover:text-primary transition-colors line-clamp-2">
              {valueProp}
            </p>
            <p className="text-[11px] text-muted-foreground/50 mt-1">
              {ad.brandName} · Sponsored
            </p>
            <span className="mt-2 inline-flex items-center gap-1 rounded-md bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
              {ctaText} →
            </span>
          </div>
        </a>
      </div>
    );
  }

  // ============================================
  // MICRO VARIANT - Single-line text ad, nearly invisible
  // ============================================
  if (variant === "micro") {
    return (
      <a
        ref={adRef}
        href={ad.clickUrl}
        target="_blank"
        rel="sponsored noopener"
        onClick={onClick}
        className={cn(
          "group text-center text-[11px] text-muted-foreground/70 transition-colors hover:text-muted-foreground",
          className
        )}
      >
        <span className="text-muted-foreground/50">Ad</span>
        <span className="text-muted-foreground/40"> · </span>
        <span className="group-hover:underline underline-offset-2 decoration-muted-foreground/40">
          {ad.brandName} — {valueProp}
        </span>
      </a>
    );
  }

  // ============================================
  // CHAT-PROMPT VARIANT - Minimal native ad above chat input
  // Designed to feel like a subtle suggestion, not a card
  // ============================================
  if (variant === "chat-prompt") {
    return (
      <div className={cn("flex items-center gap-2 px-1 py-1", className)}>
        <a
          ref={adRef}
          href={ad.clickUrl}
          target="_blank"
          rel="sponsored noopener"
          onClick={onClick}
          className="flex-1 flex items-center gap-2 min-w-0 group rounded-lg px-2 py-1.5 -mx-1 hover:bg-muted/40 transition-colors"
        >
          <div className="size-6 rounded-md overflow-hidden bg-white shrink-0 ring-1 ring-border/20">
            <AdFavicon src={ad.favicon} fallbackUrl={ad.url} brandName={ad.brandName} size={24} />
          </div>
          <p className="flex-1 min-w-0 text-[12px] text-muted-foreground/70 leading-snug line-clamp-1 group-hover:text-muted-foreground transition-colors">
            <span className="font-medium text-foreground/60 group-hover:text-foreground/80">{ad.brandName}</span>
            <span className="text-muted-foreground/30"> · </span>
            {valueProp}
          </p>
        </a>
        <span className="shrink-0 text-[10px] text-muted-foreground/30">Ad</span>
        <DismissButton onDismiss={onDismiss} className="size-5" />
      </div>
    );
  }

  // ============================================
  // INLINE-CHAT VARIANT - Native recommendation after AI response
  // Mobile: compact row | Desktop: card with CTA
  // ============================================
  if (variant === "inline-chat") {
    return (
      <>
        {/* Mobile: compact card */}
        <div className={cn("sm:hidden rounded-xl bg-muted/20 border border-border/20 overflow-hidden", className)}>
          <a
            ref={adRef}
            href={ad.clickUrl}
            target="_blank"
            rel="sponsored noopener"
            onClick={onClick}
            className="block px-3 py-2.5 active:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-2 mb-1.5">
              <div className="size-5 rounded-md overflow-hidden bg-white shrink-0 ring-1 ring-border/15">
                <AdFavicon src={ad.favicon} fallbackUrl={ad.url} brandName={ad.brandName} size={20} />
              </div>
              <span className="text-[11px] font-semibold text-foreground/70">{ad.brandName}</span>
              <span className="text-[2px] text-muted-foreground/20">ad</span>
            </div>
            <p className="text-[12px] leading-[1.45] text-muted-foreground/55 line-clamp-2">
              {valueProp}
            </p>
            <span className="mt-1.5 inline-flex items-center gap-0.5 text-[11px] font-semibold text-primary/70 active:text-primary">
              {ctaText}<span className="text-[10px]">↗</span>
            </span>
          </a>
        </div>

        {/* Desktop: card layout */}
        <div
          className={cn(
            "hidden sm:block group rounded-2xl overflow-hidden transition-all duration-200",
            "bg-muted/25 border border-border/25 hover:border-border/40",
            className
          )}
        >
          <a
            ref={adRef}
            href={ad.clickUrl}
            target="_blank"
            rel="sponsored noopener"
            onClick={onClick}
            className="flex items-start gap-3 p-3"
          >
            <div className="size-10 rounded-xl overflow-hidden bg-white shrink-0 shadow-sm ring-1 ring-black/[0.06]">
              <AdFavicon src={ad.favicon} fallbackUrl={ad.url} brandName={ad.brandName} size={40} />
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-[13px] font-semibold text-foreground/85 truncate">{ad.brandName}</span>
                <span className="shrink-0 rounded-full bg-muted/60 px-1.5 py-px text-[9px] font-medium text-muted-foreground/45 uppercase tracking-wider">Ad</span>
              </div>
              <p className="text-[12.5px] leading-[1.5] text-muted-foreground/60 group-hover:text-muted-foreground/75 transition-colors line-clamp-2">
                {valueProp}
              </p>
              <span className="mt-2 inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary/80 transition-colors group-hover:bg-primary/15 group-hover:text-primary">
                {ctaText}
                <span className="text-[10px] transition-transform duration-200 group-hover:translate-x-0.5">↗</span>
              </span>
            </div>
          </a>
        </div>
      </>
    );
  }

  // ============================================
  // INLINE VARIANT - End-of-article horizontal strip
  // ============================================
  if (variant === "inline") {
    return (
      <div className={cn("pt-6 pb-2 overflow-hidden", className)}>
        <a
          ref={adRef}
          href={ad.clickUrl}
          target="_blank"
          rel="sponsored noopener"
          onClick={onClick}
          className="flex items-center gap-2 sm:gap-3 group rounded-lg p-2 -m-2 hover:bg-muted/30 transition-colors"
        >
          <div className="size-8 sm:size-9 rounded-lg overflow-hidden bg-white shrink-0 ring-1 ring-border/20">
            <AdFavicon src={ad.favicon} fallbackUrl={ad.url} brandName={ad.brandName} size={36} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] sm:text-sm text-foreground leading-snug group-hover:text-primary transition-colors line-clamp-2">
              {valueProp}
            </p>
            <p className="text-[11px] sm:text-[11px] text-muted-foreground/50 mt-0.5">
              {ad.brandName} · Sponsored
            </p>
          </div>
          <span className="hidden sm:inline-flex shrink-0 items-center gap-1 rounded-lg border border-border/60 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors group-hover:border-primary/40 group-hover:text-primary">
            {ctaText}
            <span className="transition-transform group-hover:translate-x-0.5">&rarr;</span>
          </span>
        </a>
      </div>
    );
  }

  // ============================================
  // DEFAULT VARIANT - Desktop card (vertical layout)
  // ============================================
  return (
    <div
      className={cn(
        "group rounded-xl bg-card border border-border/40 p-3.5",
        "shadow-md hover:shadow-lg transition-shadow duration-200",
        className
      )}
    >
      {/* Header: logo + brand + dismiss */}
      <div className="flex items-center gap-2.5 mb-2">
        <div className="size-8 rounded-lg overflow-hidden bg-white shrink-0 ring-1 ring-border/20">
          <AdFavicon src={ad.favicon} fallbackUrl={ad.url} brandName={ad.brandName} size={32} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-medium text-foreground truncate">{ad.brandName}</p>
          <p className="text-[11px] text-muted-foreground/50">Sponsored</p>
        </div>
        <DismissButton onDismiss={onDismiss} />
      </div>

      {/* Value prop - full width, can breathe */}
      <a
        ref={adRef}
        href={ad.clickUrl}
        target="_blank"
        rel="sponsored noopener"
        onClick={onClick}
        className="block"
      >
        <p className="text-[13px] font-medium text-foreground leading-relaxed group-hover:text-primary transition-colors">
          {valueProp}
        </p>
        <span className="mt-3 inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground shadow-sm transition-shadow group-hover:shadow-md">
          {ctaText} →
        </span>
      </a>
    </div>
  );
}
