'use client'

import * as React from 'react'
import { useProjectStore } from '@/lib/store/project'
import { useMaterialsStore } from '@/lib/store/materials'
import { formatFromMm, parseToMm } from '@/lib/units'
import { SHEET_PRESETS } from '@/lib/presets'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { HelpTip } from '@/components/ui/help-tip'
import type { Sheet } from '@/types'
import { InvalidDimensionError } from '@/types'

function TrimHelp() {
  return (
    <HelpTip label="What is trim margin?">
      <p className="font-semibold text-neutral-900">
        Trim margin = clean-up cut from each edge
      </p>
      <p className="mt-1">
        A thin strip removed from all four edges of a fresh sheet before
        packing. Plywood and MDF often have rough or factory-damaged
        edges, so a small trim gives the optimizer a clean reference to
        work from.
      </p>
      <p className="mt-2 text-neutral-500">
        Default: 1/8&quot; (3.175 mm). Use 0 if your stock is already
        squared up.
      </p>
    </HelpTip>
  )
}

export function SheetStockManager() {
  const project = useProjectStore((s) => s.project)
  const materials = useMaterialsStore((s) => s.materials)
  const addSheet = useProjectStore((s) => s.addSheet)
  const updateSheet = useProjectStore((s) => s.updateSheet)
  const removeSheet = useProjectStore((s) => s.removeSheet)

  const [showDialog, setShowDialog] = React.useState(false)

  if (materials.length === 0) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Add a material first (Materials tab) before defining sheet stock.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        {project.sheets.map((sheet) => {
          const material = materials.find((m) => m.id === sheet.materialId)
          return (
            <Card key={sheet.id}>
              <CardHeader className="flex items-center justify-between">
                <CardTitle>{material?.name ?? 'Sheet'}</CardTitle>
                <Badge>×{sheet.quantity}</Badge>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-neutral-600">
                  {formatFromMm(sheet.widthMm, project.unit)} ×{' '}
                  {formatFromMm(sheet.heightMm, project.unit)} {project.unit}
                </p>
                <p className="flex items-center gap-1.5 text-xs text-neutral-500">
                  <span>
                    Trim: {formatFromMm(sheet.trimMm, project.unit)} {project.unit}
                  </span>
                  <TrimHelp />
                </p>
                <div className="grid grid-cols-3 gap-2 pt-2">
                  <div>
                    <Label htmlFor={`qty-${sheet.id}`}>Qty</Label>
                    <Input
                      id={`qty-${sheet.id}`}
                      type="number"
                      min={1}
                      value={sheet.quantity}
                      onChange={(e) => {
                        const n = Number(e.target.value)
                        if (Number.isFinite(n) && n >= 1) {
                          updateSheet(sheet.id, { quantity: Math.floor(n) })
                        }
                      }}
                    />
                  </div>
                  <div className="col-span-2 flex items-end justify-end">
                    <Button
                      onClick={() => removeSheet(sheet.id)}
                      variant="outline"
                      size="sm"
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Button onClick={() => setShowDialog(true)} variant="outline" size="sm">
        + Add sheet
      </Button>

      {showDialog && (
        <AddSheetDialog
          onCancel={() => setShowDialog(false)}
          onAdd={(s) => {
            addSheet(s)
            setShowDialog(false)
          }}
          materials={materials}
          unit={project.unit}
        />
      )}
    </div>
  )
}

interface AddSheetDialogProps {
  materials: { id: string; name: string }[]
  unit: 'mm' | 'in'
  onAdd: (sheet: Omit<Sheet, 'id'>) => void
  onCancel: () => void
}

function AddSheetDialog({ materials, unit, onAdd, onCancel }: AddSheetDialogProps) {
  const [presetIndex, setPresetIndex] = React.useState<number | 'custom'>(0)
  const [widthInput, setWidthInput] = React.useState(
    formatFromMm(SHEET_PRESETS[0].widthMm, unit, 32),
  )
  const [heightInput, setHeightInput] = React.useState(
    formatFromMm(SHEET_PRESETS[0].heightMm, unit, 32),
  )
  const [quantity, setQuantity] = React.useState(1)
  const [trim, setTrim] = React.useState(formatFromMm(3.175, unit, 32))
  const [materialId, setMaterialId] = React.useState(materials[0]?.id ?? '')
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (presetIndex === 'custom') return
    const p = SHEET_PRESETS[presetIndex]
    setWidthInput(formatFromMm(p.widthMm, unit, 32))
    setHeightInput(formatFromMm(p.heightMm, unit, 32))
  }, [presetIndex, unit])

  const submit = () => {
    try {
      const widthMm = parseToMm(widthInput, unit)
      const heightMm = parseToMm(heightInput, unit)
      const trimMm = parseToMm(trim, unit)
      if (widthMm <= 0 || heightMm <= 0) {
        setError('Width and height must be > 0')
        return
      }
      if (!materialId) {
        setError('Select a material')
        return
      }
      onAdd({ materialId, widthMm, heightMm, quantity, trimMm })
    } catch (e) {
      setError(e instanceof InvalidDimensionError ? e.message : 'Invalid input')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Add sheet stock</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label htmlFor="preset">Preset</Label>
            <Select
              id="preset"
              value={String(presetIndex)}
              onChange={(e) => {
                const v = e.target.value
                setPresetIndex(v === 'custom' ? 'custom' : Number(v))
              }}
            >
              {SHEET_PRESETS.map((p, i) => (
                <option key={p.name} value={i}>
                  {p.name}
                </option>
              ))}
              <option value="custom">Custom</option>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="w">Length ({unit})</Label>
              <Input
                id="w"
                value={widthInput}
                onChange={(e) => {
                  setWidthInput(e.target.value)
                  setPresetIndex('custom')
                }}
              />
            </div>
            <div>
              <Label htmlFor="h">Width ({unit})</Label>
              <Input
                id="h"
                value={heightInput}
                onChange={(e) => {
                  setHeightInput(e.target.value)
                  setPresetIndex('custom')
                }}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-center gap-1.5">
                <Label htmlFor="qty">Quantity</Label>
                <HelpTip label="What is sheet quantity?">
                  <p className="font-semibold text-neutral-900">
                    How many full sheets you have
                  </p>
                  <p className="mt-1">
                    The optimizer will use up to this many sheets of this
                    size. If your parts won&apos;t all fit, the leftover
                    parts are reported as &quot;unplaced&quot; — bump this
                    number or add another sheet stock entry.
                  </p>
                </HelpTip>
              </div>
              <Input
                id="qty"
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => {
                  const n = Number(e.target.value)
                  if (Number.isFinite(n) && n >= 1) setQuantity(Math.floor(n))
                }}
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <Label htmlFor="trim">Trim ({unit})</Label>
                <TrimHelp />
              </div>
              <Input
                id="trim"
                value={trim}
                onChange={(e) => setTrim(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="mat">Material</Label>
            <Select
              id="mat"
              value={materialId}
              onChange={(e) => setMaterialId(e.target.value)}
            >
              {materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={submit}>Add</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
