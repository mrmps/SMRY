"use client";

import { useEffect, useRef, type RefObject } from "react";
import type { Highlight } from "./use-highlights";

const MARK_ATTR = "data-highlight-id";
const MARK_COLOR_ATTR = "data-highlight-color";
const MARK_ACTIVE_ATTR = "data-highlight-active";
const MARK_PULSE_ATTR = "data-highlight-pulse";

/** One entry per text node (typically 100-500 per article, not per character) */
interface TextNodeEntry {
  node: Text;
  /** Character offset where this node starts in the full concatenated text */
  start: number;
  /** Number of characters in this text node */
  length: number;
}

interface CharMap {
  entries: TextNodeEntry[];
  fullText: string;
  normalizedText: string;
  /**
   * Maps each normalized-text index to the corresponding original-text index.
   * Single Uint32Array — no GC pressure from per-character objects.
   */
  normToOrig: Uint32Array;
}

/**
 * Build a character map from the container's text nodes.
 * One entry per text node instead of per character.
 */
function buildCharMap(container: HTMLElement): CharMap {
  const walker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_TEXT,
    null
  );

  const entries: TextNodeEntry[] = [];
  let fullText = "";
  let node: Text | null;

  while ((node = walker.nextNode() as Text | null)) {
    const text = node.textContent || "";
    if (text.length > 0) {
      entries.push({ node, start: fullText.length, length: text.length });
      fullText += text;
    }
  }

  // Build normalized text and the normalized→original index mapping
  // Collapse whitespace runs into single spaces
  const normChars: string[] = [];
  const normToOrigArr: number[] = [];

  for (let i = 0; i < fullText.length; i++) {
    const char = fullText[i];
    const isWS = /\s/.test(char);
    if (isWS) {
      // Only emit a space if the previous normalized char wasn't already a space
      if (normChars.length === 0 || normChars[normChars.length - 1] !== " ") {
        normChars.push(" ");
        normToOrigArr.push(i);
      }
    } else {
      normChars.push(char);
      normToOrigArr.push(i);
    }
  }

  return {
    entries,
    fullText,
    normalizedText: normChars.join(""),
    normToOrig: new Uint32Array(normToOrigArr),
  };
}

/**
 * Binary search: find the text node entry that contains the given original-text offset.
 * O(log M) where M = number of text nodes.
 */
function findTextNodeEntry(entries: TextNodeEntry[], origOffset: number): TextNodeEntry | null {
  let lo = 0;
  let hi = entries.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const entry = entries[mid];
    if (origOffset < entry.start) {
      hi = mid - 1;
    } else if (origOffset >= entry.start + entry.length) {
      lo = mid + 1;
    } else {
      return entry;
    }
  }
  return null;
}

/**
 * Find a text match in the DOM using the highlight's text and context.
 */
function findTextRange(
  charMap: CharMap,
  highlight: Highlight
): Range | null {
  const searchText = highlight.text;
  if (!searchText) return null;

  const { entries, normalizedText, normToOrig } = charMap;
  const normalizedSearch = searchText.replace(/\s+/g, " ");

  let matchIndex = -1;
  let startPos = 0;

  while (true) {
    const idx = normalizedText.indexOf(normalizedSearch, startPos);
    if (idx === -1) break;

    if (highlight.contextBefore) {
      const normalizedContext = highlight.contextBefore.replace(/\s+/g, " ");
      const beforeText = normalizedText.slice(
        Math.max(0, idx - normalizedContext.length),
        idx
      );
      if (beforeText.includes(normalizedContext)) {
        matchIndex = idx;
        break;
      }
    }

    if (matchIndex === -1) {
      matchIndex = idx;
    }

    startPos = idx + 1;
  }

  if (matchIndex === -1) return null;

  // Map normalized positions back to original positions via Uint32Array lookup
  const origStart = normToOrig[matchIndex];
  const matchEnd = matchIndex + normalizedSearch.length;
  // origEnd: if matchEnd is past the end of normToOrig, use fullText.length
  const origEnd = matchEnd < normToOrig.length ? normToOrig[matchEnd] : charMap.fullText.length;

  if (origStart === undefined || origEnd === undefined) return null;

  // Binary search for the text nodes containing start and end
  const startEntry = findTextNodeEntry(entries, origStart);
  const endEntry = findTextNodeEntry(entries, origEnd - 1);
  if (!startEntry || !endEntry) return null;

  try {
    const range = document.createRange();
    range.setStart(startEntry.node, origStart - startEntry.start);
    range.setEnd(endEntry.node, (origEnd - 1) - endEntry.start + 1);
    return range;
  } catch {
    return null;
  }
}

/**
 * Wrap a Range in <mark> elements. Handles ranges that span multiple text nodes.
 */
function wrapRangeInMark(
  range: Range,
  highlightId: string,
  color: string
): HTMLElement[] {
  const marks: HTMLElement[] = [];

  if (
    range.startContainer === range.endContainer &&
    range.startContainer.nodeType === Node.TEXT_NODE
  ) {
    const mark = document.createElement("mark");
    mark.setAttribute(MARK_ATTR, highlightId);
    mark.setAttribute(MARK_COLOR_ATTR, color);
    range.surroundContents(mark);
    marks.push(mark);
    return marks;
  }

  const walker = document.createTreeWalker(
    range.commonAncestorContainer,
    NodeFilter.SHOW_TEXT,
    null
  );

  const textNodes: Text[] = [];
  let current: Text | null;
  while ((current = walker.nextNode() as Text | null)) {
    if (range.intersectsNode(current)) {
      textNodes.push(current);
    }
  }

  for (const textNode of textNodes) {
    const nodeRange = document.createRange();

    if (textNode === range.startContainer) {
      nodeRange.setStart(textNode, range.startOffset);
      nodeRange.setEnd(textNode, textNode.textContent?.length || 0);
    } else if (textNode === range.endContainer) {
      nodeRange.setStart(textNode, 0);
      nodeRange.setEnd(textNode, range.endOffset);
    } else {
      nodeRange.selectNodeContents(textNode);
    }

    if (nodeRange.toString().length === 0) continue;

    try {
      const mark = document.createElement("mark");
      mark.setAttribute(MARK_ATTR, highlightId);
      mark.setAttribute(MARK_COLOR_ATTR, color);
      nodeRange.surroundContents(mark);
      marks.push(mark);
    } catch {
      // surroundContents can fail if the range partially selects a non-text node
    }
  }

  return marks;
}

/**
 * Remove marks for a specific highlight ID, or all marks if no ID given.
 */
function clearMarks(container: HTMLElement, highlightId?: string) {
  const selector = highlightId
    ? `mark[${MARK_ATTR}="${CSS.escape(highlightId)}"]`
    : `mark[${MARK_ATTR}]`;
  const marks = container.querySelectorAll(selector);
  marks.forEach((mark) => {
    const parent = mark.parentNode;
    if (!parent) return;
    while (mark.firstChild) {
      parent.insertBefore(mark.firstChild, mark);
    }
    parent.removeChild(mark);
    parent.normalize();
  });
}

/**
 * Compute a fingerprint string of highlights (id:color pairs).
 * Used as a primitive effect dependency instead of the full array reference.
 */
function computeFingerprint(highlights: Highlight[]): string {
  if (highlights.length === 0) return "";
  return highlights.map((h) => `${h.id}:${h.color}`).join(",");
}

/**
 * Hook: Renders highlights as <mark> elements on article DOM text.
 *
 * Key optimizations:
 * - Per-text-node charmap (not per-character) — ~100-500 entries instead of 100K
 * - Uint32Array for normalized→original mapping — no GC pressure
 * - Binary search for text node lookup: O(log M) instead of O(N)
 * - Primitive fingerprint as effect dep instead of highlights array
 * - Incremental updates: only add/remove/recolor changed marks
 * - Debounced MutationObserver (150ms) to batch external DOM changes
 */
export function useInlineHighlights(
  contentRef: RefObject<HTMLDivElement | null>,
  highlights: Highlight[],
  activeHighlightId: string | null,
  content?: string | null
) {
  const highlightsRef = useRef(highlights);
  useEffect(() => { highlightsRef.current = highlights; });

  const isApplyingRef = useRef(false);
  const appliedIdsRef = useRef<Set<string>>(new Set());
  const appliedColorsRef = useRef<Map<string, string>>(new Map());
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafIdRef = useRef<number | null>(null);

  // Stable applyMarks function stored in ref so MutationObserver doesn't need to re-subscribe
  const applyMarksRef = useRef<(container: HTMLElement, hl: Highlight[]) => void>(null!);
  const applyMarks = (container: HTMLElement, hl: Highlight[]) => {
    if (hl.length === 0) {
      clearMarks(container);
      appliedIdsRef.current.clear();
      appliedColorsRef.current.clear();
      return;
    }

    isApplyingRef.current = true;

    const currentIds = new Set(hl.map((h) => h.id));
    const currentColors = new Map(hl.map((h) => [h.id, h.color]));
    const prevIds = appliedIdsRef.current;

    // Check if marks still exist in DOM (they survive unless content was replaced)
    const existingMarks = container.querySelector(`mark[${MARK_ATTR}]`);
    const canIncremental = existingMarks !== null && prevIds.size > 0;

    if (canIncremental) {
      // Remove marks for deleted highlights
      for (const prevId of prevIds) {
        if (!currentIds.has(prevId)) {
          clearMarks(container, prevId);
        }
      }

      // Recolor changed highlights (no DOM surgery needed)
      for (const h of hl) {
        if (prevIds.has(h.id)) {
          const prevColor = appliedColorsRef.current.get(h.id);
          if (prevColor !== h.color) {
            const marks = container.querySelectorAll(
              `mark[${MARK_ATTR}="${CSS.escape(h.id)}"]`
            );
            marks.forEach((mark) => mark.setAttribute(MARK_COLOR_ATTR, h.color));
          }
        }
      }

      // Add new highlights only
      const toAdd = hl.filter((h) => !prevIds.has(h.id));
      if (toAdd.length > 0) {
        for (const highlight of toAdd) {
          // Rebuild charmap before each wrap because wrapRangeInMark modifies
          // the DOM text nodes, invalidating the previous charmap
          const charMap = buildCharMap(container);
          const range = findTextRange(charMap, highlight);
          if (range) {
            wrapRangeInMark(range, highlight.id, highlight.color);
          }
        }
      }
    } else {
      // Full re-application (content was replaced)
      clearMarks(container);
      for (const highlight of hl) {
        // Rebuild charmap before each wrap because wrapRangeInMark modifies
        // the DOM text nodes, invalidating the previous charmap
        const charMap = buildCharMap(container);
        const range = findTextRange(charMap, highlight);
        if (range) {
          wrapRangeInMark(range, highlight.id, highlight.color);
        }
      }
    }

    appliedIdsRef.current = currentIds;
    appliedColorsRef.current = currentColors;
    isApplyingRef.current = false;
  };
  useEffect(() => { applyMarksRef.current = applyMarks; });

  // Primitive fingerprint — only changes when highlight IDs or colors actually change
  const fingerprint = computeFingerprint(highlights);

  // Main effect: apply marks when highlight fingerprint or article content changes
  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;

    applyMarksRef.current(container, highlightsRef.current);

    // Set up MutationObserver to re-apply if external DOM changes destroy marks
    if (highlightsRef.current.length === 0) return;

    const observer = new MutationObserver(() => {
      if (isApplyingRef.current) return;

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        if (isApplyingRef.current) return;

        const hasMarks = container.querySelector(`mark[${MARK_ATTR}]`);
        if (!hasMarks && highlightsRef.current.length > 0) {
          appliedIdsRef.current.clear();
          appliedColorsRef.current.clear();
          rafIdRef.current = requestAnimationFrame(() => {
            rafIdRef.current = null;
            applyMarksRef.current(container, highlightsRef.current);
          });
        }
      }, 150);
    });

    observer.observe(container, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [contentRef, fingerprint, content]);

  // Handle active highlight scroll + pulse
  useEffect(() => {
    if (!activeHighlightId) return;

    const container = contentRef.current;
    if (!container) return;

    const mark = container.querySelector(
      `mark[${MARK_ATTR}="${CSS.escape(activeHighlightId)}"]`
    );
    if (!mark) return;

    mark.setAttribute(MARK_ACTIVE_ATTR, "true");
    mark.setAttribute(MARK_PULSE_ATTR, "true");

    mark.scrollIntoView({ behavior: "smooth", block: "center" });

    const timer = setTimeout(() => {
      mark.removeAttribute(MARK_PULSE_ATTR);
    }, 1200);

    return () => {
      clearTimeout(timer);
      mark.removeAttribute(MARK_ACTIVE_ATTR);
      mark.removeAttribute(MARK_PULSE_ATTR);
    };
  }, [activeHighlightId, contentRef, fingerprint]);
}
