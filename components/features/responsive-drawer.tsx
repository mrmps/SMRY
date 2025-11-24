"use client";

import * as React from "react";
import { useMediaQuery, useIsClient } from "usehooks-ts";
import { Button } from "@/components/ui/button";
import { Sparkles as SparklesIcon } from "lucide-react";
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
  DialogTrigger,
} from "@/components/ui/dialog";

interface ResponsiveDrawerProps {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactElement<Record<string, unknown>>;
}

export function ResponsiveDrawer({ children, open: controlledOpen, onOpenChange, trigger }: ResponsiveDrawerProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isClient = useIsClient();
  const [pendingOpen, setPendingOpen] = React.useState(false);
  const isMobile = useMediaQuery("(max-width: 768px)", {
    defaultValue: false,
    initializeWithValue: false,
  });

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  const handleOpenChange = (newOpen: boolean) => {
    if (!isClient) {
        if (newOpen) setPendingOpen(true);
        return;
    }
    if (!isControlled) {
      setInternalOpen(newOpen);
    }
    onOpenChange?.(newOpen);
  };

  React.useEffect(() => {
    if (isClient && pendingOpen) {
      setInternalOpen(true);
      setPendingOpen(false);
    }
  }, [isClient, pendingOpen]);

  const defaultTrigger = (
    <Button variant="outline" size="sm" className="h-9 shrink-0 pl-4 pr-8 text-sm font-medium transition-all">
      <SparklesIcon className="size-4" />
      Generate Summary
    </Button>
  );

  // Render only the trigger during SSR/hydration to prevent mismatches
  if (!isClient) {
    // Clone the trigger to add onClick handler if it's a custom trigger
    // This allows capturing the click before hydration completes (if React attaches listeners fast enough)
    // or just renders the button so it looks correct.
    // For now, we just render the visual part.
    return (
        <div className="relative inline-block">
          {trigger ? React.cloneElement(trigger as React.ReactElement<any>, {
              onClick: (e: React.MouseEvent) => {
                  // Preserve existing onClick
                  if ((trigger as any).props?.onClick) (trigger as any).props.onClick(e);
                  handleOpenChange(true);
              }
          }) : (
             <Button 
                variant="outline" 
                size="sm" 
                className="h-9 shrink-0 pl-4 pr-8 text-sm font-medium transition-all"
                onClick={() => handleOpenChange(true)}
             >
                <SparklesIcon className="size-4" />
                Generate Summary
             </Button>
          )}
        </div>
    );
  }

  if (!isMobile) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <div className="relative inline-block">
          {trigger ? (
            <DialogTrigger render={trigger} />
          ) : (
            <DialogTrigger render={defaultTrigger} />
          )}
        </div>
        <DialogContent className="flex flex-col overflow-hidden border-l border-zinc-100 bg-zinc-50 p-0 dark:border-zinc-800 dark:bg-zinc-950 sm:max-w-[480px] sm:max-h-[calc(100vh-2rem)] sm:rounded-2xl">
          <div className="mt-0 flex min-h-0 flex-1 flex-col">{children}</div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <div className="relative inline-block">
        {trigger ? (
          <DrawerTrigger render={trigger} />
        ) : (
          <DrawerTrigger
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
      <DrawerContent className="flex h-[85vh] flex-col bg-zinc-50 dark:bg-zinc-900">
        <DrawerTitle className="sr-only">Generate Summary</DrawerTitle>
        <div className="flex min-h-0 flex-1 flex-col">
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
