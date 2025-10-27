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

export function ResponsiveDrawer({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const isDesktop = useMediaQuery("(min-width: 1583px)");

  if (isDesktop) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            // onClick={() => track("Generate")}
            className="bg-purple-600 text-white px-4 py-2 h-9 text-sm font-medium rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-200 focus:ring-offset-0 transition-colors"
          >
            Generate
          </Button>
        </SheetTrigger>
        <SheetContent className="sm:max-w-[480px]">
          <SheetHeader className="border-b border-zinc-100 pb-4">
            <SheetTitle className="text-base font-medium">Generate Summary</SheetTitle>
            <SheetDescription className="text-xs text-gray-500">AI-powered key points and insights</SheetDescription>
          </SheetHeader>
          <div className="mt-6">{children}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button className="bg-purple-600 text-white px-3 py-1.5 h-8 text-xs font-medium rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-200 focus:ring-offset-0 transition-colors">
          Generate
        </Button>
      </DrawerTrigger>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="text-left border-b border-zinc-100 pb-3">
          <DrawerTitle className="text-base font-medium">Generate Summary</DrawerTitle>
          <DrawerDescription className="text-xs text-gray-500">AI-powered key points and insights</DrawerDescription>
        </DrawerHeader>
        <div className="p-5 overflow-auto bg-white">
          {children}
        </div>
        <DrawerFooter className="pt-3 pb-4 border-t border-zinc-100 bg-white">
          <DrawerClose asChild>
            <Button variant="outline" className="text-sm h-9 border-zinc-200 hover:bg-zinc-50">Close</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
