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
  title?: string;
  scrollable?: boolean;
  showCloseButton?: boolean;
  contentClassName?: string;
  nativeButton?: boolean;
  triggerId?: string;
}

const DefaultTrigger = React.memo(function DefaultTrigger() {
  return (
    <Button variant="outline" size="sm" className="h-9 shrink-0 pl-4 pr-8 text-sm font-medium transition-all">
      <FileText className="size-4" />
      Generate Summary
    </Button>
  );
});

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
  triggerId,
}: ResponsiveDrawerProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isMobile = useMediaQuery("(max-width: 768px)", {
    defaultValue: false,
    initializeWithValue: false,
  });
  const contentId = React.useId();

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  const handleOpenChange = React.useCallback((newOpen: boolean) => {
    if (!isControlled) {
      setInternalOpen(newOpen);
    }
    onOpenChange?.(newOpen);
  }, [isControlled, onOpenChange]);

  const triggerElement = trigger ?? <DefaultTrigger />;

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={handleOpenChange}>
        <div className="relative inline-block">
          <DrawerTrigger id={triggerId} nativeButton={nativeButton} render={triggerElement} />
        </div>
        <DrawerContent
          id={contentId}
          className={cn("flex h-[85vh] flex-col bg-card", contentClassName)}
        >
          <DrawerTitle className="sr-only">{title}</DrawerTitle>
          <div className={cn("flex min-h-0 flex-1 flex-col", scrollable && "overflow-y-auto")}>
            {children}
          </div>
          <DrawerFooter className="pb-safe shrink-0 border-t-[0.5px] border-border bg-card pt-3">
            <DrawerClose
              render={(renderProps) => {
                const { className, ...closeProps } = renderProps;
                const { key, ...restProps } = closeProps as typeof closeProps & { key?: React.Key };
                return (
                  <Button
                    {...restProps}
                    key={key}
                    variant="ghost"
                    className={cn(
                      "h-9 w-full rounded-[5px] text-muted-foreground hover:bg-accent hover:text-foreground",
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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <div className="relative inline-block">
        <DialogTrigger id={triggerId} nativeButton={nativeButton} render={triggerElement} />
      </div>
      <DialogContent
        id={contentId}
        showCloseButton={showCloseButton}
        className={cn(
          "flex flex-col border-[0.5px] border-border bg-card p-0 sm:max-w-[420px] sm:max-h-[calc(100vh-2rem)] sm:rounded-xl",
          scrollable ? "overflow-y-auto" : "overflow-hidden",
          contentClassName
        )}
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <div className={cn("mt-0 flex min-h-0 flex-1 flex-col", scrollable && "overflow-y-auto")}>
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}
