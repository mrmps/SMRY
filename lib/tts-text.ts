/**
 * Shared TTS text extraction and word position mapping.
 *
 * Both `extractTTSText()` and `buildWordPositions()` walk the SAME DOM nodes
 * in the SAME order, guaranteeing that word index N in the TTS audio
 * corresponds to word index N in the DOM highlight positions.
 *
 * Walking strategy:
 * 1. Find `[data-article-content]` element
 * 2. Walk only `.prose` containers (skip ad components between them)
 * 3. Skip elements with ad/navigation classes or hidden elements
 * 4. Enumerate words via `\S+` regex on text nodes
 */

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
 * Each entry maps a word index to its exact position in the DOM.
 *
 * Used by TTSHighlight for CSS Custom Highlight API highlighting.
 */
export function buildWordPositions(articleEl: Element): WordPosition[] {
  const positions: WordPosition[] = [];
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
        positions.push({
          node,
          start: match.index,
          end: match.index + match[0].length,
        });
      }
    }
  }

  return positions;
}

/**
 * Extract clean text for TTS from the article DOM.
 * Walks the same prose containers in the same order as `buildWordPositions()`,
 * so word N in the returned text corresponds to word position N in the DOM.
 *
 * Returns the concatenated words separated by spaces. This is the text
 * that should be sent to the TTS API.
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
export { cleanTextForTTS } from "./tts-chunk";
