"use client";

import React from "react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { useMediaQuery } from "usehooks-ts";
import { ImperativePanelHandle } from "react-resizable-panels";
import SummaryForm from "@/components/features/summary-form";
import { ArticleResponse, Source } from "@/types/api";
import { UseQueryResult } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

type ArticleResults = Record<Source, UseQueryResult<ArticleResponse, Error>>;

interface ResizableModalProps {
  url: string;
  ip: string;
  articleResults: ArticleResults;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  children: React.ReactNode;
}

export function ResizableModal({
  url,
  ip,
  articleResults,
  sidebarOpen,
  setSidebarOpen,
  children,
}: ResizableModalProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)", {
    defaultValue: false,
    initializeWithValue: false,
  });
  const drawerContentId = React.useId();
  
  const summaryPanelRef = React.useRef<ImperativePanelHandle>(null);
  const [isAnimating, setIsAnimating] = React.useState(false);
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const rafRef = React.useRef<number | null>(null);
  
  React.useEffect(() => {
    if (!isDesktop) return;
    
    const panel = summaryPanelRef.current;
    if (panel) {
      // Guard to prevent unnecessary animations during resize/drag
      // We only animate if the open state mismatches the panel's actual state
      const isExpanded = panel.getSize() > 0;
      if (sidebarOpen === isExpanded) return;

      // Clear any existing timeouts
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);

      setIsAnimating(true);
      
      rafRef.current = requestAnimationFrame(() => {
        if (sidebarOpen) {
          panel.expand(30);
        } else {
          panel.collapse();
        }
      });

      timeoutRef.current = setTimeout(() => {
        setIsAnimating(false);
        timeoutRef.current = null;
      }, 500); // Matches duration-500
    }

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [sidebarOpen, isDesktop]);

  if (isDesktop) {
    return (
      <div className="flex h-screen flex-col overflow-hidden bg-background">
        <div className="flex-1 overflow-hidden">
          <ResizablePanelGroup 
            direction="horizontal" 
            className="h-full w-full rounded-none border-0 group/panels"
          >
            <ResizablePanel defaultSize={70} minSize={30}>
              {children}
            </ResizablePanel>
            
            <ResizableHandle 
              withHandle 
              className={cn(
                "transition-opacity duration-300 group-active/panels:pointer-events-none!",
                !sidebarOpen && "opacity-0 pointer-events-none w-0"
              )} 
            />
            
            <ResizablePanel 
              ref={summaryPanelRef}
              defaultSize={sidebarOpen ? 30 : 0} 
              minSize={20} 
              maxSize={40} 
              collapsible={true} 
              collapsedSize={0} 
              className={cn(
                "bg-accent/5 overflow-hidden",
                "transition-[flex-grow,flex-basis] duration-500 ease-[cubic-bezier(0.25,0.1,0.25,1)]",
                "group-active/panels:transition-none"
              )}
              onCollapse={() => {
                 if (sidebarOpen) setSidebarOpen(false);
              }}
              onExpand={() => {
                 if (!sidebarOpen) setSidebarOpen(true);
              }}
            >
               <div 
                 className="h-full overflow-y-auto flex flex-col"
                 style={{
                   // During animation or when closed, fix width to prevents text reflow.
                   // When open and static, allow full fluid width (100%) to avoid clipping.
                   minWidth: !sidebarOpen || isAnimating ? "30vw" : "100%"
                 }}
               >
                    <SummaryForm 
                      urlProp={url} 
                      ipProp={ip}
                      articleResults={articleResults}
                      isOpen={sidebarOpen || false}
                    />
               </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </div>
    );
  }

  // Mobile Layout
  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <div className="flex-1">
          {children}
      </div>

      <Drawer open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <DrawerContent
          id={drawerContentId}
          className="flex h-[85vh] flex-col bg-zinc-50 dark:bg-zinc-900 md:hidden"
          overlayClassName="md:hidden"
        >
          <DrawerTitle className="sr-only">Generate Summary</DrawerTitle>
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="remove-all h-full">
              <SummaryForm
                urlProp={url}
                ipProp={ip}
                articleResults={articleResults}
                isOpen={sidebarOpen || false}
                usePortal={false}
              />
            </div>
          </div>
          <DrawerFooter className="pb-safe shrink-0 border-t border-zinc-100 bg-white pt-3 dark:border-zinc-800 dark:bg-zinc-950">
            <DrawerClose
              render={(renderProps) => {
                const { className, ...closeProps } = renderProps;
                const { key, ...restProps } = closeProps as typeof closeProps & {
                  key?: React.Key;
                };
                return (
                  <Button
                    {...restProps}
                    key={key}
                    variant="ghost"
                    className={cn(
                      "h-9 w-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50",
                      className
                    )}
                  >
                    Close
                  </Button>
                );
              }}
            />
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}



