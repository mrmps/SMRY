"use client";

/**
 * GravityAd - Contextual ad display component
 *
 * Renders below summary content. Uses IntersectionObserver to fire
 * impression tracking when 50% visible.
 */

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import type { GravityAd as GravityAdType } from "@/lib/hooks/use-gravity-ad";

interface GravityAdProps {
  ad: GravityAdType;
  onVisible: () => void;
  className?: string;
  /** Compact variant for mobile - minimal native styling */
  variant?: "default" | "compact";
}

export function GravityAd({ ad, onVisible, className, variant = "default" }: GravityAdProps) {
  const adRef = useRef<HTMLAnchorElement>(null);
  const [hasTrackedImpression, setHasTrackedImpression] = useState(false);

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

  // Compact variant - minimal native styling like a link
  if (variant === "compact") {
    return (
      <div className={cn("mb-6", className)}>
        <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
          Sponsored
        </p>
        <a
          ref={adRef}
          href={ad.clickUrl}
          target="_blank"
          rel="sponsored noopener"
          className="group flex items-start gap-3 rounded-lg p-2.5 -mx-2.5 transition-colors hover:bg-muted/40"
        >
          {ad.favicon && (
            <Image
              src={ad.favicon}
              alt=""
              width={32}
              height={32}
              className="size-8 rounded-md mt-0.5"
              unoptimized
            />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground leading-snug group-hover:text-primary transition-colors">
              {ad.title}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
              {ad.brandName}
            </p>
          </div>
        </a>
      </div>
    );
  }

  // Default variant - clean native style
  return (
    <a
      ref={adRef}
      href={ad.clickUrl}
      target="_blank"
      rel="sponsored noopener"
      className={cn(
        "group block mt-4 rounded-lg transition-colors hover:bg-muted/30",
        className
      )}
    >
      {/* Sponsored label */}
      <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50">
        Sponsored
      </p>

      <div className="flex items-start gap-3">
        {/* Favicon */}
        {ad.favicon && (
          <Image
            src={ad.favicon}
            alt=""
            width={36}
            height={36}
            className="size-9 rounded-lg shrink-0"
            unoptimized
          />
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title */}
          <p className="text-sm font-medium text-foreground leading-snug group-hover:text-primary transition-colors">
            {ad.title}
          </p>

          {/* Brand */}
          <p className="mt-0.5 text-xs text-muted-foreground">
            {ad.brandName}
          </p>

          {/* Ad text - only show if present */}
          {ad.adText && (
            <p className="mt-1.5 text-xs text-muted-foreground/80 leading-relaxed">
              {ad.adText}
            </p>
          )}

          {/* CTA */}
          {ad.cta && (
            <p className="mt-2 text-xs font-medium text-primary">
              {ad.cta} →
            </p>
          )}
        </div>
      </div>
    </a>
  );
}
