'use client'

import * as React from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

interface HelpTipProps {
  label?: string
  children: React.ReactNode
  className?: string
  width?: number
}

interface Position {
  top: number
  left: number
}

export function HelpTip({
  label = 'Help',
  children,
  className,
  width = 320,
}: HelpTipProps) {
  const [open, setOpen] = React.useState(false)
  const [position, setPosition] = React.useState<Position | null>(null)
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const popoverRef = React.useRef<HTMLDivElement>(null)

  const computePosition = React.useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const margin = 8
    const triggerCenterX = rect.left + rect.width / 2
    let left = triggerCenterX - width / 2
    const maxLeft = window.innerWidth - width - margin
    if (left < margin) left = margin
    if (left > maxLeft) left = maxLeft
    const top = rect.bottom + margin
    setPosition({ top, left })
  }, [width])

  React.useEffect(() => {
    if (!open) return
    computePosition()
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node
      if (triggerRef.current?.contains(target)) return
      if (popoverRef.current?.contains(target)) return
      setOpen(false)
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const handleResize = () => computePosition()
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    window.addEventListener('resize', handleResize)
    window.addEventListener('scroll', handleResize, true)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('scroll', handleResize, true)
    }
  }, [open, computePosition])

  const popover =
    open && position && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={popoverRef}
            role="tooltip"
            className="fixed z-[1000] rounded-md border border-neutral-200 bg-white p-3 text-xs leading-relaxed text-neutral-700 shadow-lg"
            style={{ top: position.top, left: position.left, width }}
          >
            {children}
          </div>,
          document.body,
        )
      : null

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        className={cn(
          'inline-flex h-4 w-4 items-center justify-center rounded-full border border-neutral-400 text-[10px] font-semibold text-neutral-500 hover:border-neutral-600 hover:text-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500',
          className,
        )}
      >
        ?
      </button>
      {popover}
    </>
  )
}
