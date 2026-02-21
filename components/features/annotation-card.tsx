"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Trash2, Copy, Check, Pencil } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { HIGHLIGHT_COLORS } from "@/components/features/highlight-popover";
import type { Highlight } from "@/lib/hooks/use-highlights";

/**
 * Map highlight color name to the same Tailwind classes used on actual <mark> elements.
 * Uses theme-aware bg variants so the card text matches the in-article highlight.
 */
const COLOR_BG: Record<string, string> = {
  yellow: "bg-yellow-200/70 dark:bg-yellow-500/30",
  green: "bg-green-200/70 dark:bg-green-500/30",
  pink: "bg-pink-200/70 dark:bg-pink-500/30",
  purple: "bg-purple-200/70 dark:bg-purple-500/30",
  blue: "bg-blue-200/70 dark:bg-blue-500/30",
};

function getRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Inline color picker
function ColorPickerPopover({
  highlightId,
  currentColor,
  onColorChange,
  onClose,
}: {
  highlightId: string;
  currentColor: string;
  onColorChange: (id: string, color: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full mt-1 z-10 bg-popover border border-border rounded-lg shadow-lg p-1.5 flex items-center gap-1"
    >
      {HIGHLIGHT_COLORS.map((color) => (
        <button
          key={color.name}
          onClick={() => {
            onColorChange(highlightId, color.name);
            onClose();
          }}
          className={cn(
            "size-6 rounded-full transition-all",
            color.solid,
            currentColor === color.name && `ring-2 ring-offset-1 ring-offset-popover ${color.border}`
          )}
          title={color.name}
        />
      ))}
    </div>
  );
}

interface AnnotationCardProps {
  highlight: Highlight;
  isActive: boolean;
  onScrollTo: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateNote: (id: string, updates: Partial<Highlight>) => void;
  onChangeColor: (id: string, color: string) => void;
}

export const AnnotationCard = React.memo(function AnnotationCard({
  highlight,
  isActive,
  onScrollTo,
  onDelete,
  onUpdateNote,
  onChangeColor,
}: AnnotationCardProps) {
  const [editingNote, setEditingNote] = useState(false);
  const [noteText, setNoteText] = useState(highlight.note || "");
  const [copied, setCopied] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(highlight.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [highlight.text]);

  const handleSaveNote = useCallback(() => {
    onUpdateNote(highlight.id, { note: noteText.trim() || undefined });
    setEditingNote(false);
  }, [highlight.id, noteText, onUpdateNote]);

  const colorObj = HIGHLIGHT_COLORS.find((c) => c.name === highlight.color) || HIGHLIGHT_COLORS[0];
  const bgClass = COLOR_BG[highlight.color] || COLOR_BG.yellow;

  return (
    <div
      className={cn(
        "group relative px-3 py-2.5 transition-colors cursor-pointer",
        isActive ? "bg-accent/50" : "hover:bg-muted/30"
      )}
      onClick={() => onScrollTo(highlight.id)}
    >
      {/* Highlighted text with matching color background */}
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p
            className={cn(
              "text-[13px] leading-relaxed rounded-sm px-1.5 py-0.5 -mx-1.5 text-foreground",
              bgClass,
              !expanded && "line-clamp-3"
            )}
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
          >
            {highlight.text}
          </p>

          {/* Note display */}
          {!editingNote && highlight.note && (
            <p
              className="mt-1.5 text-xs text-muted-foreground italic cursor-pointer hover:text-foreground transition-colors pl-1.5"
              onClick={(e) => {
                e.stopPropagation();
                setNoteText(highlight.note || "");
                setEditingNote(true);
              }}
            >
              {highlight.note}
            </p>
          )}

          {/* Inline note editor */}
          {editingNote && (
            <div className="mt-1.5" onClick={(e) => e.stopPropagation()}>
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                className="w-full text-xs p-2 border border-border rounded-md bg-background resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                rows={2}
                placeholder="Write a note..."
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    handleSaveNote();
                  }
                  if (e.key === "Escape") {
                    setEditingNote(false);
                    setNoteText(highlight.note || "");
                  }
                }}
              />
              <div className="flex gap-1 mt-1">
                <button
                  onClick={handleSaveNote}
                  className="text-xs px-2 py-0.5 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setEditingNote(false);
                    setNoteText(highlight.note || "");
                  }}
                  className="text-xs px-2 py-0.5 text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Footer row: timestamp + actions */}
          <div className="flex items-center justify-between mt-1.5 pl-1.5">
            <span className="text-[11px] text-muted-foreground/60">
              {getRelativeTime(highlight.createdAt)}
            </span>

            {/* Action buttons — always visible but subtle */}
            <div
              className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Add/edit note */}
              {!editingNote && (
                <button
                  onClick={() => {
                    setNoteText(highlight.note || "");
                    setEditingNote(true);
                  }}
                  className="p-1 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-muted/50 transition-colors"
                  title={highlight.note ? "Edit note" : "Add a note"}
                >
                  <Pencil className="size-3" />
                </button>
              )}

              {/* Change color */}
              <div className="relative">
                <button
                  onClick={() => setShowColorPicker(!showColorPicker)}
                  className={cn(
                    "size-4 rounded-full transition-all shrink-0",
                    colorObj.solid,
                    showColorPicker && "ring-1 ring-offset-1 ring-offset-background ring-foreground/30"
                  )}
                  title="Change color"
                />
                {showColorPicker && (
                  <ColorPickerPopover
                    highlightId={highlight.id}
                    currentColor={highlight.color}
                    onColorChange={onChangeColor}
                    onClose={() => setShowColorPicker(false)}
                  />
                )}
              </div>

              {/* Copy text */}
              <button
                onClick={handleCopy}
                className="p-1 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-muted/50 transition-colors"
                title="Copy text"
              >
                {copied ? (
                  <Check className="size-3 text-green-500" />
                ) : (
                  <Copy className="size-3" />
                )}
              </button>

              {/* Delete */}
              <button
                onClick={() => onDelete(highlight.id)}
                className="p-1 rounded-md text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-colors"
                title="Delete"
              >
                <Trash2 className="size-3" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}, (prev, next) => {
  return (
    prev.highlight.id === next.highlight.id &&
    prev.highlight.color === next.highlight.color &&
    prev.highlight.note === next.highlight.note &&
    prev.highlight.text === next.highlight.text &&
    prev.isActive === next.isActive &&
    prev.onScrollTo === next.onScrollTo &&
    prev.onDelete === next.onDelete &&
    prev.onUpdateNote === next.onUpdateNote &&
    prev.onChangeColor === next.onChangeColor
  );
});
