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

  const { optimize, cancel, isRunning, progress, result, error } = useOptimizer()
  const [tab, setTab] = React.useState<Tab>('parts')
  const resultsRef = React.useRef<HTMLElement>(null)

  const handleOptimize = async () => {
    clearResults()
    const input: OptimizerInput = {
      parts: project.parts,
      sheets: project.sheets,
      materials,
      kerfMm: project.kerfMm,
      cutStrategy: project.cutStrategy,
      algorithm: project.algorithm,
    }
    const r = await optimize(input)
    if (r) {
      setResults(r)
      requestAnimationFrame(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    }
  }

  const liveResult = result ?? project.results

  return (
    <div className="flex min-h-screen flex-col bg-neutral-50 text-neutral-900">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-[1800px] items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <h1 className="text-base font-semibold">MyCutList</h1>
            <span className="hidden text-xs text-neutral-500 md:inline">
              Phase 1 preview
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Input
              value={project.name}
              onChange={(e) => setProjectName(e.target.value)}
              className="w-56"
            />
            <Select
              value={project.unit}
              onChange={(e) => setUnit(e.target.value as Unit)}
              className="w-20"
            >
              <option value="in">in</option>
              <option value="mm">mm</option>
            </Select>
            <UnitHelp />
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1800px] flex-1 flex-col gap-6 px-6 py-6">
        {/* Top: data entry */}
        <section className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-lg border border-neutral-200 bg-white lg:col-span-2">
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

            <div className="rounded-lg border border-neutral-200 bg-white p-4">
              <OptimizerControls
                isRunning={isRunning}
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

          {!isRunning && !liveResult && (
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

          {!isRunning && liveResult && (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white p-4">
                <div>
                  {liveResult.unplacedPartIds.length > 0 ? (
                    <p className="text-sm text-red-600">
                      {liveResult.unplacedPartIds.length} unplaced part
                      {liveResult.unplacedPartIds.length === 1 ? '' : 's'}
                    </p>
                  ) : (
                    <p className="text-sm text-neutral-600">
                      All parts placed.
                    </p>
                  )}
                </div>
                <PdfDownloadButton />
              </div>

              {liveResult.packedSheets.map((ps, idx) => {
                const sheet = project.sheets.find((s) => s.id === ps.sheetId)
                if (!sheet) return null
                return (
                  <SheetLayoutRenderer
                    key={idx}
                    packed={ps}
                    sheet={sheet}
                    parts={project.parts}
                    unit={project.unit}
                    index={idx}
                    total={liveResult.totalSheets}
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
