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
import { InlineSummary } from "@/components/features/inline-summary";
import { ArticleResponse, Source } from "@/types/api";
import { UseQueryResult } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

type ArticleResults = Record<Source, UseQueryResult<ArticleResponse, Error>>;

interface ResizableModalProps {
  url: string;
  articleResults: ArticleResults;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  children: React.ReactNode;
}

export function ResizableModal({
  url,
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
  const rafRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (!isDesktop) return;

    const panel = summaryPanelRef.current;
    if (panel) {
      // Guard to prevent unnecessary animations during resize/drag
      // We only animate if the open state mismatches the panel's actual state
      const isExpanded = panel.getSize() > 0;
      if (sidebarOpen === isExpanded) return;

      // Clear any existing RAF
      if (rafRef.current) cancelAnimationFrame(rafRef.current);

      rafRef.current = requestAnimationFrame(() => {
        if (sidebarOpen) {
          panel.expand(25);
        } else {
          panel.collapse();
        }
      });
    }

    return () => {
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
              className={cn(
                "transition-opacity duration-300",
                !sidebarOpen && "opacity-0 pointer-events-none w-0"
              )}
            />

            {/* Summary sidebar panel - fixed at 25% width for consistent layout in this modal variant */}
            <ResizablePanel
              ref={summaryPanelRef}
              defaultSize={sidebarOpen ? 25 : 0}
              minSize={25}
              maxSize={25}
              collapsible={true}
              collapsedSize={0}
              className={cn(
                "bg-accent/5 overflow-hidden",
                "transition-[flex-grow,flex-basis] duration-500 ease-[cubic-bezier(0.25,0.1,0.25,1)]"
              )}
              onCollapse={() => {
                 if (sidebarOpen) setSidebarOpen(false);
              }}
              onExpand={() => {
                 if (!sidebarOpen) setSidebarOpen(true);
              }}
            >
               <div className="h-full overflow-y-auto flex flex-col p-4">
                    <InlineSummary
                      urlProp={url}
                      articleResults={articleResults}
                      isOpen={sidebarOpen}
                      onOpenChange={setSidebarOpen}
                      variant="sidebar"
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
          <DrawerTitle className="sr-only">Article Summary</DrawerTitle>
          <div className="flex min-h-0 flex-1 flex-col p-4">
            <InlineSummary
              urlProp={url}
              articleResults={articleResults}
              isOpen={sidebarOpen}
              onOpenChange={setSidebarOpen}
              variant="inline"
            />
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



