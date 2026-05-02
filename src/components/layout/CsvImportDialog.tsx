'use client'

import * as React from 'react'
import Papa from 'papaparse'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import {
  buildPreview,
  detectMapping,
  isMappingComplete,
  type FieldKey,
  type ParsedRow,
  type PreviewResult,
} from '@/lib/csv'
import { useMaterialsStore } from '@/lib/store/materials'
import { useProjectStore } from '@/lib/store/project'
import { formatFromMm } from '@/lib/units'
import type { Material } from '@/types'

interface CsvImportDialogProps {
  file: File
  onCancel: () => void
  onComplete: (count: number, newMaterials: string[]) => void
}

const FIELD_LABEL: Record<FieldKey, string> = {
  label: 'Label',
  L: 'L',
  W: 'W',
  qty: 'Qty',
  material: 'Material',
  grain: 'Grain',
  skip: 'Skip',
}

export function CsvImportDialog({
  file,
  onCancel,
  onComplete,
}: CsvImportDialogProps) {
  const project = useProjectStore((s) => s.project)
  const addPart = useProjectStore((s) => s.addPart)
  const materials = useMaterialsStore((s) => s.materials)
  const addMaterial = useMaterialsStore((s) => s.addMaterial)

  const [headers, setHeaders] = React.useState<string[] | null>(null)
  const [rows, setRows] = React.useState<ParsedRow[]>([])
  const [mapping, setMapping] = React.useState<Record<string, FieldKey>>({})
  const [parseError, setParseError] = React.useState<string | null>(null)

  React.useEffect(() => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
      complete: (result) => {
        const fields = result.meta.fields ?? []
        if (fields.length === 0) {
          setParseError('CSV has no header row')
          return
        }
        setHeaders(fields)
        setRows(result.data.map((raw) => ({ raw })))
        setMapping(detectMapping(fields))
      },
      error: (err) => setParseError(err.message),
    })
  }, [file])

  if (parseError) {
    return (
      <DialogShell onCancel={onCancel} title="Couldn't read CSV">
        <p className="text-sm text-red-600">{parseError}</p>
      </DialogShell>
    )
  }

  if (!headers) {
    return (
      <DialogShell onCancel={onCancel} title="Reading CSV…">
        <p className="text-sm text-neutral-500">Parsing…</p>
      </DialogShell>
    )
  }

  const complete = isMappingComplete(mapping)
  const preview: PreviewResult | null = complete
    ? buildPreview({ rows, mapping, materials, unit: project.unit })
    : null

  const handleImport = () => {
    if (!preview) return
    // 1. Create any new materials, copying defaults from the user's existing
    // first material when available (better hint than hardcoded 3/4" plywood).
    const template = materials[0]
    const defaultThickness = template?.thicknessMm ?? 19.05
    const defaultHasGrain = template?.hasGrain ?? true
    const createdMap = new Map<string, string>() // name → newly created id
    for (const name of preview.newMaterialNames) {
      const id = addMaterial({
        name,
        thicknessMm: defaultThickness,
        hasGrain: defaultHasGrain,
      })
      createdMap.set(name.toLowerCase(), id)
    }
    // 2. Add parts using either matched id or freshly created id
    for (const r of preview.rows) {
      const matId =
        r.materialId || createdMap.get(r.materialName.toLowerCase()) || ''
      addPart({
        label: r.label,
        materialId: matId,
        widthMm: r.widthMm,
        heightMm: r.heightMm,
        quantity: r.quantity,
        grain: r.grain,
        rotationLocked: false,
      })
    }
    onComplete(preview.rows.length, preview.newMaterialNames)
  }

  return (
    <DialogShell
      onCancel={onCancel}
      title={complete ? 'Preview import' : 'Map your CSV columns'}
      wide
    >
      {!complete && (
        <p className="text-sm text-neutral-600">
          Couldn&apos;t auto-detect every required column. Pick which CSV
          column maps to each field — Label, L, and W are required.
        </p>
      )}

      <MappingTable
        headers={headers}
        mapping={mapping}
        sampleRow={rows[0]?.raw}
        onChange={(h, f) =>
          setMapping((prev) => {
            const next = { ...prev, [h]: f }
            // ensure each field appears at most once
            for (const k of Object.keys(next)) {
              if (k !== h && next[k] === f && f !== 'skip') next[k] = 'skip'
            }
            return next
          })
        }
      />

      {complete && preview && (
        <PreviewBlock
          preview={preview}
          materials={materials}
          unit={project.unit}
        />
      )}

      <div className="flex justify-end gap-2 pt-3">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          onClick={handleImport}
          disabled={!complete || !preview || preview.rows.length === 0}
        >
          {complete && preview
            ? `Import ${preview.rows.length} part${preview.rows.length === 1 ? '' : 's'}`
            : 'Import'}
        </Button>
      </div>
    </DialogShell>
  )
}

function DialogShell({
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

interface MappingTableProps {
  headers: string[]
  mapping: Record<string, FieldKey>
  sampleRow?: Record<string, string>
  onChange: (header: string, field: FieldKey) => void
}

function MappingTable({
  headers,
  mapping,
  sampleRow,
  onChange,
}: MappingTableProps) {
  return (
    <div className="rounded-md border border-neutral-200">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
          <tr>
            <th className="px-3 py-2 text-left font-medium">CSV header</th>
            <th className="px-3 py-2 text-left font-medium">Sample</th>
            <th className="px-3 py-2 text-left font-medium">Maps to</th>
          </tr>
        </thead>
        <tbody>
          {headers.map((h) => (
            <tr key={h} className="border-t border-neutral-100">
              <td className="px-3 py-2 font-mono text-xs">{h}</td>
              <td className="px-3 py-2 text-xs text-neutral-500">
                {sampleRow?.[h] ?? ''}
              </td>
              <td className="px-3 py-2">
                <Select
                  value={mapping[h] ?? 'skip'}
                  onChange={(e) => onChange(h, e.target.value as FieldKey)}
                >
                  <option value="skip">Skip</option>
                  {(['label', 'L', 'W', 'qty', 'material', 'grain'] as FieldKey[]).map(
                    (f) => (
                      <option key={f} value={f}>
                        {FIELD_LABEL[f]}
                      </option>
                    ),
                  )}
                </Select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

interface PreviewBlockProps {
  preview: PreviewResult
  materials: Material[]
  unit: 'in' | 'mm'
}

function PreviewBlock({ preview, unit }: PreviewBlockProps) {
  const [expanded, setExpanded] = React.useState(false)
  const visibleRows = expanded ? preview.rows : preview.rows.slice(0, 10)

  return (
    <div className="space-y-2">
      {preview.errors.length > 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
          {preview.errors.length} row{preview.errors.length === 1 ? '' : 's'}{' '}
          skipped:
          <ul className="ml-4 list-disc">
            {preview.errors.slice(0, 5).map((e, i) => (
              <li key={i}>
                Row {e.row}: {e.message}
              </li>
            ))}
            {preview.errors.length > 5 && (
              <li>…and {preview.errors.length - 5} more</li>
            )}
          </ul>
        </div>
      )}

      {preview.newMaterialNames.length > 0 && (
        <div className="rounded-md border border-blue-200 bg-blue-50 p-2 text-xs text-blue-900">
          The following new material{preview.newMaterialNames.length === 1 ? '' : 's'} will be created:{' '}
          <strong>{preview.newMaterialNames.join(', ')}</strong>. Edit them in
          the Materials tab afterwards to set thickness and cost.
        </div>
      )}

      <div>
        <Label>Preview ({preview.rows.length} parts)</Label>
        <div className="mt-1 overflow-x-auto rounded-md border border-neutral-200">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Label</th>
                <th className="px-3 py-2 text-left font-medium">L</th>
                <th className="px-3 py-2 text-left font-medium">W</th>
                <th className="px-3 py-2 text-left font-medium">Qty</th>
                <th className="px-3 py-2 text-left font-medium">Material</th>
                <th className="px-3 py-2 text-left font-medium">Grain</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((r, i) => (
                <tr key={i} className="border-t border-neutral-100">
                  <td className="px-3 py-2">{r.label}</td>
                  <td className="px-3 py-2">{formatFromMm(r.widthMm, unit)}</td>
                  <td className="px-3 py-2">{formatFromMm(r.heightMm, unit)}</td>
                  <td className="px-3 py-2">{r.quantity}</td>
                  <td className="px-3 py-2">
                    {r.materialName}
                    {!r.materialId && (
                      <span className="ml-1 text-xs text-blue-700">(new)</span>
                    )}
                  </td>
                  <td className="px-3 py-2">{r.grain}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {preview.rows.length > 10 && !expanded && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="mt-1 text-xs text-neutral-600 underline"
          >
            Show all {preview.rows.length} rows
          </button>
        )}
      </div>
    </div>
  )
}
