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
      <div className="relative flex min-h-screen flex-col bg-background">
        {/* Sticky Mobile Header */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border/40 bg-background/80 px-4 backdrop-blur-xl supports-backdrop-filter:bg-background/60">
          <Link href="/" className="transition-opacity hover:opacity-80">
            <Image
              src="/logo.svg"
              width={80}
              height={80}
              alt="smry logo"
              className="h-6 w-auto"
              priority
            />
          </Link>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex h-8 items-center rounded-lg border border-border/50 bg-background p-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewMode("markdown")}
                className={cn(
                  "h-full rounded-none rounded-l-lg border-r border-border/50 px-2.5 hover:bg-accent",
                  viewMode === "markdown" && "bg-accent text-foreground"
                )}
                title="Reader View"
              >
                <DocumentTextIcon className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewMode("html")}
                className={cn(
                  "h-full rounded-none border-r border-border/50 px-2.5 hover:bg-accent",
                  viewMode === "html" && "bg-accent text-foreground"
                )}
                title="Original View"
              >
                <CodeBracketIcon className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewMode("iframe")}
                className={cn(
                  "h-full rounded-none rounded-r-lg px-2.5 hover:bg-accent",
                  viewMode === "iframe" && "bg-accent text-foreground"
                )}
                title="Iframe View"
              >
                <Squares2X2Icon className="size-4" />
              </Button>
            </div>

            {/* Summary Trigger */}
            <ResponsiveDrawer 
              open={sidebarOpen} 
              onOpenChange={setSidebarOpen}
              trigger={
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 rounded-lg hover:bg-accent"
                >
                  <SparklesIcon className="size-4" />
                </Button>
              }
            >
              <div className="remove-all h-full">
                <SummaryForm
                  urlProp={url}
                  ipProp={ip}
                  articleResults={results}
                  isOpen={sidebarOpen || false}
                />
              </div>
            </ResponsiveDrawer>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1">
          <div className="min-h-[calc(100vh-3.5rem)]">
            <ArrowTabs
              url={url}
              articleResults={results}
              viewMode={viewMode}
            />
          </div>
        </main>
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
