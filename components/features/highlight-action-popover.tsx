"use client";

import React, { useCallback } from "react";
import { Copy, StickyNote, Trash2, X } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { HighlightPopover, HIGHLIGHT_COLORS } from "@/components/features/highlight-popover";
import type { Highlight } from "@/lib/hooks/use-highlights";
import { toast } from "sonner";

interface HighlightActionPopoverProps {
  highlight: Highlight;
  anchorRect: DOMRect;
  onChangeColor: (id: string, color: Highlight["color"]) => void;
  onAddNote: (id: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export function HighlightActionPopover({
  highlight,
  anchorRect,
  onChangeColor,
  onAddNote,
  onDelete,
  onClose,
}: HighlightActionPopoverProps) {
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(highlight.text);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Failed to copy");
    }
    onClose();
  }, [highlight.text, onClose]);

  return (
    <HighlightPopover anchorRect={anchorRect} onClose={onClose} deferOutsideClick>
      <div className="bg-popover border border-border rounded-2xl shadow-2xl w-56 overflow-hidden">
        {/* Color picker row */}
        <div className="flex items-center justify-center gap-2.5 px-4 pt-3.5 pb-2.5">
          {HIGHLIGHT_COLORS.map((color) => {
            const isActive = highlight.color === color.name;
            return (
              <button
                key={color.name}
                onClick={() => onChangeColor(highlight.id, color.name as Highlight["color"])}
                className={cn(
                  "size-8 rounded-full flex items-center justify-center transition-transform hover:scale-110 active:scale-95",
                  color.solid,
                  isActive && "ring-2 ring-foreground/40"
                )}
                title={color.name}
              >
                {isActive && (
                  <X className="size-4 text-black/60" strokeWidth={3} />
                )}
              </button>
            );
          })}
        </div>

        {/* Divider */}
        <div className="mx-3 border-t border-border/50" />

        {/* Actions */}
        <div className="py-1.5">
          <button
            onClick={handleCopy}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-popover-foreground hover:bg-foreground/10 transition-colors"
          >
            <Copy className="size-5 text-muted-foreground" />
            <span>Copy</span>
          </button>

          <button
            onClick={() => {
              onAddNote(highlight.id);
              // Don't call onClose() here — it would set activeHighlightId to null,
              // overriding the setActiveHighlightId(id) from onAddNote (React batches both).
              // The popover will dismiss naturally since clickedHighlight is cleared by onAddNote.
            }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-popover-foreground hover:bg-foreground/10 transition-colors"
          >
            <StickyNote className="size-5 text-muted-foreground" />
            <span>Add a Note</span>
          </button>

          <button
            onClick={() => {
              onDelete(highlight.id);
              onClose();
            }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-foreground/10 transition-colors"
          >
            <Trash2 className="size-5" />
            <span>Delete</span>
          </button>
        </div>
      </div>
    </HighlightPopover>
  );
}
