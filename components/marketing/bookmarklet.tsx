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
      className="cursor-move border-b-2 border-muted-foreground transition-colors hover:border-foreground"
      title={t("dragTip")}
      onClick={handleClick}
    >
      {t("linkText")}
    </a>
  );
};
