'use client'

// Themed confirmation dialog — the custom replacement for the browser's
// native `confirm()`. Built on the existing Radix `Dialog` primitive so
// it inherits the app's overlay, animations, and Escape-to-close behavior.
//
// Two variants:
//   - "default"      — neutral confirm (primary button)
//   - "destructive"  — red confirm button for actions like End Session
//
// Example:
//   <ConfirmDialog
//     open={open}
//     onOpenChange={setOpen}
//     variant="destructive"
//     title="End this session?"
//     description="Every participant will be disconnected."
//     confirmLabel="End session"
//     onConfirm={handleEnd}
//   />

import type { ReactNode } from 'react'
import { AlertTriangle, Info } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type ConfirmVariant = 'default' | 'destructive'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  variant?: ConfirmVariant
  /** Optional fine-print footer below the description. */
  helperText?: ReactNode
  /** Called when the confirm button is clicked. */
  onConfirm: () => void | Promise<void>
  /** Disable the confirm button while an async action is in flight. */
  loading?: boolean
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  helperText,
  onConfirm,
  loading = false,
}: ConfirmDialogProps) {
  const isDestructive = variant === 'destructive'
  const Icon = isDestructive ? AlertTriangle : Info

  const handleConfirm = async () => {
    await onConfirm()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-md gap-0 p-0 overflow-hidden"
      >
        <div className="flex items-start gap-4 p-6">
          {/* Status icon — red/amber for destructive, primary for default */}
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-full ring-1 ring-inset',
              isDestructive
                ? 'bg-destructive/10 text-destructive ring-destructive/20'
                : 'bg-primary/10 text-primary ring-primary/20',
            )}
            aria-hidden
          >
            <Icon className="h-5 w-5" strokeWidth={2.25} />
          </div>

          <div className="min-w-0 flex-1">
            <DialogHeader className="space-y-1.5 text-left">
              <DialogTitle className="text-base font-semibold">
                {title}
              </DialogTitle>
              <DialogDescription className="text-sm leading-relaxed">
                {description}
              </DialogDescription>
            </DialogHeader>

            {helperText && (
              <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                {helperText}
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 border-t border-border bg-muted/40 px-6 py-3 sm:gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="rounded-full px-4"
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={isDestructive ? 'destructive' : 'default'}
            size="sm"
            onClick={handleConfirm}
            disabled={loading}
            className="rounded-full px-4 font-semibold"
          >
            {loading ? 'Working…' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
