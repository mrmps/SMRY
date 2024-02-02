"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function ResponsiveDrawer({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const isDesktop = useMediaQuery("(min-width: 1583px)");

  if (isDesktop) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button className="bg-purple-200 text-purple-700 py-2 rounded-full hover:bg-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:ring-opacity-50">
            Generate
          </Button>
        </SheetTrigger>
        <SheetContent className="sm:max-w-[425px]">
          <SheetHeader>
            <SheetTitle>Key Points From Page</SheetTitle>
            <SheetDescription>Generative AI is Experimental</SheetDescription>
          </SheetHeader>
          <div className="mt-4">{children}</div>
        </SheetContent>
      </Sheet>

      // <Dialog open={open} onOpenChange={setOpen}>
      //     <DialogTrigger asChild>
      //     <Button className="bg-purple-200 text-purple-700 py-2 rounded-full hover:bg-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:ring-opacity-50">
      //         Generate
      //     </Button>
      //     </DialogTrigger>
      //     <DialogContent className="sm:max-w-[425px]">
      //     <DialogHeader>
      //         <DialogTitle>Key Points From Page</DialogTitle>
      //         <DialogDescription>Generative AI is Experimental</DialogDescription>
      //     </DialogHeader>
      //     {children}
      //     </DialogContent>
      // </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button className="bg-purple-200 text-purple-700 py-2 rounded-full hover:bg-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:ring-opacity-50">
          Generate
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle>Key Points From Page</DrawerTitle>
          <DrawerDescription>Generative AI is Experimental</DrawerDescription>
        </DrawerHeader>
        <div className="p-4 border-t border-zinc-100 bg-gradient-to-b from-purple-50 via-purple-50 to-white">
          {children}
        </div>
        <DrawerFooter className="pt-2">
          <DrawerClose asChild>
            <Button variant="outline">Cancel</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
