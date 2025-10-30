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
          <Button
            // onClick={() => track("Generate")}
            className="h-9 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-200 focus:ring-offset-0"
          >
            Generate Summary
          </Button>
        </SheetTrigger>
        <SheetContent className="flex flex-col overflow-hidden sm:max-w-[480px]">
          <SheetHeader className="shrink-0 border-b border-zinc-100 pb-4">
            <SheetTitle className="text-base font-medium">Generate Summary</SheetTitle>
            <SheetDescription className="text-xs text-gray-500">AI-powered key points and insights</SheetDescription>
          </SheetHeader>
          <div className="mt-2 min-h-0 flex-1 overflow-y-auto px-0 pb-4">{children}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerTrigger asChild>
        <Button className="h-8 rounded-md bg-purple-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-200 focus:ring-offset-0">
          Generate Summary
        </Button>
      </DrawerTrigger>
      <DrawerContent className="flex max-h-[85vh] flex-col">
        <DrawerHeader className="shrink-0 border-b border-zinc-100 pb-3 text-left">
          <DrawerTitle className="text-base font-medium">Generate Summary</DrawerTitle>
          <DrawerDescription className="text-xs text-gray-500">AI-powered key points and insights</DrawerDescription>
        </DrawerHeader>
        <div className="min-h-0 flex-1 overflow-y-auto bg-white p-5">
          {children}
        </div>
        <DrawerFooter className="shrink-0 border-t border-zinc-100 bg-white pb-4 pt-3">
          <DrawerClose asChild>
            <Button variant="outline" className="h-9 border-zinc-200 text-sm hover:bg-zinc-50">Close</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
