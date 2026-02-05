"use client";

/**
 * GravityAd - High-performance contextual ad display component
 *
 * Performance optimizations:
 * - Single IntersectionObserver per component (ref-based, not recreated)
 * - Impression tracking via ref to avoid re-renders
 * - CSS-based favicon fallback (no state updates)
 * - Memoized component with proper comparison
 */

import { memo, useCallback, useEffect, useRef } from "react";
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
  variant?: "default" | "compact" | "sidebar" | "mobile" | "inline" | "micro";
}

// Extract domain from URL for favicon lookup
function getDomain(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

// Dismiss button component
const DismissButton = memo(function DismissButton({
  onDismiss,
  className,
}: {
  onDismiss?: () => void;
  className?: string;
}) {
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onDismiss?.();
    },
    [onDismiss]
  );

  if (!onDismiss) return null;

  return (
    <button
      type="button"
      onClick={handleClick}
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
});

// Favicon with CSS fallback (no state needed)
const AdFavicon = memo(function AdFavicon({
  favicon,
  clickUrl,
  brandName,
  size = 32,
}: {
  favicon?: string;
  clickUrl: string;
  brandName: string;
  size?: number;
}) {
  const domain = getDomain(clickUrl);
  const ddgFavicon = domain ? `https://icons.duckduckgo.com/ip3/${domain}.ico` : null;
  const initial = brandName.charAt(0).toUpperCase();
  const imgSrc = favicon || ddgFavicon;

  return (
    <div
      className="relative rounded-lg overflow-hidden bg-linear-to-br from-primary/20 to-primary/10 ring-1 ring-border/20 flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
    >
      {/* Fallback letter always rendered behind */}
      <span className="text-primary font-bold text-xs">{initial}</span>

      {/* Primary favicon - only render if we have a valid src */}
      {imgSrc && (
        <Image
          src={imgSrc}
          alt=""
          width={size}
          height={size}
          className="absolute inset-0 size-full object-cover bg-white"
          onError={(e) => {
            // On error, hide the image to show fallback letter
            e.currentTarget.style.display = "none";
          }}
          unoptimized
        />
      )}
    </div>
  );
});

// Main component
function GravityAdComponent({
  ad,
  onVisible,
  onDismiss,
  onClick,
  className,
  variant = "default",
}: GravityAdProps) {
  const adRef = useRef<HTMLAnchorElement>(null);
  const hasTrackedRef = useRef(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  // Store latest callback in ref to avoid stale closure issues
  const onVisibleRef = useRef(onVisible);

  // Keep the ref updated with latest callback
  useEffect(() => {
    onVisibleRef.current = onVisible;
  }, [onVisible]);

  // Single effect for intersection observer - stable dependencies
  useEffect(() => {
    const element = adRef.current;
    if (!element) return;

    // Reset tracking and create fresh observer when ad changes
    hasTrackedRef.current = false;

    // Clean up any existing observer
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !hasTrackedRef.current) {
          hasTrackedRef.current = true;
          // Always call the latest callback via ref
          onVisibleRef.current();
          observerRef.current?.disconnect();
        }
      },
      { threshold: 0.5 }
    );

    observerRef.current.observe(element);

    return () => {
      observerRef.current?.disconnect();
    };
  }, [ad.clickUrl]); // Only recreate when ad changes

  // Derived content
  const valueProp = ad.adText || ad.title;
  const ctaText = ad.cta || "Learn more";

  // MICRO VARIANT
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

  // MOBILE VARIANT
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
          "px-3 py-2.5 sm:px-4",
          "md:mx-3 md:mb-2 md:rounded-lg md:border md:shadow-sm",
          "group",
          className
        )}
      >
        <AdFavicon favicon={ad.favicon} clickUrl={ad.clickUrl} brandName={ad.brandName} />
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

  // COMPACT VARIANT
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
          <AdFavicon favicon={ad.favicon} clickUrl={ad.clickUrl} brandName={ad.brandName} size={28} />
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

  // SIDEBAR VARIANT
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
          <AdFavicon favicon={ad.favicon} clickUrl={ad.clickUrl} brandName={ad.brandName} />
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

  // INLINE VARIANT
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
          <AdFavicon favicon={ad.favicon} clickUrl={ad.clickUrl} brandName={ad.brandName} size={36} />
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

  // DEFAULT VARIANT
  return (
    <div
      className={cn(
        "group rounded-xl bg-card border border-border/40 p-3.5",
        "shadow-md hover:shadow-lg transition-shadow duration-200",
        className
      )}
    >
      <div className="flex items-center gap-2.5 mb-2">
        <AdFavicon favicon={ad.favicon} clickUrl={ad.clickUrl} brandName={ad.brandName} />
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-medium text-foreground truncate">{ad.brandName}</p>
          <p className="text-[10px] text-muted-foreground/50">Sponsored</p>
        </div>
        <DismissButton onDismiss={onDismiss} />
      </div>
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

// Memoized export with proper comparison
export const GravityAd = memo(GravityAdComponent, (prev, next) => {
  return (
    prev.ad.clickUrl === next.ad.clickUrl &&
    prev.variant === next.variant &&
    prev.className === next.className &&
    prev.onVisible === next.onVisible &&
    prev.onDismiss === next.onDismiss &&
    prev.onClick === next.onClick
  );
});
