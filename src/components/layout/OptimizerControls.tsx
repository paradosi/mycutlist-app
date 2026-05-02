'use client'

import * as React from 'react'
import { useProjectStore } from '@/lib/store/project'
import { useMaterialsStore } from '@/lib/store/materials'
import { formatAreaFromMm2, formatFromMm, parseToMm } from '@/lib/units'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { HelpTip } from '@/components/ui/help-tip'
import type { Algorithm, CutStrategy } from '@/types'

interface OptimizerControlsProps {
  isRunning: boolean
  onOptimize: () => void
  onCancel: () => void
}

export function OptimizerControls({
  isRunning,
  onOptimize,
  onCancel,
}: OptimizerControlsProps) {
  const project = useProjectStore((s) => s.project)
  const materials = useMaterialsStore((s) => s.materials)
  const setKerf = useProjectStore((s) => s.setKerf)
  const setAlgorithm = useProjectStore((s) => s.setAlgorithm)
  const setCutStrategy = useProjectStore((s) => s.setCutStrategy)

  const [kerfDraft, setKerfDraft] = React.useState(() =>
    formatFromMm(project.kerfMm, project.unit, 32),
  )
  const [prevKerfKey, setPrevKerfKey] = React.useState(
    `${project.kerfMm}-${project.unit}`,
  )
  const kerfKey = `${project.kerfMm}-${project.unit}`
  if (prevKerfKey !== kerfKey) {
    setPrevKerfKey(kerfKey)
    setKerfDraft(formatFromMm(project.kerfMm, project.unit, 32))
  }

  const commitKerf = () => {
    try {
      const mm = parseToMm(kerfDraft, project.unit)
      if (mm >= 0) setKerf(mm)
    } catch {
      setKerfDraft(formatFromMm(project.kerfMm, project.unit, 32))
    }
  }

  const result = project.results
  let stats: string | null = null
  if (result) {
    let totalCost = 0
    let anyCost = false
    for (const ps of result.packedSheets) {
      const sheet = project.sheets.find((s) => s.id === ps.sheetId)
      if (!sheet) continue
      const mat = materials.find((m) => m.id === sheet.materialId)
      if (mat?.costPerSheet != null) {
        totalCost += mat.costPerSheet
        anyCost = true
      }
    }
    const parts = [
      `${result.totalSheets} sheet${result.totalSheets === 1 ? '' : 's'}`,
      `${(result.averageUtilization * 100).toFixed(0)}% avg utilization`,
      `${formatAreaFromMm2(result.totalRemainingMm2, project.unit)} remaining`,
    ]
    if (anyCost) parts.push(`$${totalCost.toFixed(2)} material cost`)
    stats = parts.join(' · ')
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-1.5">
          <Label htmlFor="kerf">Kerf width ({project.unit})</Label>
          <HelpTip label="What is kerf?">
            <p className="font-semibold text-neutral-900">Kerf = blade thickness</p>
            <p className="mt-1">
              The width of material your saw blade removes with each cut.
              The optimizer subtracts this gap between adjacent parts so
              the layout is physically cuttable.
            </p>
            <p className="mt-2 text-neutral-500">
              Typical values: 1/8&quot; (3.175 mm) for table saws, 1 mm for
              fine-tooth track saws or CNC bits.
            </p>
          </HelpTip>
        </div>
        <Input
          id="kerf"
          value={kerfDraft}
          onChange={(e) => setKerfDraft(e.target.value)}
          onBlur={commitKerf}
        />
      </div>

      <div>
        <div className="flex items-center gap-1.5">
          <Label htmlFor="algo">Cut type</Label>
          <HelpTip label="What is cut type?">
            <p className="font-semibold text-neutral-900">
              Match this to the saw you&apos;ll actually use
            </p>
            <ul className="mt-2 space-y-1.5">
              <li>
                <span className="font-semibold">Table/Track Saw (Guillotine)</span>
                {' '}— every cut goes edge-to-edge across the current piece.
                Required for table saws, track saws, and panel saws. Default.
              </li>
              <li>
                <span className="font-semibold">CNC / Jigsaw (Max Efficiency)</span>
                {' '}— allows partial cuts, so parts can be packed tighter.
                Only choose this if you&apos;re using a CNC, jigsaw, or
                bandsaw that can stop mid-sheet.
              </li>
            </ul>
          </HelpTip>
        </div>
        <Select
          id="algo"
          value={project.algorithm}
          onChange={(e) => setAlgorithm(e.target.value as Algorithm)}
        >
          <option value="guillotine">Table/Track Saw (Guillotine)</option>
          <option value="maxrects">CNC / Jigsaw (Max Efficiency)</option>
        </Select>
      </div>

      {project.algorithm === 'guillotine' && (
        <div>
          <div className="flex items-center gap-1.5">
            <Label htmlFor="strategy">Cut preference</Label>
            <HelpTip label="What is cut preference?">
              <p className="font-semibold text-neutral-900">
                How the optimizer prioritizes cuts
              </p>
              <ul className="mt-2 space-y-1.5">
                <li>
                  <span className="font-semibold">Best Yield</span> — packs
                  parts as tightly as possible. Fewest sheets used.
                </li>
                <li>
                  <span className="font-semibold">Rip Cuts First</span> —
                  prefers long rips along the sheet length before
                  crosscuts. Easier on a table saw with a fence; sometimes
                  costs a bit of yield.
                </li>
              </ul>
              <p className="mt-2 text-neutral-500">
                If you&apos;re unsure, leave it on Best Yield.
              </p>
            </HelpTip>
          </div>
          <Select
            id="strategy"
            value={project.cutStrategy}
            onChange={(e) => setCutStrategy(e.target.value as CutStrategy)}
          >
            <option value="yield">Best Yield</option>
            <option value="rip-first">Rip Cuts First</option>
          </Select>
        </div>
      )}

      <div className="flex gap-2">
        <Button
          onClick={onOptimize}
          disabled={isRunning}
          size="lg"
          className="flex-1"
        >
          {isRunning ? 'Calculating…' : 'Optimize'}
        </Button>
        {isRunning && (
          <Button onClick={onCancel} variant="outline" size="lg">
            Cancel
          </Button>
        )}
      </div>

      {stats && <p className="text-xs text-neutral-600">{stats}</p>}
    </div>
  )
}
