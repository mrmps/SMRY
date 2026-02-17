"use client"

import { GripVertical, PanelLeftOpen, PanelLeftClose } from "@/components/ui/icons"
import * as ResizablePrimitive from "react-resizable-panels"

import { cn } from "@/lib/utils"

const ResizablePanelGroup = ({
  className,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.PanelGroup>) => (
  <ResizablePrimitive.PanelGroup
    className={cn(
      "flex h-full w-full data-[panel-group-direction=vertical]:flex-col",
      className
    )}
    {...props}
  />
)

const ResizablePanel = ResizablePrimitive.Panel

interface ResizableHandleProps
  extends React.ComponentProps<typeof ResizablePrimitive.PanelResizeHandle> {
  withHandle?: boolean
  /** Cursor-style toggle button */
  withToggle?: boolean
  /** Whether the panel is collapsed */
  isCollapsed?: boolean
  /** Callback when toggle is clicked */
  onToggle?: () => void
  /** Position of the panel being toggled (for icon direction) */
  panelPosition?: "left" | "right"
}

const ResizableHandle = ({
  withHandle,
  withToggle,
  isCollapsed,
  onToggle,
  panelPosition = "right",
  className,
  ...props
}: ResizableHandleProps) => (
  <ResizablePrimitive.PanelResizeHandle
    className={cn(
      "group/handle relative flex w-px items-center justify-center bg-neutral-500/15 hover:bg-neutral-500/30",
      "after:absolute after:inset-y-0 after:left-1/2 after:w-3 after:-translate-x-1/2",
      "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1",
      "data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full",
      "data-[panel-group-direction=vertical]:after:left-0 data-[panel-group-direction=vertical]:after:h-1",
      "data-[panel-group-direction=vertical]:after:w-full data-[panel-group-direction=vertical]:after:translate-x-0",
      "data-[panel-group-direction=vertical]:after:-translate-y-1/2",
      "[&[data-panel-group-direction=vertical]>div]:rotate-90",
      "transition-colors duration-150",
      className
    )}
    {...props}
  >
    {withHandle && (
      <div className="z-10 flex h-4 w-3 items-center justify-center rounded-sm border bg-border">
        <GripVertical className="h-2.5 w-2.5" />
      </div>
    )}
    {withToggle && onToggle && (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onToggle()
        }}
        title={isCollapsed ? "Expand panel" : "Collapse panel"}
        className={cn(
          "absolute z-50",
          "flex h-8 w-8 items-center justify-center",
          "rounded-lg border border-border/60",
          "bg-background/95 backdrop-blur-sm",
          "text-muted-foreground hover:text-foreground",
          "shadow-sm hover:shadow-md",
          "opacity-0 group-hover/handle:opacity-100",
          "transition-all duration-150",
          "cursor-pointer",
          // Position based on panel side
          panelPosition === "right" ? "-left-4" : "-right-4"
        )}
      >
        {panelPosition === "right" ? (
          isCollapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )
        ) : isCollapsed ? (
          <PanelLeftClose className="h-4 w-4 rotate-180" />
        ) : (
          <PanelLeftOpen className="h-4 w-4 rotate-180" />
        )}
      </button>
    )}
  </ResizablePrimitive.PanelResizeHandle>
)

export { ResizablePanelGroup, ResizablePanel, ResizableHandle }

