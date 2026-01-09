'use client';

import { ClerkProvider as BaseClerkProvider } from '@clerk/nextjs';
import { ReactNode } from 'react';

const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

interface SafeClerkProviderProps {
  children: ReactNode;
}

/**
 * Safe Clerk Provider that handles missing publishable key during SSG builds.
 * During Docker builds, the env var may not be available, so we render children
 * without Clerk wrapper to allow static generation to complete.
 */
export function SafeClerkProvider({ children }: SafeClerkProviderProps) {
  // During SSG/build time, the key might not be available
  // In that case, render children without Clerk to allow build to complete
  if (!PUBLISHABLE_KEY) {
    return <>{children}</>;
  }

  return (
    <BaseClerkProvider publishableKey={PUBLISHABLE_KEY}>
      {children}
    </BaseClerkProvider>
  );
}
