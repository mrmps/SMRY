"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  FileText,
  ListChecks,
  Info,
  BookOpen,
  Languages,
  type LucideIcon,
} from "@/components/ui/icons";

export interface SlashCommand {
  command: string;
  label: string;
  description: string;
  prompt: string;
  icon: LucideIcon;
  hasArgument?: boolean;
  argumentPlaceholder?: string;
}

export const DEFAULT_SLASH_COMMANDS: SlashCommand[] = [
  {
    command: "/summarize",
    label: "Summarize",
    description: "Get the main point in 2-3 sentences",
    prompt: "What is the main point of this article? Answer in 2-3 sentences.",
    icon: FileText,
  },
  {
    command: "/keypoints",
    label: "Key Points",
    description: "Top 3 takeaways",
    prompt: "List the top 3 key takeaways from this article.",
    icon: ListChecks,
  },
  {
    command: "/facts",
    label: "Surprising Facts",
    description: "Any surprising or notable facts",
    prompt: "What are 2-3 surprising or notable facts from this article?",
    icon: Info,
  },
  {
    command: "/explain",
    label: "Explain Simply",
    description: "What is this article about?",
    prompt: "In simple terms, what is this article about?",
    icon: BookOpen,
  },
  {
    command: "/translate",
    label: "Translate",
    description: "Translate the main point to a language",
    prompt: "Translate the main point of this article to",
    icon: Languages,
    hasArgument: true,
    argumentPlaceholder: "[language]",
  },
];

interface SlashCommandsProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (command: SlashCommand) => void;
  filter?: string;
  commands?: SlashCommand[];
  selectedIndex: number;
  onSelectedIndexChange: (index: number) => void;
  position?: { top?: number; bottom?: number; left?: number };
  className?: string;
}

export function SlashCommands({
  isOpen,
  onClose: _onClose,
  onSelect,
  filter = "",
  commands = DEFAULT_SLASH_COMMANDS,
  selectedIndex,
  onSelectedIndexChange,
  className,
}: SlashCommandsProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Filter commands based on input
  const filteredCommands = commands.filter((cmd) => {
    const searchTerm = filter.toLowerCase().replace("/", "");
    return (
      cmd.command.toLowerCase().includes(searchTerm) ||
      cmd.label.toLowerCase().includes(searchTerm)
    );
  });

  // Scroll selected item into view — instant, no animation
  useEffect(() => {
    if (isOpen && itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex]?.scrollIntoView({
        block: "nearest",
        behavior: "instant",
      });
    }
  }, [selectedIndex, isOpen]);

  if (!isOpen || filteredCommands.length === 0) {
    return null;
  }

  return (
    <div
      ref={listRef}
      className={cn(
        "max-h-[200px] overflow-y-auto",
        className
      )}
      role="listbox"
      aria-label="Slash commands"
    >
      <div className="py-1.5 flex flex-col">
        {filteredCommands.map((cmd, index) => {
          const Icon = cmd.icon;
          const isSelected = index === selectedIndex;

          return (
            <button
              key={cmd.command}
              ref={(el) => {
                itemRefs.current[index] = el;
              }}
              type="button"
              role="option"
              aria-selected={isSelected}
              onClick={() => onSelect(cmd)}
              onMouseEnter={() => onSelectedIndexChange(index)}
              className={cn(
                "flex w-full items-center gap-1.5 rounded-[10px] px-2 py-[7px] text-left",
                "cursor-pointer outline-none text-[13px]",
                isSelected
                  ? "bg-muted/80"
                  : "hover:bg-muted/50 active:bg-muted/70"
              )}
            >
              <span className="flex-shrink-0 w-[13px] h-[13px] flex items-center justify-center">
                <Icon className="size-[13px] text-muted-foreground" />
              </span>
              <span className="text-foreground/85 truncate min-w-0 flex-1">
                {cmd.command}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface UseSlashCommandsOptions {
  input: string;
  onSendMessage: (message: string) => void;
  onInputChange: (value: string) => void;
  commands?: SlashCommand[];
}

export function useSlashCommands({
  input,
  onSendMessage,
  onInputChange,
  commands = DEFAULT_SLASH_COMMANDS,
}: UseSlashCommandsOptions) {
  // Determine if slash menu should be open
  const shouldShowMenu = input.startsWith("/") && !input.includes(" ");

  // Get filter string (the part after "/")
  const filter = shouldShowMenu ? input : "";

  // Filter commands - memoize to avoid recalculation
  const filteredCommands = React.useMemo(() => {
    const searchTerm = filter.toLowerCase().replace("/", "");
    return commands.filter((cmd) =>
      cmd.command.toLowerCase().includes(searchTerm) ||
      cmd.label.toLowerCase().includes(searchTerm)
    );
  }, [filter, commands]);

  // Derive isOpen state - show menu when there's a slash at start without space
  const isOpen = shouldShowMenu && filteredCommands.length > 0;

  // Selected index state - managed by parent through callbacks
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Ensure selected index is within bounds
  const safeSelectedIndex = Math.min(selectedIndex, Math.max(0, filteredCommands.length - 1));

  // Reset selection when filter changes
  // This is intentional - we want to reset selection when the user changes their search
  const filterRef = useRef(filter);
  useEffect(() => {
    if (filterRef.current !== filter) {
      filterRef.current = filter;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional: reset index when filter changes
      setSelectedIndex(0);
    }
  }, [filter, setSelectedIndex]);

  const handleClose = useCallback(() => {
    // Close by clearing input
    onInputChange("");
  }, [onInputChange]);

  const handleSelect = useCallback(
    (command: SlashCommand) => {
      if (command.hasArgument) {
        // For commands with arguments, insert the command and let user complete it
        // The menu will close automatically because input will have a space
        onInputChange(`${command.command} `);
      } else {
        // For simple commands, send immediately
        // The menu will close because input becomes empty
        onSendMessage(command.prompt);
        onInputChange("");
      }
    },
    [onSendMessage, onInputChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (!isOpen) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < filteredCommands.length - 1 ? prev + 1 : 0
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : filteredCommands.length - 1
          );
          break;
        case "Enter":
          if (!e.shiftKey && filteredCommands[safeSelectedIndex]) {
            e.preventDefault();
            handleSelect(filteredCommands[safeSelectedIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          handleClose();
          break;
        case "Tab":
          if (filteredCommands[safeSelectedIndex]) {
            e.preventDefault();
            handleSelect(filteredCommands[safeSelectedIndex]);
          }
          break;
      }
    },
    [isOpen, filteredCommands, safeSelectedIndex, handleSelect, handleClose]
  );

  return {
    isOpen,
    filter,
    selectedIndex: safeSelectedIndex,
    filteredCommands,
    handleClose,
    handleSelect,
    handleKeyDown,
    setSelectedIndex,
  };
}
