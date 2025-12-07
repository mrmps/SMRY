"use client";

import { useHistory, type HistoryItem } from "@/lib/hooks/use-history";
import { SignedIn, SignedOut, UserButton, useAuth } from "@clerk/nextjs";
import { 
  ArrowLeft, 
  History, 
  Trash2, 
  ExternalLink, 
  Crown, 
  Search,
  X,
  Clock,
  Globe,
  Sparkles
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";

/**
 * Format a date to relative time (e.g., "2 hours ago", "3 days ago")
 */
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) {
    return "just now";
  }
  
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`;
  }
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours}h ago`;
  }
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays}d ago`;
  }
  
  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) {
    return `${diffInWeeks}w ago`;
  }
  
  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) {
    return `${diffInMonths}mo ago`;
  }
  
  const diffInYears = Math.floor(diffInDays / 365);
  return `${diffInYears}y ago`;
}

/**
 * Get date group label for an item
 */
function getDateGroup(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const monthAgo = new Date(today);
  monthAgo.setDate(monthAgo.getDate() - 30);
  
  const itemDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  
  if (itemDate >= today) {
    return "Today";
  } else if (itemDate >= yesterday) {
    return "Yesterday";
  } else if (itemDate >= weekAgo) {
    return "This Week";
  } else if (itemDate >= monthAgo) {
    return "This Month";
  }
  return "Earlier";
}

/**
 * Group items by date
 */
function groupByDate(items: HistoryItem[]): Map<string, HistoryItem[]> {
  const groups = new Map<string, HistoryItem[]>();
  const order = ["Today", "Yesterday", "This Week", "This Month", "Earlier"];
  
  // Initialize groups in order
  order.forEach(group => groups.set(group, []));
  
  items.forEach(item => {
    const group = getDateGroup(new Date(item.accessedAt));
    const existing = groups.get(group) || [];
    existing.push(item);
    groups.set(group, existing);
  });
  
  // Remove empty groups
  order.forEach(group => {
    if (groups.get(group)?.length === 0) {
      groups.delete(group);
    }
  });
  
  return groups;
}

/**
 * Get favicon URL for a domain
 */
function getFaviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
}

function HistoryItemCard({ 
  item, 
  onRemove,
  index
}: { 
  item: HistoryItem; 
  onRemove: (id: string) => void;
  index: number;
}) {
  return (
    <div
      className="group animate-in fade-in slide-in-from-bottom-2 duration-200"
      style={{ animationDelay: `${index * 30}ms`, animationFillMode: 'backwards' }}
    >
      <div className={cn(
        "relative flex items-start gap-3 rounded-xl p-3 transition-all duration-200",
        "hover:bg-accent/50 dark:hover:bg-accent/30",
        "border border-transparent hover:border-border/50"
      )}>
        {/* Favicon */}
        <div className="relative mt-0.5 shrink-0">
          <div className="size-8 rounded-lg bg-muted/50 p-1.5 ring-1 ring-border/50 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={getFaviconUrl(item.domain)}
              alt=""
              className="size-full rounded"
              loading="lazy"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const sibling = target.nextElementSibling;
                if (sibling) sibling.classList.remove('hidden');
              }}
            />
            <Globe className="hidden size-full text-muted-foreground" />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <Link
            href={`/proxy?url=${encodeURIComponent(item.url)}`}
            className="block"
          >
            <h3 className="font-medium text-[15px] text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors">
              {item.title}
            </h3>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="truncate max-w-[180px]">{item.domain}</span>
              <span className="text-border">•</span>
              <Clock className="size-3" />
              <span>{formatRelativeTime(new Date(item.accessedAt))}</span>
            </div>
          </Link>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "h-7 w-7 flex items-center justify-center rounded-md",
              "text-muted-foreground hover:text-foreground hover:bg-background",
              "transition-colors"
            )}
            title="Open original"
          >
            <ExternalLink className="size-3.5" />
          </a>
          <button
            onClick={() => onRemove(item.id)}
            className={cn(
              "h-7 w-7 flex items-center justify-center rounded-md",
              "text-muted-foreground hover:text-destructive hover:bg-destructive/10",
              "transition-colors"
            )}
            title="Remove"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function DateGroupHeader({ label }: { label: string }) {
  return (
    <div className="sticky top-0 z-10 -mx-2 px-2 py-2 bg-background/80 backdrop-blur-sm">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
        {label}
      </span>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in zoom-in-95 duration-300">
      <div className="mb-6 relative">
        <div className="size-20 rounded-2xl bg-linear-to-br from-muted to-muted/50 flex items-center justify-center">
          <History className="size-10 text-muted-foreground/50" />
        </div>
        <div className="absolute -bottom-1 -right-1 size-6 rounded-full bg-primary/10 flex items-center justify-center">
          <Sparkles className="size-3 text-primary" />
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
      <h3 className="text-base font-medium">No results for &ldquo;{query}&rdquo;</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Try searching with different keywords
      </p>
    </div>
  );
}

function SearchBar({ 
  value, 
  onChange, 
  onClear
}: { 
  value: string; 
  onChange: (value: string) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Keyboard shortcut: Cmd/Ctrl + K to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === 'Escape' && document.activeElement === inputRef.current) {
        inputRef.current?.blur();
        onClear();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClear]);
  
  return (
    <div className={cn(
      "flex items-center gap-2 rounded-xl border bg-card px-3 py-2",
      "transition-all duration-200",
      "focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/50"
    )}>
      <Search className="size-4 text-muted-foreground shrink-0" />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search history..."
        className={cn(
          "flex-1 bg-transparent text-sm outline-none",
          "placeholder:text-muted-foreground/60"
        )}
      />
      {value && (
        <button
          onClick={onClear}
          className="shrink-0 p-0.5 rounded hover:bg-accent transition-colors"
        >
          <X className="size-3.5 text-muted-foreground" />
        </button>
      )}
      <kbd className="hidden sm:flex items-center gap-0.5 shrink-0 px-1.5 py-0.5 rounded bg-muted text-[10px] font-medium text-muted-foreground">
        <span className="text-xs">⌘</span>K
      </kbd>
    </div>
  );
}

function ClearConfirmDialog({ 
  open, 
  onClose, 
  onConfirm 
}: { 
  open: boolean; 
  onClose: () => void; 
  onConfirm: () => void;
}) {
  // Handle escape key
  useEffect(() => {
    if (!open) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
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
          This will permanently delete your entire reading history. This action cannot be undone.
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

function HistoryContent() {
  const { has, isLoaded } = useAuth();
  const isPremium = isLoaded && (has?.({ plan: "premium" }) ?? false);
  
  const { 
    history, 
    totalCount, 
    hiddenCount, 
    isLoaded: historyLoaded, 
    removeFromHistory, 
    clearHistory 
  } = useHistory(isPremium);

  const [searchQuery, setSearchQuery] = useState("");
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  
  // Filter history based on search
  const filteredHistory = useMemo(() => {
    if (!searchQuery.trim()) return history;
    
    const query = searchQuery.toLowerCase();
    return history.filter(item => 
      item.title.toLowerCase().includes(query) ||
      item.domain.toLowerCase().includes(query)
    );
  }, [history, searchQuery]);
  
  // Group filtered items by date
  const groupedHistory = useMemo(() => 
    groupByDate(filteredHistory), 
    [filteredHistory]
  );
  
  const handleClearSearch = useCallback(() => setSearchQuery(""), []);

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
    <div className="space-y-4">
      {/* Search and actions bar - Grid layout to prevent shifts */}
      <div className="grid grid-cols-[1fr_auto] gap-3 items-start">
        {/* Search bar column */}
        <div className="grid grid-rows-[auto_auto] gap-2">
          <SearchBar 
            value={searchQuery}
            onChange={setSearchQuery}
            onClear={handleClearSearch}
          />
          {/* Result count - always reserve space to prevent layout shift */}
          <div className="h-5 flex items-center">
            {searchQuery && (
              <div className="text-xs text-muted-foreground animate-in fade-in slide-in-from-top-1 duration-150">
                {filteredHistory.length} of {history.length} articles
              </div>
            )}
          </div>
        </div>
        
        {/* Clear button column - aligned to search bar */}
        <div className="pt-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-[38px] text-muted-foreground hover:text-destructive"
            onClick={() => setShowClearConfirm(true)}
          >
            <Trash2 className="size-4" />
            <span className="hidden sm:inline ml-1.5">Clear</span>
          </Button>
        </div>
      </div>

      {/* Stats bar - fixed position, no conditional spacing */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span>{totalCount} {totalCount === 1 ? "article" : "articles"}</span>
        {hiddenCount > 0 && (
          <span className="text-amber-500">+{hiddenCount} hidden (free tier)</span>
        )}
      </div>

      {/* History list */}
      {filteredHistory.length === 0 && searchQuery ? (
        <NoSearchResults query={searchQuery} />
      ) : (
        <div className="space-y-1 -mx-2">
          {Array.from(groupedHistory.entries()).map(([group, items]) => (
            <div key={group}>
              <DateGroupHeader label={group} />
              {items.map((item, idx) => (
                <HistoryItemCard
                  key={item.id}
                  item={item}
                  onRemove={removeFromHistory}
                  index={idx}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Hidden count banner for free users */}
      {hiddenCount > 0 && !searchQuery && (
        <div className="rounded-2xl border border-amber-500/20 bg-linear-to-br from-amber-500/5 to-orange-500/5 p-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-start gap-4">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-amber-400 to-orange-500 shadow-lg shadow-amber-500/20">
              <Crown className="size-5 text-white" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-foreground">
                {hiddenCount} more {hiddenCount === 1 ? "article" : "articles"} in your history
              </h4>
              <p className="mt-1 text-sm text-muted-foreground">
                Upgrade to Premium for unlimited history & ad-free reading
              </p>
              <Link href="/pricing">
                <Button size="sm" className="mt-4">
                  <Crown className="mr-1.5 size-3.5" />
                  Go Premium
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

function SignedOutContent() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="mb-6 relative">
        <div className="size-20 rounded-2xl bg-linear-to-br from-amber-400/20 to-orange-500/20 flex items-center justify-center">
          <Crown className="size-10 text-amber-500" />
        </div>
      </div>
      <h3 className="text-xl font-semibold">Sign in to view history</h3>
      <p className="mt-2 text-sm text-muted-foreground max-w-[300px]">
        Create an account to save your reading history and access it from any device.
      </p>
      <Link href="/pricing">
        <Button className="mt-6">
          Get started
        </Button>
      </Link>
    </div>
  );
}

export default function HistoryPage() {
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
                    avatarBox: "size-8"
                  }
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
              <div className="size-10 rounded-xl bg-linear-to-br from-primary/10 to-primary/5 flex items-center justify-center ring-1 ring-primary/10">
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
