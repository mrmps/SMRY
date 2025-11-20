"use client";

import * as React from "react";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { Button } from "@/components/ui/button";
import { Sparkles as SparklesIcon } from "lucide-react";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { RedisStatus } from "@/components/shared/redis-status";
// import { track } from "@vercel/analytics";

interface ResponsiveDrawerProps {
  children: React.ReactNode;
  onOpenChange?: (open: boolean) => void;
}

export function ResponsiveDrawer({ children, onOpenChange }: ResponsiveDrawerProps) {
  const [open, setOpen] = React.useState(false);
  const isMobile = useMediaQuery("(max-width: 768px)");

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    onOpenChange?.(newOpen);
  };

  if (!isMobile) {
    return (
      <Sheet open={open} onOpenChange={handleOpenChange} modal={false}>
        <div className="relative inline-block">
          <SheetTrigger render={
            <Button variant="outline" size="sm" className="h-9 shrink-0 pl-4 pr-8 text-sm font-medium transition-all">
              <SparklesIcon className="size-4" />
              Generate Summary
            </Button>
          } />
          <div className="absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center">
            <RedisStatus showLabel={false} size="sm" autoRefresh={true} />
          </div>
        </div>
        <SheetContent className="flex flex-col overflow-hidden border-l border-zinc-100 bg-zinc-50 p-0 dark:border-zinc-800 dark:bg-zinc-950 sm:max-w-[480px]">
          <div className="mt-0 flex min-h-0 flex-1 flex-col">{children}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <div className="relative inline-block">
        <DrawerTrigger asChild>
          <Button className="relative h-8 rounded-lg bg-zinc-900 py-1.5 pl-3 pr-9 text-xs font-medium text-zinc-50 transition-colors hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-200 focus:ring-offset-0 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200">
              <span className="sm:hidden">Summary</span>
              <span className="hidden sm:inline">Generate Summary</span>
          </Button>
        </DrawerTrigger>
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center">
            <RedisStatus showLabel={false} size="sm" autoRefresh={true} />
        </div>
      </div>
      <DrawerContent className="flex h-[85vh] flex-col bg-zinc-50 dark:bg-zinc-900">
        <div className="flex min-h-0 flex-1 flex-col">
          {children}
        </div>
        <DrawerFooter className="pb-safe shrink-0 border-t border-zinc-100 bg-white pt-3 dark:border-zinc-800 dark:bg-zinc-950">
          <DrawerClose asChild>
            <Button variant="ghost" className="h-9 w-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50">Close</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
