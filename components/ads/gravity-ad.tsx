"use client";

/**
 * GravityAd - Contextual ad display component
 *
 * Renders below summary content. Uses IntersectionObserver to fire
 * impression tracking when 50% visible.
 */

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GravityAd as GravityAdType } from "@/lib/hooks/use-gravity-ad";

interface GravityAdProps {
  ad: GravityAdType;
  onVisible: () => void;
  className?: string;
}

export function GravityAd({ ad, onVisible, className }: GravityAdProps) {
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

  return (
    <a
      ref={adRef}
      href={ad.clickUrl}
      target="_blank"
      rel="sponsored noopener"
      className={cn(
        "block mt-4 p-3 rounded-lg border border-border/50 bg-muted/30 transition-colors hover:bg-muted/50",
        className
      )}
    >
      <div className="flex items-start gap-3">
        {/* Favicon */}
        {ad.favicon && (
          <div className="shrink-0 mt-0.5">
            <Image
              src={ad.favicon}
              alt=""
              width={20}
              height={20}
              className="size-5 rounded"
              unoptimized
            />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Ad label + Brand */}
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70 px-1.5 py-0.5 rounded bg-muted">
              Ad
            </span>
            <span className="text-xs font-medium text-muted-foreground truncate">
              {ad.brandName}
            </span>
          </div>

          {/* Title */}
          <p className="text-sm font-medium text-foreground leading-snug mb-1">
            {ad.title}
          </p>

          {/* Ad text */}
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
            {ad.adText}
          </p>

          {/* CTA */}
          {ad.cta && (
            <div className="mt-2 flex items-center gap-1 text-xs font-medium text-primary">
              <span>{ad.cta}</span>
              <ExternalLink className="size-3" />
            </div>
          )}
        </div>
      </div>
    </a>
  );
}
