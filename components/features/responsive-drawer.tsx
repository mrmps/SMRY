"use client";

import * as React from "react";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
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
  const isDesktop = useMediaQuery("(min-width: 1583px)");

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    onOpenChange?.(newOpen);
  };

  if (isDesktop) {
    return (
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetTrigger asChild>
          <div className="relative inline-block">
            <Button
              className="relative h-9 rounded-lg bg-zinc-900 px-4 py-2 pr-8 text-sm font-medium text-zinc-50 transition-colors hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-200 focus:ring-offset-0 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Generate Summary
            </Button>
            <div className="absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center">
              <RedisStatus showLabel={false} size="sm" autoRefresh={true} />
            </div>
          </div>
        </SheetTrigger>
        <SheetContent className="flex flex-col overflow-hidden border-l border-zinc-100 bg-zinc-50/50 p-0 backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/50 sm:max-w-[480px]">
          <SheetHeader className="shrink-0 border-b border-zinc-100 bg-white/80 px-6 py-4 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/80">
            <SheetTitle className="text-base font-medium tracking-tight">Generate Summary</SheetTitle>
            <SheetDescription className="text-xs text-zinc-500">AI-powered key points and insights</SheetDescription>
          </SheetHeader>
          <div className="mt-0 min-h-0 flex-1 overflow-y-auto">{children}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerTrigger asChild>
          <div className="relative inline-block">
            <Button className="relative h-8 rounded-lg bg-zinc-900 px-3 py-1.5 pr-7 text-xs font-medium text-zinc-50 transition-colors hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-200 focus:ring-offset-0 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200">
              <span className="sm:hidden">Summary</span>
              <span className="hidden sm:inline">Generate Summary</span>
            </Button>
            <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center">
              <RedisStatus showLabel={false} size="sm" autoRefresh={true} />
            </div>
          </div>
      </DrawerTrigger>
      <DrawerContent className="flex max-h-[85vh] flex-col bg-zinc-50 dark:bg-zinc-900">
        <DrawerHeader className="shrink-0 border-b border-zinc-100 bg-white px-6 py-4 text-left dark:border-zinc-800 dark:bg-zinc-950">
          <DrawerTitle className="text-base font-medium tracking-tight">Generate Summary</DrawerTitle>
          <DrawerDescription className="text-xs text-zinc-500">AI-powered key points and insights</DrawerDescription>
        </DrawerHeader>
        <div className="min-h-0 flex-1 overflow-y-auto">
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
