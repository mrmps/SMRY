"use client";

import { cn } from "@/lib/utils";
import { ArrowRight } from "@/components/ui/icons";

export interface Suggestion {
  text: string;
  id?: string;
}

interface ChatSuggestionsProps {
  suggestions: Suggestion[];
  onSuggestionClick: (suggestion: string) => void;
  title?: string;
  className?: string;
  /** Variant style - 'default' shows as pills, 'list' shows as a simple list */
  variant?: "default" | "list";
}

export function ChatSuggestions({
  suggestions,
  onSuggestionClick,
  title,
  className,
  variant = "default",
}: ChatSuggestionsProps) {
  if (!suggestions || suggestions.length === 0) {
    return null;
  }

  if (variant === "list") {
    return (
      <div className={cn("space-y-1", className)}>
        {title && (
          <p className="text-xs font-medium text-muted-foreground/70 mb-2">{title}</p>
        )}
        {suggestions.map((suggestion, index) => (
          <button
            key={suggestion.id || index}
            type="button"
            onClick={() => onSuggestionClick(suggestion.text)}
            className={cn(
              "group flex w-full items-center gap-2 text-left",
              "text-sm text-muted-foreground",
              // 44px minimum touch target per iOS HIG
              "min-h-[44px] py-2.5 px-1",
              "hover:text-foreground active:bg-muted/30",
              "transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-lg"
            )}
            style={{ touchAction: "manipulation" }}
          >
            <ArrowRight className="size-3 opacity-0 -ml-5 group-hover:opacity-100 group-hover:ml-0 transition-all duration-200" />
            <span>{suggestion.text}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {title && (
        <p className="text-xs font-medium text-muted-foreground/70">{title}</p>
      )}
      <div className="flex flex-wrap gap-2">
        {suggestions.map((suggestion, index) => (
          <button
            key={suggestion.id || index}
            type="button"
            onClick={() => onSuggestionClick(suggestion.text)}
            className={cn(
              "inline-flex items-center",
              "text-[14px] text-foreground/80",
              // 44px minimum touch target per iOS HIG / WCAG 2.2
              "min-h-[44px] px-4 py-2.5",
              "bg-muted/40 hover:bg-muted/60 active:bg-muted/80",
              "border border-border/50 hover:border-border/70",
              "rounded-full",
              "transition-all duration-150",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            )}
            style={{ touchAction: "manipulation" }}
          >
            {suggestion.text}
          </button>
        ))}
      </div>
    </div>
  );
}
