"use client";

import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipTrigger,
  TooltipPopup,
} from "@/components/ui/tooltip";
import type { BypassStatus } from "@/types/api";

interface PaywallIndicatorProps {
  status: BypassStatus | null;
  isLoading: boolean;
  hasError?: boolean;
  className?: string;
}

const STATUS_CONFIG: Record<
  BypassStatus,
  { icon: string; color: string; tooltip: string }
> = {
  bypassed: {
    icon: "✓",
    color: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400",
    tooltip: "Complete article",
  },
  uncertain: {
    icon: "?",
    color: "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400",
    tooltip: "Unable to determine completeness",
  },
  blocked: {
    icon: "🔒",
    color: "bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400",
    tooltip: "Content appears truncated",
  },
};

export function PaywallIndicator({
  status,
  isLoading,
  hasError,
  className,
}: PaywallIndicatorProps) {
  if (isLoading) {
    return (
      <Tooltip>
        <TooltipTrigger
          render={<span />}
          className={cn(
            "inline-flex h-4 sm:h-5 min-w-4 sm:min-w-5 items-center justify-center",
            className
          )}
        >
          <span className="size-2 animate-pulse rounded-full bg-muted-foreground" />
        </TooltipTrigger>
        <TooltipPopup>Analyzing...</TooltipPopup>
      </Tooltip>
    );
  }

  if (hasError) {
    return (
      <Tooltip>
        <TooltipTrigger
          render={<span />}
          className={cn(
            "inline-flex h-4 sm:h-5 min-w-4 sm:min-w-5 items-center justify-center rounded-md sm:rounded-lg px-1 text-[9px] sm:text-[10px] font-semibold transition-colors cursor-help",
            "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
            className
          )}
        >
          !
        </TooltipTrigger>
        <TooltipPopup>Analysis failed</TooltipPopup>
      </Tooltip>
    );
  }

  if (!status) return null;

  const config = STATUS_CONFIG[status];

  return (
    <Tooltip>
      <TooltipTrigger
        render={<span />}
        className={cn(
          "inline-flex h-4 sm:h-5 min-w-4 sm:min-w-5 items-center justify-center rounded-md sm:rounded-lg px-1 text-[9px] sm:text-[10px] font-semibold transition-colors cursor-help",
          config.color,
          className
        )}
      >
        {config.icon}
      </TooltipTrigger>
      <TooltipPopup>{config.tooltip}</TooltipPopup>
    </Tooltip>
  );
}
