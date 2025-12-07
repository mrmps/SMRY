"use client";

import { useCallback, useEffect, useState } from "react";

const HISTORY_KEY = "smry-article-history";
const STORAGE_EVENT_NAME = "local-storage-update";

export interface HistoryItem {
  id: string;
  url: string;
  title: string;
  domain: string;
  accessedAt: string; // ISO string
}

interface StorageEventDetail {
  key: string;
  value: HistoryItem[];
}

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url.startsWith("http") ? url : `https://${url}`);
    return urlObj.hostname.replace("www.", "");
  } catch {
    return url;
  }
}

/**
 * Generate a unique ID for history items
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Custom hook to manage article history in localStorage
 * @param isPremium - Whether user has premium subscription (unlimited history)
 * @returns History management functions and state
 */
export function useHistory(isPremium: boolean = false) {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Max items based on premium status
  const maxItems = isPremium ? Infinity : 30;

  // Read initial value from localStorage
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const item = window.localStorage.getItem(HISTORY_KEY);
        if (item) {
          const parsed = JSON.parse(item) as HistoryItem[];
          setHistory(parsed);
        }
      } catch (error) {
        console.warn(`Error reading history from localStorage:`, error);
      }
      setIsLoaded(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Listen for changes from other components/tabs
  useEffect(() => {
    const handleStorageChange = (event: Event) => {
      const customEvent = event as CustomEvent<StorageEventDetail>;
      if (customEvent.detail.key === HISTORY_KEY) {
        setHistory(customEvent.detail.value);
      }
    };

    // Listen to custom events (same window)
    window.addEventListener(STORAGE_EVENT_NAME, handleStorageChange);

    // Listen to storage events (other tabs)
    const handleNativeStorage = (event: StorageEvent) => {
      if (event.key === HISTORY_KEY && event.newValue) {
        setHistory(JSON.parse(event.newValue));
      }
    };
    window.addEventListener("storage", handleNativeStorage);

    return () => {
      window.removeEventListener(STORAGE_EVENT_NAME, handleStorageChange);
      window.removeEventListener("storage", handleNativeStorage);
    };
  }, []);

  /**
   * Save history to localStorage and dispatch update event
   */
  const saveHistory = useCallback((newHistory: HistoryItem[]) => {
    try {
      setHistory(newHistory);
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));

      // Dispatch custom event for same-window updates
      const event = new CustomEvent<StorageEventDetail>(STORAGE_EVENT_NAME, {
        detail: { key: HISTORY_KEY, value: newHistory },
      });
      window.dispatchEvent(event);
    } catch (error) {
      console.warn("Error saving history to localStorage:", error);
    }
  }, []);

  /**
   * Add an article to history
   * Deduplicates by URL (updates accessedAt if already exists)
   */
  const addToHistory = useCallback(
    (url: string, title: string) => {
      const domain = extractDomain(url);
      const now = new Date().toISOString();

      setHistory((prev) => {
        // Check if this URL already exists
        const existingIndex = prev.findIndex((item) => item.url === url);

        let newHistory: HistoryItem[];

        if (existingIndex !== -1) {
          // Update existing item - move to front with new timestamp
          const existing = prev[existingIndex];
          const updated = { ...existing, title, accessedAt: now };
          newHistory = [
            updated,
            ...prev.slice(0, existingIndex),
            ...prev.slice(existingIndex + 1),
          ];
        } else {
          // Add new item at the beginning
          const newItem: HistoryItem = {
            id: generateId(),
            url,
            title,
            domain,
            accessedAt: now,
          };
          newHistory = [newItem, ...prev];
        }

        // Keep only the max allowed items (we store 100 max regardless)
        // But display limit is based on premium status
        const storageLimit = 100;
        if (newHistory.length > storageLimit) {
          newHistory = newHistory.slice(0, storageLimit);
        }

        // Save to localStorage
        try {
          window.localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
          const event = new CustomEvent<StorageEventDetail>(STORAGE_EVENT_NAME, {
            detail: { key: HISTORY_KEY, value: newHistory },
          });
          window.dispatchEvent(event);
        } catch (error) {
          console.warn("Error saving history:", error);
        }

        return newHistory;
      });
    },
    []
  );

  /**
   * Remove a single item from history
   */
  const removeFromHistory = useCallback(
    (id: string) => {
      const newHistory = history.filter((item) => item.id !== id);
      saveHistory(newHistory);
    },
    [history, saveHistory]
  );

  /**
   * Clear all history
   */
  const clearHistory = useCallback(() => {
    saveHistory([]);
  }, [saveHistory]);

  /**
   * Get visible history based on premium status
   */
  const visibleHistory = isPremium ? history : history.slice(0, maxItems);

  /**
   * Check if there are more items hidden (for free users)
   */
  const hiddenCount = isPremium ? 0 : Math.max(0, history.length - maxItems);

  return {
    history: visibleHistory,
    totalCount: history.length,
    hiddenCount,
    isLoaded,
    addToHistory,
    removeFromHistory,
    clearHistory,
    isPremium,
  };
}

/**
 * Standalone function to add to history (for use outside React components)
 * This is useful for the proxy-content component
 */
export function addArticleToHistory(url: string, title: string): void {
  if (typeof window === "undefined") return;

  try {
    const item = window.localStorage.getItem(HISTORY_KEY);
    const history: HistoryItem[] = item ? JSON.parse(item) : [];

    const domain = extractDomain(url);
    const now = new Date().toISOString();

    // Check if this URL already exists
    const existingIndex = history.findIndex((item) => item.url === url);

    let newHistory: HistoryItem[];

    if (existingIndex !== -1) {
      // Update existing item - move to front with new timestamp
      const existing = history[existingIndex];
      const updated = { ...existing, title, accessedAt: now };
      newHistory = [
        updated,
        ...history.slice(0, existingIndex),
        ...history.slice(existingIndex + 1),
      ];
    } else {
      // Add new item at the beginning
      const newItem: HistoryItem = {
        id: generateId(),
        url,
        title,
        domain,
        accessedAt: now,
      };
      newHistory = [newItem, ...history];
    }

    // Keep only 100 items max
    if (newHistory.length > 100) {
      newHistory = newHistory.slice(0, 100);
    }

    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));

    // Dispatch event for other components
    const event = new CustomEvent<StorageEventDetail>(STORAGE_EVENT_NAME, {
      detail: { key: HISTORY_KEY, value: newHistory },
    });
    window.dispatchEvent(event);
  } catch (error) {
    console.warn("Error adding to history:", error);
  }
}

