'use client';

import { useSyncExternalStore, useCallback } from 'react';

/**
 * Hook to detect if a media query matches.
 * Uses useSyncExternalStore for proper React 18+ external store synchronization.
 * Returns null during SSR/initial hydration to avoid mismatch.
 */
export function useMediaQuery(query: string): boolean | null {
  const subscribe = useCallback(
    (callback: () => void) => {
      const mediaQuery = window.matchMedia(query);
      mediaQuery.addEventListener('change', callback);
      return () => mediaQuery.removeEventListener('change', callback);
    },
    [query]
  );

  const getSnapshot = useCallback(
    () => window.matchMedia(query).matches,
    [query]
  );

  // Return null during SSR - component should handle this appropriately
  const getServerSnapshot = useCallback(() => null, []);

  const result = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot as () => boolean | null
  );

  return result;
}

/**
 * Tailwind lg breakpoint (1024px)
 */
export function useIsDesktop(): boolean | null {
  return useMediaQuery('(min-width: 1024px)');
}
