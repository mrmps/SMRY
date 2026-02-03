"use client";

import { cn } from "@/lib/utils";

export interface Suggestion {
  text: string;
  id?: string;
}

interface ChatSuggestionsProps {
  suggestions: Suggestion[];
  onSuggestionClick: (suggestion: string) => void;
  title?: string;
  className?: string;
}

export function ChatSuggestions({
  suggestions,
  onSuggestionClick,
  title = "Suggestions",
  className,
}: ChatSuggestionsProps) {
  if (!suggestions || suggestions.length === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <div className="space-y-1">
        {suggestions.map((suggestion, index) => (
          <button
            key={suggestion.id || index}
            type="button"
            onClick={() => onSuggestionClick(suggestion.text)}
            className={cn(
              "block w-full text-left",
              "text-sm font-medium text-primary",
              "py-1.5 px-0",
              "hover:underline hover:underline-offset-2",
              "transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded"
            )}
          >
            {suggestion.text}
          </button>
        ))}
      </div>
    </div>
  );
}
