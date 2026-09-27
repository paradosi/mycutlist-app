'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

/**
 * Modal frame shared by the app's dialogs: dimmed backdrop, card with a title
 * and close button, Escape and backdrop-click to cancel, focus trapped inside
 * and restored on close.
 */
export function DialogShell({
  title,
  children,
  onCancel,
  wide,
}: {
  title: string
  children: React.ReactNode
  onCancel: () => void
  wide?: boolean
}) {
  const cardRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const previousActive = document.activeElement as HTMLElement | null

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
        return
      }
      if (e.key !== 'Tab' || !cardRef.current) return
      const focusable = cardRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKey)
    cardRef.current
      ?.querySelector<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])',
      )
      ?.focus()

    return () => {
      document.removeEventListener('keydown', handleKey)
      previousActive?.focus?.()
    }
  }, [onCancel])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onCancel}
    >
      <div
        ref={cardRef}
        onClick={(e) => e.stopPropagation()}
        className={wide ? 'w-full max-w-3xl' : 'w-full max-w-md'}
      >
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>{title}</CardTitle>
            <Button variant="ghost" size="sm" onClick={onCancel} aria-label="Close">
              ✕
            </Button>
          </CardHeader>
          <CardContent className="max-h-[70vh] space-y-3 overflow-y-auto">
            {children}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default DialogShell
