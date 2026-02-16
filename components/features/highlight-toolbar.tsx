"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { Highlighter, X, StickyNote, Copy, Check } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import type { Highlight } from "@/lib/hooks/use-highlights";

const HIGHLIGHT_COLORS = [
  { name: "yellow", bg: "bg-yellow-200/70 dark:bg-yellow-500/30", border: "border-yellow-400" },
  { name: "green", bg: "bg-green-200/70 dark:bg-green-500/30", border: "border-green-400" },
  { name: "blue", bg: "bg-blue-200/70 dark:bg-blue-500/30", border: "border-blue-400" },
  { name: "pink", bg: "bg-pink-200/70 dark:bg-pink-500/30", border: "border-pink-400" },
] as const;

interface HighlightToolbarProps {
  onHighlight: (highlight: Omit<Highlight, "id" | "createdAt">) => void;
  containerRef: React.RefObject<HTMLElement | null>;
}

export function HighlightToolbar({ onHighlight, containerRef }: HighlightToolbarProps) {
  const [selection, setSelection] = useState<{
    text: string;
    range: Range;
    rect: DOMRect;
  } | null>(null);
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [note, setNote] = useState("");
  const [selectedColor, setSelectedColor] = useState<Highlight["color"]>("yellow");
  const [copied, setCopied] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const noteInputRef = useRef<HTMLTextAreaElement>(null);

  // Handle text selection
  const handleSelectionChange = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) {
      // Don't clear if we're in the note input
      if (!showNoteInput) {
        setSelection(null);
      }
      return;
    }

    const range = sel.getRangeAt(0);
    const text = sel.toString().trim();

    // Only show toolbar if selection is within the container
    if (!containerRef.current?.contains(range.commonAncestorContainer)) {
      setSelection(null);
      return;
    }

    if (text.length < 3) {
      setSelection(null);
      return;
    }

    const rect = range.getBoundingClientRect();
    setSelection({ text, range, rect });
    setShowNoteInput(false);
    setNote("");
  }, [containerRef, showNoteInput]);

  useEffect(() => {
    document.addEventListener("selectionchange", handleSelectionChange);
    return () => document.removeEventListener("selectionchange", handleSelectionChange);
  }, [handleSelectionChange]);

  // Focus note input when shown
  useEffect(() => {
    if (showNoteInput && noteInputRef.current) {
      noteInputRef.current.focus();
    }
  }, [showNoteInput]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setSelection(null);
        setShowNoteInput(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleHighlight = useCallback(() => {
    if (!selection) return;

    // Get context for better re-finding
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
      color: selectedColor,
      contextBefore,
      contextAfter,
    });

    // Clear selection
    window.getSelection()?.removeAllRanges();
    setSelection(null);
    setShowNoteInput(false);
    setNote("");
  }, [selection, note, selectedColor, onHighlight]);

  const handleCopy = useCallback(async () => {
    if (!selection) return;
    await navigator.clipboard.writeText(selection.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [selection]);

  if (!selection) return null;

  // Position toolbar above selection
  const toolbarStyle: React.CSSProperties = {
    position: "fixed",
    left: `${selection.rect.left + selection.rect.width / 2}px`,
    top: `${selection.rect.top - 8}px`,
    transform: "translate(-50%, -100%)",
    zIndex: 9999,
  };

  return createPortal(
    <div
      ref={toolbarRef}
      style={toolbarStyle}
      className="animate-in fade-in zoom-in-95 duration-150"
    >
      <div className="bg-popover border border-border rounded-lg shadow-lg p-1.5 flex items-center gap-1">
        {/* Color options */}
        {HIGHLIGHT_COLORS.map((color) => (
          <button
            key={color.name}
            onClick={() => setSelectedColor(color.name as Highlight["color"])}
            className={cn(
              "size-6 rounded-full transition-all",
              color.bg,
              selectedColor === color.name && `ring-2 ring-offset-1 ${color.border}`
            )}
            title={`Highlight ${color.name}`}
          />
        ))}

        <div className="w-px h-5 bg-border mx-1" />

        {/* Highlight button */}
        <button
          onClick={handleHighlight}
          className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-muted transition-colors text-sm font-medium"
          title="Save highlight"
        >
          <Highlighter className="size-4" />
          <span className="hidden sm:inline">Highlight</span>
        </button>

        {/* Add note button */}
        <button
          onClick={() => setShowNoteInput(!showNoteInput)}
          className={cn(
            "p-1.5 rounded-md hover:bg-muted transition-colors",
            showNoteInput && "bg-muted"
          )}
          title="Add note"
        >
          <StickyNote className="size-4" />
        </button>

        {/* Copy button */}
        <button
          onClick={handleCopy}
          className="p-1.5 rounded-md hover:bg-muted transition-colors"
          title="Copy text"
        >
          {copied ? (
            <Check className="size-4 text-green-500" />
          ) : (
            <Copy className="size-4" />
          )}
        </button>

        {/* Close button */}
        <button
          onClick={() => setSelection(null)}
          className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground"
          title="Close"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Note input */}
      {showNoteInput && (
        <div className="mt-2 bg-popover border border-border rounded-lg shadow-lg p-2 w-64">
          <textarea
            ref={noteInputRef}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a note..."
            className="w-full text-sm bg-transparent border-none outline-none resize-none"
            rows={2}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                handleHighlight();
              }
            }}
          />
          <div className="flex justify-end mt-1">
            <button
              onClick={handleHighlight}
              className="text-xs px-2 py-1 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}

// Get CSS class for highlight color
export function getHighlightClass(color: Highlight["color"]): string {
  const colors = {
    yellow: "bg-yellow-200/70 dark:bg-yellow-500/30",
    green: "bg-green-200/70 dark:bg-green-500/30",
    blue: "bg-blue-200/70 dark:bg-blue-500/30",
    pink: "bg-pink-200/70 dark:bg-pink-500/30",
  };
  return colors[color] || colors.yellow;
}
