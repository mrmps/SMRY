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

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
  variant?: "default" | "compact" | "sidebar" | "mobile" | "inline" | "micro" | "inline-chat";
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

// Extract domain from a URL for favicon lookup
function getDomain(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

// Fallback icon when no favicon
function FallbackIcon({ brandName }: { brandName: string }) {
  return (
    <div className="size-full rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
      <span className="text-primary font-bold text-xs">
        {brandName.charAt(0).toUpperCase()}
      </span>
    </div>
  );
}

export function GravityAd({ ad, onVisible, onDismiss, onClick, className, variant = "default" }: GravityAdProps) {
  const adRef = useRef<HTMLAnchorElement>(null);
  const [hasTrackedImpression, setHasTrackedImpression] = useState(false);
  // 0 = gravity favicon, 1 = DuckDuckGo fallback, 2 = letter icon
  const [faviconStage, setFaviconStage] = useState(0);

  const ddgFavicon = useMemo(() => {
    const domain = getDomain(ad.clickUrl);
    return domain ? `https://icons.duckduckgo.com/ip3/${domain}.ico` : null;
  }, [ad.clickUrl]);

  // Resolve which favicon src to use (null = use FallbackIcon)
  const faviconSrc =
    faviconStage === 0 && ad.favicon ? ad.favicon
    : faviconStage <= 1 && ddgFavicon ? ddgFavicon
    : null;

  const handleFaviconError = () => {
    setFaviconStage((s) => s + 1);
  };

  // Reset on ad change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional reset when ad prop changes
    setHasTrackedImpression(false);
    setFaviconStage(0);
  }, [ad.clickUrl]);

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
  }, [hasTrackedImpression, onVisible, ad.impUrl]); // ad.impUrl triggers re-setup on ad change

  // Derived content - prioritize VALUE (adText) over brand repetition
  const valueProp = ad.adText || ad.title; // The actual value/benefit
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
          "flex items-center gap-3 bg-card border-t border-border/30",
          "px-3 py-2.5",
          "sm:px-4",
          "md:mx-3 md:mb-2 md:rounded-lg md:border md:shadow-sm",
          "group",
          className
        )}
      >
        {/* Icon with light bg for dark mode visibility */}
        <div className="size-8 rounded-lg overflow-hidden bg-white shrink-0 ring-1 ring-border/20">
          {faviconSrc ? (
            <Image
              src={faviconSrc}
              alt=""
              width={32}
              height={32}
              className="size-full object-cover"
              onError={handleFaviconError}
              unoptimized
            />
          ) : (
            <FallbackIcon brandName={ad.brandName} />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors">
            {valueProp}
          </p>
          <p className="text-[11px] text-muted-foreground/50 mt-0.5">
            {ad.brandName} · Ad
          </p>
        </div>

        {/* Dismiss only - no CTA button, whole thing is clickable */}
        <DismissButton onDismiss={onDismiss} />
      </a>
    );
  }

  // ============================================
  // COMPACT VARIANT - Minimal inline
  // ============================================
  if (variant === "compact") {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <a
          ref={adRef}
          href={ad.clickUrl}
          target="_blank"
          rel="sponsored noopener"
          onClick={onClick}
          className="flex-1 flex items-center gap-2 min-w-0 group rounded-md p-1.5 -m-1.5 hover:bg-muted/40 transition-colors"
        >
          <div className="size-7 rounded-md overflow-hidden bg-white shrink-0 ring-1 ring-border/20">
            {faviconSrc ? (
              <Image
                src={faviconSrc!}
                alt=""
                width={28}
                height={28}
                className="size-full object-cover"
                onError={handleFaviconError}
                unoptimized
              />
            ) : (
              <FallbackIcon brandName={ad.brandName} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-medium text-foreground group-hover:text-primary transition-colors line-clamp-1">
              {valueProp}
            </p>
            <p className="text-[10px] text-muted-foreground/50">
              {ad.brandName} · Ad
            </p>
          </div>
        </a>
        <span className="shrink-0 inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground">
          {ctaText} →
        </span>
        <DismissButton onDismiss={onDismiss} />
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
            {faviconSrc ? (
              <Image
                src={faviconSrc!}
                alt=""
                width={32}
                height={32}
                className="size-full object-cover"
                onError={handleFaviconError}
                unoptimized
              />
            ) : (
              <FallbackIcon brandName={ad.brandName} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-foreground leading-snug group-hover:text-primary transition-colors line-clamp-2">
              {valueProp}
            </p>
            <p className="text-[10px] text-muted-foreground/50 mt-1">
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
  // Just: "Ad · BrandName — value prop"
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
  // INLINE-CHAT VARIANT - Elegant sponsored suggestion
  // Styled like a blockquote with left border
  // ============================================
  if (variant === "inline-chat") {
    return (
      <a
        ref={adRef}
        href={ad.clickUrl}
        target="_blank"
        rel="sponsored noopener"
        onClick={onClick}
        className={cn(
          "group block pl-3 border-l-2 border-border/40 hover:border-primary/40 transition-colors",
          className
        )}
      >
        <p className="text-[12px] leading-relaxed text-muted-foreground/70 group-hover:text-muted-foreground transition-colors">
          <span className="font-medium text-foreground/70 group-hover:text-foreground/90">{ad.brandName}</span>
          {" — "}
          {valueProp}
          {" "}
          <span className="inline-flex items-center gap-0.5 font-medium text-primary/60 group-hover:text-primary transition-colors whitespace-nowrap">
            {ctaText}
            <span className="text-[10px]">↗</span>
          </span>
        </p>
        <span className="text-[9px] text-muted-foreground/30 mt-0.5 block">Sponsored</span>
      </a>
    );
  }

  // ============================================
  // INLINE VARIANT - End-of-article horizontal strip
  // No card, no shadow — just a quiet separator + horizontal row
  // ============================================
  if (variant === "inline") {
    return (
      <div className={cn("border-t border-border/40 pt-6 pb-2 overflow-hidden", className)}>
        <a
          ref={adRef}
          href={ad.clickUrl}
          target="_blank"
          rel="sponsored noopener"
          onClick={onClick}
          className="flex items-center gap-2 sm:gap-3 group rounded-lg p-2 -m-2 hover:bg-muted/30 transition-colors"
        >
          <div className="size-8 sm:size-9 rounded-lg overflow-hidden bg-white shrink-0 ring-1 ring-border/20">
            {faviconSrc ? (
              <Image
                src={faviconSrc!}
                alt=""
                width={36}
                height={36}
                className="size-full object-cover"
                onError={handleFaviconError}
                unoptimized
              />
            ) : (
              <FallbackIcon brandName={ad.brandName} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] sm:text-sm text-foreground leading-snug group-hover:text-primary transition-colors line-clamp-2">
              {valueProp}
            </p>
            <p className="text-[10px] sm:text-[11px] text-muted-foreground/50 mt-0.5">
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
          {faviconSrc ? (
            <Image
              src={faviconSrc!}
              alt=""
              width={32}
              height={32}
              className="size-full object-cover"
              onError={handleFaviconError}
              unoptimized
            />
          ) : (
            <FallbackIcon brandName={ad.brandName} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-medium text-foreground truncate">{ad.brandName}</p>
          <p className="text-[10px] text-muted-foreground/50">Sponsored</p>
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
