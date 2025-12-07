"use client";

import { useAuth } from "@clerk/nextjs";
import { useState, useEffect } from "react";

/**
 * Hook to check if user has premium using Clerk Billing
 * Returns stable values to prevent hydration mismatches
 * 
 * @returns { isPremium: boolean, isLoading: boolean }
 */
export function useIsPremium() {
  const { isLoaded, has } = useAuth();
  // Track if we've done the initial client-side check to avoid hydration mismatch
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    if (isLoaded && !hasChecked) {
      setHasChecked(true);
    }
  }, [isLoaded, hasChecked]);

  // Only trust premium status after initial client check
  const isPremium = hasChecked && (has?.({ plan: "premium" }) ?? false);
  const isLoading = !hasChecked;

  return { isPremium, isLoading };
}

