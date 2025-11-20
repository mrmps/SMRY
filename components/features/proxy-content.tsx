"use client";

import React from "react";
import ArrowTabs from "@/components/article/tabs";
import { ResponsiveDrawer } from "@/components/features/responsive-drawer";
import SummaryForm from "@/components/features/summary-form";
import { useArticles } from "@/lib/hooks/use-articles";
import { DocumentTextIcon, Squares2X2Icon, CodeBracketIcon } from "@heroicons/react/24/outline";
import { Bug as BugIcon, Sparkles as SparklesIcon } from "lucide-react";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { cn } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import ShareButton from "@/components/features/share-button";
import { buttonVariants, Button } from "@/components/ui/button";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useQueryState, parseAsStringLiteral, parseAsBoolean } from "nuqs";
import { ImperativePanelHandle } from "react-resizable-panels";
import { Source, SOURCES } from "@/types/api";

interface ProxyContentProps {
  url: string;
  ip: string;
}

export function ProxyContent({ url, ip }: ProxyContentProps) {
  const { results } = useArticles(url);
  const [source] = useQueryState<Source>(
    "source",
    parseAsStringLiteral(SOURCES).withDefault("smry-fast")
  );
  const [viewMode, setViewMode] = useQueryState(
    "view",
    parseAsStringLiteral(["markdown", "html", "iframe"] as const).withDefault("markdown")
  );
  const [sidebarOpen, setSidebarOpen] = useQueryState(
    "sidebar",
    parseAsBoolean.withDefault(false)
  );
  const isMobile = useMediaQuery("(max-width: 768px)");
  
  const summaryPanelRef = React.useRef<ImperativePanelHandle>(null);

  React.useEffect(() => {
    const panel = summaryPanelRef.current;
    if (panel) {
      if (sidebarOpen) {
        panel.expand();
      } else {
        panel.collapse();
      }
    }
  }, [sidebarOpen]);

  // Mobile Layout
  if (isMobile) {
    return (
      <div className="relative flex min-h-screen justify-center">
          <div className="mx-auto max-w-prose px-4">
            <div className="flex items-center justify-between gap-2 py-4">
                 <Link href="/" className="mr-2 transition-opacity hover:opacity-80">
                   <Image
                     src="/logo.svg"
                     width={100}
                     height={100}
                     alt="smry logo"
                     className="h-7 w-auto transition-all hover:opacity-80"
                     priority
                   />
                 </Link>
          
                {/* AI Summary */}
                  <ResponsiveDrawer open={sidebarOpen} onOpenChange={setSidebarOpen}>
                    <div className="remove-all h-full">
                      <SummaryForm 
                        urlProp={url} 
                        ipProp={ip}
                        articleResults={results}
                        isOpen={sidebarOpen || false}
                      />
                    </div>
                  </ResponsiveDrawer>
          
                {/* View Mode Toggle - IOS Segmented Control Style */}
                <div className="inline-flex h-8 items-center rounded-lg bg-zinc-100 p-0.5 dark:bg-zinc-800">
                  <button
                    onClick={() => setViewMode("markdown")}
                    className={cn(
                      "flex h-full items-center justify-center rounded-md px-2.5 text-xs font-medium transition-all",
                      viewMode === "markdown" 
                        ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-50" 
                        : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
                    )}
                    title="Markdown"
                  >
                    <DocumentTextIcon className="size-4" />
                  </button>
                  <button
                    onClick={() => setViewMode("html")}
                    className={cn(
                      "flex h-full items-center justify-center rounded-md px-2.5 text-xs font-medium transition-all",
                      viewMode === "html" 
                        ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-50" 
                        : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
                    )}
                    title="HTML"
                  >
                    <CodeBracketIcon className="size-4" />
                  </button>
                  <button
                    onClick={() => setViewMode("iframe")}
                    className={cn(
                      "flex h-full items-center justify-center rounded-md px-2.5 text-xs font-medium transition-all",
                      viewMode === "iframe" 
                        ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-50" 
                        : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
                    )}
                    title="Iframe"
                  >
                    <Squares2X2Icon className="size-4" />
                  </button>
                </div>
              </div>
            <ArrowTabs 
              url={url} 
              articleResults={results} 
              viewMode={viewMode} 
            />
          </div>
      </div>
    );
  }

  // Desktop Layout - Dashboard Style
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      {/* Unified Top Bar */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-card px-4 z-20 relative">
        {/* Left: Brand */}
        <Link href="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
           <Image
             src="/logo.svg"
             width={100}
             height={100}
             alt="smry logo"
             className="h-6 w-auto"
             priority
           />
        </Link>

        {/* Center: The Control Pills */}
        <div className="flex items-center p-0.5 bg-accent rounded-lg absolute left-1/2 -translate-x-1/2">
          <button 
            onClick={() => setViewMode("markdown")}
            className={cn(
              "px-3 py-1 text-xs font-medium rounded-[6px] transition-all",
              viewMode === "markdown" 
                ? "bg-card shadow-sm text-foreground" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            reader
          </button>
          <button 
            onClick={() => setViewMode("html")}
            className={cn(
              "px-3 py-1 text-xs font-medium rounded-[6px] transition-all",
              viewMode === "html" 
                ? "bg-card shadow-sm text-foreground" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            original
          </button>
           <button 
            onClick={() => setViewMode("iframe")}
            className={cn(
              "px-3 py-1 text-xs font-medium rounded-[6px] transition-all",
              viewMode === "iframe" 
                ? "bg-card shadow-sm text-foreground" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            iframe
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1">
          <Button
             variant={sidebarOpen ? "secondary" : "outline"}
             size="sm"
             className="h-8 text-xs font-medium"
             onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <SparklesIcon className="mr-1.5 size-3.5" />
            Summary
          </Button>
          <ShareButton 
            url={`https://smry.ai/${url}`} 
            source={source || "smry-fast"}
            viewMode={viewMode || "markdown"}
            sidebarOpen={sidebarOpen !== null ? sidebarOpen : true}
          />
          <a
            href="https://smryai.userjot.com/"
            target="_blank"
            rel="noreferrer"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-8 text-xs font-medium text-muted-foreground hover:text-foreground")}
          >
            <BugIcon className="mr-1.5 size-3.5" />
            Report Bug
          </a>
        </div>
      </header>

      {/* Resizable Content Area */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal" className="h-full w-full rounded-none border-0">
          {/* Left Panel: Page Content with Tabs */}
          <ResizablePanel defaultSize={75} minSize={30}>
            <div className="h-full w-full overflow-y-auto bg-card">
              <div className="mx-auto max-w-3xl p-6">
                <ArrowTabs 
                  url={url} 
                  articleResults={results} 
                  viewMode={viewMode} 
                />
              </div>
            </div>
          </ResizablePanel>
          
          <ResizableHandle withHandle />
          
          {/* Right Panel: Summary */}
          <ResizablePanel 
            ref={summaryPanelRef}
            defaultSize={25} 
            minSize={20} 
            maxSize={40} 
            collapsible={true} 
            collapsedSize={0} 
            className="bg-accent/5"
            onCollapse={() => setSidebarOpen(false)}
            onExpand={() => setSidebarOpen(true)}
          >
             <div className="h-full overflow-y-auto flex flex-col">
                  <SummaryForm 
                    urlProp={url} 
                    ipProp={ip}
                    articleResults={results}
                    isOpen={sidebarOpen || false}
                  />
             </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
