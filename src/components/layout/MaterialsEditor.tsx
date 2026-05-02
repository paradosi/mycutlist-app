'use client'

import * as React from 'react'
import { useMaterialsStore } from '@/lib/store/materials'
import { useProjectStore } from '@/lib/store/project'
import { formatFromMm, parseToMm } from '@/lib/units'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { HelpTip } from '@/components/ui/help-tip'
import type { Material, Unit } from '@/types'
import { InvalidDimensionError } from '@/types'

export function MaterialsEditor() {
  const materials = useMaterialsStore((s) => s.materials)
  const addMaterial = useMaterialsStore((s) => s.addMaterial)
  const updateMaterial = useMaterialsStore((s) => s.updateMaterial)
  const removeMaterial = useMaterialsStore((s) => s.removeMaterial)
  const project = useProjectStore((s) => s.project)

  const [editing, setEditing] = React.useState<Material | null>(null)
  const [adding, setAdding] = React.useState(false)

  const usageCount = (id: string): number => {
    const inParts = project.parts.filter((p) => p.materialId === id).length
    const inSheets = project.sheets.filter((s) => s.materialId === id).length
    return inParts + inSheets
  }

  const handleDelete = (m: Material) => {
    const used = usageCount(m.id)
    if (used > 0) {
      window.alert(
        `Can't remove "${m.name}" — used by ${used} part${used === 1 ? '' : 's'}/sheet${used === 1 ? '' : 's'} in this project. Reassign or remove them first.`,
      )
      return
    }
    removeMaterial(m.id)
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-md border border-neutral-200">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Name</th>
              <th className="px-3 py-2 text-left font-medium">
                Thickness ({project.unit})
              </th>
              <th className="px-3 py-2 text-left font-medium">
                <span className="inline-flex items-center gap-1.5">
                  Has grain
                  <HelpTip label="What does has grain mean?">
                    <p>
                      Whether this material has a visible wood grain that the
                      optimizer should keep aligned. Plywood and solid wood
                      have grain; MDF, melamine, and HDPE don&apos;t.
                    </p>
                  </HelpTip>
                </span>
              </th>
              <th className="px-3 py-2 text-left font-medium">
                <span className="inline-flex items-center gap-1.5">
                  Cost / sheet
                  <HelpTip label="What is cost per sheet?">
                    <p>
                      Optional. If set, the result will show estimated material
                      cost based on how many full sheets the optimizer used.
                    </p>
                  </HelpTip>
                </span>
              </th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {materials.map((m) => (
              <tr key={m.id} className="border-t border-neutral-100">
                <td className="px-3 py-2 font-medium text-neutral-900">
                  {m.name}
                </td>
                <td className="px-3 py-2">
                  {formatFromMm(m.thicknessMm, project.unit)} {project.unit}
                </td>
                <td className="px-3 py-2">
                  {m.hasGrain ? <Badge>Yes</Badge> : <span className="text-neutral-400">—</span>}
                </td>
                <td className="px-3 py-2">
                  {m.costPerSheet != null
                    ? `$${m.costPerSheet.toFixed(2)}`
                    : '—'}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditing(m)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(m)}
                  >
                    Del
                  </Button>
                </td>
              </tr>
            ))}
            {materials.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-6 text-center text-sm text-neutral-500"
                >
                  No materials yet. Add one to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Button onClick={() => setAdding(true)} variant="outline" size="sm">
        + Add material
      </Button>

      {(adding || editing) && (
        <MaterialDialog
          initial={editing ?? undefined}
          unit={project.unit}
          onCancel={() => {
            setAdding(false)
            setEditing(null)
          }}
          onSubmit={(data) => {
            if (editing) {
              updateMaterial(editing.id, data)
            } else {
              addMaterial(data)
            }
            setAdding(false)
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}

interface MaterialDialogProps {
  initial?: Material
  unit: Unit
  onCancel: () => void
  onSubmit: (data: Omit<Material, 'id'>) => void
}

function MaterialDialog({ initial, unit, onCancel, onSubmit }: MaterialDialogProps) {
  const [name, setName] = React.useState(initial?.name ?? '')
  const [thicknessInput, setThicknessInput] = React.useState(
    formatFromMm(initial?.thicknessMm ?? (unit === 'in' ? 19.05 : 18), unit, 32),
  )
  const [hasGrain, setHasGrain] = React.useState(initial?.hasGrain ?? true)
  const [costInput, setCostInput] = React.useState(
    initial?.costPerSheet != null ? String(initial.costPerSheet) : '',
  )
  const [error, setError] = React.useState<string | null>(null)

  const submit = () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Name is required')
      return
    }
    let thicknessMm: number
    try {
      thicknessMm = parseToMm(thicknessInput, unit)
    } catch (e) {
      setError(
        e instanceof InvalidDimensionError ? 'Invalid thickness' : 'Invalid input',
      )
      return
    }
    if (thicknessMm <= 0) {
      setError('Thickness must be > 0')
      return
    }
    const costStr = costInput.trim()
    let costPerSheet: number | undefined
    if (costStr) {
      const parsed = Number(costStr.replace(/^\$/, ''))
      if (!Number.isFinite(parsed) || parsed < 0) {
        setError('Cost must be a positive number')
        return
      }
      costPerSheet = parsed
    }
    onSubmit({ name: trimmed, thicknessMm, hasGrain, costPerSheet })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{initial ? 'Edit material' : 'Add material'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label htmlFor="m-name">Name</Label>
            <Input
              id="m-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder='e.g. 3/4" Maple Plywood'
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="m-thick">Thickness ({unit})</Label>
            <Input
              id="m-thick"
              value={thicknessInput}
              onChange={(e) => setThicknessInput(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="m-grain">Has grain</Label>
            <Select
              id="m-grain"
              value={hasGrain ? 'yes' : 'no'}
              onChange={(e) => setHasGrain(e.target.value === 'yes')}
            >
              <option value="yes">Yes — plywood, solid wood</option>
              <option value="no">No — MDF, melamine, plastic</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="m-cost">Cost per sheet (optional)</Label>
            <Input
              id="m-cost"
              type="text"
              inputMode="decimal"
              value={costInput}
              onChange={(e) => setCostInput(e.target.value)}
              placeholder="e.g. 65.00"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={submit}>{initial ? 'Save' : 'Add'}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
