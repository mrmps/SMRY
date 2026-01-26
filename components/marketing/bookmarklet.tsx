"use client";
import type { MouseEvent, DragEvent } from "react";
import { useEffect, useRef } from "react";
import { Bookmark } from "lucide-react";
import { useTranslations } from "next-intl";

export const BookmarkletLink = () => {
  const t = useTranslations("nav");
  const bookmarklet = `javascript:void(function(){var url=window.location.href;window.open('https://smry.ai/proxy?url='+encodeURIComponent(url)+'&utm_source=bookmarklet','_blank');}());`;
  const linkRef = useRef<HTMLAnchorElement>(null);
  const dragImageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (linkRef.current) {
      linkRef.current.setAttribute("href", bookmarklet);
    }
  }, [bookmarklet]);

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
  };

  const handleDragStart = (event: DragEvent<HTMLAnchorElement>) => {
    event.dataTransfer.setData("text/uri-list", bookmarklet);
    event.dataTransfer.setData("text/plain", "SMRY");
    event.dataTransfer.setData(
      "text/html",
      `<a href="${bookmarklet}" title="SMRY">SMRY</a>`
    );
    event.dataTransfer.effectAllowed = "copyLink";

    const dragPreview = dragImageRef.current;
    if (dragPreview) {
      const rect = dragPreview.getBoundingClientRect();
      event.dataTransfer.setDragImage(dragPreview, rect.width / 2, rect.height / 2);
    }
  };

  return (
    <>
      {/* Hidden drag preview */}
      <div
        aria-hidden="true"
        ref={dragImageRef}
        style={{
          position: "absolute",
          left: "-9999px",
          top: "-9999px",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            height: "32px",
            padding: "0 12px",
            borderRadius: "8px",
            background: "#4f46e5",
            color: "#fff",
            fontSize: "13px",
            fontWeight: 500,
          }}
        >
          SMRY
        </div>
      </div>

      {/* Compact banner - hidden on mobile/tablet, shown on desktop */}
      <div
        className="relative hidden h-[52px] items-center gap-4 rounded-[16px] px-4 lg:flex"
        style={{
          background: "linear-gradient(93deg, rgb(255, 255, 255) -15.29%, rgb(255, 255, 255) 56.25%, rgb(239, 239, 255) 123.9%)",
        }}
      >
        {/* Gradient border */}
        <div
          className="pointer-events-none absolute inset-0 rounded-[16px] dark:hidden"
          style={{
            padding: "1px",
            background: "linear-gradient(90deg, rgb(238, 242, 255) 0%, rgb(255, 255, 255) 100%)",
            WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
            WebkitMaskComposite: "xor",
            maskComposite: "exclude",
          }}
        />

        {/* Dark mode background */}
        <div
          className="pointer-events-none absolute inset-0 rounded-[16px] hidden dark:block"
          style={{
            background: "linear-gradient(93deg, hsl(240 10% 10%) -15.29%, hsl(240 10% 10%) 56.25%, hsl(240 15% 15%) 123.9%)",
          }}
        />
        {/* Dark mode gradient border */}
        <div
          className="pointer-events-none absolute inset-0 rounded-[16px] hidden dark:block"
          style={{
            padding: "1px",
            background: "linear-gradient(90deg, rgba(99, 102, 241, 0.3) 0%, rgba(99, 102, 241, 0.1) 100%)",
            WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
            WebkitMaskComposite: "xor",
            maskComposite: "exclude",
          }}
        />

        {/* Text */}
        <div className="relative min-w-0 flex-1">
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{t("addToBookmarks")}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{t("dragToBookmarksBar")}</p>
        </div>

        {/* Draggable button */}
        <a
          ref={linkRef}
          draggable="true"
          onDragStart={handleDragStart}
          onClick={handleClick}
          title={t("dragToBookmarksBar")}
          className="relative inline-flex shrink-0 cursor-grab items-center gap-1.5 rounded-lg border border-indigo-200/80 bg-white pl-2.5 pr-3 py-1.5 text-sm font-medium text-indigo-600 shadow-sm transition-all hover:border-indigo-300 hover:bg-indigo-50 active:scale-[0.97] active:cursor-grabbing dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-400 dark:hover:bg-indigo-500/20"
        >
          <Bookmark className="size-3.5" strokeWidth={2} />
          <span>SMRY</span>
        </a>
      </div>
    </>
  );
};
