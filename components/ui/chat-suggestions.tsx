"use client";

import { cn } from "@/lib/utils";
import { CornerDownRight } from "@/components/ui/icons";

export interface Suggestion {
  text: string;
  id?: string;
}

interface ChatSuggestionsProps {
  suggestions: Suggestion[];
  onSuggestionClick: (suggestion: string) => void;
  title?: string;
  className?: string;
  /** Variant style - 'default' shows as clean list, 'pills' shows as rounded pill buttons */
  variant?: "default" | "pills";
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

  if (variant === "pills") {
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
                "min-h-[44px] px-4 py-2.5",
                "bg-muted/40 hover:bg-muted/60 active:bg-muted/80",
                "border border-border/50 hover:border-border/70",
                "rounded-full",
                "transition-colors",
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

  // Default: clean list style (matches Speechify-style suggestion UI)
  return (
    <div className={cn("flex flex-col", className)}>
      {title && (
        <p className="text-xs font-medium text-muted-foreground/50 mb-2 px-1">{title}</p>
      )}
      {suggestions.map((suggestion, index) => (
        <button
          key={suggestion.id || index}
          type="button"
          onClick={() => onSuggestionClick(suggestion.text)}
          className={cn(
            "flex w-full items-center gap-3 text-left",
            "min-h-[44px] py-2.5 px-1",
            "text-[15px] text-foreground/60 hover:text-foreground/90",
            "active:opacity-70 transition-colors",
            "focus:outline-none"
          )}
          style={{ touchAction: "manipulation" }}
        >
          <CornerDownRight className="size-3.5 shrink-0 text-muted-foreground/40" />
          <span>{suggestion.text}</span>
        </button>
      ))}
    </div>
  );
}
