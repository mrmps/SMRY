"use client";

/**
 * GravityAd - Contextual ad display component
 *
 * Design principles:
 * 1. Compact & respectful - minimize intrusion, especially on mobile
 * 2. Single-line on small screens, expand on larger
 * 3. Dismiss always available, elegantly integrated
 * 4. Value-first hierarchy
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
  variant?: "default" | "compact" | "sidebar" | "mobile";
}

// Dismiss button - extracted outside component to avoid recreation on render
function DismissButton({
  size = "sm",
  onDismiss
}: {
  size?: "sm" | "md";
  onDismiss?: () => void;
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
        "shrink-0 rounded-full transition-colors",
        "text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/80",
        size === "sm" ? "p-1" : "p-1.5"
      )}
      aria-label="Dismiss ad"
    >
      <X className={size === "sm" ? "size-3.5" : "size-4"} />
    </button>
  );
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

  // Mobile variant - ultra compact single line
  if (variant === "mobile") {
    return (
      <div
        className={cn(
          "flex items-center bg-card/95 border-t border-border/40",
          // Minimal vertical space on mobile
          "gap-2 px-3 py-1.5",
          // Slightly more room on larger phones
          "xs:py-2",
          // Comfortable on tablets
          "sm:gap-2.5 sm:px-4 sm:py-2.5",
          // Card on large tablets
          "md:mx-3 md:mb-2 md:rounded-xl md:border md:shadow-md",
          className
        )}
      >
        {/* Logo */}
        {ad.favicon && (
          <Image
            src={ad.favicon}
            alt=""
            width={32}
            height={32}
            className="size-6 xs:size-7 sm:size-8 md:size-9 rounded-md sm:rounded-lg shrink-0 bg-white ring-1 ring-black/[0.06]"
            unoptimized
          />
        )}

        {/* Content */}
        <a
          ref={adRef}
          href={ad.clickUrl}
          target="_blank"
          rel="sponsored noopener"
          onClick={onClick}
          className="flex-1 min-w-0 group"
        >
          <p className="text-[12px] xs:text-[13px] sm:text-[14px] font-medium text-foreground leading-snug line-clamp-1 md:line-clamp-2 group-hover:text-primary transition-colors">
            {ad.adText || ad.title}
          </p>
          <p className="text-[10px] xs:text-[11px] text-muted-foreground/60 truncate">
            {ad.brandName} <span className="opacity-60">· Ad</span>
          </p>
        </a>

        {/* CTA - hidden on tiny, text on small, button on tablet */}
        <a
          href={ad.clickUrl}
          target="_blank"
          rel="sponsored noopener"
          onClick={onClick}
          className="hidden xs:block shrink-0 text-[11px] sm:text-[12px] font-semibold text-primary sm:bg-primary sm:text-primary-foreground sm:px-2.5 sm:py-1 sm:rounded-full whitespace-nowrap"
        >
          {ad.cta || "View"}
        </a>

        {/* Dismiss */}
        <DismissButton size="sm" onDismiss={onDismiss} />
      </div>
    );
  }

  // Compact variant - minimal inline
  if (variant === "compact") {
    return (
      <div className={cn("flex items-center gap-2.5", className)}>
        <a
          ref={adRef}
          href={ad.clickUrl}
          target="_blank"
          rel="sponsored noopener"
          onClick={onClick}
          className="flex-1 flex items-center gap-2.5 min-w-0 group rounded-lg p-1.5 -m-1.5 hover:bg-muted/40 transition-colors"
        >
          {ad.favicon && (
            <Image
              src={ad.favicon}
              alt=""
              width={28}
              height={28}
              className="size-7 rounded-md shrink-0 bg-white ring-1 ring-black/[0.06]"
              unoptimized
            />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-foreground group-hover:text-primary transition-colors truncate">
              {ad.adText || ad.title}
            </p>
            <p className="text-[10px] text-muted-foreground/60">
              {ad.brandName} · Ad
            </p>
          </div>
        </a>
        <DismissButton size="sm" onDismiss={onDismiss} />
      </div>
    );
  }

  // Sidebar variant
  if (variant === "sidebar") {
    return (
      <div className={cn("group", className)}>
        <div className="flex items-start gap-3">
          <a
            ref={adRef}
            href={ad.clickUrl}
            target="_blank"
            rel="sponsored noopener"
            onClick={onClick}
            className="flex-1 flex items-start gap-3 min-w-0 rounded-lg p-2 -m-2 hover:bg-muted/40 transition-colors"
          >
            {ad.favicon && (
              <Image
                src={ad.favicon}
                alt=""
                width={36}
                height={36}
                className="size-9 rounded-lg shrink-0 bg-white ring-1 ring-black/[0.06]"
                unoptimized
              />
            )}
            <div className="flex-1 min-w-0 pt-0.5">
              <p className="text-[13px] font-medium text-foreground group-hover:text-primary transition-colors leading-snug">
                {ad.adText || ad.title}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground/60">
                {ad.brandName} · Sponsored
              </p>
              {ad.cta && (
                <p className="mt-2 text-[12px] font-semibold text-primary">
                  {ad.cta} →
                </p>
              )}
            </div>
          </a>
          <DismissButton size="sm" onDismiss={onDismiss} />
        </div>
      </div>
    );
  }

  // Default variant - desktop floating card
  return (
    <div
      className={cn(
        "group rounded-xl bg-card border border-border/50 p-3.5",
        "shadow-lg shadow-black/[0.04] hover:shadow-xl hover:shadow-black/[0.06]",
        "transition-all duration-200",
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
          {ad.favicon && (
            <Image
              src={ad.favicon}
              alt=""
              width={40}
              height={40}
              className="size-10 rounded-xl shrink-0 bg-white ring-1 ring-black/[0.06]"
              unoptimized
            />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-semibold text-foreground group-hover:text-primary transition-colors leading-snug">
              {ad.adText || ad.title}
            </p>
            <p className="mt-0.5 text-[12px] text-muted-foreground/70">
              {ad.brandName} · <span className="text-muted-foreground/50">Ad</span>
            </p>
            {ad.cta && (
              <span className="inline-block mt-2 text-[12px] font-semibold text-primary-foreground bg-primary px-3 py-1.5 rounded-full">
                {ad.cta}
              </span>
            )}
          </div>
        </a>
        <DismissButton size="md" onDismiss={onDismiss} />
      </div>
    </div>
  );
}
