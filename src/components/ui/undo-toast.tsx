'use client'

import * as React from 'react'

/** How long Undo stays available. Must match `.toast-countdown` in globals.css. */
export const UNDO_TOAST_MS = 8000

interface UndoToastProps {
  message: string
  onUndo: () => void
  onDismiss: () => void
}

/**
 * Bottom-of-screen notice with an Undo button and a shrinking bar that shows
 * how long Undo is still available. Remount (change `key`) to restart it.
 */
export function UndoToast({ message, onUndo, onDismiss }: UndoToastProps) {
  // Hovering or focusing the toast pauses the countdown.
  const [paused, setPaused] = React.useState(false)
  const remaining = React.useRef(UNDO_TOAST_MS)
  const startedAt = React.useRef(0)

  React.useEffect(() => {
    if (paused) return
    startedAt.current = Date.now()
    const t = setTimeout(onDismiss, remaining.current)
    return () => {
      clearTimeout(t)
      remaining.current -= Date.now() - startedAt.current
    }
  }, [paused, onDismiss])

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <div
        role="status"
        aria-live="polite"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
        className="toast-in pointer-events-auto relative w-full max-w-sm overflow-hidden rounded-lg bg-neutral-900 text-white shadow-lg"
      >
        <div className="flex items-center gap-3 py-2.5 pl-4 pr-2">
          <p className="flex-1 text-sm">{message}</p>
          <button
            type="button"
            onClick={onUndo}
            className="rounded-md px-3 py-1.5 text-sm font-semibold text-amber-300 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
          >
            Undo
          </button>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className="rounded-md px-2 py-1.5 text-sm text-neutral-400 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
          >
            ✕
          </button>
        </div>
        <div
          aria-hidden
          className="toast-countdown absolute bottom-0 left-0 h-0.5 w-full origin-left bg-amber-300"
          data-paused={paused || undefined}
        />
      </div>
    </div>
  )
}

export default UndoToast
