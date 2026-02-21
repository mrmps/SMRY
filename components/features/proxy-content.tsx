"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useArticleAuto } from "@/lib/hooks/use-articles";
import { addArticleToHistory } from "@/lib/hooks/use-history";
import { useIsPremium } from "@/lib/hooks/use-is-premium";
import { ArrowLeft, AiMagic, Highlighter } from "@/components/ui/icons";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";

import { ArticleContent } from "@/components/article/content";
import { TabbedSidebar, TabbedSidebarHandle } from "@/components/features/tabbed-sidebar";
import { MobileBottomBar } from "@/components/features/mobile-bottom-bar";
import { FloatingToolbar } from "@/components/features/floating-toolbar";
import { SettingsPopover } from "@/components/features/settings-popover";
import { SettingsDrawer, SettingsDrawerHandle } from "@/components/features/settings-drawer";
import { useChatThreads, type ThreadMessage } from "@/lib/hooks/use-chat-threads";
import { useIsDesktop } from "@/lib/hooks/use-media-query";
import { useGravityAd } from "@/lib/hooks/use-gravity-ad";
import { GravityAd } from "@/components/ads/gravity-ad";
import { PromoBanner } from "@/components/marketing/promo-banner";
import { UpdateBanner } from "@/components/marketing/update-banner";
import {
  useQueryStates,
  parseAsStringLiteral,
  parseAsBoolean,
  parseAsString,
} from "nuqs";
import { Source } from "@/types/api";
import { saveReadingProgress } from "@/lib/hooks/use-reading-progress";
import { isTextUIPart, type UIMessage } from "ai";
import { KeyboardShortcutsDialog } from "@/components/features/keyboard-shortcuts-dialog";
import { HighlightsProvider } from "@/lib/contexts/highlights-context";
import { AnnotationsSidebar } from "@/components/features/annotations-sidebar";
import { MobileChatDrawer } from "@/components/features/mobile-chat-drawer";
import { MobileAnnotationsDrawer } from "@/components/features/mobile-annotations-drawer";
import {
  Sidebar,
  SidebarContent,
  SidebarProvider,
} from "@/components/ui/sidebar";

// Check if the user is typing in an input/textarea/contentEditable
function isTypingInInput(e: KeyboardEvent): boolean {
  const target = e.target as HTMLElement | null;
  if (!target) return false;
  const tagName = target.tagName;
  if (tagName === "INPUT" || tagName === "TEXTAREA") return true;
  if (target.isContentEditable) return true;
  return false;
}

interface ProxyContentProps {
  url: string;
  initialSource?: Source;
  initialViewMode?: "markdown" | "html" | "iframe";
  initialSidebarOpen?: boolean;
}

export function ProxyContent({ url, initialSidebarOpen = false }: ProxyContentProps) {
  // Use the new auto endpoint - single request, races all sources server-side
  const articleQuery = useArticleAuto(url);
  const { isPremium } = useIsPremium();
  const isDesktop = useIsDesktop();
  const showDesktopPromo = isDesktop !== false;
  const showMobilePromo = isDesktop === false;

  // Get the source that was actually used by the auto endpoint
  const source = articleQuery.data?.source || "smry-fast";


  const viewModes = ["markdown", "html", "iframe"] as const;

  const [query, setQuery] = useQueryStates(
    {
      url: parseAsString.withDefault(url),
      view: parseAsStringLiteral(viewModes).withDefault("markdown"),
      sidebar: parseAsBoolean.withDefault(initialSidebarOpen),
    },
    {
      history: "replace",
      shallow: true,
    }
  );
  const viewMode = query.view as (typeof viewModes)[number];
  const sidebarOpen = query.sidebar as boolean;

  const activeArticle = articleQuery.data?.article;
  const articleTitle = activeArticle?.title;
  const articleTextContent = activeArticle?.textContent;

  // Track initialization state per URL
  const initializedUrlRef = useRef<string | null>(null);

  // With the auto endpoint, we get a single result - no need for complex selection logic
  const firstSuccessfulArticle = articleQuery.data?.article || null;

  // Fetch ad - pass article data for better targeting
  // Ads refresh every 45 seconds for users who stay on the page
  const { ads: gravityAds, fireImpression, fireClick, fireDismiss } = useGravityAd({
    url,
    title: firstSuccessfulArticle?.title,
    textContent: firstSuccessfulArticle?.textContent,
    isPremium,
    // Additional metadata for better ad targeting
    byline: firstSuccessfulArticle?.byline,
    siteName: firstSuccessfulArticle?.siteName,
    publishedTime: firstSuccessfulArticle?.publishedTime,
    lang: firstSuccessfulArticle?.lang,
  });

  // Ad distribution: Show UNIQUE ads only - don't duplicate the same ad across placements
  // Gravity may return 1-5 ads. We assign each unique ad to exactly one placement.
  // This prevents the same ad from being tracked multiple times as different impressions.
  const sidebarAd = gravityAds[0] ?? null;        // Fixed position ad (always visible)
  const inlineAd = gravityAds[1] ?? null;         // Mid-article ad - only if we have a 2nd ad
  const footerAd = gravityAds[2] ?? null;         // End-of-article ad - only if we have a 3rd ad
  const chatAd = gravityAds[3] ?? null;           // Chat header ad - only if we have a 4th ad
  const microAd = gravityAds[4] ?? null;          // Below chat input - only if we have a 5th ad

  // Mobile chat header fallback: when chat drawer is open, article ads aren't visible,
  // so we can reuse inlineAd/footerAd as fallback if chatAd is unavailable
  const mobileChatAd = chatAd ?? inlineAd ?? footerAd ?? null;

  // Stable ad callbacks for ArticleContent (prevents breaking its React.memo on sidebar toggle)
  const onInlineAdVisible = useCallback(() => { if (inlineAd) fireImpression(inlineAd); }, [inlineAd, fireImpression]);
  const onInlineAdClick = useCallback(() => { if (inlineAd) fireClick(inlineAd); }, [inlineAd, fireClick]);
  const onFooterAdVisible = useCallback(() => { if (footerAd) fireImpression(footerAd); }, [footerAd, fireImpression]);
  const onFooterAdClick = useCallback(() => { if (footerAd) fireClick(footerAd); }, [footerAd, fireClick]);

  // Debug: Log how many unique ads we received and from which provider
  if (typeof window !== 'undefined' && gravityAds.length > 0) {
    const providers = [...new Set(gravityAds.map(a => a.ad_provider || 'gravity'))];
    console.log(`[Ads] Received ${gravityAds.length} ads (${providers.join(' + ')}):`,
      gravityAds.map((a, i) => `[${i}] ${a.brandName} (${a.ad_provider || 'gravity'})`).join(', '));
  }

  // Handle article load: save to history
  useEffect(() => {
    if (!firstSuccessfulArticle || initializedUrlRef.current === url) return;

    initializedUrlRef.current = url;

    // Save to history
    addArticleToHistory(url, firstSuccessfulArticle.title || "Untitled Article");
  }, [firstSuccessfulArticle, url]);

  // TTS (Text-to-Speech) dictation

  const [mobileSummaryOpen, setMobileSummaryOpenRaw] = useState(false);
  const [mobileAnnotationsOpen, setMobileAnnotationsOpenRaw] = useState(false);
  const setMobileSummaryOpen = React.useCallback((val: boolean) => {
    setMobileSummaryOpenRaw(val);
    if (val) setMobileAnnotationsOpenRaw(false);
  }, []);
  const setMobileAnnotationsOpen = React.useCallback((val: boolean) => {
    setMobileAnnotationsOpenRaw(val);
    if (val) setMobileSummaryOpenRaw(false);
  }, []);
  const [mobileAdDismissed, setMobileAdDismissed] = useState(false);
  const [desktopAdDismissed, setDesktopAdDismissed] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [shortcutsDialogOpen, setShortcutsDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [styleOptionsOpen, setStyleOptionsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [sidebarActiveTab, setSidebarActiveTab] = useState<"chat" | "history">("chat");
  const [annotationsSidebarOpen, setAnnotationsSidebarOpenRaw] = useState(false);
  const setAnnotationsSidebarOpen = React.useCallback(
    (value: boolean | ((prev: boolean) => boolean)) => {
      setAnnotationsSidebarOpenRaw((prev) => {
        const next = typeof value === "function" ? value(prev) : value;
        // Close chat sidebar when opening annotations
        if (next) setQuery({ sidebar: null });
        return next;
      });
    },
    [setQuery]
  );

  const tabbedSidebarRef = useRef<TabbedSidebarHandle>(null);
  const mobileSettingsRef = useRef<SettingsDrawerHandle>(null);
  const creatingThreadRef = useRef(false);
  const {
    threads,
    activeThread: _activeThread,
    activeThreadId: currentThreadId,
    createThread,
    updateThread,
    setActiveThreadId,
    deleteThread,
    togglePin,
    renameThread,
    groupedThreads,
    isLoaded: threadsLoaded,
    loadMore,
    hasMore,
    isLoadingMore,
    searchThreads,
    getThreadWithMessages,
    findThreadByArticleUrl,
  } = useChatThreads(isPremium, url);

  // Compute initialMessages from active thread (ThreadMessage is UIMessage-compatible)
  const threadInitialMessages: UIMessage[] = useMemo(() => {
    if (!_activeThread?.messages.length) return [];
    return _activeThread.messages as UIMessage[];
  }, [_activeThread]);

  const handleViewModeChange = React.useCallback(
    (mode: (typeof viewModes)[number]) => {
      setQuery({ view: mode });
    },
    [setQuery]
  );

  const handleSidebarChange = React.useCallback(
    (next: boolean) => {
      setQuery({ sidebar: next ? true : null });
      // Close annotations sidebar when opening chat sidebar
      if (next) setAnnotationsSidebarOpen(false);
    },
    [setQuery, setAnnotationsSidebarOpen]
  );

  // Copy page as markdown (used by ⌘C keyboard shortcut)
  // Note: Visual feedback is handled internally by FloatingToolbar when using the menu
  const handleCopyPage = React.useCallback(async () => {
    try {
      let markdown = `# ${articleTitle || "Article"}\n\n`;
      markdown += `**Source:** ${url}\n\n`;
      if (articleTextContent) {
        markdown += `---\n\n${articleTextContent}\n\n`;
      }
      await navigator.clipboard.writeText(markdown);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  }, [articleTitle, articleTextContent, url]);

  // Open in external AI service
  const handleOpenInAI = React.useCallback((service: "chatgpt" | "claude") => {
    const proxyUrlObj = new URL("https://www.smry.ai/proxy");
    proxyUrlObj.searchParams.set("url", url);
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
  }, [url, source]);

  // Scroll refs (shared between progress tracking and header hide)
  const desktopScrollRef = useRef<HTMLDivElement>(null);
  const mobileScrollRef = useRef<HTMLDivElement>(null);

  // Reading progress tracking (throttled save to localStorage)
  const progressSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const calculateProgress = (scrollEl: HTMLElement): number => {
      const scrollTop = scrollEl.scrollTop;
      const scrollHeight = scrollEl.scrollHeight - scrollEl.clientHeight;
      if (scrollHeight <= 0) return 100;
      return Math.min(100, Math.max(0, (scrollTop / scrollHeight) * 100));
    };

    const handleScroll = (scrollEl: HTMLElement) => {
      if (progressSaveTimerRef.current) return; // throttled
      progressSaveTimerRef.current = setTimeout(() => {
        progressSaveTimerRef.current = null;
        const progress = calculateProgress(scrollEl);
        saveReadingProgress(url, progress);
      }, 3000);
    };

    const desktopEl = desktopScrollRef.current;
    const mobileEl = mobileScrollRef.current;

    const onDesktopScroll = () => desktopEl && handleScroll(desktopEl);
    const onMobileScroll = () => mobileEl && handleScroll(mobileEl);

    desktopEl?.addEventListener("scroll", onDesktopScroll, { passive: true });
    mobileEl?.addEventListener("scroll", onMobileScroll, { passive: true });

    return () => {
      desktopEl?.removeEventListener("scroll", onDesktopScroll);
      mobileEl?.removeEventListener("scroll", onMobileScroll);
      if (progressSaveTimerRef.current) {
        clearTimeout(progressSaveTimerRef.current);
      }
    };
  }, [url, isDesktop]);

  // Save progress on unmount (page navigation)
  useEffect(() => {
    const desktopEl = desktopScrollRef.current;
    const mobileEl = mobileScrollRef.current;
    return () => {
      const scrollEl = desktopEl || mobileEl;
      if (!scrollEl) return;
      const scrollTop = scrollEl.scrollTop;
      const scrollHeight = scrollEl.scrollHeight - scrollEl.clientHeight;
      if (scrollHeight <= 0) return;
      const progress = Math.min(100, Math.max(0, (scrollTop / scrollHeight) * 100));
      saveReadingProgress(url, progress);
    };
  }, [url, isDesktop]);

  // Mobile header hide-on-scroll state
  const [mobileHeaderVisible, setMobileHeaderVisible] = useState(true);
  const lastScrollY = useRef(0);
  const scrollDeltaAccum = useRef(0);
  const headerVisibleRef = useRef(true);
  const lastToggleTime = useRef(0); // Cooldown to prevent mid-animation reversal

  // Track scroll direction to hide/show mobile header (like X/Twitter)
  useEffect(() => {
    const scrollEl = mobileScrollRef.current;
    if (!scrollEl || isDesktop !== false) return;

    const handleScroll = () => {
      const currentY = scrollEl.scrollTop;
      const delta = currentY - lastScrollY.current;
      const now = Date.now();
      lastScrollY.current = currentY;

      // Cooldown: ignore state changes for 300ms after last toggle (animation duration)
      const inCooldown = now - lastToggleTime.current < 300;

      // Always show at top (bypass cooldown for this)
      if (currentY < 50) {
        if (!headerVisibleRef.current) {
          headerVisibleRef.current = true;
          setMobileHeaderVisible(true);
          lastToggleTime.current = now;
        }
        scrollDeltaAccum.current = 0;
        return;
      }

      // Accumulate scroll in same direction, reset on direction change
      if ((delta > 0 && scrollDeltaAccum.current < 0) || (delta < 0 && scrollDeltaAccum.current > 0)) {
        scrollDeltaAccum.current = 0;
      }
      scrollDeltaAccum.current += delta;

      // Skip state changes during cooldown
      if (inCooldown) return;

      // Trigger after accumulating ~60px in one direction (hysteresis)
      if (scrollDeltaAccum.current > 60 && headerVisibleRef.current) {
        headerVisibleRef.current = false;
        setMobileHeaderVisible(false);
        scrollDeltaAccum.current = 0;
        lastToggleTime.current = now;
      } else if (scrollDeltaAccum.current < -60 && !headerVisibleRef.current) {
        headerVisibleRef.current = true;
        setMobileHeaderVisible(true);
        scrollDeltaAccum.current = 0;
        lastToggleTime.current = now;
      }
    };

    scrollEl.addEventListener("scroll", handleScroll, { passive: true });
    return () => scrollEl.removeEventListener("scroll", handleScroll);
  }, [isDesktop]);

  // Handle new chat from history sidebar
  const handleNewChat = React.useCallback(() => {
    let articleDomain: string | undefined;
    try {
      articleDomain = new URL(url).hostname.replace("www.", "");
    } catch {}
    createThread(undefined, {
      articleUrl: url,
      articleTitle: articleTitle,
      articleDomain,
    });
    // Clear current chat messages for the new thread
    tabbedSidebarRef.current?.clearMessages();
  }, [createThread, url, articleTitle]);

  // Use ref for currentThreadId so the callback always reads the latest value
  // without needing it as a dependency (which would cause recreations and re-fires)
  const currentThreadIdRef = useRef(currentThreadId);
  useEffect(() => {
    currentThreadIdRef.current = currentThreadId;
    // Reset the guard so a new thread can be created after switching/deleting
    creatingThreadRef.current = false;
  }, [currentThreadId]);

  // Guard: skip onMessagesChange echo when loading messages from a thread selection
  const isLoadingThreadRef = useRef(false);

  // Auto-load the most recent thread for this article URL on page load.
  // Uses tabbedSidebarRef.setMessages() to push messages into the already-mounted chat
  // (since the initialMessages prop is ignored after mount by useChat's useState).
  //
  // Guard: `currentThreadId` is null on fresh load, set once a thread is loaded.
  // This naturally prevents re-running after auto-load or user actions, and avoids
  // the timing issue where threads haven't loaded from IDB yet (the effect re-fires
  // when findThreadByArticleUrl updates with new threads data).
  useEffect(() => {
    if (!isPremium || !threadsLoaded || currentThreadId) return;

    const match = findThreadByArticleUrl(url);
    if (!match) return;

    // Use the same flow as handleSelectThread to properly load messages
    isLoadingThreadRef.current = true;
    currentThreadIdRef.current = match.id;
    setActiveThreadId(match.id);

    // Async: fetch full messages if needed (cross-device), then push to chat
    (async () => {
      const thread = await getThreadWithMessages(match.id);
      if (thread && thread.messages.length > 0) {
        tabbedSidebarRef.current?.setMessages(thread.messages as UIMessage[]);
      }
      requestAnimationFrame(() => {
        isLoadingThreadRef.current = false;
      });
    })();
  }, [isPremium, threadsLoaded, currentThreadId, url, findThreadByArticleUrl, setActiveThreadId, getThreadWithMessages]);

  // Handle thread selection from history sidebar
  const handleSelectThread = React.useCallback(async (threadId: string) => {
    // Update ref synchronously BEFORE setting messages to prevent race condition
    // (otherwise onMessagesChange fires with the old thread ID and overwrites it)
    isLoadingThreadRef.current = true;
    currentThreadIdRef.current = threadId;
    setActiveThreadId(threadId);

    // Try local messages first, then fetch from server if empty (cross-device)
    const thread = await getThreadWithMessages(threadId);
    if (thread && thread.messages.length > 0) {
      tabbedSidebarRef.current?.setMessages(thread.messages as UIMessage[]);
    } else {
      tabbedSidebarRef.current?.clearMessages();
    }

    // Allow the echo effect to fire and be skipped before re-enabling saves
    requestAnimationFrame(() => {
      isLoadingThreadRef.current = false;
    });

    // Ensure the chat sidebar is open on desktop so the user sees the loaded thread
    if (!sidebarOpen) {
      handleSidebarChange(true);
    }
  }, [setActiveThreadId, getThreadWithMessages, sidebarOpen, handleSidebarChange]);

  // Sync chat messages back to the active thread (premium only)
  const handleMessagesChange = useCallback((messages: UIMessage[]) => {
    if (!isPremium) return;
    // Skip echo-save when loading messages from thread selection
    if (isLoadingThreadRef.current) return;
    // Don't create/update threads when there are no messages (e.g. on mount or clear)
    if (messages.length === 0) return;
    // Save as ThreadMessage[] directly (no lossy {role,content} conversion)
    const threadMessages: ThreadMessage[] = messages.map((msg) => ({
      id: msg.id,
      role: msg.role as "user" | "assistant",
      parts: msg.parts.filter((p) => isTextUIPart(p)).map((p) => ({ type: "text" as const, text: (p as { text: string }).text })),
    }));
    // Auto-title from first user message
    const firstUserMsg = threadMessages.find((m) => m.role === "user");
    const firstUserText = firstUserMsg?.parts[0]?.text || "";
    const title = firstUserText
      ? firstUserText.slice(0, 50) + (firstUserText.length > 50 ? "..." : "")
      : "New Chat";

    const threadId = currentThreadIdRef.current;
    if (threadId) {
      updateThread(threadId, { messages: threadMessages, title });
    } else if (!creatingThreadRef.current) {
      // Guard against duplicate creates during rapid message updates
      creatingThreadRef.current = true;
      let articleDomain: string | undefined;
      try {
        articleDomain = new URL(url).hostname.replace("www.", "");
      } catch {}
      const newThread = createThread(title, {
        articleUrl: url,
        articleTitle: articleTitle,
        articleDomain,
      }, threadMessages);
      // Set ref synchronously so the next onMessagesChange (which fires fast during streaming)
      // can update the thread instead of being silently dropped
      currentThreadIdRef.current = newThread.id;
    }
  }, [isPremium, updateThread, createThread, url, articleTitle]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;

      // ⌘I — Toggle AI chat
      if (mod && e.key === "i") {
        e.preventDefault();
        if (sidebarOpen && sidebarActiveTab === "chat") {
          // Already on chat tab, close sidebar
          handleSidebarChange(false);
        } else {
          // Open sidebar and switch to chat tab
          if (!sidebarOpen) {
            handleSidebarChange(true);
          }
          tabbedSidebarRef.current?.setActiveTab("chat");
          setSidebarActiveTab("chat");
        }
        return;
      }
      // ⌘⇧H — Toggle history tab in sidebar
      if (mod && e.shiftKey && (e.key === "h" || e.key === "H")) {
        e.preventDefault();
        if (sidebarOpen && sidebarActiveTab === "history") {
          // Already on history tab, close sidebar
          handleSidebarChange(false);
        } else {
          // Open sidebar and switch to history tab
          if (!sidebarOpen) {
            handleSidebarChange(true);
          }
          tabbedSidebarRef.current?.setActiveTab("history");
          setSidebarActiveTab("history");
        }
        return;
      }
      // ⌘⇧N — New chat thread
      if (mod && e.shiftKey && (e.key === "n" || e.key === "N")) {
        e.preventDefault();
        handleNewChat();
        return;
      }
      // ⌘⇧C — Copy last AI response
      if (mod && e.shiftKey && (e.key === "c" || e.key === "C")) {
        e.preventDefault();
        tabbedSidebarRef.current?.copyLastResponse();
        return;
      }
      // Esc — Stop AI generation (don't preventDefault so dialogs still close)
      if (e.key === "Escape") {
        tabbedSidebarRef.current?.stopGeneration();
        return;
      }

      // Guard: don't fire plain-key shortcuts while typing
      if (isTypingInInput(e)) return;

      // ? — Toggle shortcuts cheat sheet
      if (e.key === "?" && !mod) {
        e.preventDefault();
        setShortcutsDialogOpen((prev) => !prev);
        return;
      }
      // / — Focus chat input (only when sidebar is open)
      if (e.key === "/" && !mod && sidebarOpen) {
        e.preventDefault();
        tabbedSidebarRef.current?.focusInput();
        return;
      }
      // V — Cycle view mode (Reader → Original → Frame)
      if ((e.key === "v" || e.key === "V") && !mod) {
        e.preventDefault();
        const modes: Array<"markdown" | "html" | "iframe"> = ["markdown", "html", "iframe"];
        const currentIndex = modes.indexOf(viewMode);
        const nextIndex = (currentIndex + 1) % modes.length;
        handleViewModeChange(modes[nextIndex]);
        return;
      }
      // O — Open original URL
      if ((e.key === "o" || e.key === "O") && !mod) {
        e.preventDefault();
        window.open(url, "_blank", "noopener,noreferrer");
        return;
      }
      // , — Open settings popover
      if (e.key === "," && !mod) {
        e.preventDefault();
        setSettingsOpen(true);
        return;
      }
      // ⌘C — Copy page as markdown (only when no text is selected and not in input)
      if (mod && (e.key === "c" || e.key === "C") && !e.shiftKey) {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) {
          e.preventDefault();
          handleCopyPage();
        }
        return;
      }
      // ⌘⇧G — Open in ChatGPT (uses modifier to prevent accidental triggers)
      if (mod && e.shiftKey && (e.key === "g" || e.key === "G")) {
        e.preventDefault();
        handleOpenInAI("chatgpt");
        return;
      }
      // ⌘⇧A — Open in Claude (uses modifier to prevent accidental triggers)
      if (mod && e.shiftKey && (e.key === "a" || e.key === "A")) {
        e.preventDefault();
        handleOpenInAI("claude");
        return;
      }
      // ⇧S — Open Share modal (Shift+S must be before plain S)
      if (e.shiftKey && (e.key === "s" || e.key === "S") && !mod) {
        e.preventDefault();
        setShareOpen(true);
        return;
      }
      // A — Toggle annotations sidebar
      if ((e.key === "a" || e.key === "A") && !mod && !e.shiftKey) {
        e.preventDefault();
        setAnnotationsSidebarOpen((prev) => !prev);
        return;
      }
      // S — Open Style Options popover
      if ((e.key === "s" || e.key === "S") && !mod && !e.shiftKey) {
        e.preventDefault();
        setStyleOptionsOpen(true);
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [sidebarOpen, sidebarActiveTab, handleSidebarChange, handleNewChat, viewMode, handleViewModeChange, url, handleCopyPage, handleOpenInAI, setAnnotationsSidebarOpen]);

  return (
    <div className="flex h-dvh flex-col bg-background">
      {/* Promo Banner - desktop/tablet */}
      {showDesktopPromo && <PromoBanner />}
      <UpdateBanner className="hidden md:block" />

      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Content Area - conditionally render desktop or mobile layout */}
        <main className="flex-1 overflow-hidden">
        <HighlightsProvider articleUrl={url} articleTitle={articleTitle}>
          {isDesktop === null ? (
            // SSR/hydration: render nothing to avoid layout shift
            // The layout will render on client after hydration
            <div className="h-full bg-background" />
          ) : isDesktop ? (
            // Desktop: Sidebar layout — content shifts left when chat opens
            <SidebarProvider
              open={sidebarOpen}
              onOpenChange={handleSidebarChange}
              className="h-full !min-h-0"
              style={{ "--sidebar-width": "440px" } as React.CSSProperties}
            >
              {/* Main content area — flex-1 shrinks when sidebar gap appears */}
              <div className="flex-1 min-w-0 relative h-full">
                {/* Back arrow - top left */}
                <button
                  onClick={() => window.history.back()}
                  className="absolute top-4 left-4 z-50 size-10 flex items-center justify-center rounded-xl border border-border/60 bg-background/60 backdrop-blur-sm text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                  aria-label="Go back"
                >
                  <ArrowLeft className="size-5" />
                </button>

                {/* Top-right action buttons — AI Chat + Annotations */}
                <div
                  className="absolute top-4 z-50 flex flex-col gap-2 transition-[right] duration-200 ease-linear"
                  style={{ right: annotationsSidebarOpen ? 'calc(320px + 1rem)' : '1rem' }}
                >
                  {/* AI Chat toggle */}
                  {(sidebarOpen || annotationsSidebarOpen) ? (
                    <div className="relative group">
                      <button
                        onClick={() => {
                          if (sidebarOpen) {
                            handleSidebarChange(false);
                          } else {
                            handleSidebarChange(true);
                            tabbedSidebarRef.current?.setActiveTab("chat");
                            setSidebarActiveTab("chat");
                          }
                        }}
                        className={cn(
                          "size-10 flex items-center justify-center rounded-xl border backdrop-blur-md shadow-sm transition-colors",
                          sidebarOpen
                            ? "border-primary/30 bg-primary/10 text-primary hover:bg-primary/20"
                            : "border-border/60 bg-background/80 text-muted-foreground hover:text-foreground hover:bg-muted/80"
                        )}
                        aria-label={sidebarOpen ? "Close AI Chat (⌘I)" : "Open AI Chat (⌘I)"}
                      >
                        <AiMagic className="size-4" />
                      </button>
                      <div className="absolute right-full mr-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-popover text-popover-foreground text-xs px-2 py-1 rounded-md border shadow-sm">
                        {sidebarOpen ? "Close" : "Open"} AI Chat <Kbd className="ml-1 text-[10px] px-1 py-0.5">⌘I</Kbd>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        handleSidebarChange(true);
                        tabbedSidebarRef.current?.setActiveTab("chat");
                        setSidebarActiveTab("chat");
                      }}
                      className="flex items-center gap-2.5 h-10 pl-3.5 pr-3 rounded-xl border border-border/60 bg-background/80 backdrop-blur-md shadow-sm text-foreground hover:bg-muted/80 transition-colors"
                      aria-label="Ask AI (⌘I)"
                    >
                      <AiMagic className="size-4" />
                      <span className="text-sm font-medium">AI Chat</span>
                      <Kbd className="ml-0.5 text-[10px] px-1.5 py-0.5 bg-muted/80">⌘I</Kbd>
                    </button>
                  )}

                  {/* Annotations toggle */}
                  {(sidebarOpen || annotationsSidebarOpen) ? (
                    <div className="relative group">
                      <button
                        onClick={() => setAnnotationsSidebarOpen((prev) => !prev)}
                        className={cn(
                          "size-10 flex items-center justify-center rounded-xl border backdrop-blur-md shadow-sm transition-colors",
                          annotationsSidebarOpen
                            ? "border-primary/30 bg-primary/10 text-primary hover:bg-primary/20"
                            : "border-border/60 bg-background/80 text-muted-foreground hover:text-foreground hover:bg-muted/80"
                        )}
                        aria-label="Toggle Annotations (A)"
                      >
                        <Highlighter className="size-4" />
                      </button>
                      <div className="absolute right-full mr-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-popover text-popover-foreground text-xs px-2 py-1 rounded-md border shadow-sm">
                        {annotationsSidebarOpen ? "Close" : "Open"} Annotations <Kbd className="ml-1 text-[10px] px-1 py-0.5">A</Kbd>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAnnotationsSidebarOpen(true)}
                      className="flex items-center gap-2.5 h-10 pl-3.5 pr-3 rounded-xl border border-border/60 bg-background/80 backdrop-blur-md shadow-sm text-foreground hover:bg-muted/80 transition-colors"
                      aria-label="Annotations (A)"
                    >
                      <Highlighter className="size-4" />
                      <span className="text-sm font-medium">Annotations</span>
                      <Kbd className="ml-0.5 text-[10px] px-1.5 py-0.5 bg-muted/80">A</Kbd>
                    </button>
                  )}
                </div>

                <div ref={desktopScrollRef} className="h-full overflow-y-auto bg-background scrollbar-hide">
                  <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-6">
                    <ArticleContent
                      data={articleQuery.data}
                      isLoading={articleQuery.isLoading}
                      isError={articleQuery.isError}
                      error={articleQuery.error}
                      source={source}
                      url={url}
                      viewMode={viewMode}
                      isFullScreen={isFullScreen}
                      onFullScreenChange={setIsFullScreen}
                      inlineAd={!isPremium ? inlineAd : null}
                      onInlineAdVisible={inlineAd ? onInlineAdVisible : undefined}
                      onInlineAdClick={inlineAd ? onInlineAdClick : undefined}
                      showInlineAd={!isPremium}
                      footerAd={!isPremium ? footerAd : null}
                      onFooterAdVisible={footerAd ? onFooterAdVisible : undefined}
                      onFooterAdClick={footerAd ? onFooterAdClick : undefined}
                    />
                  </div>
                </div>

                {/* Fixed bottom-right ad when sidebar is closed */}
                {!sidebarOpen && !isPremium && sidebarAd && !desktopAdDismissed && (
                  <div className="fixed bottom-4 right-4 z-40 w-[280px] lg:w-[320px] xl:w-[360px] max-w-[calc(100vw-2rem)]">
                    <GravityAd
                      ad={sidebarAd}
                      onVisible={() => fireImpression(sidebarAd)}
                      onClick={() => fireClick(sidebarAd)}
                      onDismiss={() => {
                        fireDismiss(sidebarAd);
                        setDesktopAdDismissed(true);
                      }}
                      variant={sidebarOpen ? "compact" : "default"}
                    />
                  </div>
                )}

                {/* Floating Toolbar - Desktop only */}
                <FloatingToolbar
                  viewMode={viewMode}
                  onViewModeChange={handleViewModeChange}
                  originalUrl={url}
                  shareUrl={`https://smry.ai/proxy?url=${encodeURIComponent(url)}`}
                  articleTitle={articleTitle}
                  articleTextContent={articleTextContent}
                  source={source || "smry-fast"}
                  sidebarOpen={sidebarOpen}
                  onOpenSettings={() => setSettingsOpen(true)}
                  styleOptionsOpen={styleOptionsOpen}
                  onStyleOptionsOpenChange={setStyleOptionsOpen}
                  shareOpen={shareOpen}
                  onShareOpenChange={setShareOpen}
                />

                {/* Settings Popover - Desktop dialog, Mobile drawer */}
                <SettingsPopover
                  open={settingsOpen}
                  onOpenChange={setSettingsOpen}
                />

                {/* Annotations Sidebar — slides from right as overlay */}
                <AnnotationsSidebar
                  open={annotationsSidebarOpen}
                  onOpenChange={setAnnotationsSidebarOpen}
                  articleUrl={url}
                  articleTitle={articleTitle}
                />
              </div>

              {/* Chat Sidebar — pushes content left when open */}
              <Sidebar side="right" collapsible="offcanvas">
                <SidebarContent className="overflow-hidden">
                  <div className="h-full">
                    <TabbedSidebar
                      ref={tabbedSidebarRef}
                      articleContent={articleTextContent || ""}
                      articleTitle={articleTitle}
                      isOpen={sidebarOpen}
                      onOpenChange={handleSidebarChange}
                      isPremium={isPremium}
                      initialMessages={threadInitialMessages}
                      onMessagesChange={isPremium ? handleMessagesChange : undefined}
                      activeThreadTitle={_activeThread?.title}
                      headerAd={!isPremium ? chatAd : null}
                      onHeaderAdVisible={chatAd ? () => fireImpression(chatAd) : undefined}
                      onHeaderAdClick={chatAd ? () => fireClick(chatAd) : undefined}
                      microAd={!isPremium ? microAd : null}
                      onMicroAdVisible={microAd ? () => fireImpression(microAd) : undefined}
                      onMicroAdClick={microAd ? () => fireClick(microAd) : undefined}
                      threads={threads}
                      activeThreadId={currentThreadId}
                      onNewChat={handleNewChat}
                      onSelectThread={handleSelectThread}
                      onDeleteThread={deleteThread}
                      onTogglePin={togglePin}
                      onRenameThread={renameThread}
                      groupedThreads={groupedThreads}
                      hasMore={hasMore}
                      isLoadingMore={isLoadingMore}
                      onLoadMore={loadMore}
                      searchThreads={searchThreads}
                      onTabChange={setSidebarActiveTab}
                    />
                  </div>
                </SidebarContent>
              </Sidebar>
            </SidebarProvider>
          ) : (
            // Mobile: Clean article-first layout with bottom bar
            <div className="h-full relative">
              {/* Scrollable content area */}
              <div
                ref={mobileScrollRef}
                className={cn(
                  "h-full overflow-y-auto bg-background touch-pan-y",
                  !isPremium && sidebarAd && !mobileAdDismissed ? "pb-36" : "pb-16"
                )}
              >
                {/* Mobile promo + header stack with safe-area support */}
                <div
                  className={cn(
                    "sticky top-0 z-40 bg-background transition-transform duration-300 ease-out",
                    !mobileHeaderVisible && "-translate-y-full"
                  )}
                >
                  {showMobilePromo && <PromoBanner className="md:hidden" />}
                  <UpdateBanner className="md:hidden" />
                  <header className="flex h-14 items-center bg-background px-4">
                    {/* Back button - left */}
                    <div className="flex items-center gap-3 shrink-0">
                      <button
                        onClick={() => window.history.back()}
                        className="size-9 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        aria-label="Go back"
                      >
                        <ArrowLeft className="size-5" />
                      </button>
                    </div>

                    {/* Domain name - center */}
                    <div className="flex-1 flex items-center justify-center">
                      <span className="text-sm font-medium text-muted-foreground truncate max-w-[200px]">
                        {(() => {
                          try {
                            return new URL(url).hostname.replace('www.', '').toUpperCase();
                          } catch {
                            return '';
                          }
                        })()}
                      </span>
                    </div>

                    {/* Right buttons: annotations + AI chat */}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setMobileAnnotationsOpen(true)}
                        className={cn(
                          "size-9 flex items-center justify-center rounded-full transition-colors",
                          mobileAnnotationsOpen
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        )}
                        aria-label="Open annotations"
                      >
                        <Highlighter className="size-5" />
                      </button>
                      <button
                        onClick={() => setMobileSummaryOpen(true)}
                        className={cn(
                          "size-9 flex items-center justify-center rounded-full transition-colors",
                          mobileSummaryOpen
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        )}
                        aria-label="Open chat"
                      >
                        <AiMagic className="size-5" />
                      </button>
                    </div>
                  </header>
                </div>

                <div
                  className={cn(
                    viewMode === "html"
                      ? "px-2 pt-2" // Near-fullscreen with small margins for HTML mode
                      : "mx-auto max-w-3xl px-4 sm:px-6 py-4" // Padded for reader mode
                  )}
                >
                  {/* Article content */}
                  <ArticleContent
                    data={articleQuery.data}
                    isLoading={articleQuery.isLoading}
                    isError={articleQuery.isError}
                    error={articleQuery.error}
                    source={source}
                    url={url}
                    viewMode={viewMode}
                    isFullScreen={isFullScreen}
                    onFullScreenChange={setIsFullScreen}
                    inlineAd={!isPremium ? inlineAd : null}
                    onInlineAdVisible={inlineAd ? onInlineAdVisible : undefined}
                    onInlineAdClick={inlineAd ? onInlineAdClick : undefined}
                    showInlineAd={!isPremium}
                    footerAd={!isPremium ? footerAd : null}
                    onFooterAdVisible={footerAd ? onFooterAdVisible : undefined}
                    onFooterAdClick={footerAd ? onFooterAdClick : undefined}
                  />
                </div>
              </div>

              {/* Mobile Chat Drawer — fullscreen vaul drawer */}
              <MobileChatDrawer
                open={mobileSummaryOpen}
                onOpenChange={setMobileSummaryOpen}
                articleContent={articleTextContent || ""}
                articleTitle={articleTitle}
                chatAd={!isPremium ? mobileChatAd : null}
                onChatAdVisible={mobileChatAd ? () => fireImpression(mobileChatAd) : undefined}
                onChatAdClick={mobileChatAd ? () => fireClick(mobileChatAd) : undefined}
                isPremium={isPremium}
                initialMessages={threadInitialMessages}
                onMessagesChange={isPremium ? handleMessagesChange : undefined}
                threads={threads}
                activeThreadId={currentThreadId}
                onSelectThread={handleSelectThread}
                onNewChat={handleNewChat}
                onDeleteThread={deleteThread}
                groupedThreads={groupedThreads}
                hasMore={hasMore}
                isLoadingMore={isLoadingMore}
                onLoadMore={loadMore}
                searchThreads={searchThreads}
                getThreadWithMessages={getThreadWithMessages}
              />

              {/* Mobile Annotations Drawer — bottom sheet */}
              <MobileAnnotationsDrawer
                open={mobileAnnotationsOpen}
                onOpenChange={setMobileAnnotationsOpen}
                articleUrl={url}
                articleTitle={articleTitle}
              />

              {/* Fixed ad above bottom bar - responsive CSS handles phone vs tablet sizing */}
              {!isPremium && sidebarAd && !mobileAdDismissed && (
                <div
                  className="fixed left-0 right-0 z-20"
                  style={{ bottom: 'calc(3.5rem + env(safe-area-inset-bottom, 0px))' }}
                >
                  <GravityAd
                    ad={sidebarAd}
                    variant="mobile"
                    onVisible={() => fireImpression(sidebarAd)}
                    onClick={() => fireClick(sidebarAd)}
                    onDismiss={() => {
                      fireDismiss(sidebarAd);
                      setMobileAdDismissed(true);
                    }}
                  />
                </div>
              )}

              {/* Mobile Bottom Bar */}
              <MobileBottomBar
                viewMode={viewMode || "markdown"}
                onViewModeChange={handleViewModeChange}
                smryUrl={`https://smry.ai/proxy?url=${encodeURIComponent(url)}`}
                originalUrl={url}
                articleTitle={articleTitle}
                onOpenSettings={() => mobileSettingsRef.current?.open()}
              />

              {/* Mobile Settings Drawer - native iOS style */}
              <SettingsDrawer
                ref={mobileSettingsRef}
                viewMode={viewMode || "markdown"}
                onViewModeChange={handleViewModeChange}
              />
            </div>
          )}
        </HighlightsProvider>
        </main>
      </div>
      <KeyboardShortcutsDialog
        open={shortcutsDialogOpen}
        onOpenChange={setShortcutsDialogOpen}
      />

    </div>
  );
}
