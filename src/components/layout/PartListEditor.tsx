'use client'

import * as React from 'react'
import { z } from 'zod'
import { useProjectStore } from '@/lib/store/project'
import { useMaterialsStore } from '@/lib/store/materials'
import { parseToMm, formatFromMm } from '@/lib/units'
import type { Grain, Part, Unit } from '@/types'
import { InvalidDimensionError } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { HelpTip } from '@/components/ui/help-tip'
import { CsvImportDialog } from '@/components/layout/CsvImportDialog'
import { partsToCsv } from '@/lib/csv'

const dimensionSchema = z.string().min(1)
const qtySchema = z.number().int().min(1).max(999)

const GRAIN_OPTIONS: { value: Grain; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'with', label: 'With grain' },
  { value: 'across', label: 'Across grain' },
  { value: 'either', label: 'Either' },
]

interface DimensionCellProps {
  value: number
  unit: Unit
  onCommit: (mm: number) => void
}

function DimensionCell({ value, unit, onCommit }: DimensionCellProps) {
  const [draft, setDraft] = React.useState(() => formatFromMm(value, unit, 32))
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    setDraft(formatFromMm(value, unit, 32))
  }, [value, unit])

  const commit = () => {
    try {
      dimensionSchema.parse(draft)
      const mm = parseToMm(draft, unit)
      if (mm <= 0) {
        setError('Must be > 0')
        return
      }
      setError(null)
      onCommit(mm)
    } catch (e) {
      setError(
        e instanceof InvalidDimensionError ? 'Invalid' : 'Invalid',
      )
    }
  }

  return (
    <div className="flex flex-col">
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        }}
        className={error ? 'border-red-400' : ''}
      />
      {error && <span className="mt-0.5 text-xs text-red-500">{error}</span>}
    </div>
  )
}

export function PartListEditor() {
  const project = useProjectStore((s) => s.project)
  const materials = useMaterialsStore((s) => s.materials)
  const addPart = useProjectStore((s) => s.addPart)
  const updatePart = useProjectStore((s) => s.updatePart)
  const removePart = useProjectStore((s) => s.removePart)
  const duplicatePart = useProjectStore((s) => s.duplicatePart)

  const unit = project.unit
  const defaultMaterialId = materials[0]?.id ?? ''

  const handleAdd = () => {
    addPart({
      label: `Part ${project.parts.length + 1}`,
      materialId: defaultMaterialId,
      widthMm: unit === 'in' ? 24 * 25.4 : 600,
      heightMm: unit === 'in' ? 12 * 25.4 : 300,
      quantity: 1,
      grain: 'none',
      rotationLocked: false,
    })
  }

  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [importFile, setImportFile] = React.useState<File | null>(null)
  const [importNotice, setImportNotice] = React.useState<string | null>(null)

  const handleExport = () => {
    const csv = partsToCsv({ parts: project.parts, materials, unit })
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const safeName = project.name.replace(/[^a-z0-9-_]+/gi, '-')
    a.download = `${safeName}-parts.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) setImportFile(f)
    // reset so picking the same file twice still fires onChange
    e.target.value = ''
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-md border border-neutral-200">
        <table className="w-full border-collapse text-sm" style={{ minWidth: 720 }}>
          <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-2 py-2 text-left font-medium" style={{ minWidth: 120 }}>Label</th>
              <th className="px-2 py-2 text-left font-medium" style={{ minWidth: 90 }}>L ({unit})</th>
              <th className="px-2 py-2 text-left font-medium" style={{ minWidth: 90 }}>W ({unit})</th>
              <th className="px-2 py-2 text-left font-medium" style={{ minWidth: 64 }}>Qty</th>
              <th className="px-2 py-2 text-left font-medium" style={{ minWidth: 140 }}>Material</th>
              <th className="px-2 py-2 text-left font-medium" style={{ minWidth: 110 }}>
                <span className="inline-flex items-center gap-1.5">
                  Grain
                  <HelpTip label="What does grain mean?">
                    <p className="font-semibold text-neutral-900">
                      Grain controls part rotation
                    </p>
                    <p className="mt-1">
                      Sheets are assumed to have grain along their long edge.
                      This setting tells the optimizer how the part may be
                      rotated relative to that grain.
                    </p>
                    <ul className="mt-2 space-y-1.5">
                      <li>
                        <span className="font-semibold">None</span> — no grain
                        constraint; rotates freely for best fit.
                      </li>
                      <li>
                        <span className="font-semibold">With grain</span> —
                        never rotated. Part&apos;s long edge runs with the
                        sheet grain. Use for visible faces.
                      </li>
                      <li>
                        <span className="font-semibold">Across grain</span> —
                        always rotated 90°. Grain runs across the part&apos;s
                        long dimension.
                      </li>
                      <li>
                        <span className="font-semibold">Either</span> — grain
                        matters but you allow either direction; same effect as
                        None for Phase 1.
                      </li>
                    </ul>
                  </HelpTip>
                </span>
              </th>
              <th className="px-2 py-2" style={{ minWidth: 110 }}></th>
            </tr>
          </thead>
          <tbody>
            {project.parts.map((part) => (
              <PartRow
                key={part.id}
                part={part}
                unit={unit}
                materials={materials}
                onUpdate={(updates) => updatePart(part.id, updates)}
                onRemove={() => removePart(part.id)}
                onDuplicate={() => duplicatePart(part.id)}
              />
            ))}
            {project.parts.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-6 text-center text-sm text-neutral-500"
                >
                  No parts yet. Add one to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={handleAdd} variant="outline" size="sm">
          + Add part
        </Button>
        <Button
          onClick={() => fileInputRef.current?.click()}
          variant="outline"
          size="sm"
        >
          Import CSV
        </Button>
        <Button
          onClick={handleExport}
          variant="outline"
          size="sm"
          disabled={project.parts.length === 0}
        >
          Export CSV
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {importNotice && (
        <div className="rounded-md border border-green-200 bg-green-50 p-2 text-xs text-green-900">
          {importNotice}
        </div>
      )}

      {importFile && (
        <CsvImportDialog
          file={importFile}
          onCancel={() => setImportFile(null)}
          onComplete={(count, newMats) => {
            setImportFile(null)
            const matsMsg =
              newMats.length > 0
                ? ` Created ${newMats.length} new material${newMats.length === 1 ? '' : 's'}: ${newMats.join(', ')}.`
                : ''
            setImportNotice(
              `Imported ${count} part${count === 1 ? '' : 's'}.${matsMsg}`,
            )
            window.setTimeout(() => setImportNotice(null), 8000)
          }}
        />
      )}
    </div>
  )
}

interface PartRowProps {
  part: Part
  unit: Unit
  materials: { id: string; name: string }[]
  onUpdate: (u: Partial<Part>) => void
  onRemove: () => void
  onDuplicate: () => void
}

function PartRow({ part, unit, materials, onUpdate, onRemove, onDuplicate }: PartRowProps) {
  return (
    <tr className="border-t border-neutral-100">
      <td className="px-2 py-2">
        <Input
          value={part.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
        />
      </td>
      <td className="px-2 py-2">
        <DimensionCell
          value={part.widthMm}
          unit={unit}
          onCommit={(mm) => onUpdate({ widthMm: mm })}
        />
      </td>
      <td className="px-2 py-2">
        <DimensionCell
          value={part.heightMm}
          unit={unit}
          onCommit={(mm) => onUpdate({ heightMm: mm })}
        />
      </td>
      <td className="px-2 py-2">
        <Input
          type="number"
          min={1}
          max={999}
          value={part.quantity}
          onChange={(e) => {
            const n = Number(e.target.value)
            const result = qtySchema.safeParse(n)
            if (result.success) onUpdate({ quantity: n })
          }}
        />
      </td>
      <td className="px-2 py-2">
        <Select
          value={part.materialId}
          onChange={(e) => onUpdate({ materialId: e.target.value })}
        >
          {materials.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </Select>
      </td>
      <td className="px-2 py-2">
        <Select
          value={part.grain}
          onChange={(e) => onUpdate({ grain: e.target.value as Grain })}
        >
          {GRAIN_OPTIONS.map((g) => (
            <option key={g.value} value={g.value}>
              {g.label}
            </option>
          ))}
        </Select>
      </td>
      <td className="whitespace-nowrap px-2 py-2 text-right">
        <Button onClick={onDuplicate} variant="ghost" size="sm" className="px-2">
          Dup
        </Button>
        <Button onClick={onRemove} variant="ghost" size="sm" className="px-2">
          Del
        </Button>
      </td>
    </tr>
  )
}
