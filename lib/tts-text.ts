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

export interface TimedWordPosition extends WordPosition {
  /** Start time in seconds from alignment, or -1 if unmatched */
  startTimeSec: number;
  /** End time in seconds from alignment, or -1 if unmatched */
  endTimeSec: number;
  /** Index of the matched alignment word, or -1 if unmatched */
  alignmentWordIdx: number;
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

/**
 * Match alignment words (from TTS provider, possibly normalized) to DOM word
 * positions using fuzzy text comparison. Returns positions augmented with
 * timing data from the best-matching alignment word.
 *
 * Handles text normalization differences (e.g. "$100" → "one hundred dollars")
 * by:
 * 1. Forward-matching with case-insensitive stripped-punctuation comparison
 * 2. For unmatched DOM words, interpolating time from surrounding matches
 *
 * This eliminates the fragile index-based mapping between DOM spans and
 * alignment words that broke when text normalization changed word count.
 */
export function matchTimingsToPositions(
  positions: WordPosition[],
  alignmentWords: readonly { text: string; startTime: number; endTime: number }[],
): TimedWordPosition[] {
  if (!positions.length || !alignmentWords.length) {
    return positions.map((p) => ({ ...p, startTimeSec: -1, endTimeSec: -1, alignmentWordIdx: -1 }));
  }

  const result: TimedWordPosition[] = [];
  let alignIdx = 0;

  for (let i = 0; i < positions.length; i++) {
    const pos = positions[i];
    const domWord = (pos.node.textContent || "").slice(pos.start, pos.end);
    const domNorm = normalizeForMatch(domWord);

    let matched = false;
    // Search forward in alignment words for a match
    const searchLimit = Math.min(alignIdx + 5, alignmentWords.length);
    for (let j = alignIdx; j < searchLimit; j++) {
      const alignNorm = normalizeForMatch(alignmentWords[j].text);
      if (wordsMatch(domNorm, alignNorm)) {
        result.push({
          ...pos,
          startTimeSec: alignmentWords[j].startTime,
          endTimeSec: alignmentWords[j].endTime,
          alignmentWordIdx: j,
        });
        alignIdx = j + 1;
        matched = true;
        break;
      }
    }

    if (!matched) {
      // Try wider search (up to 15 ahead) for cases with many inserted words
      const wideLimit = Math.min(alignIdx + 15, alignmentWords.length);
      for (let j = searchLimit; j < wideLimit; j++) {
        const alignNorm = normalizeForMatch(alignmentWords[j].text);
        if (wordsMatch(domNorm, alignNorm)) {
          result.push({
            ...pos,
            startTimeSec: alignmentWords[j].startTime,
            endTimeSec: alignmentWords[j].endTime,
            alignmentWordIdx: j,
          });
          alignIdx = j + 1;
          matched = true;
          break;
        }
      }
    }

    if (!matched) {
      // Mark as unmatched — will be interpolated below
      result.push({ ...pos, startTimeSec: -1, endTimeSec: -1, alignmentWordIdx: -1 });
    }
  }

  // Interpolate timing for unmatched words from nearest matched neighbors
  interpolateUnmatched(result);

  return result;
}

/**
 * Build a reverse map: alignment word index → DOM span index.
 * For alignment words that weren't matched to any DOM word,
 * maps to the closest preceding matched span.
 */
export function buildAlignmentToSpanMap(
  timedPositions: TimedWordPosition[],
  alignmentWordCount: number,
): Map<number, number> {
  const map = new Map<number, number>();

  // First pass: add direct matches
  for (let spanIdx = 0; spanIdx < timedPositions.length; spanIdx++) {
    const alignIdx = timedPositions[spanIdx].alignmentWordIdx;
    if (alignIdx >= 0) {
      map.set(alignIdx, spanIdx);
    }
  }

  // Second pass: fill gaps — unmatched alignment indices map to the
  // closest preceding matched span (so highlighting stays near the
  // correct position even when normalization added extra words).
  let lastSpanIdx = 0;
  for (let alignIdx = 0; alignIdx < alignmentWordCount; alignIdx++) {
    if (map.has(alignIdx)) {
      lastSpanIdx = map.get(alignIdx)!;
    } else {
      map.set(alignIdx, lastSpanIdx);
    }
  }

  return map;
}

/** Strip punctuation and lowercase for fuzzy comparison */
function normalizeForMatch(word: string): string {
  return word.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

/** Check if two normalized words match (exact, prefix, or containment) */
function wordsMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  // One contains the other (handles partial normalization, e.g. "$100" → "100")
  if (a.length >= 2 && b.length >= 2) {
    if (a.includes(b) || b.includes(a)) return true;
  }
  return false;
}

/** Fill in timing for unmatched positions by interpolating from neighbors */
function interpolateUnmatched(positions: TimedWordPosition[]): void {
  for (let i = 0; i < positions.length; i++) {
    if (positions[i].startTimeSec >= 0) continue;

    // Find previous matched
    let prevTime = 0;
    for (let j = i - 1; j >= 0; j--) {
      if (positions[j].startTimeSec >= 0) {
        prevTime = positions[j].endTimeSec;
        break;
      }
    }
    // Find next matched
    let nextTime = prevTime;
    for (let j = i + 1; j < positions.length; j++) {
      if (positions[j].startTimeSec >= 0) {
        nextTime = positions[j].startTimeSec;
        break;
      }
    }

    // Simple linear interpolation
    const gap = nextTime - prevTime;
    const unmatchedCount = countConsecutiveUnmatched(positions, i);
    const idx = i - findUnmatchedStart(positions, i);
    const step = unmatchedCount > 0 ? gap / (unmatchedCount + 1) : 0;
    positions[i].startTimeSec = prevTime + step * (idx + 1);
    positions[i].endTimeSec = positions[i].startTimeSec + step * 0.8;
  }
}

function countConsecutiveUnmatched(positions: TimedWordPosition[], from: number): number {
  let start = from;
  while (start > 0 && positions[start - 1].startTimeSec < 0) start--;
  let count = 0;
  for (let i = start; i < positions.length && positions[i].startTimeSec < 0; i++) count++;
  return count;
}

function findUnmatchedStart(positions: TimedWordPosition[], from: number): number {
  let start = from;
  while (start > 0 && positions[start - 1].startTimeSec < 0) start--;
  return start;
}

// Re-export cleanTextForTTS from shared module (single source of truth)
export { cleanTextForTTS };
