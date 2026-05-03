'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { formatFromMm } from '@/lib/units'
import type { Algorithm, Part, Unit } from '@/types'

interface UnplacedPartsCalloutProps {
  unplacedPartIds: string[]
  parts: Part[]
  algorithm: Algorithm
  unit: Unit
  canAddSheet: boolean
  onAddSheet: () => void
  onSwitchAlgorithm: () => void
}

export function UnplacedPartsCallout({
  unplacedPartIds,
  parts,
  algorithm,
  unit,
  canAddSheet,
  onAddSheet,
  onSwitchAlgorithm,
}: UnplacedPartsCalloutProps) {
  const total = unplacedPartIds.length

  const counts = new Map<string, number>()
  for (const id of unplacedPartIds) {
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  const grouped = Array.from(counts.entries())
    .map(([id, count]) => {
      const part = parts.find((p) => p.id === id)
      return part ? { part, count } : null
    })
    .filter((x): x is { part: Part; count: number } => x !== null)

  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-red-700">
          {total} unplaced part{total === 1 ? '' : 's'}
        </p>
        <p className="text-xs text-red-700/80">
          Couldn&rsquo;t fit on the available sheets.
        </p>
      </div>

      {grouped.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-xs text-red-900">
          {grouped.map(({ part, count }) => (
            <li key={part.id}>
              <span className="font-medium">
                {part.label || 'Unnamed part'}
              </span>
              {count > 1 && <span> · ×{count}</span>}
              <span className="text-red-700/80">
                {' '}· {formatFromMm(part.widthMm, unit, 32)} ×{' '}
                {formatFromMm(part.heightMm, unit, 32)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {canAddSheet && (
          <Button size="sm" variant="outline" onClick={onAddSheet}>
            Add a sheet &amp; re-optimize
          </Button>
        )}
        {algorithm === 'guillotine' && (
          <Button size="sm" variant="outline" onClick={onSwitchAlgorithm}>
            Try Max Efficiency mode
          </Button>
        )}
      </div>
    </div>
  )
}
