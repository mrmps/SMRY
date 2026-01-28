"use client";

import { useHistory, type HistoryItem } from "@/lib/hooks/use-history";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
  useAuth,
} from "@clerk/nextjs";
import {
  ArrowLeft,
  History,
  Trash2,
  ExternalLink,
  Crown,
  Search,
  X,
  Newspaper,
  ChevronRight,
  Grid3X3,
  List,
  LayoutGrid,
  BookMarked,
  TrendingUp,
  Calendar,
  Command,
  CornerDownLeft,
  RotateCcw,
} from "lucide-react";
import { GlobeIcon } from "@/components/ui/custom-icons";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  useState,
  useMemo,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { normalizeUrl } from "@/lib/validation/url";

// ============================================================================
// ROUND 1: Clean typography and visual hierarchy
// ============================================================================

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return "just now";

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m`;

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h`;

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays}d`;

  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) return `${diffInWeeks}w`;

  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) return `${diffInMonths}mo`;

  return `${Math.floor(diffInDays / 365)}y`;
}

function formatFullDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

type DateGroup =
  | "Today"
  | "Yesterday"
  | "This Week"
  | "This Month"
  | "Earlier";

function getDateGroup(date: Date): DateGroup {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const monthAgo = new Date(today);
  monthAgo.setDate(monthAgo.getDate() - 30);

  const itemDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );

  if (itemDate >= today) return "Today";
  if (itemDate >= yesterday) return "Yesterday";
  if (itemDate >= weekAgo) return "This Week";
  if (itemDate >= monthAgo) return "This Month";
  return "Earlier";
}

function groupByDate(items: HistoryItem[]): Map<DateGroup, HistoryItem[]> {
  const groups = new Map<DateGroup, HistoryItem[]>();
  const order: DateGroup[] = [
    "Today",
    "Yesterday",
    "This Week",
    "This Month",
    "Earlier",
  ];

  order.forEach((group) => groups.set(group, []));

  items.forEach((item) => {
    const group = getDateGroup(new Date(item.accessedAt));
    const existing = groups.get(group) || [];
    existing.push(item);
    groups.set(group, existing);
  });

  order.forEach((group) => {
    if (groups.get(group)?.length === 0) {
      groups.delete(group);
    }
  });

  return groups;
}

// ============================================================================
// ROUND 6: Smart grouping by domain
// ============================================================================

function groupByDomain(
  items: HistoryItem[]
): Map<string, { items: HistoryItem[]; count: number }> {
  const groups = new Map<string, { items: HistoryItem[]; count: number }>();

  items.forEach((item) => {
    const existing = groups.get(item.domain);
    if (existing) {
      existing.items.push(item);
      existing.count++;
    } else {
      groups.set(item.domain, { items: [item], count: 1 });
    }
  });

  // Sort by count (most read domains first)
  const sorted = new Map(
    [...groups.entries()].sort((a, b) => b[1].count - a[1].count)
  );

  return sorted;
}

function getFaviconUrl(domain: string): string {
  return `https://icons.duckduckgo.com/ip3/${domain}.ico`;
}

function getGoogleFaviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
}

function FaviconImage({
  domain,
  className,
  fallbackIcon: FallbackIcon = GlobeIcon,
  fallbackClassName,
}: {
  domain: string;
  className?: string;
  fallbackIcon?: React.ComponentType<{ className?: string }>;
  fallbackClassName?: string;
}) {
  const [errorCount, setErrorCount] = useState(0);

  const src = useMemo(() => {
    if (errorCount === 0) {
      return getFaviconUrl(domain);
    }
    if (errorCount === 1) {
      return getGoogleFaviconUrl(domain);
    }
    return null;
  }, [domain, errorCount]);

  if (!src) {
    return (
      <div className="size-full flex items-center justify-center">
        <FallbackIcon className={fallbackClassName ?? className} />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className={className}
      loading="lazy"
      onError={() => setErrorCount((c) => c + 1)}
    />
  );
}

function buildProxyUrlFromHistory(url: string): string {
  try {
    const normalized = normalizeUrl(url);
    return `/proxy?url=${encodeURIComponent(normalized)}`;
  } catch {
    return `/proxy?url=${encodeURIComponent(url)}`;
  }
}

// ============================================================================
// ROUND 9: Reading stats
// ============================================================================

function ReadingStats({
  history,
  className,
}: {
  history: HistoryItem[];
  className?: string;
}) {
  const stats = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const todayCount = history.filter(
      (item) => new Date(item.accessedAt) >= today
    ).length;
    const weekCount = history.filter(
      (item) => new Date(item.accessedAt) >= weekAgo
    ).length;

    // Top domains
    const domainCounts = new Map<string, number>();
    history.forEach((item) => {
      domainCounts.set(item.domain, (domainCounts.get(item.domain) || 0) + 1);
    });
    const topDomains = [...domainCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    return { todayCount, weekCount, topDomains, totalCount: history.length };
  }, [history]);

  if (history.length === 0) return null;

  return (
    <div className={cn("grid grid-cols-3 gap-3", className)}>
      <div className="rounded-xl border bg-card/50 p-3">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          <Calendar className="size-3.5" />
          <span className="text-[11px] font-medium uppercase tracking-wider">
            Today
          </span>
        </div>
        <div className="text-2xl font-semibold tabular-nums">
          {stats.todayCount}
        </div>
      </div>
      <div className="rounded-xl border bg-card/50 p-3">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          <TrendingUp className="size-3.5" />
          <span className="text-[11px] font-medium uppercase tracking-wider">
            This Week
          </span>
        </div>
        <div className="text-2xl font-semibold tabular-nums">
          {stats.weekCount}
        </div>
      </div>
      <div className="rounded-xl border bg-card/50 p-3">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          <BookMarked className="size-3.5" />
          <span className="text-[11px] font-medium uppercase tracking-wider">
            Total
          </span>
        </div>
        <div className="text-2xl font-semibold tabular-nums">
          {stats.totalCount}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// ROUND 10: Random article suggestion (Readwise-style "revisit")
// ============================================================================

function RevisitSuggestion({
  history,
  className,
}: {
  history: HistoryItem[];
  className?: string;
}) {
  const [suggestion, setSuggestion] = useState<HistoryItem | null>(null);
  const [isVisible, setIsVisible] = useState(true);

  // Pick a random article from history on mount (prefer older ones)
  const randomIndexRef = useRef<number | null>(null);

  useEffect(() => {
    if (history.length < 5) return;

    // Only pick random once
    if (randomIndexRef.current === null) {
      // Bias towards older articles (more likely to be forgotten)
      const olderItems = history.slice(Math.floor(history.length / 3));
      randomIndexRef.current = Math.floor(Math.random() * olderItems.length);
    }

    const olderItems = history.slice(Math.floor(history.length / 3));
    const item = olderItems[randomIndexRef.current];
    if (item) {
      setSuggestion(item);
    }
  }, [history]);

  if (!suggestion || !isVisible || history.length < 5) return null;

  return (
    <div
      className={cn(
        "relative rounded-xl border bg-gradient-to-br from-primary/5 via-transparent to-primary/5 p-4",
        "animate-in fade-in slide-in-from-top-2 duration-300",
        className
      )}
    >
      <button
        onClick={() => setIsVisible(false)}
        className="absolute top-2 right-2 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
      >
        <X className="size-3.5" />
      </button>
      <div className="flex items-start gap-3">
        <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <RotateCcw className="size-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">
              Revisit this
            </span>
          </div>
          <Link
            href={buildProxyUrlFromHistory(suggestion.url)}
            className="block group"
          >
            <h4 className="font-medium text-sm text-foreground line-clamp-1 group-hover:text-primary transition-colors">
              {suggestion.title}
            </h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              {suggestion.domain} ·{" "}
              {formatRelativeTime(new Date(suggestion.accessedAt))} ago
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// ROUND 2 & 8: Enhanced history item with keyboard navigation support
// ============================================================================

interface HistoryItemCardProps {
  item: HistoryItem;
  onRemove: (id: string) => void;
  isSelected: boolean;
  onSelect: () => void;
  showPreview?: boolean;
  viewMode: "list" | "compact" | "grid";
}

function HistoryItemCard({
  item,
  onRemove,
  isSelected,
  onSelect,
  viewMode,
}: HistoryItemCardProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect();
    }
  };

  if (viewMode === "compact") {
    return (
      <div
        onClick={onSelect}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        aria-pressed={isSelected}
        className={cn(
          "group flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all duration-150",
          isSelected
            ? "bg-primary/10 ring-1 ring-primary/30"
            : "hover:bg-accent/50"
        )}
      >
        {/* Favicon */}
        <div className="size-5 rounded bg-muted/50 overflow-hidden shrink-0">
          <FaviconImage
            domain={item.domain}
            className="size-full"
            fallbackClassName="size-3 text-muted-foreground"
          />
        </div>

        {/* Title */}
        <Link
          href={buildProxyUrlFromHistory(item.url)}
          className="flex-1 min-w-0"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="text-sm font-medium text-foreground line-clamp-1 group-hover:text-primary transition-colors">
            {item.title}
          </span>
        </Link>

        {/* Meta */}
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-muted-foreground hidden sm:block">
            {item.domain}
          </span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {formatRelativeTime(new Date(item.accessedAt))}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
          >
            <ExternalLink className="size-3.5" />
          </a>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove(item.id);
            }}
            className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>
    );
  }

  if (viewMode === "grid") {
    return (
      <div
        onClick={onSelect}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        aria-pressed={isSelected}
        className={cn(
          "group relative rounded-xl border bg-card p-4 cursor-pointer transition-all duration-150",
          isSelected
            ? "ring-2 ring-primary shadow-lg shadow-primary/10"
            : "hover:border-border hover:shadow-md"
        )}
      >
        {/* Header with favicon and domain */}
        <div className="flex items-center gap-2 mb-3">
          <div className="size-6 rounded-md bg-muted/50 overflow-hidden shrink-0">
            <FaviconImage
              domain={item.domain}
              className="size-full"
              fallbackClassName="size-3 text-muted-foreground"
            />
          </div>
          <span className="text-xs text-muted-foreground truncate flex-1">
            {item.domain}
          </span>
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {formatRelativeTime(new Date(item.accessedAt))}
          </span>
        </div>

        {/* Title */}
        <Link
          href={buildProxyUrlFromHistory(item.url)}
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="font-medium text-sm text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors">
            {item.title}
          </h3>
        </Link>

        {/* Hover actions */}
        <div className="absolute top-2 right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="p-1.5 rounded-md bg-background/80 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ExternalLink className="size-3" />
          </a>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove(item.id);
            }}
            className="p-1.5 rounded-md bg-background/80 text-muted-foreground hover:text-destructive transition-colors"
          >
            <Trash2 className="size-3" />
          </button>
        </div>
      </div>
    );
  }

  // Default list view
  return (
    <div
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      className={cn(
        "group relative flex items-start gap-3 rounded-xl p-3 cursor-pointer transition-all duration-150",
        isSelected
          ? "bg-primary/10 ring-1 ring-primary/30"
          : "hover:bg-accent/50"
      )}
    >
      {/* Favicon */}
      <div className="relative mt-0.5 shrink-0">
        <div className="size-9 rounded-lg bg-muted/50 p-1.5 ring-1 ring-border/30 overflow-hidden">
          <FaviconImage
            domain={item.domain}
            className="size-full rounded-sm"
            fallbackIcon={Newspaper}
            fallbackClassName="size-full text-muted-foreground"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <Link
          href={buildProxyUrlFromHistory(item.url)}
          className="block"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="font-medium text-[15px] text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors">
            {item.title}
          </h3>
        </Link>
        <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="truncate max-w-[200px]">{item.domain}</span>
          <span className="text-border/60">·</span>
          <span
            className="tabular-nums"
            title={formatFullDate(new Date(item.accessedAt))}
          >
            {formatRelativeTime(new Date(item.accessedAt))}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
          title="Open original"
        >
          <ExternalLink className="size-3.5" />
        </a>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove(item.id);
          }}
          className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          title="Remove"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// ROUND 3: Enhanced search with filters
// ============================================================================

type GroupingMode = "date" | "domain";

function CommandBar({
  value,
  onChange,
  onClear,
  grouping,
  onGroupingChange,
  viewMode,
  onViewModeChange,
  resultCount,
  totalCount,
}: {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  grouping: GroupingMode;
  onGroupingChange: (mode: GroupingMode) => void;
  viewMode: "list" | "compact" | "grid";
  onViewModeChange: (mode: "list" | "compact" | "grid") => void;
  resultCount?: number;
  totalCount?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape" && document.activeElement === inputRef.current) {
        inputRef.current?.blur();
        onClear();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClear]);

  return (
    <div className="space-y-3">
      {/* Main search bar */}
      <div
        className={cn(
          "flex items-center gap-2 rounded-xl border bg-card px-3 py-2.5",
          "transition-all duration-200",
          isFocused && "ring-2 ring-primary/20 border-primary/50"
        )}
      >
        <Search className="size-4 text-muted-foreground shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="Search articles..."
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
        />
        {value ? (
          <button
            onClick={onClear}
            className="shrink-0 p-1 rounded-md hover:bg-accent transition-colors"
          >
            <X className="size-3.5 text-muted-foreground" />
          </button>
        ) : (
          <kbd className="hidden sm:flex items-center gap-0.5 shrink-0 px-1.5 py-0.5 rounded-md bg-muted text-[10px] font-medium text-muted-foreground">
            <Command className="size-3" />K
          </kbd>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Grouping toggle */}
          <div className="flex items-center rounded-lg border bg-card p-0.5">
            <button
              onClick={() => onGroupingChange("date")}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors",
                grouping === "date"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Calendar className="size-3.5" />
              <span className="hidden sm:inline">Date</span>
            </button>
            <button
              onClick={() => onGroupingChange("domain")}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors",
                grouping === "domain"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <GlobeIcon className="size-3.5" />
              <span className="hidden sm:inline">Source</span>
            </button>
          </div>

          {/* View mode toggle */}
          <div className="flex items-center rounded-lg border bg-card p-0.5">
            <button
              onClick={() => onViewModeChange("list")}
              className={cn(
                "p-1.5 rounded-md transition-colors",
                viewMode === "list"
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title="List view"
            >
              <List className="size-4" />
            </button>
            <button
              onClick={() => onViewModeChange("compact")}
              className={cn(
                "p-1.5 rounded-md transition-colors",
                viewMode === "compact"
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title="Compact view"
            >
              <Grid3X3 className="size-4" />
            </button>
            <button
              onClick={() => onViewModeChange("grid")}
              className={cn(
                "p-1.5 rounded-md transition-colors",
                viewMode === "grid"
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title="Grid view"
            >
              <LayoutGrid className="size-4" />
            </button>
          </div>
        </div>

        {/* Result count */}
        {value && resultCount !== undefined && totalCount !== undefined && (
          <span className="text-xs text-muted-foreground">
            {resultCount} of {totalCount}
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// ROUND 1: Date group header
// ============================================================================

function DateGroupHeader({
  label,
  count,
  isCollapsed,
  onToggle,
}: {
  label: string;
  count: number;
  isCollapsed?: boolean;
  onToggle?: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="sticky top-0 z-10 -mx-2 px-2 py-2 flex items-center gap-2 w-full bg-background/95 backdrop-blur-sm hover:bg-accent/30 transition-colors rounded-md group"
    >
      {onToggle && (
        <ChevronRight
          className={cn(
            "size-3.5 text-muted-foreground transition-transform",
            !isCollapsed && "rotate-90"
          )}
        />
      )}
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="text-xs text-muted-foreground/60 tabular-nums">
        {count}
      </span>
    </button>
  );
}

function DomainGroupHeader({
  domain,
  count,
  isCollapsed,
  onToggle,
}: {
  domain: string;
  count: number;
  isCollapsed?: boolean;
  onToggle?: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="sticky top-0 z-10 -mx-2 px-2 py-2 flex items-center gap-2 w-full bg-background/95 backdrop-blur-sm hover:bg-accent/30 transition-colors rounded-md group"
    >
      {onToggle && (
        <ChevronRight
          className={cn(
            "size-3.5 text-muted-foreground transition-transform",
            !isCollapsed && "rotate-90"
          )}
        />
      )}
      <div className="size-4 rounded overflow-hidden shrink-0">
        <FaviconImage
          domain={domain}
          className="size-full"
          fallbackClassName="size-full text-muted-foreground"
        />
      </div>
      <span className="text-xs font-medium text-muted-foreground truncate">
        {domain}
      </span>
      <span className="text-xs text-muted-foreground/60 tabular-nums">
        {count}
      </span>
    </button>
  );
}

// ============================================================================
// Empty and no results states
// ============================================================================

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in zoom-in-95 duration-300">
      <div className="mb-6 relative">
        <div className="size-20 rounded-2xl bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
          <History className="size-10 text-muted-foreground/50" />
        </div>
      </div>
      <h3 className="text-lg font-semibold">No reading history yet</h3>
      <p className="mt-2 text-sm text-muted-foreground max-w-[280px]">
        Articles you read will appear here so you can easily find them again.
      </p>
      <Link href="/">
        <Button className="mt-6" size="sm">
          Start reading
        </Button>
      </Link>
    </div>
  );
}

function NoSearchResults({ query }: { query: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center animate-in fade-in duration-200">
      <div className="size-14 rounded-xl bg-muted/50 flex items-center justify-center mb-4">
        <Search className="size-6 text-muted-foreground/50" />
      </div>
      <h3 className="text-base font-medium">
        No results for &ldquo;{query}&rdquo;
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Try searching with different keywords
      </p>
    </div>
  );
}

// ============================================================================
// ROUND 7: Clear confirmation dialog
// ============================================================================

function ClearConfirmDialog({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center animate-in fade-in duration-150">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-card border rounded-2xl p-6 shadow-xl max-w-sm mx-4 animate-in zoom-in-95 duration-200">
        <h3 className="text-lg font-semibold">Clear all history?</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          This will permanently delete your entire reading history. This action
          cannot be undone.
        </p>
        <div className="mt-6 flex gap-3 justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            Clear all
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// ROUND 2: Keyboard navigation hook
// ============================================================================

function useKeyboardNavigation(
  items: HistoryItem[],
  selectedId: string | null,
  onSelect: (id: string) => void,
  onOpen: (item: HistoryItem) => void
) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if focused on input
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      const currentIndex = selectedId
        ? items.findIndex((item) => item.id === selectedId)
        : -1;

      switch (e.key) {
        case "j":
        case "ArrowDown": {
          e.preventDefault();
          const nextIndex = Math.min(currentIndex + 1, items.length - 1);
          if (items[nextIndex]) {
            onSelect(items[nextIndex].id);
          }
          break;
        }
        case "k":
        case "ArrowUp": {
          e.preventDefault();
          const prevIndex = Math.max(currentIndex - 1, 0);
          if (items[prevIndex]) {
            onSelect(items[prevIndex].id);
          }
          break;
        }
        case "Enter": {
          e.preventDefault();
          const selectedItem = items.find((item) => item.id === selectedId);
          if (selectedItem) {
            onOpen(selectedItem);
          }
          break;
        }
        case "Escape": {
          e.preventDefault();
          onSelect("");
          break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [items, selectedId, onSelect, onOpen]);
}

// ============================================================================
// ROUND 5: Keyboard shortcuts help
// ============================================================================

function KeyboardHints({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "hidden lg:flex items-center gap-4 text-xs text-muted-foreground",
        className
      )}
    >
      <div className="flex items-center gap-1.5">
        <kbd className="px-1.5 py-0.5 rounded bg-muted font-medium">↑</kbd>
        <kbd className="px-1.5 py-0.5 rounded bg-muted font-medium">↓</kbd>
        <span>Navigate</span>
      </div>
      <div className="flex items-center gap-1.5">
        <kbd className="px-1.5 py-0.5 rounded bg-muted font-medium">
          <CornerDownLeft className="size-3" />
        </kbd>
        <span>Open</span>
      </div>
      <div className="flex items-center gap-1.5">
        <kbd className="px-1.5 py-0.5 rounded bg-muted font-medium">esc</kbd>
        <span>Clear</span>
      </div>
    </div>
  );
}

// ============================================================================
// Main History Content
// ============================================================================

function HistoryContent() {
  const router = useRouter();
  const { has, isLoaded } = useAuth();
  const isPremium = isLoaded && (has?.({ plan: "premium" }) ?? false);

  const {
    history,
    totalCount,
    hiddenCount,
    isLoaded: historyLoaded,
    removeFromHistory,
    clearHistory,
  } = useHistory(isPremium);

  const [searchQuery, setSearchQuery] = useState("");
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [grouping, setGrouping] = useState<GroupingMode>("date");
  const [viewMode, setViewMode] = useState<"list" | "compact" | "grid">("list");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    new Set()
  );

  // Filter history based on search
  const filteredHistory = useMemo(() => {
    if (!searchQuery.trim()) return history;

    const query = searchQuery.toLowerCase();
    return history.filter(
      (item) =>
        item.title.toLowerCase().includes(query) ||
        item.domain.toLowerCase().includes(query)
    );
  }, [history, searchQuery]);

  // Group items
  const groupedByDate = useMemo(
    () => groupByDate(filteredHistory),
    [filteredHistory]
  );
  const groupedByDomain = useMemo(
    () => groupByDomain(filteredHistory),
    [filteredHistory]
  );

  const handleClearSearch = useCallback(() => setSearchQuery(""), []);

  const handleOpenItem = useCallback(
    (item: HistoryItem) => {
      router.push(buildProxyUrlFromHistory(item.url));
    },
    [router]
  );

  const toggleGroup = useCallback((group: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) {
        next.delete(group);
      } else {
        next.add(group);
      }
      return next;
    });
  }, []);

  // Build navigation list that matches rendered order
  const navigationItems = useMemo(() => {
    if (viewMode === "grid") return filteredHistory;
    if (grouping === "domain") {
      return Array.from(groupedByDomain.values()).flatMap(({ items }) => items);
    }
    return Array.from(groupedByDate.values()).flatMap((items) => items);
  }, [filteredHistory, groupedByDate, groupedByDomain, grouping, viewMode]);

  // Keyboard navigation
  useKeyboardNavigation(
    navigationItems,
    selectedId,
    setSelectedId,
    handleOpenItem
  );

  if (!historyLoaded) {
    return (
      <div className="space-y-3 mt-4">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="h-16 rounded-xl bg-muted/30 animate-pulse"
            style={{ animationDelay: `${i * 100}ms` }}
          />
        ))}
      </div>
    );
  }

  if (history.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-6">
      {/* Stats dashboard - Round 9 */}
      <ReadingStats history={history} />

      {/* Revisit suggestion - Round 10 */}
      <RevisitSuggestion history={history} />

      {/* Command bar with search, filters, and view toggle */}
      <CommandBar
        value={searchQuery}
        onChange={setSearchQuery}
        onClear={handleClearSearch}
        grouping={grouping}
        onGroupingChange={setGrouping}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        resultCount={searchQuery ? filteredHistory.length : undefined}
        totalCount={searchQuery ? history.length : undefined}
      />

      {/* Stats and actions bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>
            {totalCount} {totalCount === 1 ? "article" : "articles"}
          </span>
          {hiddenCount > 0 && (
            <span className="text-amber-500/80">
              +{hiddenCount} hidden (free tier)
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <KeyboardHints />
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive"
            onClick={() => setShowClearConfirm(true)}
          >
            <Trash2 className="size-4" />
            <span className="hidden sm:inline ml-1.5">Clear</span>
          </Button>
        </div>
      </div>

      {/* History list */}
      {filteredHistory.length === 0 && searchQuery ? (
        <NoSearchResults query={searchQuery} />
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filteredHistory.map((item) => (
            <HistoryItemCard
              key={item.id}
              item={item}
              onRemove={removeFromHistory}
              isSelected={selectedId === item.id}
              onSelect={() =>
                setSelectedId(selectedId === item.id ? null : item.id)
              }
              viewMode={viewMode}
            />
          ))}
        </div>
      ) : grouping === "date" ? (
        <div className="space-y-1">
          {Array.from(groupedByDate.entries()).map(([group, items]) => (
            <div key={group}>
              <DateGroupHeader
                label={group}
                count={items.length}
                isCollapsed={collapsedGroups.has(group)}
                onToggle={() => toggleGroup(group)}
              />
              {!collapsedGroups.has(group) && (
                <div className="space-y-0.5 mt-1">
                  {items.map((item) => (
                    <HistoryItemCard
                      key={item.id}
                      item={item}
                      onRemove={removeFromHistory}
                      isSelected={selectedId === item.id}
                      onSelect={() =>
                        setSelectedId(selectedId === item.id ? null : item.id)
                      }
                      viewMode={viewMode}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-1">
          {Array.from(groupedByDomain.entries()).map(([domain, { items }]) => (
            <div key={domain}>
              <DomainGroupHeader
                domain={domain}
                count={items.length}
                isCollapsed={collapsedGroups.has(domain)}
                onToggle={() => toggleGroup(domain)}
              />
              {!collapsedGroups.has(domain) && (
                <div className="space-y-0.5 mt-1">
                  {items.map((item) => (
                    <HistoryItemCard
                      key={item.id}
                      item={item}
                      onRemove={removeFromHistory}
                      isSelected={selectedId === item.id}
                      onSelect={() =>
                        setSelectedId(selectedId === item.id ? null : item.id)
                      }
                      viewMode={viewMode}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Premium upsell banner */}
      {hiddenCount > 0 && !searchQuery && (
        <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-orange-500/5 p-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-start gap-4">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-amber-500/20">
              <Crown className="size-5 text-white" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-foreground">
                {hiddenCount} more {hiddenCount === 1 ? "article" : "articles"}{" "}
                in your history
              </h4>
              <p className="mt-1 text-sm text-muted-foreground">
                Support to unlock unlimited history & ad-free reading
              </p>
              <Link href="/pricing">
                <Button size="sm" className="mt-4">
                  <Crown className="mr-1.5 size-3.5" />
                  Support & Unlock
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      <ClearConfirmDialog
        open={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={clearHistory}
      />
    </div>
  );
}

// ============================================================================
// Signed out content
// ============================================================================

function SignedOutContent() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="mb-6 relative">
        <div className="size-20 rounded-2xl bg-gradient-to-br from-amber-400/20 to-orange-500/20 flex items-center justify-center">
          <Crown className="size-10 text-amber-500" />
        </div>
      </div>
      <h3 className="text-xl font-semibold">Sign in to view history</h3>
      <p className="mt-2 text-sm text-muted-foreground max-w-[300px]">
        Create an account to save your reading history and access it from any
        device.
      </p>
      <div className="flex items-center gap-3 mt-6">
        <SignInButton mode="modal" fallbackRedirectUrl="/auth/redirect?returnUrl=%2Fhistory">
          <Button variant="outline">
            Sign In
          </Button>
        </SignInButton>
        <Link href="/pricing?returnUrl=/history">
          <Button>Get Pro</Button>
        </Link>
      </div>
    </div>
  );
}

// ============================================================================
// Main export
// ============================================================================

export function HistoryPageContent() {
  const router = useRouter();

  return (
    <main className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-4" />
            <span className="hidden sm:inline">Back</span>
          </button>
          <div className="flex items-center gap-4">
            <SignedIn>
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: "size-8",
                  },
                }}
              />
            </SignedIn>
            <Link href="/" className="hover:opacity-80 transition-opacity">
              <Image
                src="/logo.svg"
                width={72}
                height={72}
                alt="smry logo"
                className="dark:invert"
              />
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex flex-1 flex-col px-4 py-6">
        <div className="mx-auto w-full max-w-2xl">
          {/* Page title */}
          <div className="mb-6">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center ring-1 ring-primary/10">
                <History className="size-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Reading History</h1>
                <p className="text-sm text-muted-foreground">
                  Your recently read articles
                </p>
              </div>
            </div>
          </div>

          {/* Content based on auth state */}
          <SignedIn>
            <HistoryContent />
          </SignedIn>
          <SignedOut>
            <SignedOutContent />
          </SignedOut>
        </div>
      </div>
    </main>
  );
}
