import type { HistoryItem } from "./use-history";

const PROGRESS_KEY = "smry-reading-progress";
const HISTORY_KEY = "smry-article-history";

type ProgressMap = Record<string, number>;

function getProgressMap(): ProgressMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(PROGRESS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function setProgressMap(map: ProgressMap): void {
  try {
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(map));
  } catch {
    // localStorage full or unavailable
  }
}

/** Save reading progress for a URL (0-100) */
export function saveReadingProgress(url: string, progress: number): void {
  const map = getProgressMap();
  if (progress >= 95) {
    // Article finished — remove entry
    delete map[url];
  } else if (progress > 0) {
    map[url] = Math.round(progress);
  }
  setProgressMap(map);
}

/** Get reading progress for a URL, or null if none saved */
export function getReadingProgress(url: string): number | null {
  const map = getProgressMap();
  return map[url] ?? null;
}

/** Remove progress entry for a URL */
export function clearReadingProgress(url: string): void {
  const map = getProgressMap();
  delete map[url];
  setProgressMap(map);
}

/** Get the most recent unfinished article (cross-referenced with history) */
export function getLastUnfinishedArticle(): {
  url: string;
  title: string;
  domain: string;
  progress: number;
} | null {
  if (typeof window === "undefined") return null;

  const progressMap = getProgressMap();
  const urlsWithProgress = Object.keys(progressMap);
  if (urlsWithProgress.length === 0) return null;

  // Read article history
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return null;

    const history: HistoryItem[] = JSON.parse(raw);

    // History is sorted by accessedAt (most recent first)
    // Find the first history item that has a progress entry
    for (const item of history) {
      const progress = progressMap[item.url];
      if (progress != null && progress > 0 && progress < 95) {
        return {
          url: item.url,
          title: item.title,
          domain: item.domain,
          progress,
        };
      }
    }
  } catch {
    // Corrupted data
  }

  return null;
}
