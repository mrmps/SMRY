"use client";

import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

function useIsMac() {
  return useSyncExternalStore(
    emptySubscribe,
    () => navigator.platform.toLowerCase().includes("mac"),
    () => true // Assume Mac on server for SSR
  );
}

export function BookmarkBanner() {
  const isMac = useIsMac();

  return (
    <div
      className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-foreground"
      style={{
        backdropFilter: "blur(40px)",
        WebkitBackdropFilter: "blur(40px)",
        backgroundImage:
          "linear-gradient(135deg, rgba(255, 255, 255, 0.3) 0px, rgba(0, 0, 0, 0) 100%), linear-gradient(100deg, rgba(255, 255, 255, 0.1) 25%, rgba(0, 0, 0, 0) 25%)",
        boxShadow:
          "rgba(255, 255, 255, 0.1) 0px 0px 0px 1px inset, rgba(0, 0, 0, 0.05) 0px 0px 0px 2px",
      }}
    >
      <span
        style={{ textShadow: "rgba(0, 0, 0, 0.05) 0px 1px 0px" }}
      >
        Bookmark us!
      </span>
      <span className="inline-flex items-center gap-1">
        <kbd className="inline-flex min-h-[26px] min-w-[26px] items-center justify-center rounded-md border border-border bg-background px-2 font-mono text-xs text-foreground shadow-sm [border-bottom-width:2px]">
          {isMac ? "⌘" : "Ctrl"}
        </kbd>
        <span className="text-[11px] text-muted-foreground">+</span>
        <kbd className="inline-flex min-h-[26px] min-w-[26px] items-center justify-center rounded-md border border-border bg-background px-2 font-mono text-xs text-foreground shadow-sm [border-bottom-width:2px]">
          D
        </kbd>
      </span>
    </div>
  );
}
