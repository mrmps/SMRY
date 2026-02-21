"use client";

import { useEffect, useRef, useCallback } from "react";

interface TTSHighlightProps {
  currentWord: string;
  currentWordIndex: number;
  isActive: boolean;
}

interface WordPosition {
  node: Text;
  start: number;
  end: number;
}

// Inject ::highlight CSS rule dynamically (Turbopack can't parse it statically)
let styleInjected = false;
function injectHighlightCSS() {
  if (styleInjected || typeof document === "undefined") return;
  try {
    const style = document.createElement("style");
    style.textContent = `::highlight(tts-word) { background-color: hsl(var(--primary) / 0.25); color: inherit; }`;
    document.head.appendChild(style);
    styleInjected = true;
  } catch {
    // CSS Highlights API not supported
  }
}

/**
 * Build a flat index of word positions in the article DOM.
 * Called once when TTS starts, cached for the session.
 * O(n) traversal, then O(1) lookup per word index.
 */
function buildWordIndex(articleEl: Element): WordPosition[] {
  const positions: WordPosition[] = [];
  const walker = document.createTreeWalker(
    articleEl,
    NodeFilter.SHOW_TEXT,
    null,
  );

  let node: Text | null;
  while ((node = walker.nextNode() as Text | null)) {
    const text = node.textContent || "";
    const regex = /\S+/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      positions.push({
        node,
        start: match.index,
        end: match.index + match[0].length,
      });
    }
  }

  return positions;
}

/**
 * TTSHighlight applies CSS Custom Highlight API highlighting
 * to the currently spoken word. Uses a cached word index for O(1)
 * per-word lookups instead of O(n) TreeWalker traversal each frame.
 */
export function TTSHighlight({
  currentWord,
  currentWordIndex,
  isActive,
}: TTSHighlightProps) {
  const wordIndexRef = useRef<WordPosition[] | null>(null);
  const lastArticleElRef = useRef<Element | null>(null);
  const lastHighlightIdx = useRef(-1);

  // Build word index when TTS becomes active
  const ensureWordIndex = useCallback(() => {
    const articleEl = document.querySelector("[data-article-content]");
    if (!articleEl) return null;

    // Rebuild if article element changed (e.g., view mode switch)
    if (articleEl !== lastArticleElRef.current || !wordIndexRef.current) {
      wordIndexRef.current = buildWordIndex(articleEl);
      lastArticleElRef.current = articleEl;
    }

    return wordIndexRef.current;
  }, []);

  // Inject CSS on first mount
  useEffect(() => {
    injectHighlightCSS();
  }, []);

  useEffect(() => {
    // Clear highlight when inactive
    if (!isActive || currentWordIndex < 0) {
      try { CSS.highlights?.delete("tts-word"); } catch { /* unsupported */ }
      lastHighlightIdx.current = -1;
      return;
    }

    // Skip if same word (no DOM work needed)
    if (currentWordIndex === lastHighlightIdx.current) return;
    lastHighlightIdx.current = currentWordIndex;

    if (!CSS.highlights) return;

    const positions = ensureWordIndex();
    if (!positions || currentWordIndex >= positions.length) return;

    const pos = positions[currentWordIndex];

    try {
      const range = new Range();
      range.setStart(pos.node, pos.start);
      range.setEnd(pos.node, pos.end);

      const highlight = new Highlight(range);
      CSS.highlights.set("tts-word", highlight);

      // Auto-scroll: only when word is outside visible area
      const rect = range.getBoundingClientRect();
      const scrollEl =
        document.querySelector("[data-desktop-scroll]") ||
        document.querySelector("[data-mobile-scroll]");

      if (scrollEl && rect) {
        const containerRect = scrollEl.getBoundingClientRect();
        const isAbove = rect.top < containerRect.top + 100;
        const isBelow = rect.bottom > containerRect.bottom - 100;

        if (isAbove || isBelow) {
          const targetY =
            scrollEl.scrollTop +
            (rect.top - containerRect.top) -
            containerRect.height / 3;
          scrollEl.scrollTo({ top: targetY, behavior: "smooth" });
        }
      }
    } catch {
      // Range creation failed (node may have been removed)
      wordIndexRef.current = null; // Force rebuild on next update
    }
  }, [currentWord, currentWordIndex, isActive, ensureWordIndex]);

  // Cleanup on unmount or when TTS stops
  useEffect(() => {
    if (!isActive) {
      wordIndexRef.current = null;
      lastArticleElRef.current = null;
    }
    return () => {
      try { CSS.highlights?.delete("tts-word"); } catch { /* unsupported */ }
      wordIndexRef.current = null;
      lastArticleElRef.current = null;
    };
  }, [isActive]);

  return null;
}
