"use client";

/**
 * GravityAd - Contextual ad display component
 *
 * Design principles (after 15 rounds of review):
 * 1. Compact & respectful - minimal intrusion
 * 2. Title + description hierarchy when space allows
 * 3. Always-visible CTA with smart fallback
 * 4. Dismiss on all variants
 * 5. Great at every breakpoint
 */

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { X, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GravityAd as GravityAdType } from "@/lib/hooks/use-gravity-ad";

interface GravityAdProps {
  ad: GravityAdType;
  onVisible: () => void;
  onDismiss?: () => void;
  onClick?: () => void;
  className?: string;
  variant?: "default" | "compact" | "sidebar" | "mobile";
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
  const [imgError, setImgError] = useState(false);

  // Reset on ad change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional reset when ad prop changes
    setHasTrackedImpression(false);
    setImgError(false);
  }, [ad.clickUrl]);

  // Impression tracking
  useEffect(() => {
    if (hasTrackedImpression || !adRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !hasTrackedImpression) {
          setHasTrackedImpression(true);
          onVisible();
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(adRef.current);
    return () => observer.disconnect();
  }, [hasTrackedImpression, onVisible]);

  // Derived content
  const headline = ad.title || ad.brandName;
  const description = ad.adText || ad.title;
  const ctaText = ad.cta || "Learn more";
  const showDescription = ad.adText && ad.title; // Only show desc if we have both

  // ============================================
  // MOBILE VARIANT - Ultra compact, single row
  // ============================================
  if (variant === "mobile") {
    return (
      <div
        className={cn(
          "flex items-center bg-card border-t border-border/30",
          // Extremely tight on small phones
          "gap-2 px-2.5 py-1.5",
          // Slightly more room 475px+
          "xs:gap-2.5 xs:px-3 xs:py-2",
          // Comfortable on tablets 640px+
          "sm:gap-3 sm:px-4 sm:py-2.5",
          // Card style 768px+
          "md:mx-3 md:mb-2 md:rounded-lg md:border md:shadow-sm",
          className
        )}
      >
        {/* Icon - scales with viewport */}
        <a
          ref={adRef}
          href={ad.clickUrl}
          target="_blank"
          rel="sponsored noopener"
          onClick={onClick}
          className="shrink-0"
        >
          <div className="size-6 xs:size-7 sm:size-8 md:size-9 rounded-md overflow-hidden bg-muted">
            {ad.favicon && !imgError ? (
              <Image
                src={ad.favicon}
                alt=""
                width={36}
                height={36}
                className="size-full object-cover"
                onError={() => setImgError(true)}
                unoptimized
              />
            ) : (
              <FallbackIcon brandName={ad.brandName} />
            )}
          </div>
        </a>

        {/* Content */}
        <a
          href={ad.clickUrl}
          target="_blank"
          rel="sponsored noopener"
          onClick={onClick}
          className="flex-1 min-w-0 group"
        >
          {/* Mobile: single line. Tablet: can show headline + desc */}
          <p className="text-[12px] xs:text-[13px] sm:text-[13px] font-medium text-foreground leading-tight truncate group-hover:text-primary transition-colors">
            {headline}
          </p>
          {/* Description - only on 640px+ */}
          <p className="hidden sm:block text-[11px] text-muted-foreground/70 truncate mt-0.5">
            {description !== headline ? description : ad.brandName}
          </p>
          {/* Brand + Ad on mobile */}
          <p className="sm:hidden text-[10px] text-muted-foreground/50 truncate">
            {ad.brandName} · Ad
          </p>
        </a>

        {/* CTA - grows with viewport */}
        <a
          href={ad.clickUrl}
          target="_blank"
          rel="sponsored noopener"
          onClick={onClick}
          className={cn(
            "shrink-0 font-medium transition-colors flex items-center gap-1",
            // Tiny: icon only
            "text-primary",
            // 475px+: text
            "xs:text-[11px]",
            // 640px+: button style
            "sm:text-[11px] sm:bg-primary sm:text-primary-foreground sm:px-2.5 sm:py-1 sm:rounded-md sm:hover:bg-primary/90"
          )}
        >
          <span className="hidden xs:inline">{ctaText}</span>
          <ExternalLink className="size-3 xs:hidden" />
        </a>

        {/* Dismiss */}
        <DismissButton onDismiss={onDismiss} className="size-5 xs:size-6" />
      </div>
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
          <div className="size-6 rounded-md overflow-hidden bg-muted shrink-0">
            {ad.favicon && !imgError ? (
              <Image
                src={ad.favicon}
                alt=""
                width={24}
                height={24}
                className="size-full object-cover"
                onError={() => setImgError(true)}
                unoptimized
              />
            ) : (
              <FallbackIcon brandName={ad.brandName} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-medium text-foreground group-hover:text-primary transition-colors truncate">
              {headline}
            </p>
            <p className="text-[10px] text-muted-foreground/50">
              {ad.brandName} · Ad
            </p>
          </div>
        </a>
        <a
          href={ad.clickUrl}
          target="_blank"
          rel="sponsored noopener"
          onClick={onClick}
          className="shrink-0 text-[10px] font-medium text-primary hover:text-primary/80"
        >
          {ctaText} →
        </a>
        <DismissButton onDismiss={onDismiss} className="size-5" />
      </div>
    );
  }

  // ============================================
  // SIDEBAR VARIANT - Native content feel
  // ============================================
  if (variant === "sidebar") {
    return (
      <div className={cn("group", className)}>
        <div className="flex items-start gap-2.5">
          <a
            ref={adRef}
            href={ad.clickUrl}
            target="_blank"
            rel="sponsored noopener"
            onClick={onClick}
            className="flex-1 flex items-start gap-2.5 min-w-0 rounded-lg p-2 -m-2 hover:bg-muted/40 transition-colors"
          >
            <div className="size-8 rounded-lg overflow-hidden bg-muted shrink-0 mt-0.5">
              {ad.favicon && !imgError ? (
                <Image
                  src={ad.favicon}
                  alt=""
                  width={32}
                  height={32}
                  className="size-full object-cover"
                  onError={() => setImgError(true)}
                  unoptimized
                />
              ) : (
                <FallbackIcon brandName={ad.brandName} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              {/* Headline */}
              <p className="text-[13px] font-medium text-foreground leading-snug group-hover:text-primary transition-colors">
                {headline}
              </p>
              {/* Description if different from headline */}
              {showDescription && (
                <p className="text-[12px] text-muted-foreground/70 leading-snug mt-0.5 line-clamp-2">
                  {description}
                </p>
              )}
              {/* Brand + Ad */}
              <p className="text-[10px] text-muted-foreground/50 mt-1">
                {ad.brandName} · Sponsored
              </p>
              {/* CTA */}
              <p className="mt-2 text-[11px] font-semibold text-primary">
                {ctaText} →
              </p>
            </div>
          </a>
          <DismissButton onDismiss={onDismiss} className="mt-1" />
        </div>
      </div>
    );
  }

  // ============================================
  // DEFAULT VARIANT - Desktop floating card
  // ============================================
  return (
    <div
      className={cn(
        "group rounded-xl bg-card border border-border/40 p-3",
        "shadow-md hover:shadow-lg transition-shadow duration-200",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <a
          ref={adRef}
          href={ad.clickUrl}
          target="_blank"
          rel="sponsored noopener"
          onClick={onClick}
          className="flex-1 flex items-start gap-3 min-w-0"
        >
          {/* Logo */}
          <div className="size-10 rounded-xl overflow-hidden bg-muted shrink-0">
            {ad.favicon && !imgError ? (
              <Image
                src={ad.favicon}
                alt=""
                width={40}
                height={40}
                className="size-full object-cover"
                onError={() => setImgError(true)}
                unoptimized
              />
            ) : (
              <FallbackIcon brandName={ad.brandName} />
            )}
          </div>

          <div className="flex-1 min-w-0">
            {/* Headline - always shown */}
            <p className="text-[14px] font-semibold text-foreground leading-snug group-hover:text-primary transition-colors">
              {headline}
            </p>

            {/* Description - if we have both title and adText */}
            {showDescription && (
              <p className="text-[12px] text-muted-foreground/80 leading-snug mt-0.5 line-clamp-2">
                {description}
              </p>
            )}

            {/* Brand + Ad label */}
            <p className="text-[11px] text-muted-foreground/50 mt-1">
              {ad.brandName} · Ad
            </p>

            {/* CTA Button */}
            <span className="inline-flex items-center gap-1 mt-2.5 text-[11px] font-semibold text-primary-foreground bg-primary px-3 py-1.5 rounded-md hover:bg-primary/90 transition-colors">
              {ctaText}
              <ExternalLink className="size-3 opacity-70" />
            </span>
          </div>
        </a>

        {/* Dismiss */}
        <DismissButton onDismiss={onDismiss} />
      </div>
    </div>
  );
}
