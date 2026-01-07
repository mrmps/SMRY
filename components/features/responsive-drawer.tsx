"use client";

import * as React from "react";
import { useMediaQuery } from "usehooks-ts";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface ResponsiveDrawerProps {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactElement<Record<string, unknown>>;
  /** Title for accessibility (sr-only) */
  title?: string;
  /** Whether content should scroll */
  scrollable?: boolean;
  /** Show close button in dialog (desktop) */
  showCloseButton?: boolean;
  /** Custom className for the content container */
  contentClassName?: string;
  /** Whether the trigger is a native button element */
  nativeButton?: boolean;
}

export function ResponsiveDrawer({
  children,
  open: controlledOpen,
  onOpenChange,
  trigger,
  title = "Dialog",
  scrollable = false,
  showCloseButton = true,
  contentClassName,
  nativeButton = true,
}: ResponsiveDrawerProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isMobile = useMediaQuery("(max-width: 768px)", {
    defaultValue: false,
    initializeWithValue: false,
  });
  const contentId = React.useId();

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  const handleOpenChange = (newOpen: boolean) => {
    if (!isControlled) {
      setInternalOpen(newOpen);
    }
    onOpenChange?.(newOpen);
  };

  const defaultTrigger = (
    <Button variant="outline" size="sm" className="h-9 shrink-0 pl-4 pr-8 text-sm font-medium transition-all">
      <FileText className="size-4" />
      Generate Summary
    </Button>
  );

  if (!isMobile) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <div className="relative inline-block">
          <DialogTrigger nativeButton={nativeButton} render={trigger ?? defaultTrigger} />
        </div>
        <DialogContent
          id={contentId}
          showCloseButton={showCloseButton}
          className={cn(
            "flex flex-col border-l border-zinc-100 bg-zinc-50 p-0 dark:border-zinc-800 dark:bg-zinc-950 sm:max-w-[480px] sm:max-h-[calc(100vh-2rem)] sm:rounded-2xl",
            scrollable ? "overflow-y-auto" : "overflow-hidden",
            contentClassName
          )}
        >
          <DialogTitle className="sr-only">{title}</DialogTitle>
          <div className={cn("mt-0 flex min-h-0 flex-1 flex-col", scrollable && "overflow-y-auto")}>{children}</div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <div className="relative inline-block">
        {trigger ? (
          <DrawerTrigger nativeButton={nativeButton} render={trigger} />
        ) : (
          <DrawerTrigger
            nativeButton
            render={(renderProps) => {
              const { className, ...triggerProps } = renderProps;
              const { key, ...restProps } = triggerProps as typeof triggerProps & {
                key?: React.Key;
              };
              return (
                <Button
                  {...restProps}
                  key={key}
                  className={cn(
                    "relative h-8 rounded-lg bg-zinc-900 py-1.5 pl-3 pr-9 text-xs font-medium text-zinc-50 transition-colors hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-200 focus:ring-offset-0 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200",
                    className
                  )}
                >
                  <span className="sm:hidden">Summary</span>
                  <span className="hidden sm:inline">Generate Summary</span>
                </Button>
              );
            }}
          />
        )}
      </div>
      <DrawerContent
        id={contentId}
        className={cn(
          "flex h-[85vh] flex-col bg-background",
          contentClassName
        )}
      >
        <DrawerTitle className="sr-only">{title}</DrawerTitle>
        <div className={cn("flex min-h-0 flex-1 flex-col", scrollable && "overflow-y-auto")}>
          {children}
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
  );
}
