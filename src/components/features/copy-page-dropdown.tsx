"use client";

import React, { useState } from "react";
import { Check, Copy, ChevronDown, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Menu,
  MenuTrigger,
  MenuPopup,
  MenuItem,
  MenuSeparator,
  MenuCheckboxItem,
  MenuGroupLabel,
} from "@/components/ui/menu";

// AI Service Icons
const OpenAIIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M21.55 10.004a5.416 5.416 0 00-.478-4.501c-1.217-2.09-3.662-3.166-6.05-2.66A5.59 5.59 0 0010.831 1C8.39.995 6.224 2.546 5.473 4.838A5.553 5.553 0 001.76 7.496a5.487 5.487 0 00.691 6.5 5.416 5.416 0 00.477 4.502c1.217 2.09 3.662 3.165 6.05 2.66A5.586 5.586 0 0013.168 23c2.443.006 4.61-1.546 5.361-3.84a5.553 5.553 0 003.715-2.66 5.488 5.488 0 00-.693-6.497v.001zm-8.381 11.558a4.199 4.199 0 01-2.675-.954c.034-.018.093-.05.132-.074l4.44-2.53a.71.71 0 00.364-.623v-6.176l1.877 1.069c.02.01.033.029.036.05v5.115c-.003 2.274-1.87 4.118-4.174 4.123zM4.192 17.78a4.059 4.059 0 01-.498-2.763c.032.02.09.055.131.078l4.44 2.53c.225.13.504.13.73 0l5.42-3.088v2.138a.068.068 0 01-.027.057L9.9 19.288c-1.999 1.136-4.552.46-5.707-1.51h-.001zM3.023 8.216A4.15 4.15 0 015.198 6.41l-.002.151v5.06a.711.711 0 00.364.624l5.42 3.087-1.876 1.07a.067.067 0 01-.063.005l-4.489-2.559c-1.995-1.14-2.679-3.658-1.53-5.63h.001zm15.417 3.54l-5.42-3.088L14.896 7.6a.067.067 0 01.063-.006l4.489 2.557c1.998 1.14 2.683 3.662 1.529 5.633a4.163 4.163 0 01-2.174 1.807V12.38a.71.71 0 00-.363-.623zm1.867-2.773a6.04 6.04 0 00-.132-.078l-4.44-2.53a.731.731 0 00-.729 0l-5.42 3.088V7.325a.068.068 0 01.027-.057L14.1 4.713c2-1.137 4.555-.46 5.707 1.513.487.833.664 1.809.499 2.757h.001zm-11.741 3.81l-1.877-1.068a.065.065 0 01-.036-.051V6.559c.001-2.277 1.873-4.122 4.181-4.12.976 0 1.92.338 2.671.954-.034.018-.092.05-.131.073l-4.44 2.53a.71.71 0 00-.365.623l-.003 6.173v.002zm1.02-2.168L12 9.25l2.414 1.375v2.75L12 14.75l-2.415-1.375v-2.75z" />
  </svg>
);

const ClaudeIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M13.827 3.52h3.603L24 20h-3.603l-6.57-16.48zm-7.258 0h3.767L16.906 20h-3.674l-1.343-3.461H5.017l-1.344 3.46H0L6.57 3.522zm4.132 9.959L8.453 7.687 6.205 13.48H10.7z" />
  </svg>
);

interface Source {
  url: string;
  title: string;
  content?: string;
}

interface CopyPageDropdownProps {
  url: string;
  articleTitle?: string;
  articleContent?: string;
  textContent?: string;
  sources?: Source[];
  source?: string;
  viewMode?: string;
  className?: string;
  /** Use "icon" for mobile-friendly compact trigger */
  triggerVariant?: "default" | "icon";
}

export function CopyPageDropdown({
  url,
  articleTitle = "Article",
  textContent,
  sources = [],
  source,
  className,
  triggerVariant = "default",
}: CopyPageDropdownProps) {
  const [copied, setCopied] = useState(false);
  const [selectedSources, setSelectedSources] = useState<Set<number>>(
    new Set(sources.map((_, i) => i))
  );

  // Generate markdown content
  const generateMarkdown = (includeContent = true) => {
    let markdown = `# ${articleTitle}\n\n`;
    markdown += `**Source:** ${url}\n\n`;

    if (includeContent && textContent) {
      markdown += `---\n\n${textContent}\n\n`;
    }

    if (sources.length > 0) {
      markdown += `## Sources\n\n`;
      sources.forEach((source, index) => {
        if (selectedSources.has(index)) {
          markdown += `- [${source.title}](${source.url})\n`;
        }
      });
    }

    return markdown;
  };

  const handleCopy = async () => {
    try {
      const markdown = generateMarkdown();
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const handleOpenInAI = (service: "chatgpt" | "claude") => {
    // Build the smry.ai proxy URL with query parameters
    const proxyUrlObj = new URL("https://www.smry.ai/proxy");
    proxyUrlObj.searchParams.set("url", url);
    
    if (source) {
      proxyUrlObj.searchParams.set("source", source);
    }
    const smryUrl = proxyUrlObj.toString();
    
    let aiUrl: string;
    switch (service) {
      case "chatgpt": {
        const chatgptPrompt = `Read from '${smryUrl}' so I can ask questions about it.`;
        aiUrl = `https://chatgpt.com/?hints=search&prompt=${encodeURIComponent(chatgptPrompt)}`;
        break;
      }
      case "claude": {
        const claudePrompt = `Read from '${smryUrl}' so I can ask questions about it.`;
        aiUrl = `https://claude.ai/new?q=${encodeURIComponent(claudePrompt)}`;
        break;
      }
    }

    window.open(aiUrl, "_blank", "noopener,noreferrer");
  };

  const toggleSource = (index: number) => {
    setSelectedSources((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const selectAllSources = () => {
    setSelectedSources(new Set(sources.map((_, i) => i)));
  };

  const deselectAllSources = () => {
    setSelectedSources(new Set());
  };

  // Icon-only variant for mobile
  if (triggerVariant === "icon") {
    return (
      <Menu>
        <MenuTrigger
          render={(props) => {
            const { key, ...rest } = props as typeof props & { key?: React.Key };
            return (
              <Button
                key={key}
                {...rest}
                variant="ghost"
                size="icon"
                className={cn("h-8 w-8 text-muted-foreground hover:text-foreground", className)}
              >
                {copied ? (
                  <Check className="size-4 text-green-600" />
                ) : (
                  <Copy className="size-4" />
                )}
              </Button>
            );
          }}
        />
        <MenuPopup side="bottom" align="end" className="w-64">
          {/* Copy Option */}
          <MenuItem
            onClick={() => void handleCopy()}
            className="flex items-center gap-3 p-2 cursor-pointer"
          >
            <div className="flex size-8 items-center justify-center rounded-lg border border-border bg-muted/50">
              <Copy className="size-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium">Copy page</span>
              <span className="text-xs text-muted-foreground">
                Copy as Markdown for LLMs
              </span>
            </div>
            {copied && <Check className="ml-auto size-4 text-green-600" />}
          </MenuItem>

          <MenuSeparator />

          {/* AI Services */}
          <MenuItem
            onClick={() => handleOpenInAI("chatgpt")}
            className="flex items-center gap-3 p-2 cursor-pointer"
          >
            <div className="flex size-8 items-center justify-center rounded-lg border border-border bg-muted/50">
              <OpenAIIcon className="size-4" />
            </div>
            <div className="flex flex-1 flex-col">
              <span className="flex items-center gap-1 text-sm font-medium">
                Open in ChatGPT
                <ArrowUpRight className="size-3 text-muted-foreground" />
              </span>
              <span className="text-xs text-muted-foreground">
                Ask questions about this page
              </span>
            </div>
          </MenuItem>

          <MenuItem
            onClick={() => handleOpenInAI("claude")}
            className="flex items-center gap-3 p-2 cursor-pointer"
          >
            <div className="flex size-8 items-center justify-center rounded-lg border border-border bg-muted/50">
              <ClaudeIcon className="size-4" />
            </div>
            <div className="flex flex-1 flex-col">
              <span className="flex items-center gap-1 text-sm font-medium">
                Open in Claude
                <ArrowUpRight className="size-3 text-muted-foreground" />
              </span>
              <span className="text-xs text-muted-foreground">
                Ask questions about this page
              </span>
            </div>
          </MenuItem>

          {/* Source Selection (if sources available) */}
          {sources.length > 0 && (
            <>
              <MenuSeparator />
              <MenuGroupLabel className="flex items-center justify-between">
                <span>Include sources</span>
                <div className="flex gap-1">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      selectAllSources();
                    }}
                    className="text-[10px] text-primary hover:underline"
                  >
                    All
                  </button>
                  <span className="text-muted-foreground">/</span>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      deselectAllSources();
                    }}
                    className="text-[10px] text-primary hover:underline"
                  >
                    None
                  </button>
                </div>
              </MenuGroupLabel>
              <div className="max-h-32 overflow-y-auto px-1">
                {sources.map((source, index) => (
                  <MenuCheckboxItem
                    key={index}
                    checked={selectedSources.has(index)}
                    onCheckedChange={() => toggleSource(index)}
                    className="text-xs"
                  >
                    <span className="truncate">{source.title}</span>
                  </MenuCheckboxItem>
                ))}
              </div>
            </>
          )}
        </MenuPopup>
      </Menu>
    );
  }

  // Default split-button variant
  return (
    <div className={cn("flex items-center", className)}>
      {/* Split Button Container with shared border */}
      <div className="flex items-center rounded-lg border border-input bg-background shadow-sm">
        {/* Main Copy Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void handleCopy()}
          className="h-8 rounded-r-none border-0 gap-1.5 text-xs font-medium hover:bg-accent"
        >
          {copied ? (
            <Check className="size-3.5 text-green-600" />
          ) : (
            <Copy className="size-3.5" />
          )}
          {copied ? "Copied" : "Copy page"}
        </Button>

        {/* Divider */}
        <div className="h-5 w-px bg-input" />

        {/* Dropdown Trigger */}
        <Menu>
          <MenuTrigger
            render={(props) => {
              const { key, ...rest } = props as typeof props & { key?: React.Key };
              return (
                <Button
                  key={key}
                  {...rest}
                  variant="ghost"
                  size="sm"
                  className="h-8 rounded-l-none border-0 px-2 hover:bg-accent"
                >
                  <ChevronDown className="size-3.5" />
                </Button>
              );
            }}
          />
          <MenuPopup side="bottom" align="end" className="w-64">
            {/* Copy Option */}
            <MenuItem
              onClick={() => void handleCopy()}
              className="flex items-center gap-3 p-2 cursor-pointer"
            >
              <div className="flex size-8 items-center justify-center rounded-lg border border-border bg-muted/50">
                <Copy className="size-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium">Copy page</span>
                <span className="text-xs text-muted-foreground">
                  Copy as Markdown for LLMs
                </span>
              </div>
              {copied && <Check className="ml-auto size-4 text-green-600" />}
            </MenuItem>

            <MenuSeparator />

            {/* AI Services */}
            <MenuItem
              onClick={() => handleOpenInAI("chatgpt")}
              className="flex items-center gap-3 p-2 cursor-pointer"
            >
              <div className="flex size-8 items-center justify-center rounded-lg border border-border bg-muted/50">
                <OpenAIIcon className="size-4" />
              </div>
              <div className="flex flex-1 flex-col">
                <span className="flex items-center gap-1 text-sm font-medium">
                  Open in ChatGPT
                  <ArrowUpRight className="size-3 text-muted-foreground" />
                </span>
                <span className="text-xs text-muted-foreground">
                  Ask questions about this page
                </span>
              </div>
            </MenuItem>

            <MenuItem
              onClick={() => handleOpenInAI("claude")}
              className="flex items-center gap-3 p-2 cursor-pointer"
            >
              <div className="flex size-8 items-center justify-center rounded-lg border border-border bg-muted/50">
                <ClaudeIcon className="size-4" />
              </div>
              <div className="flex flex-1 flex-col">
                <span className="flex items-center gap-1 text-sm font-medium">
                  Open in Claude
                  <ArrowUpRight className="size-3 text-muted-foreground" />
                </span>
                <span className="text-xs text-muted-foreground">
                  Ask questions about this page
                </span>
              </div>
            </MenuItem>

            {/* Source Selection (if sources available) */}
            {sources.length > 0 && (
              <>
                <MenuSeparator />
                <MenuGroupLabel className="flex items-center justify-between">
                  <span>Include sources</span>
                  <div className="flex gap-1">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        selectAllSources();
                      }}
                      className="text-[10px] text-primary hover:underline"
                    >
                      All
                    </button>
                    <span className="text-muted-foreground">/</span>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        deselectAllSources();
                      }}
                      className="text-[10px] text-primary hover:underline"
                    >
                      None
                    </button>
                  </div>
                </MenuGroupLabel>
                <div className="max-h-32 overflow-y-auto px-1">
                  {sources.map((source, index) => (
                    <MenuCheckboxItem
                      key={index}
                      checked={selectedSources.has(index)}
                      onCheckedChange={() => toggleSource(index)}
                      className="text-xs"
                    >
                      <span className="truncate">{source.title}</span>
                    </MenuCheckboxItem>
                  ))}
                </div>
              </>
            )}
          </MenuPopup>
        </Menu>
      </div>
    </div>
  );
}

export default CopyPageDropdown;
