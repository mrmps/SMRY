'use client';

import { useAuth } from "@clerk/nextjs";
import { useState, useEffect } from "react";

/**
 * Hook to check if the current user has premium status.
 * Uses server-side billing check via API for accuracy.
 */
export function usePremium() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [isPremium, setIsPremium] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      setIsPremium(false);
      setIsLoading(false);
      return;
    }

    // Check premium status via server
    async function checkPremium() {
      try {
        const token = await getToken();
        const res = await fetch("/api/premium", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const data = await res.json();
          setIsPremium(data.isPremium ?? false);
        }
      } catch {
        setIsPremium(false);
      } finally {
        setIsLoading(false);
      }
    }

    checkPremium();
  }, [isLoaded, isSignedIn, getToken]);

  return { isPremium, isLoading, isLoaded: isLoaded && !isLoading };
}
