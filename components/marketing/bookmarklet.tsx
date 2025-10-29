"use client";
import type { MouseEvent } from "react";
import { useEffect, useRef } from "react";

export const BookmarkletLink = () => {
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
      className="border-b-2 border-stone-400 hover:border-stone-700 transition-colors cursor-move"
      title="Drag to bookmarks bar"
      onClick={handleClick}
    >
      smry.ai bookmarklet
    </a>
  );
};
