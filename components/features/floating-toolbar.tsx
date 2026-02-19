"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  FileText,
  MonitorPlay,
  Navigation04,
  History,
  Settings,
  MoreHorizontal,
  Copy,
  Check,
  Bug,
  ArrowUpRight,
} from "@/components/ui/icons";
import { Link } from "@/i18n/navigation";
import { usePremium } from "@/lib/hooks/use-premium";
import { FeedbackIcon } from "@/components/ui/custom-icons";
import { Kbd } from "@/components/ui/kbd";
import ShareButton from "@/components/features/share-button";
import { ReaderSettingsPopover } from "@/components/features/reader-settings-popover";
import { OpenAIIcon, ClaudeIcon } from "@/components/features/copy-page-dropdown";
import {
  Menu,
  MenuTrigger,
  MenuPopup,
  MenuItem,
  MenuSeparator,
} from "@/components/ui/menu";
import { Source } from "@/types/api";

interface TooltipProps {
  label: string;
  shortcut?: string;
  children: React.ReactNode;
}

function Tooltip({ label, shortcut, children }: TooltipProps) {
  const [show, setShow] = React.useState(false);

  return (
    <div
      className="relative"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div
          className={cn(
            "absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50",
            "flex items-center gap-2 px-2.5 py-1.5 rounded-lg",
            "bg-popover text-popover-foreground shadow-md border border-border/50",
            "text-xs font-medium whitespace-nowrap",
            "animate-in fade-in-0 zoom-in-95 duration-100"
          )}
        >
          <span>{label}</span>
          {shortcut && (
            <Kbd className="text-[10px] px-1.5 py-0.5">{shortcut}</Kbd>
          )}
        </div>
      )}
    </div>
  );
}

interface ToolbarButtonProps {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  onClick?: () => void;
  isActive?: boolean;
  className?: string;
}

function ToolbarButton({
  icon,
  label,
  shortcut,
  onClick,
  isActive,
  className,
}: ToolbarButtonProps) {
  return (
    <Tooltip label={label} shortcut={shortcut}>
      <button
        onClick={onClick}
        className={cn(
          "size-10 flex items-center justify-center rounded-lg transition-all duration-150",
          "hover:bg-accent hover:text-accent-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "active:scale-95",
          isActive
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground",
          className
        )}
        aria-label={label}
      >
        {icon}
      </button>
    </Tooltip>
  );
}

// View mode indicator icons
const viewModeIcons = {
  markdown: BookOpen,
  html: FileText,
  iframe: MonitorPlay,
} as const;

const viewModeLabels = {
  markdown: "Reader",
  html: "Original",
  iframe: "Frame",
} as const;

interface FloatingToolbarProps {
  viewMode: "markdown" | "html" | "iframe";
  onViewModeChange: (mode: "markdown" | "html" | "iframe") => void;
  originalUrl: string;
  shareUrl: string;
  articleTitle?: string;
  articleTextContent?: string;
  source: Source;
  sidebarOpen: boolean;
  onOpenSettings: () => void;
  styleOptionsOpen?: boolean;
  onStyleOptionsOpenChange?: (open: boolean) => void;
  shareOpen?: boolean;
  onShareOpenChange?: (open: boolean) => void;
}

export function FloatingToolbar({
  viewMode,
  onViewModeChange,
  originalUrl,
  shareUrl,
  articleTitle,
  articleTextContent,
  source,
  sidebarOpen,
  onOpenSettings,
  styleOptionsOpen,
  onStyleOptionsOpenChange,
  shareOpen,
  onShareOpenChange,
}: FloatingToolbarProps) {
  const [copied, setCopied] = React.useState(false);
  const { isPremium } = usePremium();

  // Cycle through view modes
  const cycleViewMode = () => {
    const modes: Array<"markdown" | "html" | "iframe"> = ["markdown", "html", "iframe"];
    const currentIndex = modes.indexOf(viewMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    onViewModeChange(modes[nextIndex]);
  };

  // Open original URL
  const openOriginal = () => {
    window.open(originalUrl, "_blank", "noopener,noreferrer");
  };

  // Copy page content
  const handleCopyPage = async () => {
    try {
      let markdown = `# ${articleTitle || "Article"}\n\n`;
      markdown += `**Source:** ${originalUrl}\n\n`;
      if (articleTextContent) {
        markdown += `---\n\n${articleTextContent}\n\n`;
      }
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  // Open in AI
  const handleOpenInAI = (service: "chatgpt" | "claude") => {
    const proxyUrlObj = new URL("https://www.smry.ai/proxy");
    proxyUrlObj.searchParams.set("url", originalUrl);
    if (source) {
      proxyUrlObj.searchParams.set("source", source);
    }
    const smryUrl = proxyUrlObj.toString();
    let aiUrl: string;
    if (service === "chatgpt") {
      const prompt = `Read from '${smryUrl}' so I can ask questions about it.`;
      aiUrl = `https://chatgpt.com/?hints=search&prompt=${encodeURIComponent(prompt)}`;
    } else {
      const prompt = `Read from '${smryUrl}' so I can ask questions about it.`;
      aiUrl = `https://claude.ai/new?q=${encodeURIComponent(prompt)}`;
    }
    window.open(aiUrl, "_blank", "noopener,noreferrer");
  };

  const ViewModeIcon = viewModeIcons[viewMode];

  return (
    <div
      className={cn(
        "fixed z-40 hidden md:flex flex-col gap-1 p-1.5",
        "bg-background/80 backdrop-blur-xl border border-border/50 rounded-xl shadow-lg",
        "top-1/2 -translate-y-1/2 left-4"
      )}
    >
      {/* View Mode */}
      <Tooltip label={`View: ${viewModeLabels[viewMode]}`} shortcut="V">
        <button
          onClick={cycleViewMode}
          className={cn(
            "size-10 flex items-center justify-center rounded-lg transition-all duration-150",
            "hover:bg-accent hover:text-accent-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "active:scale-95",
            "text-foreground"
          )}
          aria-label={`Current view: ${viewModeLabels[viewMode]}. Press to cycle.`}
        >
          <ViewModeIcon className="size-5" />
        </button>
      </Tooltip>

      {/* Open Original */}
      <ToolbarButton
        icon={<Navigation04 className="size-5" />}
        label="Open original"
        shortcut="O"
        onClick={openOriginal}
      />

      {/* Share - using custom wrapper since ShareButton has its own trigger */}
      <Tooltip label="Share" shortcut="⇧S">
        <div className="size-10 flex items-center justify-center">
          <ShareButton
            url={shareUrl}
            originalUrl={originalUrl}
            source={source}
            viewMode={viewMode}
            sidebarOpen={sidebarOpen}
            articleTitle={articleTitle}
            triggerVariant="icon"
            open={shareOpen}
            onOpenChange={onShareOpenChange}
          />
        </div>
      </Tooltip>

      <div className="h-px bg-border/50 my-1" />

      {/* Reading History - direct link */}
      <Tooltip label="Reading History">
        <Link
          href="/history"
          className={cn(
            "size-10 flex items-center justify-center rounded-lg transition-all duration-150",
            "hover:bg-accent hover:text-accent-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "active:scale-95",
            "text-muted-foreground"
          )}
          aria-label="Reading History"
        >
          <History className="size-5" />
          {!isPremium && (
            <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-amber-500" />
          )}
        </Link>
      </Tooltip>

      <div className="h-px bg-border/50 my-1" />

      {/* Style Options/Reader Settings Popover */}
      <Tooltip label="Style Options" shortcut="S">
        <div>
          <ReaderSettingsPopover
            side="right"
            align="center"
            open={styleOptionsOpen}
            onOpenChange={onStyleOptionsOpenChange}
          />
        </div>
      </Tooltip>

      {/* Settings */}
      <ToolbarButton
        icon={<Settings className="size-5" />}
        label="Settings"
        shortcut=","
        onClick={onOpenSettings}
      />

      {/* More Menu */}
      <Menu>
        <MenuTrigger
          render={(props) => {
            const { key, ...rest } = props as typeof props & { key?: React.Key };
            return (
              <Tooltip label="More options" key={key}>
                <button
                  {...rest}
                  className={cn(
                    "size-10 flex items-center justify-center rounded-lg transition-all duration-150",
                    "hover:bg-accent hover:text-accent-foreground",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    "active:scale-95",
                    "text-muted-foreground"
                  )}
                  aria-label="More options"
                >
                  <MoreHorizontal className="size-5" />
                </button>
              </Tooltip>
            );
          }}
        />
        <MenuPopup side="right" align="start" className="min-w-[200px]">
          <MenuItem
            onClick={handleCopyPage}
            className="flex items-center gap-2 px-3"
          >
            {copied ? (
              <Check className="size-4 text-green-600" />
            ) : (
              <Copy className="size-4" />
            )}
            <span className="flex-1">{copied ? "Copied!" : "Copy page"}</span>
            <Kbd className="text-[10px] px-1.5 py-0.5">⌘C</Kbd>
          </MenuItem>
          <MenuItem
            onClick={() => handleOpenInAI("chatgpt")}
            className="flex items-center gap-2 px-3"
          >
            <OpenAIIcon className="size-4" />
            <span className="flex-1">Open in ChatGPT</span>
            <Kbd className="text-[10px] px-1.5 py-0.5">⌘⇧G</Kbd>
            <ArrowUpRight className="size-3 opacity-50 shrink-0" />
          </MenuItem>
          <MenuItem
            onClick={() => handleOpenInAI("claude")}
            className="flex items-center gap-2 px-3"
          >
            <ClaudeIcon className="size-4" />
            <span className="flex-1">Open in Claude</span>
            <Kbd className="text-[10px] px-1.5 py-0.5">⌘⇧A</Kbd>
            <ArrowUpRight className="size-3 opacity-50 shrink-0" />
          </MenuItem>
          <MenuSeparator />
          <MenuItem
            render={(props) => {
              const { key, className, ...rest } = props as typeof props & {
                key?: React.Key;
                className?: string;
              };
              return (
                <a
                  key={key}
                  {...rest}
                  href="https://smryai.userjot.com/"
                  target="_blank"
                  rel="noreferrer"
                  className={cn(className, "flex items-center gap-2 w-full px-3")}
                >
                  <Bug className="size-4" />
                  <span className="flex-1">Report Bug</span>
                </a>
              );
            }}
          />
          <MenuItem
            render={(props) => {
              const { key, className, ...rest } = props as typeof props & {
                key?: React.Key;
                className?: string;
              };
              return (
                <a
                  key={key}
                  {...rest}
                  href="https://smryai.userjot.com/"
                  target="_blank"
                  rel="noreferrer"
                  className={cn(className, "flex items-center gap-2 w-full px-3")}
                >
                  <FeedbackIcon className="size-4" />
                  <span className="flex-1">Send Feedback</span>
                </a>
              );
            }}
          />
        </MenuPopup>
      </Menu>
    </div>
  );
}
