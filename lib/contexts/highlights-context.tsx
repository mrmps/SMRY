"use client";

import React, { createContext, useContext, useState, useMemo, type ReactNode } from "react";
import { useHighlights } from "@/lib/hooks/use-highlights";
import type { Highlight } from "@/lib/hooks/use-highlights";

interface HighlightsContextValue {
  highlights: Highlight[];
  isLoading: boolean;
  addHighlight: (highlight: Omit<Highlight, "id" | "createdAt">) => Highlight;
  updateHighlight: (id: string, updates: Partial<Highlight>) => void;
  deleteHighlight: (id: string) => void;
  clearHighlights: () => void;
  articleHash: string;
  activeHighlightId: string | null;
  setActiveHighlightId: (id: string | null) => void;
}

const HighlightsContext = createContext<HighlightsContextValue | null>(null);

interface HighlightsProviderProps {
  children: ReactNode;
  articleUrl: string;
  articleTitle?: string;
}

export function HighlightsProvider({ children, articleUrl, articleTitle }: HighlightsProviderProps) {
  const {
    highlights,
    isLoading,
    addHighlight,
    updateHighlight,
    deleteHighlight,
    clearHighlights,
    articleHash,
  } = useHighlights(articleUrl, articleTitle);
  const [activeHighlightId, setActiveHighlightId] = useState<string | null>(null);

  // Memoize context value — with stable callbacks from Step 1, this only
  // re-creates when highlights data, loading state, or active ID actually change
  const value = useMemo<HighlightsContextValue>(
    () => ({
      highlights,
      isLoading,
      addHighlight,
      updateHighlight,
      deleteHighlight,
      clearHighlights,
      articleHash,
      activeHighlightId,
      setActiveHighlightId,
    }),
    [
      highlights,
      isLoading,
      addHighlight,
      updateHighlight,
      deleteHighlight,
      clearHighlights,
      articleHash,
      activeHighlightId,
    ]
  );

  return (
    <HighlightsContext.Provider value={value}>
      {children}
    </HighlightsContext.Provider>
  );
}

export function useHighlightsContext() {
  const ctx = useContext(HighlightsContext);
  if (!ctx) {
    throw new Error("useHighlightsContext must be used within a HighlightsProvider");
  }
  return ctx;
}
