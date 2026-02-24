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
  Bug,
  ArrowUpRight,
  Play,
  Loader2,
} from "@/components/ui/icons";
import { Link } from "@/i18n/navigation";
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
import type { ArticleExportData } from "@/components/features/export-article";

interface TooltipProps {
  label: string;
  shortcut?: string;
  children: React.ReactNode;
  disabled?: boolean;
}

function Tooltip({ label, shortcut, children, disabled }: TooltipProps) {
  const [show, setShow] = React.useState(false);

  React.useEffect(() => {
    if (disabled) setShow(false);
  }, [disabled]);

  return (
    <div
      className="relative"
      onMouseEnter={() => { if (!disabled) setShow(true); }}
      onMouseLeave={() => setShow(false)}
      onClick={() => setShow(false)}
    >
      {children}
      {show && !disabled && (
        <div
          className={cn(
            "absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50",
            "flex items-center gap-2 px-2.5 py-1.5 rounded-lg",
            "bg-popover text-popover-foreground shadow-md border border-border/50",
            "text-xs font-medium whitespace-nowrap",
            "animate-in fade-in-0 zoom-in-95 duration-100",
            "pointer-events-none"
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
  tooltipDisabled?: boolean;
}

function ToolbarButton({
  icon,
  label,
  shortcut,
  onClick,
  isActive,
  className,
  tooltipDisabled,
}: ToolbarButtonProps) {
  return (
    <Tooltip label={label} shortcut={shortcut} disabled={tooltipDisabled}>
      <button
        onClick={(e) => {
          onClick?.();
          e.currentTarget.blur();
        }}
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
  iframe: "iFrame",
} as const;

type ViewMode = "markdown" | "html" | "iframe";

function ViewModeSelector({
  viewMode,
  onViewModeChange,
}: {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}) {
  const [hovered, setHovered] = React.useState(false);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const modes = ["markdown", "html", "iframe"] as const;

  const handleEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setHovered(true);
  };

  const handleLeave = () => {
    timeoutRef.current = setTimeout(() => setHovered(false), 200);
  };

  const ActiveIcon = viewModeIcons[viewMode];

  return (
    <div
      className="relative"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {/* Active mode button */}
      <button
        className={cn(
          "size-10 flex items-center justify-center rounded-lg transition-all duration-150",
          "hover:bg-accent hover:text-accent-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "active:scale-95",
          "text-muted-foreground"
        )}
        aria-label={`Current view: ${viewModeLabels[viewMode]}`}
      >
        <ActiveIcon className="size-5" />
      </button>

      {/* Expanded options on hover */}
      {hovered && (
        <div
          className={cn(
            "absolute left-full ml-2 top-0 z-50",
            "flex flex-col gap-0.5 p-1 rounded-lg",
            "bg-background/80 backdrop-blur-xl border border-border/50 shadow-lg",
            "animate-in fade-in-0 slide-in-from-left-2 duration-150"
          )}
        >
          {modes.map((mode) => {
            const Icon = viewModeIcons[mode];
            const isActive = viewMode === mode;
            return (
              <button
                key={mode}
                onClick={() => {
                  onViewModeChange(mode);
                  setHovered(false);
                }}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md transition-all duration-150",
                  "text-xs font-medium whitespace-nowrap",
                  "hover:bg-accent hover:text-accent-foreground",
                  "active:scale-95",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground"
                )}
                aria-label={viewModeLabels[mode]}
              >
                <Icon className="size-3.5" />
                <span className="flex-1">{viewModeLabels[mode]}</span>
                <Kbd className="text-[10px] px-1.5 py-0.5 ml-3">V</Kbd>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface FloatingToolbarProps {
  viewMode: "markdown" | "html" | "iframe";
  onViewModeChange: (mode: "markdown" | "html" | "iframe") => void;
  originalUrl: string;
  shareUrl: string;
  articleTitle?: string;
  source: Source;
  sidebarOpen: boolean;
  onOpenSettings: () => void;
  articleExportData?: ArticleExportData;
  styleOptionsOpen?: boolean;
  onStyleOptionsOpenChange?: (open: boolean) => void;
  shareOpen?: boolean;
  onShareOpenChange?: (open: boolean) => void;
  onTTSToggle?: () => void;
  isTTSActive?: boolean;
  isTTSLoading?: boolean;
}

export function FloatingToolbar({
  viewMode,
  onViewModeChange,
  originalUrl,
  shareUrl,
  articleTitle,
  source,
  sidebarOpen,
  onOpenSettings,
  articleExportData,
  styleOptionsOpen,
  onStyleOptionsOpenChange,
  shareOpen,
  onShareOpenChange,
  onTTSToggle,
  isTTSActive,
  isTTSLoading,
}: FloatingToolbarProps) {
  const anyPanelOpen = !!(styleOptionsOpen || shareOpen);

  // Open original URL
  const openOriginal = () => {
    window.open(originalUrl, "_blank", "noopener,noreferrer");
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

  return (
    <div
      className={cn(
        "fixed z-40 hidden md:flex flex-col gap-1 p-1.5",
        "bg-background/80 backdrop-blur-xl border border-border/50 rounded-xl shadow-lg",
        "top-1/2 -translate-y-1/2 left-4"
      )}
    >
      {/* View Mode — hover to expand */}
      <ViewModeSelector viewMode={viewMode} onViewModeChange={onViewModeChange} />

      {/* Open Original */}
      <ToolbarButton
        icon={<Navigation04 className="size-5" />}
        label="Open original"
        shortcut="O"
        onClick={openOriginal}
        tooltipDisabled={anyPanelOpen}
      />

      {/* Share - using custom wrapper since ShareButton has its own trigger */}
      <Tooltip label="Share" shortcut="⇧S" disabled={anyPanelOpen}>
        <div className="size-10 flex items-center justify-center">
          <ShareButton
            url={shareUrl}
            originalUrl={originalUrl}
            source={source}
            viewMode={viewMode}
            sidebarOpen={sidebarOpen}
            articleTitle={articleTitle}
            articleExportData={articleExportData}
            triggerVariant="icon"
            open={shareOpen}
            onOpenChange={onShareOpenChange}
          />
        </div>
      </Tooltip>

      {/* Listen (TTS) */}
      <ToolbarButton
        icon={isTTSLoading
          ? <Loader2 className="size-5 animate-spin" />
          : <Play className="size-5" />
        }
        label={isTTSActive ? "Stop listening" : "Listen"}
        shortcut="L"
        onClick={onTTSToggle}
        isActive={isTTSActive}
      />

      <div className="h-px bg-border/50 my-1" />

      {/* Reading History - direct link */}
      <Tooltip label="Reading History" shortcut="H" disabled={anyPanelOpen}>
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
        </Link>
      </Tooltip>

      <div className="h-px bg-border/50 my-1" />

      {/* Style Options/Reader Settings Popover */}
      <Tooltip label="Style Options" shortcut="S" disabled={anyPanelOpen}>
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
        tooltipDisabled={anyPanelOpen}
      />

      {/* More Menu */}
      <Menu>
        <MenuTrigger
          render={(props) => {
            const { key, ...rest } = props as typeof props & { key?: React.Key };
            return (
              <Tooltip label="More options" key={key} disabled={anyPanelOpen}>
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
