"use client";

import React, { useState } from "react";
import { Trash2, StickyNote, ChevronDown, ChevronUp } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ExportHighlights } from "./export-highlights";
import type { Highlight } from "@/lib/hooks/use-highlights";
import { getHighlightClass } from "./highlight-toolbar";

interface HighlightsPanelProps {
  highlights: Highlight[];
  articleUrl: string;
  articleTitle?: string;
  onDelete: (id: string) => void;
  onUpdateNote: (id: string, updates: Partial<Highlight>) => void;
  className?: string;
}

export function HighlightsPanel({
  highlights,
  articleUrl,
  articleTitle,
  onDelete,
  onUpdateNote,
  className,
}: HighlightsPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");

  if (highlights.length === 0) {
    return null;
  }

  const handleStartEditNote = (hl: Highlight) => {
    setEditingNote(hl.id);
    setNoteText(hl.note || "");
  };

  const handleSaveNote = (id: string) => {
    onUpdateNote(id, { note: noteText });
    setEditingNote(null);
    setNoteText("");
  };

  return (
    <div className={cn("border border-border rounded-lg bg-card", className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-3">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 hover:text-foreground transition-colors"
        >
          <span className="font-medium text-sm">
            {highlights.length} Highlight{highlights.length !== 1 ? "s" : ""}
          </span>
          {expanded ? (
            <ChevronUp className="size-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-4 text-muted-foreground" />
          )}
        </button>
        <ExportHighlights
          highlights={highlights}
          articleUrl={articleUrl}
          articleTitle={articleTitle}
        />
      </div>

      {/* Highlights list */}
      {expanded && (
        <div className="border-t border-border divide-y divide-border">
          {highlights.map((hl) => (
            <div key={hl.id} className="p-3 group">
              <div className="flex items-start gap-2">
                {/* Color indicator */}
                <div
                  className={cn(
                    "w-1 self-stretch rounded-full shrink-0",
                    getHighlightClass(hl.color)
                  )}
                />

                <div className="flex-1 min-w-0">
                  {/* Highlight text */}
                  <p className="text-sm text-foreground line-clamp-3">
                    &ldquo;{hl.text}&rdquo;
                  </p>

                  {/* Note */}
                  {editingNote === hl.id ? (
                    <div className="mt-2">
                      <textarea
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        className="w-full text-xs p-2 border border-border rounded bg-background resize-none"
                        rows={2}
                        placeholder="Add a note..."
                        autoFocus
                      />
                      <div className="flex gap-1 mt-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-xs"
                          onClick={() => handleSaveNote(hl.id)}
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-xs"
                          onClick={() => setEditingNote(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : hl.note ? (
                    <p
                      className="mt-1 text-xs text-muted-foreground italic cursor-pointer hover:text-foreground"
                      onClick={() => handleStartEditNote(hl)}
                    >
                      {hl.note}
                    </p>
                  ) : null}

                  {/* Timestamp */}
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {new Date(hl.createdAt).toLocaleDateString()}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {!editingNote && (
                    <button
                      onClick={() => handleStartEditNote(hl)}
                      className="p-1 rounded hover:bg-muted transition-colors"
                      title="Edit note"
                    >
                      <StickyNote className="size-3.5 text-muted-foreground" />
                    </button>
                  )}
                  <button
                    onClick={() => onDelete(hl.id)}
                    className="p-1 rounded hover:bg-destructive/10 transition-colors"
                    title="Delete highlight"
                  >
                    <Trash2 className="size-3.5 text-destructive" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
