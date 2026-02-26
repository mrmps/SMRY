"use client";

import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { Drawer as DrawerPrimitive } from "vaul-base";
import {
  X,
  Highlighter,
  Trash2,
  Copy,
  Check,
  Pencil,
  ChevronDown,
} from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useHighlightsContext } from "@/lib/contexts/highlights-context";
import { HIGHLIGHT_COLORS } from "@/components/features/highlight-popover";
import { ExportHighlights } from "@/components/features/export-highlights";
import type { Highlight } from "@/lib/hooks/use-highlights";

// ─── Helpers ─────────────────────────────────────────────────────────

const COLOR_BG: Record<string, string> = {
  yellow: "bg-yellow-200/60 dark:bg-yellow-500/20",
  green: "bg-green-200/60 dark:bg-green-500/20",
  pink: "bg-pink-200/60 dark:bg-pink-500/20",
  orange: "bg-orange-200/60 dark:bg-orange-500/20",
  blue: "bg-blue-200/60 dark:bg-blue-500/20",
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

// ─── Mobile Annotation Card ─────────────────────────────────────────

interface MobileCardProps {
  highlight: Highlight;
  isActive: boolean;
  noteEditId?: string | null;
  onScrollTo: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateNote: (id: string, updates: Partial<Highlight>) => void;
  onChangeColor: (id: string, color: string) => void;
}

function MobileAnnotationCard({
  highlight,
  isActive,
  noteEditId,
  onScrollTo,
  onDelete,
  onUpdateNote,
  onChangeColor,
}: MobileCardProps) {
  const [expanded, setExpanded] = useState(false);
  // Lazy init: if the drawer opens with this card already targeted, start in edit mode.
  // vaul-base unmounts content on close (keepMounted=false), so there's no "previous"
  // value to diff — we must derive initial state from the prop directly.
  const [editingNote, setEditingNote] = useState(() => noteEditId === highlight.id);
  const [noteText, setNoteText] = useState(highlight.note || "");
  const [copied, setCopied] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const noteEditorRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Render-time derived state: detect noteEditId changes after mount.
  // React-recommended pattern (no useEffect + setState cascade).
  const [prevNoteEditId, setPrevNoteEditId] = useState(noteEditId);
  if (prevNoteEditId !== noteEditId) {
    setPrevNoteEditId(noteEditId);
    if (noteEditId === highlight.id) {
      setNoteText(highlight.note || "");
      setEditingNote(true);
    }
  }

  // Focus textarea and scroll into view when note editor opens.
  // Explicit .focus() is needed because autoFocus is unreliable on iOS.
  // Two-step delay: first focus (triggers keyboard), then scroll after
  // the visual viewport has resized to account for the keyboard.
  useEffect(() => {
    if (!editingNote) return;
    // Step 1: focus triggers keyboard open
    const focusTimer = setTimeout(() => {
      textareaRef.current?.focus();
    }, 100);
    // Step 2: scroll after keyboard + drawer have settled (~350ms on iOS)
    const scrollTimer = setTimeout(() => {
      noteEditorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 400);
    return () => {
      clearTimeout(focusTimer);
      clearTimeout(scrollTimer);
    };
  }, [editingNote]);

  const bgClass = COLOR_BG[highlight.color] || COLOR_BG.yellow;


  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(highlight.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Failed to copy");
    }
  }, [highlight.text]);

  const handleSaveNote = useCallback(() => {
    onUpdateNote(highlight.id, { note: noteText.trim() || undefined });
    setEditingNote(false);
  }, [highlight.id, noteText, onUpdateNote]);

  return (
    <div
      className={cn(
        "mx-4 mb-3 rounded-xl border border-border/40 overflow-hidden transition-colors",
        isActive && "ring-2 ring-primary/30"
      )}
    >
      {/* Tappable quote area — min 48px touch target */}
      <div
        role="button"
        tabIndex={0}
        className={cn(
          "w-full text-left px-3.5 py-3 transition-colors active:bg-foreground/5",
          bgClass,
        )}
        onClick={() => {
          onScrollTo(highlight.id);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onScrollTo(highlight.id);
          }
        }}
      >
        <p
          className={cn(
            "text-[14px] leading-relaxed text-foreground",
            !expanded && "line-clamp-3"
          )}
        >
          {highlight.text}
        </p>
        {highlight.text.length > 120 && (
          <button
            className="text-[12px] text-muted-foreground/60 mt-1"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
          >
            {expanded ? "Show less" : "Show more"}
          </button>
        )}
      </div>

      {/* Note display */}
      {!editingNote && highlight.note && (
        <div className="px-3.5 py-2 bg-muted/20 border-t border-border/20">
          <p className="text-[13px] text-muted-foreground italic leading-relaxed">
            {highlight.note}
          </p>
        </div>
      )}

      {/* Inline note editor */}
      {editingNote && (
        <div ref={noteEditorRef} className="px-3.5 py-2.5 bg-muted/20 border-t border-border/20">
          <textarea
            ref={textareaRef}
            autoFocus
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            style={{ fontSize: '16px' }}
            className="w-full p-2.5 border border-border rounded-lg bg-background resize-none focus:outline-none focus:border-foreground/30"
            rows={3}
            placeholder="Write a note..."
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                handleSaveNote();
              }
            }}
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={handleSaveNote}
              className="text-[13px] px-3 py-1.5 bg-primary text-primary-foreground rounded-lg font-medium active:scale-95 transition-transform"
            >
              Save
            </button>
            <button
              onClick={() => {
                setEditingNote(false);
                setNoteText(highlight.note || "");
              }}
              className="text-[13px] px-3 py-1.5 text-muted-foreground active:scale-95 transition-transform"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Footer: timestamp + toggle actions */}
      <div className="flex items-center justify-between px-3.5 py-2 bg-muted/10">
        <span className="text-[11px] text-muted-foreground/50">
          {getRelativeTime(highlight.createdAt)}
        </span>
        <button
          onClick={() => setShowActions(!showActions)}
          className="flex items-center gap-1 px-2 py-1 -mr-1 rounded-md text-[11px] text-muted-foreground/60 active:bg-foreground/5 transition-colors"
        >
          <ChevronDown className={cn("size-3 transition-transform", showActions && "rotate-180")} />
        </button>
      </div>

      {/* Expandable action row — 48px touch targets */}
      {showActions && (
        <div className="flex items-center border-t border-border/20 divide-x divide-border/20">
          {/* Note */}
          <button
            onClick={() => {
              setNoteText(highlight.note || "");
              setEditingNote(true);
              setShowActions(false);
              // scrollIntoView handled by useEffect above
            }}
            className="flex-1 flex items-center justify-center gap-1.5 py-3 text-[12px] text-muted-foreground active:bg-foreground/5 transition-colors"
          >
            <Pencil className="size-3.5" />
            <span>{highlight.note ? "Edit" : "Note"}</span>
          </button>

          {/* Color picker */}
          <div className="flex-1 flex items-center justify-center gap-1.5 py-3">
            {HIGHLIGHT_COLORS.map((color) => (
              <button
                key={color.name}
                onClick={() => onChangeColor(highlight.id, color.name)}
                className={cn(
                  "size-5 rounded-full transition-transform active:scale-90",
                  color.solid,
                  highlight.color === color.name && "ring-2 ring-foreground/30 ring-offset-1 ring-offset-background"
                )}
              />
            ))}
          </div>

          {/* Copy */}
          <button
            onClick={handleCopy}
            className="flex-1 flex items-center justify-center gap-1.5 py-3 text-[12px] text-muted-foreground active:bg-foreground/5 transition-colors"
          >
            {copied ? (
              <>
                <Check className="size-3.5 text-green-500" />
                <span className="text-green-500">Copied</span>
              </>
            ) : (
              <>
                <Copy className="size-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>

          {/* Delete */}
          <button
            onClick={() => onDelete(highlight.id)}
            className="px-4 flex items-center justify-center py-3 text-destructive active:bg-destructive/10 transition-colors"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Mobile Annotations Drawer ──────────────────────────────────────

interface MobileAnnotationsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  articleUrl?: string;
  articleTitle?: string;
  noteEditId?: string | null;
}

export function MobileAnnotationsDrawer({
  open,
  onOpenChange,
  articleUrl,
  articleTitle,
  noteEditId,
}: MobileAnnotationsDrawerProps) {
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

  // Visual Viewport API: lift drawer above virtual keyboard on iOS/Android.
  // Tracks both keyboard offset (to position drawer above keyboard) and available
  // viewport height (to shrink drawer so it fits the remaining space).
  // Without height adjustment, the 70dvh drawer extends above the visible area
  // when keyboard takes ~50% of screen, hiding the textarea off-screen.
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv || !open) return;

    const update = () => {
      const offset = Math.max(0, window.innerHeight - vv.offsetTop - vv.height);
      setKeyboardOffset(offset);
      setViewportHeight(vv.height);
    };

    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    update();
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      setKeyboardOffset(0);
      setViewportHeight(0);
    };
  }, [open]);

  const filteredHighlights = useMemo(() => {
    const filtered = filterColor
      ? highlights.filter((h) => h.color === filterColor)
      : highlights;
    return [...filtered].sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime() || 0;
      const timeB = new Date(b.createdAt).getTime() || 0;
      return timeB - timeA;
    });
  }, [highlights, filterColor]);

  const handleScrollTo = useCallback(
    (id: string) => {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      setActiveHighlightId(id);
      onOpenChange(false);
      scrollTimeoutRef.current = setTimeout(() => setActiveHighlightId(null), 2000);
    },
    [setActiveHighlightId, onOpenChange]
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

  return (
    <DrawerPrimitive.Root
      open={open}
      onOpenChange={onOpenChange}
      direction="bottom"
      shouldScaleBackground={false}
      modal={true}
    >
      <DrawerPrimitive.Portal>
        <DrawerPrimitive.Overlay
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
        />

        <DrawerPrimitive.Content
          className="fixed inset-x-0 z-50 flex flex-col bg-background border-t border-border rounded-t-2xl"
          style={{
            // When keyboard is visible, shrink to fit available space above keyboard.
            // Without this, 70dvh extends above the viewport and hides the textarea.
            height: keyboardOffset > 0 && viewportHeight > 0
              ? `${viewportHeight}px`
              : "70dvh",
            bottom: `${keyboardOffset}px`,
            transition: keyboardOffset > 0
              ? "bottom 0.15s ease-out, height 0.15s ease-out"
              : undefined,
          }}
        >
          {/* Drag handle — thin bar visual indicator */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="h-1 w-10 rounded-full bg-muted-foreground/25" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2" data-vaul-no-drag>
            <div className="flex items-center gap-2.5">
              <Highlighter className="size-4 text-muted-foreground/60" />
              <span className="text-[15px] font-semibold">
                {highlights.length === 0
                  ? "Annotations"
                  : `${highlights.length} Highlight${highlights.length !== 1 ? "s" : ""}`}
              </span>
            </div>
            {/* Close button — 44px min touch target */}
            <button
              onClick={() => onOpenChange(false)}
              className="size-10 flex items-center justify-center rounded-full text-muted-foreground active:bg-muted transition-colors -mr-1"
              aria-label="Close annotations"
            >
              <X className="size-4.5" />
            </button>
          </div>

          {/* Color filter + actions row */}
          {highlights.length > 0 && (
            <div className="flex items-center justify-between px-4 pb-2" data-vaul-no-drag>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFilterColor(null)}
                  className={cn(
                    "px-2.5 py-1 rounded-full text-[12px] font-medium transition-colors",
                    filterColor === null
                      ? "bg-foreground/10 text-foreground"
                      : "text-muted-foreground/50"
                  )}
                >
                  All
                </button>
                {HIGHLIGHT_COLORS.map((color) => (
                  <button
                    key={color.name}
                    onClick={() => setFilterColor(filterColor === color.name ? null : color.name)}
                    className={cn(
                      "size-6 rounded-full transition-all flex items-center justify-center",
                      color.solid,
                      filterColor === color.name
                        ? "ring-2 ring-offset-1 ring-offset-background ring-foreground/30 scale-110"
                        : "opacity-40"
                    )}
                  />
                ))}
              </div>
              <div className="flex items-center gap-1">
                {articleUrl && (
                  <ExportHighlights
                    highlights={highlights}
                    articleUrl={articleUrl}
                    articleTitle={articleTitle}
                  />
                )}
                <button
                  onClick={clearHighlights}
                  className="size-8 flex items-center justify-center rounded-md text-muted-foreground/40 active:text-destructive active:bg-destructive/10 transition-colors"
                  title="Clear all"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Divider */}
          <div className="h-px bg-border/30 mx-4" />

          {/* Content */}
          {highlights.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 px-8 text-center" data-vaul-no-drag>
              <div className="size-14 rounded-full bg-muted/30 flex items-center justify-center mb-4">
                <Highlighter className="size-7 text-muted-foreground/40" />
              </div>
              <p className="text-[15px] font-medium text-foreground/70 mb-1">No highlights yet</p>
              <p className="text-[13px] text-muted-foreground/50 leading-relaxed max-w-[240px]">
                Select text in the article to start highlighting
              </p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto pt-3" data-vaul-no-drag style={{ touchAction: "pan-y", paddingBottom: `max(env(safe-area-inset-bottom, 12px), 12px)` }}>
              {filteredHighlights.map((hl) => (
                <MobileAnnotationCard
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
          )}
        </DrawerPrimitive.Content>
      </DrawerPrimitive.Portal>
    </DrawerPrimitive.Root>
  );
}
