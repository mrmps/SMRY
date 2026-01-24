"use client";
import type { MouseEvent } from "react";
import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";

export const BookmarkletLink = () => {
  const t = useTranslations("bookmarklet");
  // Simple bookmarklet - opens current page in SMRY proxy
  const bookmarklet = `javascript:void(function(){var url=window.location.href;window.open('https://smry.ai/proxy?url='+encodeURIComponent(url),'_blank');}());`;
  const linkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    // Set href directly on the DOM element to bypass React's security warning
    if (linkRef.current) {
      linkRef.current.setAttribute('href', bookmarklet);
    }
  }, [bookmarklet]);

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    // Prevent navigation when clicked
    event.preventDefault();
  };

  return (
    <a
      ref={linkRef}
      className="inline-flex shrink-0 cursor-grab items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground shadow-sm transition-all hover:bg-accent hover:shadow active:cursor-grabbing active:scale-95"
      title={t("dragTip")}
      onClick={handleClick}
    >
      <svg className="size-3.5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M5 2h14a1 1 0 011 1v19.143a.5.5 0 01-.766.424L12 18.03l-7.234 4.536A.5.5 0 014 22.143V3a1 1 0 011-1z" />
      </svg>
      SMRY
    </a>
  );
};
