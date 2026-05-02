'use client'

import * as React from 'react'
import { Line, Rect, Svg, Text as PdfText } from '@react-pdf/renderer'
import type { PackedSheet, Part, Sheet, Unit } from '@/types'
import { formatFromMm } from '@/lib/units'
import { colorForLabel } from '@/lib/colors'

// @react-pdf/renderer's Text supports SVG attributes at runtime when nested
// inside <Svg>, but the published types don't expose fontSize/fontFamily on
// the SVG branch of the props union. Re-typed alias keeps things checked.
type SvgTextProps = {
  x: number | string
  y: number | string
  textAnchor?: 'start' | 'middle' | 'end'
  fontSize?: number | string
  fontFamily?: string
  fill?: string
  stroke?: string
  children?: React.ReactNode
}
const SvgText = PdfText as unknown as React.ComponentType<SvgTextProps>

interface SheetSvgPdfProps {
  sheet: Sheet
  packed: PackedSheet
  parts: Part[]
  unit: Unit
  /** Width in PDF points the SVG box should occupy. */
  widthPts: number
  /** Height in PDF points the SVG box should occupy. */
  heightPts: number
}

const HELVETICA_AVG_CHAR = 0.5 // approx ratio of avg char width to font size
const TEXT_PADDING_PT = 4 // horizontal padding inside a part rect (PDF pts)
const MIN_FONT_PT = 5
const DESIRED_LABEL_PT = 11
const DESIRED_DIM_PT = 8

interface FitResult {
  text: string
  fontSizePt: number
  visible: boolean
}

// Pick the largest font size that fits `text` within `availPt`. If even at
// MIN_FONT_PT the text overflows, truncate with an ellipsis. If even one
// ellipsis can't fit, mark as not visible.
function fitText(
  text: string,
  availPt: number,
  desiredPt: number,
): FitResult {
  if (availPt <= 0 || !text) return { text: '', fontSizePt: 0, visible: false }
  const charW = HELVETICA_AVG_CHAR
  for (let size = desiredPt; size >= MIN_FONT_PT; size -= 0.5) {
    if (text.length * size * charW <= availPt) {
      return { text, fontSizePt: size, visible: true }
    }
  }
  // Truncate at MIN_FONT_PT.
  const maxCharsAtMin = Math.floor(availPt / (MIN_FONT_PT * charW))
  if (maxCharsAtMin < 2) {
    return { text: '', fontSizePt: 0, visible: false }
  }
  if (text.length <= maxCharsAtMin) {
    return { text, fontSizePt: MIN_FONT_PT, visible: true }
  }
  return {
    text: text.slice(0, Math.max(1, maxCharsAtMin - 1)) + '…',
    fontSizePt: MIN_FONT_PT,
    visible: true,
  }
}

export function SheetSvgPdf({
  sheet,
  packed,
  parts,
  unit,
  widthPts,
  heightPts,
}: SheetSvgPdfProps) {
  if (widthPts <= 0 || heightPts <= 0) return null

  // Map mm in the viewBox to PDF points on the page so we can reason about
  // text size and stroke width in real printable units.
  const sheetAspect = sheet.widthMm / sheet.heightMm
  const boxAspect = widthPts / heightPts
  const renderScalePtPerMm =
    sheetAspect >= boxAspect ? widthPts / sheet.widthMm : heightPts / sheet.heightMm
  const ptToMm = 1 / renderScalePtPerMm

  // Stroke widths expressed in mm (viewBox units) but tuned to render as
  // ~0.5–1.5 pt at the chosen page scale.
  const strokeOuter = 1.5 * ptToMm
  const strokePart = 1 * ptToMm
  const strokeKerf = 0.5 * ptToMm
  const strokeTrim = 0.6 * ptToMm

  return (
    <Svg
      width={widthPts}
      height={heightPts}
      viewBox={`0 0 ${sheet.widthMm} ${sheet.heightMm}`}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* sheet background */}
      <Rect
        x={0}
        y={0}
        width={sheet.widthMm}
        height={sheet.heightMm}
        fill="#f5f5f5"
        stroke="#a3a3a3"
        strokeWidth={strokeOuter}
      />

      {/* trim margin guide */}
      {sheet.trimMm > 0 && (
        <Rect
          x={sheet.trimMm}
          y={sheet.trimMm}
          width={sheet.widthMm - 2 * sheet.trimMm}
          height={sheet.heightMm - 2 * sheet.trimMm}
          fill="none"
          stroke="#d4d4d4"
          strokeWidth={strokeTrim}
        />
      )}

      {/* part rectangles + labels (no <G> wrapper — emit primitives directly) */}
      {packed.placements.flatMap((pl, i) => {
        const part = parts.find((p) => p.id === pl.partId)
        if (!part) return []
        const w = pl.rotated ? part.heightMm : part.widthMm
        const h = pl.rotated ? part.widthMm : part.heightMm
        const fill = colorForLabel(part.label)
        const cx = pl.x + w / 2
        const cy = pl.y + h / 2

        // Available width inside the rect, in PDF points.
        const wPt = w * renderScalePtPerMm
        const hPt = h * renderScalePtPerMm
        const availPt = Math.max(0, wPt - TEXT_PADDING_PT * 2)

        const dimsString = `${formatFromMm(w, unit)} × ${formatFromMm(h, unit)}`
        const labelFit = fitText(part.label, availPt, DESIRED_LABEL_PT)
        const dimFit = fitText(dimsString, availPt, DESIRED_DIM_PT)

        // Also need vertical room: don't render text if the rect is so short
        // that two stacked lines would overflow.
        const totalLineHeightPt = labelFit.fontSizePt + dimFit.fontSizePt + 2
        const showText = hPt >= totalLineHeightPt + 2

        const labelMm = labelFit.fontSizePt * ptToMm
        const dimMm = dimFit.fontSizePt * ptToMm

        return [
          <Rect
            key={`r-${i}`}
            x={pl.x}
            y={pl.y}
            width={w}
            height={h}
            fill={fill}
            stroke="#525252"
            strokeWidth={strokePart}
          />,
          showText && labelFit.visible ? (
            <SvgText
              key={`l-${i}`}
              x={cx}
              y={cy - dimMm * 0.3}
              textAnchor="middle"
              fontSize={labelMm}
              fontFamily="Helvetica-Bold"
              fill="#171717"
            >
              {labelFit.text}
            </SvgText>
          ) : null,
          showText && dimFit.visible ? (
            <SvgText
              key={`d-${i}`}
              x={cx}
              y={cy + labelMm * 0.7}
              textAnchor="middle"
              fontSize={dimMm}
              fontFamily="Helvetica"
              fill="#404040"
            >
              {dimFit.text}
            </SvgText>
          ) : null,
        ].filter(Boolean) as React.ReactElement[]
      })}

      {/* kerf cut lines */}
      {packed.cuts.map((c, i) => (
        <Line
          key={`cut-${i}`}
          x1={c.fromX}
          y1={c.fromY}
          x2={c.toX}
          y2={c.toY}
          stroke="#9ca3af"
          strokeWidth={strokeKerf}
        />
      ))}
    </Svg>
  )
}
