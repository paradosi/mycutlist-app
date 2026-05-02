'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { formatAreaFromMm2, formatFromMm } from '@/lib/units'
import { colorForLabel } from '@/lib/colors'
import type { PackedSheet, Part, Sheet, Unit } from '@/types'

interface SheetLayoutRendererProps {
  packed: PackedSheet
  sheet: Sheet
  parts: Part[]
  unit: Unit
  index: number
  total: number
}

export function SheetLayoutRenderer({
  packed,
  sheet,
  parts,
  unit,
  index,
  total,
}: SheetLayoutRendererProps) {
  const [zoom, setZoom] = React.useState(1)
  const svgRef = React.useRef<SVGSVGElement>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = React.useState(1280)

  React.useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => setContainerWidth(el.clientWidth)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const handleExportSvg = () => {
    if (!svgRef.current) return
    const serializer = new XMLSerializer()
    const svgString = serializer.serializeToString(svgRef.current)
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sheet-${index + 1}.svg`
    a.click()
    URL.revokeObjectURL(url)
  }

  const utilizationPct = (packed.utilization * 100).toFixed(0)
  const sheetAreaMm2 = sheet.widthMm * sheet.heightMm
  const remainingMm2 = sheetAreaMm2 * Math.max(0, 1 - packed.utilization)
  const remainingLabel = formatAreaFromMm2(remainingMm2, unit)
  const padding = 24
  // Fit-to-container by default; zoom acts as a multiplier for detail.
  const baseDisplayWidth = Math.max(320, containerWidth - padding * 2)
  const scale = baseDisplayWidth / sheet.widthMm
  const displayWidth = baseDisplayWidth * zoom
  const displayHeight = sheet.heightMm * scale * zoom

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">
            Sheet {index + 1} of {total} — {utilizationPct}% utilized ·{' '}
            {remainingLabel} remaining
          </h3>
          <p className="text-xs text-neutral-500">
            {formatFromMm(sheet.widthMm, unit)} ×{' '}
            {formatFromMm(sheet.heightMm, unit)} {unit}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}
          >
            −
          </Button>
          <Button size="sm" variant="outline" onClick={() => setZoom(1)}>
            Fit
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setZoom((z) => Math.min(4, z + 0.25))}
          >
            +
          </Button>
          <Button size="sm" variant="outline" onClick={handleExportSvg}>
            SVG
          </Button>
        </div>
      </div>

      <div ref={containerRef} className="overflow-auto" style={{ maxHeight: 600 }}>
        <svg
          ref={svgRef}
          xmlns="http://www.w3.org/2000/svg"
          width={displayWidth + padding * 2}
          height={displayHeight + padding * 2}
          viewBox={`0 0 ${sheet.widthMm + padding * 2} ${sheet.heightMm + padding * 2}`}
          style={{ display: 'block' }}
        >
          <g transform={`translate(${padding} ${padding})`}>
            {/* sheet background */}
            <rect
              x={0}
              y={0}
              width={sheet.widthMm}
              height={sheet.heightMm}
              fill="#f5f5f5"
              stroke="#a3a3a3"
              strokeWidth={2}
            />
            {/* trim margin guide */}
            {sheet.trimMm > 0 && (
              <rect
                x={sheet.trimMm}
                y={sheet.trimMm}
                width={sheet.widthMm - 2 * sheet.trimMm}
                height={sheet.heightMm - 2 * sheet.trimMm}
                fill="none"
                stroke="#d4d4d4"
                strokeDasharray="6 6"
                strokeWidth={1}
              />
            )}
            {packed.placements.map((pl, i) => {
              const part = parts.find((p) => p.id === pl.partId)
              if (!part) return null
              const w = pl.rotated ? part.heightMm : part.widthMm
              const h = pl.rotated ? part.widthMm : part.heightMm
              const fill = colorForLabel(part.label)
              const labelDims = `${formatFromMm(w, unit)} × ${formatFromMm(h, unit)}`
              return (
                <g key={i}>
                  <rect
                    x={pl.x}
                    y={pl.y}
                    width={w}
                    height={h}
                    fill={fill}
                    stroke="#525252"
                    strokeWidth={1.5}
                  />
                  <text
                    x={pl.x + w / 2}
                    y={pl.y + h / 2 - 12}
                    textAnchor="middle"
                    fontSize={Math.min(28, Math.max(12, w / 14))}
                    fill="#171717"
                    fontWeight={600}
                  >
                    {part.label}
                  </text>
                  <text
                    x={pl.x + w / 2}
                    y={pl.y + h / 2 + 14}
                    textAnchor="middle"
                    fontSize={Math.min(20, Math.max(10, w / 18))}
                    fill="#404040"
                  >
                    {labelDims}
                  </text>
                  {part.grain !== 'none' && (
                    <line
                      x1={pl.x + 8}
                      y1={pl.y + h - 8}
                      x2={pl.x + Math.min(60, w - 8)}
                      y2={pl.y + h - 8}
                      stroke="#171717"
                      strokeWidth={2}
                      markerEnd="url(#grainArrow)"
                    />
                  )}
                </g>
              )
            })}
            {/* kerf gap markers */}
            {packed.cuts.map((c, i) => (
              <line
                key={`cut-${i}`}
                x1={c.fromX}
                y1={c.fromY}
                x2={c.toX}
                y2={c.toY}
                stroke="#dc2626"
                strokeWidth={1}
                strokeOpacity={0.4}
              />
            ))}
            <defs>
              <marker
                id="grainArrow"
                viewBox="0 0 10 10"
                refX="10"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#171717" />
              </marker>
            </defs>
          </g>
        </svg>
      </div>
    </div>
  )
}
