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
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { ImperativePanelHandle } from "react-resizable-panels";
import SummaryForm from "@/components/features/summary-form";
import { ArticleResponse, Source } from "@/types/api";
import { UseQueryResult } from "@tanstack/react-query";

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
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const summaryPanelRef = React.useRef<ImperativePanelHandle>(null);
  
  React.useEffect(() => {
    if (!isDesktop) return;
    
    const panel = summaryPanelRef.current;
    if (panel) {
      if (sidebarOpen) {
        panel.expand();
      } else {
        panel.collapse();
      }
    }
  }, [sidebarOpen, isDesktop]);

  if (isDesktop) {
    return (
      <div className="flex h-screen flex-col overflow-hidden bg-background">
        <div className="flex-1 overflow-hidden">
          <ResizablePanelGroup direction="horizontal" className="h-full w-full rounded-none border-0">
            <ResizablePanel defaultSize={75} minSize={30}>
              {children}
            </ResizablePanel>
            
            <ResizableHandle withHandle />
            
            <ResizablePanel 
              ref={summaryPanelRef}
              defaultSize={sidebarOpen ? 30 : 0} 
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

  if (!isDesktop && sidebarOpen) {
    return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <div className="flex-1">
          {children}
      </div>

      {/* Mobile Drawer Logic */}
      <Drawer open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <DrawerContent 
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
              />
            </div>
          </div>
          <DrawerFooter className="pb-safe shrink-0 border-t border-zinc-100 bg-white pt-3 dark:border-zinc-800 dark:bg-zinc-950">
            <DrawerClose asChild>
              <Button variant="ghost" className="h-9 w-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50">Close</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <div className="flex-1">
        {children}
      </div>
    </div>
  );
}
