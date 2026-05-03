'use client'

import * as React from 'react'
import dynamic from 'next/dynamic'
import { useProjectStore } from '@/lib/store/project'
import { useMaterialsStore } from '@/lib/store/materials'
import { useOptimizer } from '@/hooks/useOptimizer'
import { useMaterialSelfHeal } from '@/hooks/useMaterialSelfHeal'
import { PartListEditor } from '@/components/layout/PartListEditor'
import { SheetStockManager } from '@/components/layout/SheetStockManager'
import { MaterialsEditor } from '@/components/layout/MaterialsEditor'
import { OptimizerControls } from '@/components/layout/OptimizerControls'
import { UnplacedPartsCallout } from '@/components/layout/UnplacedPartsCallout'
import { SheetLayoutRenderer } from '@/components/renderer/SheetLayoutRenderer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { HelpTip } from '@/components/ui/help-tip'
import { cn } from '@/lib/utils'

function UnitHelp() {
  return (
    <HelpTip label="What is the unit toggle?">
      <p className="font-semibold text-neutral-900">
        Display unit for dimensions
      </p>
      <p className="mt-1">
        Choose how dimensions are shown and entered. Internally everything
        is stored as millimeters; this only changes the display.
      </p>
      <p className="mt-2">
        Inputs accept both formats regardless of this setting:
      </p>
      <ul className="mt-1 space-y-1">
        <li>
          <span className="font-mono text-neutral-900">23 7/8</span> or
          <span className="font-mono text-neutral-900"> 23-7/8</span> —
          imperial fractions
        </li>
        <li>
          <span className="font-mono text-neutral-900">23.875</span> —
          decimal
        </li>
        <li>
          <span className="font-mono text-neutral-900">607mm</span>,
          <span className="font-mono text-neutral-900"> 60.7cm</span>,
          <span className="font-mono text-neutral-900"> 1.2m</span> —
          explicit metric suffix
        </li>
        <li>
          <span className="font-mono text-neutral-900">48</span> — bare
          number, treated as the current unit
        </li>
      </ul>
    </HelpTip>
  )
}
import type { OptimizerInput, Unit } from '@/types'

const PdfDownloadButton = dynamic(
  () => import('@/components/pdf/PdfDownloadButton').then((m) => m.PdfDownloadButton),
  { ssr: false, loading: () => <Button variant="outline" disabled>Loading PDF…</Button> },
)

type Tab = 'parts' | 'sheets' | 'materials' | 'settings'

export default function Home() {
  useMaterialSelfHeal()
  const project = useProjectStore((s) => s.project)
  const materials = useMaterialsStore((s) => s.materials)
  const setProjectName = useProjectStore((s) => s.setProjectName)
  const setUnit = useProjectStore((s) => s.setUnit)
  const setResults = useProjectStore((s) => s.setResults)
  const clearResults = useProjectStore((s) => s.clearResults)
  const updateSheet = useProjectStore((s) => s.updateSheet)
  const setAlgorithm = useProjectStore((s) => s.setAlgorithm)

  const { optimize, cancel, isRunning, progress, result, error } = useOptimizer()
  const [tab, setTab] = React.useState<Tab>('parts')
  const resultsRef = React.useRef<HTMLElement>(null)

  const canOptimize = project.parts.length > 0 && project.sheets.length > 0

  const runOptimize = React.useCallback(async () => {
    const p = useProjectStore.getState().project
    const m = useMaterialsStore.getState().materials
    if (p.parts.length === 0 || p.sheets.length === 0) return
    clearResults()
    const input: OptimizerInput = {
      parts: p.parts,
      sheets: p.sheets,
      materials: m,
      kerfMm: p.kerfMm,
      cutStrategy: p.cutStrategy,
      algorithm: p.algorithm,
    }
    const r = await optimize(input)
    if (r) {
      setResults(r)
      requestAnimationFrame(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    }
  }, [optimize, clearResults, setResults])

  const handleOptimize = runOptimize

  const handleAddSheet = React.useCallback(() => {
    const sheets = useProjectStore.getState().project.sheets
    if (sheets.length === 0) return
    const dominant = [...sheets].sort((a, b) => b.quantity - a.quantity)[0]
    updateSheet(dominant.id, { quantity: dominant.quantity + 1 })
    void runOptimize()
  }, [updateSheet, runOptimize])

  const handleSwitchToMaxRects = React.useCallback(() => {
    setAlgorithm('maxrects')
    void runOptimize()
  }, [setAlgorithm, runOptimize])

  const liveResult = result ?? project.results
  const hasResult =
    !!liveResult &&
    (liveResult.packedSheets.length > 0 || liveResult.unplacedPartIds.length > 0)

  return (
    <div className="flex min-h-screen flex-col bg-neutral-50 text-neutral-900">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-[1800px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
          <div className="mr-auto flex items-center gap-3">
            <h1 className="text-base font-semibold">MyCutList</h1>
            <span className="hidden text-xs text-neutral-500 md:inline">
              Phase 1 preview
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={project.unit}
              onChange={(e) => setUnit(e.target.value as Unit)}
              className="w-20"
              aria-label="Unit"
            >
              <option value="in">in</option>
              <option value="mm">mm</option>
            </Select>
            <UnitHelp />
            <a
              href="https://github.com/paradosi/mycutlist-app/issues/new?labels=feedback&template=feedback.md"
              target="_blank"
              rel="noopener noreferrer"
              className="ml-1 inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-900 shadow-sm transition-colors hover:border-amber-400 hover:bg-amber-100 sm:ml-2"
            >
              <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
              Feedback
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1800px] flex-1 flex-col gap-6 px-4 py-4 sm:px-6 sm:py-6">
        {/* Top: data entry */}
        <section className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="min-w-0 rounded-lg border border-neutral-200 bg-white lg:col-span-2">
              <div className="flex border-b border-neutral-200">
                <TabButton active={tab === 'parts'} onClick={() => setTab('parts')}>
                  Parts
                </TabButton>
                <TabButton active={tab === 'sheets'} onClick={() => setTab('sheets')}>
                  Sheets
                </TabButton>
                <TabButton
                  active={tab === 'materials'}
                  onClick={() => setTab('materials')}
                >
                  Materials
                </TabButton>
                <TabButton active={tab === 'settings'} onClick={() => setTab('settings')}>
                  Settings
                </TabButton>
              </div>
              <div className="p-4">
                {tab === 'parts' && <PartListEditor />}
                {tab === 'sheets' && <SheetStockManager />}
                {tab === 'materials' && <MaterialsEditor />}
                {tab === 'settings' && (
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="pname">Project name</Label>
                      <Input
                        id="pname"
                        value={project.name}
                        onChange={(e) => setProjectName(e.target.value)}
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <Label htmlFor="punit">Unit</Label>
                        <UnitHelp />
                      </div>
                      <Select
                        id="punit"
                        value={project.unit}
                        onChange={(e) => setUnit(e.target.value as Unit)}
                      >
                        <option value="in">Inches</option>
                        <option value="mm">Millimeters</option>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="min-w-0 rounded-lg border border-neutral-200 bg-white p-4">
              <OptimizerControls
                isRunning={isRunning}
                canOptimize={canOptimize}
                onOptimize={handleOptimize}
                onCancel={cancel}
              />
            </div>
          </div>
        </section>

        {/* Bottom: results */}
        <section ref={resultsRef} className="space-y-4">
          {error && (
            <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {isRunning && (
            <div className="rounded-lg border border-neutral-200 bg-white p-6">
              <p className="text-sm font-medium">Calculating…</p>
              {progress && (
                <p className="mt-1 text-xs text-neutral-500">
                  Generation {progress.generation} · best utilization{' '}
                  {(progress.bestUtilization * 100).toFixed(1)}%
                </p>
              )}
            </div>
          )}

          {!isRunning && !hasResult && (
            <div className="flex h-72 items-center justify-center rounded-lg border-2 border-dashed border-neutral-300 bg-white">
              <div className="text-center">
                <div className="text-3xl">📐</div>
                <p className="mt-2 text-sm text-neutral-600">
                  Add your sheets and parts, then click Optimize.
                </p>
                <p className="text-xs text-neutral-500">
                  Results will appear here.
                </p>
              </div>
            </div>
          )}

          {!isRunning && hasResult && liveResult && (
            <div className="space-y-4">
              {liveResult.unplacedPartIds.length > 0 && (
                <UnplacedPartsCallout
                  unplacedPartIds={liveResult.unplacedPartIds}
                  parts={project.parts}
                  algorithm={project.algorithm}
                  unit={project.unit}
                  canAddSheet={project.sheets.length > 0}
                  onAddSheet={handleAddSheet}
                  onSwitchAlgorithm={handleSwitchToMaxRects}
                />
              )}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-white p-4">
                <p className="text-sm text-neutral-600">
                  {liveResult.unplacedPartIds.length === 0
                    ? 'All parts placed.'
                    : `${liveResult.packedSheets.reduce((n, ps) => n + ps.placements.length, 0)} part${liveResult.packedSheets.reduce((n, ps) => n + ps.placements.length, 0) === 1 ? '' : 's'} placed across ${liveResult.totalSheets} sheet${liveResult.totalSheets === 1 ? '' : 's'}.`}
                </p>
                <PdfDownloadButton />
              </div>

              {liveResult.packedSheets.map((ps, idx) => {
                const sheet = project.sheets.find((s) => s.id === ps.sheetId)
                if (!sheet) return null
                const material = materials.find((m) => m.id === sheet.materialId)
                return (
                  <SheetLayoutRenderer
                    key={idx}
                    packed={ps}
                    sheet={sheet}
                    parts={project.parts}
                    unit={project.unit}
                    index={idx}
                    total={liveResult.totalSheets}
                    materialName={material?.name}
                  />
                )
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

interface TabButtonProps {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}

function TabButton({ active, onClick, children }: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex-1 px-3 py-2 text-sm font-medium transition-colors',
        active
          ? 'border-b-2 border-neutral-900 text-neutral-900'
          : 'text-neutral-500 hover:text-neutral-900',
      )}
    >
      {children}
    </button>
  )
}
