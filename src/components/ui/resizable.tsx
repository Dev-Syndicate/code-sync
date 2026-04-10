"use client"

import { GripVertical } from "lucide-react"
import * as ResizablePrimitive from "react-resizable-panels"

import { cn } from "@/lib/utils"

function ResizablePanelGroup({
  className,
  ...props
}: ResizablePrimitive.GroupProps) {
  return (
    <ResizablePrimitive.Group
      data-slot="resizable-panel-group"
      className={cn(
        "flex h-full w-full aria-[orientation=vertical]:flex-col",
        className
      )}
      {...props}
    />
  )
}

function ResizablePanel({ ...props }: ResizablePrimitive.PanelProps) {
  return <ResizablePrimitive.Panel data-slot="resizable-panel" {...props} />
}

function ResizableHandle({
  withHandle,
  className,
  ...props
}: ResizablePrimitive.SeparatorProps & {
  withHandle?: boolean
}) {
  return (
    <ResizablePrimitive.Separator
      data-slot="resizable-handle"
      className={cn(
        // Base: generous hit area + visible divider line on hover
        "group relative flex items-center justify-center",
        // Vertical separator (between horizontally-laid panels):
        // 6px wide hit area, shows a 1px divider in the middle
        "w-1.5 cursor-col-resize bg-transparent",
        "before:absolute before:inset-y-0 before:left-1/2 before:w-px before:-translate-x-1/2 before:bg-white/10",
        "hover:before:bg-white/30 hover:before:w-[2px]",
        "data-[resize-handle-active]:before:bg-primary data-[resize-handle-active]:before:w-[2px]",
        "transition-colors",
        // Horizontal separator (between vertically-stacked panels) — flip
        "aria-[orientation=horizontal]:h-1.5 aria-[orientation=horizontal]:w-full aria-[orientation=horizontal]:cursor-row-resize",
        "aria-[orientation=horizontal]:before:inset-x-0 aria-[orientation=horizontal]:before:top-1/2 aria-[orientation=horizontal]:before:left-0 aria-[orientation=horizontal]:before:h-px aria-[orientation=horizontal]:before:w-full aria-[orientation=horizontal]:before:translate-x-0 aria-[orientation=horizontal]:before:-translate-y-1/2",
        "aria-[orientation=horizontal]:hover:before:h-[2px]",
        // Focus ring
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        className
      )}
      {...props}
    >
      {withHandle && (
        <div
          className={cn(
            "pointer-events-none z-10 flex h-10 w-5 items-center justify-center rounded-md border border-white/15 bg-[#2d2d2d] shadow-lg",
            "opacity-70 group-hover:opacity-100 group-data-[resize-handle-active]:opacity-100",
            "transition-opacity",
            "group-aria-[orientation=horizontal]:rotate-90"
          )}
        >
          <GripVertical className="h-3.5 w-3.5 text-white/80" />
        </div>
      )}
    </ResizablePrimitive.Separator>
  )
}

export { ResizableHandle, ResizablePanel, ResizablePanelGroup }
