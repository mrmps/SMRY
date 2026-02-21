"use client";

import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

interface HighlightPopoverProps {
  anchorRect: DOMRect;
  children: React.ReactNode;
  onClose: () => void;
  /** Defer outside-click listener by one frame to prevent the opening click from closing */
  deferOutsideClick?: boolean;
}

/**
 * Shared popover shell for highlight toolbars.
 * Handles: portal rendering, positioning above anchor, click-outside dismiss,
 * Escape key dismiss, and entry animation.
 */
export function HighlightPopover({
  anchorRect,
  children,
  onClose,
  deferOutsideClick = false,
}: HighlightPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (deferOutsideClick) {
      const raf = requestAnimationFrame(() => {
        document.addEventListener("mousedown", handleClick);
      });
      return () => {
        cancelAnimationFrame(raf);
        document.removeEventListener("mousedown", handleClick);
      };
    }

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [deferOutsideClick, onClose]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const style: React.CSSProperties = {
    position: "fixed",
    left: `${anchorRect.left + anchorRect.width / 2}px`,
    top: `${anchorRect.top - 8}px`,
    transform: "translate(-50%, -100%)",
    zIndex: 9999,
  };

  return createPortal(
    <div
      ref={popoverRef}
      style={style}
      className="animate-in fade-in zoom-in-95 duration-150"
    >
      {children}
    </div>,
    document.body
  );
}

/**
 * Shared color row used in both toolbar and action popover.
 */
export const HIGHLIGHT_COLORS = [
  { name: "yellow", bg: "bg-yellow-200/70 dark:bg-yellow-500/30", border: "border-yellow-400", solid: "bg-yellow-400" },
  { name: "green", bg: "bg-green-200/70 dark:bg-green-500/30", border: "border-green-400", solid: "bg-green-400" },
  { name: "pink", bg: "bg-pink-200/70 dark:bg-pink-500/30", border: "border-pink-400", solid: "bg-pink-400" },
  { name: "orange", bg: "bg-orange-200/70 dark:bg-orange-500/30", border: "border-orange-400", solid: "bg-orange-400" },
  { name: "blue", bg: "bg-blue-200/70 dark:bg-blue-500/30", border: "border-blue-400", solid: "bg-blue-400" },
] as const;
