"use client";

import { useSyncExternalStore } from "react";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import { useIsPremium } from "@/lib/hooks/use-is-premium";
import { buildUrlWithReturn, storeReturnUrl } from "@/lib/hooks/use-return-url";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

// Empty subscribe function for useSyncExternalStore
const emptySubscribe = () => () => {};

// Hook to detect client-side hydration safely
function useIsClient() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

interface AuthBarProps {
  /** Size variant for different contexts */
  variant?: "default" | "compact";
  /** Show the "No Ads" or "Upgrade" link for non-premium users */
  showUpgrade?: boolean;
  /** Show the golden "Get Pro" button for signed-out users */
  showGetPro?: boolean;
  /** Show the "Sign In" button for signed-out users */
  showSignIn?: boolean;
  /** Custom class name */
  className?: string;
}

/**
 * Unified auth bar component for consistent auth UI across the app.
 *
 * States:
 * - Loading: Shows skeleton
 * - Signed out: "Sign In" button + "Get Pro" link
 * - Signed in (free): "Upgrade" link + UserButton
 * - Signed in (premium): Just UserButton
 */
export function AuthBar({
  variant = "default",
  showUpgrade = true,
  showGetPro = true,
  showSignIn = true,
  className
}: AuthBarProps) {
  const isClient = useIsClient();
  const { isPremium, isLoading } = useIsPremium();

  const isCompact = variant === "compact";
  const avatarSize = isCompact ? "size-7" : "size-9";

  // Build the auth redirect URL with return URL for server-side premium check
  // This allows the /auth/redirect page to know where to send the user back
  const authRedirectUrl = isClient
    ? buildUrlWithReturn("/auth/redirect")
    : "/auth/redirect";

  // Don't render anything server-side to prevent hydration mismatch
  if (!isClient) {
    return <div className={cn("flex items-center gap-2", className)} />;
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <SignedIn>
        {/* Upgrade link for non-premium users */}
        {showUpgrade && !isLoading && !isPremium && (
          <Link
            href="/pricing"
            className={cn(
              "inline-flex items-center gap-1.5 font-medium transition-colors",
              "text-foreground hover:text-muted-foreground",
              isCompact ? "text-xs px-2 py-1" : "text-sm"
            )}
          >
            Upgrade
          </Link>
        )}
        <UserButton
          appearance={{
            elements: {
              avatarBox: avatarSize,
            },
          }}
        />
      </SignedIn>

      <SignedOut>
        {/* Sign In button - redirects to /auth/redirect for server-side premium check */}
        {showSignIn && (
          <SignInButton
            mode="modal"
            fallbackRedirectUrl={authRedirectUrl}
          >
            <button
              className={cn(
                "font-medium transition-colors",
                "text-muted-foreground hover:text-foreground",
                isCompact ? "text-xs" : "text-sm"
              )}
            >
              Sign In
            </button>
          </SignInButton>
        )}

        {/* Get Pro link */}
        {showGetPro && (
          <Link
            href="/pricing"
            onClick={() => storeReturnUrl()}
            className={cn(
              "group relative font-semibold rounded-full overflow-hidden transition-all",
              "bg-linear-to-r from-amber-400 via-yellow-300 to-amber-400 bg-[length:200%_100%]",
              "text-black shadow-[0_0_12px_rgba(251,191,36,0.3)]",
              "hover:shadow-[0_0_20px_rgba(251,191,36,0.5)] hover:scale-105",
              "active:scale-95",
              "animate-[shimmer_2.5s_ease-in-out_infinite]",
              isCompact
                ? "px-2.5 py-0.5 text-xs"
                : "px-3.5 py-1.5 text-sm"
            )}
          >
            Get Pro
          </Link>
        )}
      </SignedOut>
    </div>
  );
}

/**
 * Simple "No Ads" / "Upgrade" link for non-premium users.
 * Shows nothing for premium users or while loading.
 */
export function UpgradeLink({ className }: { className?: string }) {
  const isClient = useIsClient();
  const { isPremium, isLoading } = useIsPremium();

  if (!isClient || isLoading || isPremium) {
    return null;
  }

  return (
    <Link
      href="/pricing"
      className={cn(
        "inline-flex items-center gap-1.5 text-sm font-medium",
        "text-foreground hover:text-muted-foreground transition-colors",
        className
      )}
    >
      No Ads
    </Link>
  );
}
