'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { DialogShell } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

export type ClearKind = 'parts' | 'all'

interface ClearProjectDialogProps {
  projectName: string
  partCount: number
  sheetCount: number
  hasResults: boolean
  onConfirm: (kind: ClearKind) => void
  onCancel: () => void
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/**
 * Two-step clear: pick "Clear parts" or "Start over", then confirm. Saved
 * materials are never touched; the caller offers Undo afterwards.
 */
export function ClearProjectDialog({
  projectName,
  partCount,
  sheetCount,
  hasResults,
  onConfirm,
  onCancel,
}: ClearProjectDialogProps) {
  const [choice, setChoice] = React.useState<ClearKind | null>(null)
  const nothingToClear = partCount === 0 && !hasResults

  if (choice) {
    const isParts = choice === 'parts'
    return (
      <DialogShell title="Are you sure?" onCancel={onCancel}>
        <p className="text-sm text-neutral-700">
          {isParts ? (
            <>
              This removes {plural(partCount, 'part')}
              {hasResults ? ' and the current results' : ''}. Your{' '}
              {plural(sheetCount, 'sheet')} and settings stay.
            </>
          ) : (
            <>
              This resets <span className="font-medium">{projectName}</span>{' '}
              to a blank project: parts, sheets, results and settings. Your
              saved materials stay.
            </>
          )}
        </p>
        <p className="text-xs text-neutral-500">
          You&rsquo;ll have a few seconds to undo it.
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={() => setChoice(null)}>
            Back
          </Button>
          <Button variant="destructive" onClick={() => onConfirm(choice)}>
            {isParts ? 'Clear parts' : 'Start over'}
          </Button>
        </div>
      </DialogShell>
    )
  }

  return (
    <DialogShell title="Clear" onCancel={onCancel}>
      <div className="space-y-2">
        <ChoiceButton
          title="Clear parts"
          description={
            nothingToClear
              ? 'There are no parts to clear.'
              : `Removes ${plural(partCount, 'part')}${hasResults ? ' and the results' : ''}. Keeps your sheets and settings.`
          }
          disabled={nothingToClear}
          onClick={() => setChoice('parts')}
        />
        <ChoiceButton
          title="Start over"
          description="Resets the whole project to a blank one. Your saved materials stay."
          onClick={() => setChoice('all')}
        />
      </div>
      <div className="flex justify-end pt-1">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </DialogShell>
  )
}

function ChoiceButton({
  title,
  description,
  disabled,
  onClick,
}: {
  title: string
  description: string
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'group flex w-full items-center gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-3 text-left transition-colors',
        'hover:border-neutral-400 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500',
        'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-neutral-200 disabled:hover:bg-white',
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-neutral-900">{title}</span>
        <span className="mt-0.5 block text-xs text-neutral-500">{description}</span>
      </span>
      <span
        aria-hidden
        className="text-neutral-400 transition-transform group-hover:translate-x-0.5 group-disabled:hidden"
      >
        ›
      </span>
    </button>
  )
}

export default ClearProjectDialog
