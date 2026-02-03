"use client"

import * as React from "react"
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip"

import { cn } from "@/lib/utils"

function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

const Tooltip = TooltipPrimitive.Root

const TooltipTrigger = TooltipPrimitive.Trigger

const TooltipContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Popup> & {
    sideOffset?: number
    side?: "top" | "bottom" | "left" | "right"
  }
>(({ className, sideOffset = 4, side = "top", children, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Positioner side={side} sideOffset={sideOffset}>
      <TooltipPrimitive.Popup
        ref={ref}
        className={cn(
          "z-50 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md",
          "data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95",
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          className
        )}
        {...props}
      >
        {children}
      </TooltipPrimitive.Popup>
    </TooltipPrimitive.Positioner>
  </TooltipPrimitive.Portal>
))
TooltipContent.displayName = "TooltipContent"

// Alias for backwards compatibility
const TooltipPopup = TooltipContent

export { Tooltip, TooltipTrigger, TooltipContent, TooltipPopup, TooltipProvider }
