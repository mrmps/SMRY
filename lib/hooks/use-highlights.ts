'use client';

import { useState, useCallback, useMemo } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getApiUrl } from '@/lib/api/config';

export interface Highlight {
  id: string;
  text: string;
  note?: string;
  color: 'yellow' | 'green' | 'blue' | 'pink' | 'orange';
  createdAt: string;
  // Position info for re-rendering
  startOffset?: number;
  endOffset?: number;
  contextBefore?: string;
  contextAfter?: string;
}

export interface ArticleHighlights {
  articleUrl: string;
  articleTitle?: string;
  highlights: Highlight[];
  updatedAt: string;
}

// Generate article hash (same logic as chat)
function generateArticleHash(url: string): string {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    const char = url.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

const STORAGE_PREFIX = 'article-highlights-';

// Query keys
const highlightKeys = {
  all: ['highlights'] as const,
  byArticle: (hash: string) => ['highlights', hash] as const,
  allArticles: () => ['highlights', 'all-articles'] as const,
};

export function useHighlights(articleUrl: string, articleTitle?: string) {
  const { getToken, isSignedIn } = useAuth();
  const queryClient = useQueryClient();

  const articleHash = useMemo(() => generateArticleHash(articleUrl), [articleUrl]);
  const storageKey = `${STORAGE_PREFIX}${articleHash}`;

  // Fetch highlights from server (for signed-in users)
  const { data: serverData, isLoading } = useQuery({
    queryKey: highlightKeys.byArticle(articleHash),
    queryFn: async (): Promise<ArticleHighlights | null> => {
      const token = await getToken();
      if (!token) return null;

      const response = await fetch(getApiUrl(`/api/highlights/${articleHash}`), {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!isSignedIn,
    staleTime: 30_000,
  });

  // Local state for highlights - initialize from localStorage
  const [localHighlights, setLocalHighlights] = useState<Highlight[]>(() => {
    if (typeof window === 'undefined' || isSignedIn) return [];
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const data = JSON.parse(stored) as ArticleHighlights;
        return data.highlights;
      }
    } catch {
      // Ignore parse errors
    }
    return [];
  });

  // Use server data for signed-in users, local for anonymous
  const highlights = useMemo(
    () => isSignedIn ? (serverData?.highlights ?? []) : localHighlights,
    [isSignedIn, serverData?.highlights, localHighlights]
  );

  // Save mutation for server
  const saveMutation = useMutation({
    mutationFn: async (newHighlights: Highlight[]) => {
      const token = await getToken();
      if (!token) return false;

      const response = await fetch(getApiUrl(`/api/highlights/${articleHash}`), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          articleUrl,
          articleTitle,
          highlights: newHighlights,
        }),
      });

      return response.ok;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: highlightKeys.byArticle(articleHash) });
    },
  });

  // Helper: persist highlights for signed-in users via optimistic update + mutation
  // Uses functional updater inside setQueryData to guarantee sequential reads
  // (avoids lost mutations when two calls are batched in the same event handler)
  const persistSignedIn = useCallback((updater: (prev: Highlight[]) => Highlight[]) => {
    let next: Highlight[] = [];
    queryClient.setQueryData<ArticleHighlights | null>(
      highlightKeys.byArticle(articleHash),
      (old) => {
        const prevHighlights = old?.highlights ?? [];
        next = updater(prevHighlights);
        return old ? { ...old, highlights: next, updatedAt: new Date().toISOString() } : {
          articleUrl,
          articleTitle,
          highlights: next,
          updatedAt: new Date().toISOString(),
        };
      }
    );
    saveMutation.mutate(next);
    return next;
  }, [queryClient, articleHash, articleUrl, articleTitle, saveMutation]);

  // Helper: persist highlights for anonymous users
  const persistLocal = useCallback((updater: (prev: Highlight[]) => Highlight[]) => {
    let next: Highlight[] = [];
    setLocalHighlights(prev => {
      next = updater(prev);
      // Write to localStorage synchronously inside the updater to avoid race conditions
      // where rapid mutations could cause localStorage to diverge from React state
      const data: ArticleHighlights = {
        articleUrl,
        articleTitle,
        highlights: next,
        updatedAt: new Date().toISOString(),
      };
      try {
        localStorage.setItem(storageKey, JSON.stringify(data));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
    return next;
  }, [articleUrl, articleTitle, storageKey]);

  // Add highlight — stable reference (no dependency on highlights)
  const addHighlight = useCallback((highlight: Omit<Highlight, 'id' | 'createdAt'>) => {
    const newHighlight: Highlight = {
      ...highlight,
      id: `hl-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      createdAt: new Date().toISOString(),
    };

    const updater = (prev: Highlight[]) => [...prev, newHighlight];

    if (isSignedIn) {
      persistSignedIn(updater);
    } else {
      persistLocal(updater);
    }

    return newHighlight;
  }, [isSignedIn, persistSignedIn, persistLocal]);

  // Update highlight (e.g., add note) — stable reference
  const updateHighlight = useCallback((id: string, updates: Partial<Highlight>) => {
    const updater = (prev: Highlight[]) => prev.map(h =>
      h.id === id ? { ...h, ...updates } : h
    );

    if (isSignedIn) {
      persistSignedIn(updater);
    } else {
      persistLocal(updater);
    }
  }, [isSignedIn, persistSignedIn, persistLocal]);

  // Delete highlight — stable reference
  const deleteHighlight = useCallback((id: string) => {
    const updater = (prev: Highlight[]) => prev.filter(h => h.id !== id);

    if (isSignedIn) {
      persistSignedIn(updater);
    } else {
      persistLocal(updater);
    }
  }, [isSignedIn, persistSignedIn, persistLocal]);

  // Clear all highlights
  const clearHighlights = useCallback(() => {
    if (isSignedIn) {
      // Optimistic update so UI clears immediately
      queryClient.setQueryData<ArticleHighlights | null>(
        highlightKeys.byArticle(articleHash),
        (old) => old ? { ...old, highlights: [], updatedAt: new Date().toISOString() } : null
      );
      saveMutation.mutate([]);
    } else {
      setLocalHighlights([]);
      try {
        localStorage.removeItem(storageKey);
      } catch {
        // Ignore
      }
    }
  }, [isSignedIn, saveMutation, storageKey, queryClient, articleHash]);

  return {
    highlights,
    isLoading,
    addHighlight,
    updateHighlight,
    deleteHighlight,
    clearHighlights,
    articleHash,
  };
}

// Hook to get all highlights across all articles (for export)
export function useAllHighlights() {
  const { getToken, isSignedIn } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: highlightKeys.allArticles(),
    queryFn: async (): Promise<ArticleHighlights[]> => {
      const token = await getToken();
      if (!token) return [];

      const response = await fetch(getApiUrl('/api/highlights'), {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!isSignedIn,
  });

  // For anonymous users, collect from localStorage
  const localHighlights = useMemo(() => {
    if (isSignedIn || typeof window === 'undefined') return [];

    const results: ArticleHighlights[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_PREFIX)) {
        try {
          const data = JSON.parse(localStorage.getItem(key) || '');
          if (data.highlights?.length > 0) {
            results.push(data);
          }
        } catch {
          // Ignore
        }
      }
    }
    return results;
  }, [isSignedIn]);

  return {
    allHighlights: isSignedIn ? (data ?? []) : localHighlights,
    isLoading,
  };
}
