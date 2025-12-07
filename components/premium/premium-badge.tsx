"use client";

import { Crown } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { cn } from "@/lib/utils";

interface PremiumBadgeProps {
  className?: string;
  showLabel?: boolean;
}

export function PremiumBadge({ className, showLabel = true }: PremiumBadgeProps) {
  const { isLoaded, has } = useAuth();

  if (!isLoaded) {
    return null;
  }

  // Use Clerk Billing's has() to check for premium plan
  const isPremium = has?.({ plan: "premium" }) ?? false;

  if (!isPremium) {
    return null;
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
        className
      )}
    >
      <Crown className="size-3" />
      {showLabel && <span>Premium</span>}
    </div>
  );
}
