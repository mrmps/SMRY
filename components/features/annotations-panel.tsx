"use client";

import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { Trash2, Highlighter } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { useHighlightsContext } from "@/lib/contexts/highlights-context";
import { HIGHLIGHT_COLORS } from "@/components/features/highlight-popover";
import { AnnotationCard } from "@/components/features/annotation-card";
import { ExportHighlights } from "./export-highlights";
import type { Highlight } from "@/lib/hooks/use-highlights";

export function AnnotationsPanel({
  articleUrl,
  articleTitle,
  noteEditId,
}: {
  articleUrl?: string;
  articleTitle?: string;
  noteEditId?: string | null;
}) {
  const {
    highlights,
    updateHighlight,
    deleteHighlight,
    clearHighlights,
    activeHighlightId,
    setActiveHighlightId,
  } = useHighlightsContext();

  const [filterColor, setFilterColor] = useState<string | null>(null);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filteredHighlights = useMemo(() => {
    const filtered = filterColor
      ? highlights.filter((h) => h.color === filterColor)
      : highlights;
    return [...filtered].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [highlights, filterColor]);

  const handleScrollTo = useCallback(
    (id: string) => {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      setActiveHighlightId(id);
      scrollTimeoutRef.current = setTimeout(() => setActiveHighlightId(null), 2000);
    },
    [setActiveHighlightId]
  );

  useEffect(() => () => {
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
  }, []);

  const handleChangeColor = useCallback(
    (id: string, color: string) => {
      updateHighlight(id, { color: color as Highlight["color"] });
    },
    [updateHighlight]
  );

  // Empty state
  if (highlights.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 text-center">
        <div className="size-10 rounded-full bg-muted/40 flex items-center justify-center mb-3">
          <Highlighter className="size-5 text-muted-foreground/60" />
        </div>
        <p className="text-sm font-medium text-foreground/80 mb-1">No highlights yet</p>
        <p className="text-xs text-muted-foreground/60 max-w-[200px] leading-relaxed">
          Select text in the article to create highlights
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Compact header: count + color filters inline + actions */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-border/30">
        <span className="text-[11px] text-muted-foreground/70 tabular-nums shrink-0">
          {filteredHighlights.length}
        </span>

        {/* Color filter pills */}
        <div className="flex items-center gap-1 flex-1">
          <button
            onClick={() => setFilterColor(null)}
            className={cn(
              "px-1.5 py-0.5 rounded-full text-[10px] font-medium transition-colors",
              filterColor === null
                ? "bg-foreground/10 text-foreground"
                : "text-muted-foreground/50 hover:text-muted-foreground"
            )}
          >
            All
          </button>
          {HIGHLIGHT_COLORS.map((color) => (
            <button
              key={color.name}
              onClick={() => setFilterColor(filterColor === color.name ? null : color.name)}
              className={cn(
                "size-3.5 rounded-full transition-all shrink-0",
                color.solid,
                filterColor === color.name
                  ? "ring-1.5 ring-offset-1 ring-offset-background ring-foreground/30 scale-110"
                  : "opacity-50 hover:opacity-80"
              )}
              title={`Filter ${color.name}`}
            />
          ))}
        </div>

        {/* Export + clear */}
        <div className="flex items-center gap-0.5 shrink-0">
          {articleUrl && (
            <ExportHighlights
              highlights={highlights}
              articleUrl={articleUrl}
              articleTitle={articleTitle}
            />
          )}
          <button
            onClick={clearHighlights}
            className="p-1 rounded-md text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors"
            title="Clear all"
          >
            <Trash2 className="size-3" />
          </button>
        </div>
      </div>

      {/* Highlights list */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {filteredHighlights.map((hl) => (
          <AnnotationCard
            key={hl.id}
            highlight={hl}
            isActive={activeHighlightId === hl.id}
            noteEditId={noteEditId === hl.id ? noteEditId : null}
            onScrollTo={handleScrollTo}
            onDelete={deleteHighlight}
            onUpdateNote={updateHighlight}
            onChangeColor={handleChangeColor}
          />
        ))}
      </div>
    </div>
  );
}
