/**
 * Shared TTS text extraction and word position mapping.
 *
 * `extractTTSText()` returns raw DOM text (pre-cleaning) for server submission.
 * `buildWordPositions()` returns DOM positions filtered through `cleanTextForTTS`,
 * guaranteeing that word index N in the TTS alignment (based on cleaned text)
 * corresponds to word position N in the DOM highlight spans.
 *
 * Walking strategy:
 * 1. Find `[data-article-content]` element
 * 2. Walk only `.prose` containers (skip ad components between them)
 * 3. Skip elements with ad/navigation classes or hidden elements
 * 4. Enumerate words via `\S+` regex on text nodes
 * 5. (buildWordPositions only) Filter positions to match `cleanTextForTTS` output
 */

import { cleanTextForTTS } from "./tts-chunk";

// Elements to skip during text extraction (ads, navigation, etc.)
const SKIP_SELECTORS = [
  "[data-gravity-ad]",
  "[data-ad]",
  ".gravity-ad",
  ".ad-container",
  "[aria-hidden='true']",
] as const;

/**
 * Check if a text node or its ancestors should be skipped.
 */
function shouldSkipNode(node: Text): boolean {
  let el: Element | null = node.parentElement;
  while (el) {
    // Stop at the prose boundary — don't check above it
    if (el.classList.contains("prose")) return false;
    for (const sel of SKIP_SELECTORS) {
      if (el.matches(sel)) return true;
    }
    el = el.parentElement;
  }
  return false;
}

/**
 * Get the prose containers from the article element.
 * Handles both layouts:
 * - No inline ad: `<div class="prose" data-article-content>` (element itself is prose)
 * - With inline ad: `<div data-article-content>` wrapping multiple `<div class="prose">`
 */
function getProseContainers(articleEl: Element): Element[] {
  if (articleEl.classList.contains("prose")) {
    return [articleEl];
  }
  return Array.from(articleEl.querySelectorAll(":scope > .prose"));
}

export interface WordPosition {
  node: Text;
  start: number;
  end: number;
}

/**
 * Build a flat array of word positions from the article's prose containers.
 * Walks text nodes in DOM order, skipping ad/navigation elements.
 * Positions are filtered through `cleanTextForTTS` so that word index N
 * here matches word index N in the TTS character alignment.
 *
 * Used by useTTSHighlight for span-wrapping and click-to-seek.
 */
export function buildWordPositions(articleEl: Element): WordPosition[] {
  const rawPositions: WordPosition[] = [];
  const containers = getProseContainers(articleEl);

  for (const container of containers) {
    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT,
      null,
    );

    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
      if (shouldSkipNode(node)) continue;

      const text = node.textContent || "";
      const regex = /\S+/g;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(text)) !== null) {
        rawPositions.push({
          node,
          start: match.index,
          end: match.index + match[0].length,
        });
      }
    }
  }

  // Filter to match cleaned text (TTS alignment is based on cleaned text)
  const rawWords = rawPositions.map(
    (p) => (p.node.textContent || "").slice(p.start, p.end),
  );
  const rawText = rawWords.join(" ");
  const cleanedText = cleanTextForTTS(rawText);
  const cleanedWords = cleanedText.match(/\S+/g) || [];

  // If cleaning didn't change anything, return raw (fast path)
  if (cleanedWords.length === rawPositions.length) return rawPositions;

  // Forward-match cleaned words to raw positions.
  // Uses startsWith for robustness: if cleanTextForTTS partially removes
  // text from a word (e.g. "ADVERTISEMENT." → "."), we still match.
  const result: WordPosition[] = [];
  let rawIdx = 0;
  for (const cleanedWord of cleanedWords) {
    let matched = false;
    while (rawIdx < rawPositions.length) {
      const raw = rawWords[rawIdx];
      if (raw === cleanedWord || raw.includes(cleanedWord) || cleanedWord.includes(raw)) {
        result.push(rawPositions[rawIdx]);
        rawIdx++;
        matched = true;
        break;
      }
      rawIdx++;
    }
    // Safety: if no raw match found, stop — indices would be misaligned
    if (!matched) break;
  }
  return result;
}

/**
 * Extract raw text for TTS from the article DOM.
 * Walks the same prose containers as `buildWordPositions()`.
 * Returns concatenated words separated by spaces — caller should apply
 * `cleanTextForTTS()` before sending to the TTS API.
 */
export function extractTTSText(articleEl: Element): string {
  const words: string[] = [];
  const containers = getProseContainers(articleEl);

  for (const container of containers) {
    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT,
      null,
    );

    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
      if (shouldSkipNode(node)) continue;

      const text = node.textContent || "";
      const regex = /\S+/g;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(text)) !== null) {
        words.push(match[0]);
      }
    }
  }

  return words.join(" ");
}

// Re-export cleanTextForTTS from shared module (single source of truth)
export { cleanTextForTTS };
