"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Copy, StickyNote, AiMagic, Check } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { HighlightPopover, HIGHLIGHT_COLORS } from "@/components/features/highlight-popover";
import type { Highlight } from "@/lib/hooks/use-highlights";

// Re-export for consumers that import from here
export { HIGHLIGHT_COLORS };

interface HighlightToolbarProps {
  onHighlight: (highlight: Omit<Highlight, "id" | "createdAt">) => void;
  containerRef: React.RefObject<HTMLElement | null>;
  onAskAI?: (text: string) => void;
}

export function HighlightToolbar({ onHighlight, containerRef, onAskAI }: HighlightToolbarProps) {
  const [selection, setSelection] = useState<{
    text: string;
    range: Range;
    rect: DOMRect;
  } | null>(null);
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState(false);
  const noteInputRef = useRef<HTMLTextAreaElement>(null);
  const lastSelectedTextRef = useRef("");
  const selectionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced selection change handler
  const handleSelectionChange = useCallback(() => {
    if (selectionTimerRef.current) clearTimeout(selectionTimerRef.current);

    selectionTimerRef.current = setTimeout(() => {
      selectionTimerRef.current = null;
      const sel = window.getSelection();

      if (!sel || sel.isCollapsed || !sel.rangeCount) {
        if (!showNoteInput) {
          setSelection(null);
          lastSelectedTextRef.current = "";
        }
        return;
      }

      const text = sel.toString().trim();
      if (text === lastSelectedTextRef.current) return;
      lastSelectedTextRef.current = text;

      const range = sel.getRangeAt(0);
      if (!containerRef.current?.contains(range.commonAncestorContainer)) {
        setSelection(null);
        return;
      }

      if (text.length < 3) {
        setSelection(null);
        return;
      }

      setSelection({ text, range, rect: range.getBoundingClientRect() });
      setShowNoteInput(false);
      setNote("");
    }, 50);
  }, [containerRef, showNoteInput]);

  useEffect(() => {
    document.addEventListener("selectionchange", handleSelectionChange);
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
      if (selectionTimerRef.current) clearTimeout(selectionTimerRef.current);
    };
  }, [handleSelectionChange]);

  useEffect(() => {
    if (showNoteInput && noteInputRef.current) noteInputRef.current.focus();
  }, [showNoteInput]);

  // Highlight with a specific color (instant on color click)
  const highlightWithColor = useCallback(
    (color: Highlight["color"]) => {
      if (!selection) return;

      const range = selection.range;
      const contextBefore = range.startContainer.textContent?.slice(
        Math.max(0, range.startOffset - 30),
        range.startOffset
      );
      const contextAfter = range.endContainer.textContent?.slice(
        range.endOffset,
        range.endOffset + 30
      );

      onHighlight({
        text: selection.text,
        note: note.trim() || undefined,
        color,
        contextBefore,
        contextAfter,
      });

      window.getSelection()?.removeAllRanges();
      setSelection(null);
      setShowNoteInput(false);
      setNote("");
    },
    [selection, note, onHighlight]
  );

  const handleCopy = useCallback(async () => {
    if (!selection) return;
    await navigator.clipboard.writeText(selection.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [selection]);

  const handleAskAI = useCallback(() => {
    if (!selection) return;
    onAskAI?.(selection.text);
    window.getSelection()?.removeAllRanges();
    setSelection(null);
  }, [selection, onAskAI]);

  const handleSaveNote = useCallback(() => {
    highlightWithColor("yellow");
  }, [highlightWithColor]);

  const handleClose = useCallback(() => {
    setSelection(null);
    setShowNoteInput(false);
  }, []);

  if (!selection) return null;

  return (
    <HighlightPopover anchorRect={selection.rect} onClose={handleClose}>
      <div className="bg-popover border border-border rounded-2xl shadow-2xl w-56 overflow-hidden">
        {/* Color picker — click to highlight instantly */}
        <div className="flex items-center justify-center gap-2.5 px-4 pt-3.5 pb-2.5">
          {HIGHLIGHT_COLORS.map((color) => (
            <button
              key={color.name}
              onClick={() => highlightWithColor(color.name as Highlight["color"])}
              className={cn(
                "size-8 rounded-full transition-transform hover:scale-110 active:scale-95",
                color.solid
              )}
              title={`Highlight ${color.name}`}
            />
          ))}
        </div>

        {/* Divider */}
        <div className="mx-3 border-t border-border/50" />

        {/* Actions */}
        <div className="py-1.5">
          <button
            onClick={handleCopy}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-popover-foreground hover:bg-foreground/10 transition-colors"
          >
            {copied ? (
              <Check className="size-5 text-green-400" />
            ) : (
              <Copy className="size-5 text-muted-foreground" />
            )}
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>

          <button
            onClick={() => setShowNoteInput(!showNoteInput)}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-2.5 text-sm text-popover-foreground hover:bg-foreground/10 transition-colors",
              showNoteInput && "bg-foreground/10"
            )}
          >
            <StickyNote className="size-5 text-muted-foreground" />
            <span>Add a Note</span>
          </button>

          {onAskAI && (
            <button
              onClick={handleAskAI}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-popover-foreground hover:bg-foreground/10 transition-colors"
            >
              <AiMagic className="size-5 text-muted-foreground" />
              <span>Ask AI</span>
            </button>
          )}
        </div>
      </div>

      {/* Note input */}
      {showNoteInput && (
        <div className="mt-2 bg-popover border border-border rounded-xl shadow-2xl p-3 w-56">
          <textarea
            ref={noteInputRef}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Write a note..."
            className="w-full text-sm bg-foreground/5 border border-border rounded-lg px-2.5 py-2 text-popover-foreground placeholder:text-muted-foreground outline-none resize-none focus:border-foreground/20"
            rows={2}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                handleSaveNote();
              }
            }}
          />
          <div className="flex justify-end mt-2">
            <button
              onClick={handleSaveNote}
              className="text-xs px-3 py-1.5 bg-foreground/15 text-popover-foreground rounded-lg hover:bg-foreground/25 transition-colors font-medium"
            >
              Save & Highlight
            </button>
          </div>
        </div>
      )}
    </HighlightPopover>
  );
}

// Get CSS class for highlight color
export function getHighlightClass(color: Highlight["color"]): string {
  const colors: Record<string, string> = {
    yellow: "bg-yellow-200/70 dark:bg-yellow-500/30",
    green: "bg-green-200/70 dark:bg-green-500/30",
    blue: "bg-blue-200/70 dark:bg-blue-500/30",
    pink: "bg-pink-200/70 dark:bg-pink-500/30",
    purple: "bg-purple-200/70 dark:bg-purple-500/30",
  };
  return colors[color] || colors.yellow;
}
