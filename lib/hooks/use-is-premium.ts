"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { useSyncExternalStore } from "react";

// Empty subscribe function - we don't need to subscribe to anything,
// we just use useSyncExternalStore for its hydration-safe behavior
const emptySubscribe = () => () => {};

// Test emails that get premium features in development
const DEV_PREMIUM_EMAILS = new Set([
  "kartik.labhshetwar@gmail.com",
]);

/**
 * Hook to check if user has premium using Clerk Billing
 * Returns stable values to prevent hydration mismatches
 *
 * Uses useSyncExternalStore to safely handle the SSR/client boundary
 * without causing cascading renders from useEffect + setState
 *
 * @returns { isPremium: boolean, isLoading: boolean }
 */
export function useIsPremium(): { isPremium: boolean, isLoading: boolean } {
  const { isLoaded, has } = useAuth();
  const { user } = useUser();

  // Returns true on client, false during SSR - prevents hydration mismatch
  const isClient = useSyncExternalStore(
    emptySubscribe,
    () => true,  // Client snapshot
    () => false  // Server snapshot
  );

  // Check if user email is in dev premium list (only in development)
  const isDevPremium = process.env.NODE_ENV === "development" &&
    user?.primaryEmailAddress?.emailAddress &&
    DEV_PREMIUM_EMAILS.has(user.primaryEmailAddress.emailAddress);

  // Only trust premium status after client hydration and auth is loaded
  const isPremium = isClient && isLoaded && (isDevPremium || (has?.({ plan: "premium" }) ?? false));
  const isLoading = !isClient || !isLoaded;

  return { isPremium, isLoading };
}

