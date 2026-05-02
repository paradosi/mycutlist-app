'use client'

import * as React from 'react'
import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from '@react-pdf/renderer'
import { formatAreaFromMm2, formatFromMm } from '@/lib/units'
import type { Material, PackedSheet, Part, Project, Sheet, Unit } from '@/types'
import { SheetSvgPdf } from './SheetSvgPdf'

const PAGE_PADDING = 36
const LETTER_PORTRAIT = { w: 612, h: 792 }
const LETTER_LANDSCAPE = { w: 792, h: 612 }

const styles = StyleSheet.create({
  page: { padding: PAGE_PADDING, fontSize: 10, fontFamily: 'Helvetica' },
  h1: { fontSize: 22, marginBottom: 12, fontFamily: 'Helvetica-Bold' },
  h2: { fontSize: 13, marginBottom: 6, fontFamily: 'Helvetica-Bold' },
  meta: { fontSize: 10, color: '#525252', marginBottom: 4 },
  sheetHeader: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#171717',
    marginBottom: 4,
  },
  sheetMeta: { fontSize: 9, color: '#525252', marginBottom: 8 },
  drawingBox: {
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 4,
    padding: 4,
  },
  table: { width: '100%', marginTop: 8 },
  rowHead: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#737373',
    paddingVertical: 4,
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#e5e5e5',
    paddingVertical: 3,
  },
  footer: {
    position: 'absolute',
    bottom: 18,
    left: PAGE_PADDING,
    right: PAGE_PADDING,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8,
    color: '#a3a3a3',
  },
})

function Footer() {
  return (
    <View style={styles.footer} fixed>
      <Text>Generated with MyCutList · mycutlist.app</Text>
      <Text
        render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
      />
    </View>
  )
}

// Per-sheet cut list keeps simple flex:1 columns. The BOM uses the
// percentage widths the user requested.
const sheetCellHead = { flex: 1, fontSize: 9, fontFamily: 'Helvetica-Bold' }
const sheetCell = { flex: 1, fontSize: 9 }
const sheetCellNarrowHead = { width: 50, fontSize: 9, fontFamily: 'Helvetica-Bold' }
const sheetCellNarrow = { width: 50, fontSize: 9 }

const bomCol = {
  label: { width: '30%', fontSize: 9, paddingRight: 4 },
  l: { width: '12%', fontSize: 9, paddingRight: 4 },
  w: { width: '12%', fontSize: 9, paddingRight: 4 },
  qty: { width: '8%', fontSize: 9, paddingRight: 4 },
  material: { width: '25%', fontSize: 9, paddingRight: 4 },
  grain: { width: '13%', fontSize: 9 },
} as const

const bomColHead = {
  label: { ...bomCol.label, fontFamily: 'Helvetica-Bold' },
  l: { ...bomCol.l, fontFamily: 'Helvetica-Bold' },
  w: { ...bomCol.w, fontFamily: 'Helvetica-Bold' },
  qty: { ...bomCol.qty, fontFamily: 'Helvetica-Bold' },
  material: { ...bomCol.material, fontFamily: 'Helvetica-Bold' },
  grain: { ...bomCol.grain, fontFamily: 'Helvetica-Bold' },
} as const

interface CutListPDFProps {
  project: Project
  materials: Material[]
}

interface SheetCutRow {
  label: string
  widthMm: number
  heightMm: number
  qty: number
}

interface BomRow {
  label: string
  widthMm: number
  heightMm: number
  qty: number
  materialName: string
  grain: string
}

function groupPlacements(packed: PackedSheet, parts: Part[]): SheetCutRow[] {
  const map = new Map<string, SheetCutRow>()
  for (const pl of packed.placements) {
    const part = parts.find((p) => p.id === pl.partId)
    if (!part) continue
    const w = pl.rotated ? part.heightMm : part.widthMm
    const h = pl.rotated ? part.widthMm : part.heightMm
    const key = `${part.label}|${w.toFixed(1)}|${h.toFixed(1)}`
    const existing = map.get(key)
    if (existing) existing.qty += 1
    else map.set(key, { label: part.label, widthMm: w, heightMm: h, qty: 1 })
  }
  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label))
}

// BOM consolidation: identical (label, L, W, material) rows in the input
// get summed instead of repeated. Useful when the user added duplicate
// entries via CSV import or copy-paste.
function consolidateBom(parts: Part[], materials: Material[]): BomRow[] {
  const map = new Map<string, BomRow>()
  for (const p of parts) {
    const matName =
      materials.find((m) => m.id === p.materialId)?.name ?? 'Unknown material'
    const key = `${p.label}|${p.widthMm.toFixed(2)}|${p.heightMm.toFixed(2)}|${matName}`
    const existing = map.get(key)
    if (existing) {
      existing.qty += p.quantity
    } else {
      map.set(key, {
        label: p.label,
        widthMm: p.widthMm,
        heightMm: p.heightMm,
        qty: p.quantity,
        materialName: matName,
        grain: p.grain,
      })
    }
  }
  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label))
}

export function CutListPDF({ project, materials }: CutListPDFProps) {
  const result = project.results
  const totalParts = project.parts.reduce((s, p) => s + p.quantity, 0)
  const today = new Date().toISOString().slice(0, 10)
  const sanitizedName = project.name || 'Project'
  const bomRows = consolidateBom(project.parts, materials)

  return (
    <Document title={sanitizedName}>
      {/* ---------- Cover ---------- */}
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.h1}>{sanitizedName}</Text>
        <Text style={styles.meta}>Generated {today}</Text>
        <View style={{ marginTop: 16 }}>
          <Text style={styles.h2}>Project</Text>
          <Text style={styles.meta}>
            Unit: {project.unit} · Kerf:{' '}
            {formatFromMm(project.kerfMm, project.unit)} {project.unit}
          </Text>
          <Text style={styles.meta}>
            Algorithm: {project.algorithm} · Strategy: {project.cutStrategy}
          </Text>
        </View>

        {result && (
          <View style={{ marginTop: 16 }}>
            <Text style={styles.h2}>Summary</Text>
            <Text>Total sheets used: {result.totalSheets}</Text>
            <Text>Total parts: {totalParts}</Text>
            <Text>
              Average utilization:{' '}
              {(result.averageUtilization * 100).toFixed(1)}%
            </Text>
            <Text>
              Remaining material:{' '}
              {formatAreaFromMm2(result.totalRemainingMm2, project.unit)}
            </Text>
            {result.unplacedPartIds.length > 0 && (
              <Text style={{ marginTop: 6, color: '#b91c1c' }}>
                Unplaced parts: {result.unplacedPartIds.length}
              </Text>
            )}
          </View>
        )}
        <Footer />
      </Page>

      {/* ---------- Per-sheet pages ---------- */}
      {result?.packedSheets.map((ps, idx) => (
        <SheetPage
          key={idx}
          packed={ps}
          index={idx}
          total={result.totalSheets}
          project={project}
          materials={materials}
        />
      ))}

      {/* ---------- BOM ---------- */}
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.h2}>Parts BOM</Text>
        <View style={styles.table}>
          <View style={styles.rowHead}>
            <Text style={bomColHead.label}>Label</Text>
            <Text style={bomColHead.l}>L ({project.unit})</Text>
            <Text style={bomColHead.w}>W ({project.unit})</Text>
            <Text style={bomColHead.qty}>Qty</Text>
            <Text style={bomColHead.material}>Material</Text>
            <Text style={bomColHead.grain}>Grain</Text>
          </View>
          {bomRows.map((r, i) => (
            <View key={i} style={styles.row}>
              <Text style={bomCol.label}>{r.label}</Text>
              <Text style={bomCol.l}>{formatFromMm(r.widthMm, project.unit)}</Text>
              <Text style={bomCol.w}>{formatFromMm(r.heightMm, project.unit)}</Text>
              <Text style={bomCol.qty}>{r.qty}</Text>
              <Text style={bomCol.material}>{r.materialName}</Text>
              <Text style={bomCol.grain}>{r.grain}</Text>
            </View>
          ))}
        </View>
        <Footer />
      </Page>
    </Document>
  )
}

interface SheetPageProps {
  packed: PackedSheet
  index: number
  total: number
  project: Project
  materials: Material[]
}

function SheetPage({ packed, index, total, project, materials }: SheetPageProps) {
  const sheet: Sheet | undefined = project.sheets.find(
    (s) => s.id === packed.sheetId,
  )
  if (!sheet) return null

  // Look up material name by id from the materials store. With valid project
  // data this always resolves; the fallback exists only for edge cases like a
  // sheet pointing at a deleted material.
  const material = materials.find((m) => m.id === sheet.materialId)
  const materialName = material?.name ?? 'Unknown material'

  const isLandscape = sheet.widthMm >= sheet.heightMm
  const orientation: 'landscape' | 'portrait' = isLandscape
    ? 'landscape'
    : 'portrait'
  const pageDims = isLandscape ? LETTER_LANDSCAPE : LETTER_PORTRAIT
  const contentW = pageDims.w - PAGE_PADDING * 2
  const contentH = pageDims.h - PAGE_PADDING * 2

  // Reserve ~36pt for header, ~65% of content for drawing, rest for cut list.
  const headerH = 36
  const drawingH = (contentH - headerH) * 0.7
  const drawingW = contentW

  const utilizationPct = (packed.utilization * 100).toFixed(0)
  const sheetAreaMm2 = sheet.widthMm * sheet.heightMm
  const remainingMm2 = sheetAreaMm2 * Math.max(0, 1 - packed.utilization)
  const remainingLabel = formatAreaFromMm2(remainingMm2, project.unit)

  const grouped = groupPlacements(packed, project.parts)

  return (
    <Page size="LETTER" orientation={orientation} style={styles.page}>
      <View style={{ height: headerH }}>
        <Text style={styles.sheetHeader}>
          Sheet {index + 1} of {total} — {materialName} — {utilizationPct}%
          utilized · {remainingLabel} remaining
        </Text>
        <Text style={styles.sheetMeta}>
          {formatFromMm(sheet.widthMm, project.unit)} ×{' '}
          {formatFromMm(sheet.heightMm, project.unit)} {project.unit} ·{' '}
          Trim: {formatFromMm(sheet.trimMm, project.unit)} {project.unit}
        </Text>
      </View>

      {/* Drawing — explicit numeric size, no flex centering on the parent so
          Yoga doesn't collapse the SVG box. */}
      <View
        style={[styles.drawingBox, { width: drawingW, height: drawingH }]}
      >
        <SheetSvgPdf
          sheet={sheet}
          packed={packed}
          parts={project.parts}
          unit={project.unit}
          widthPts={drawingW - 8}
          heightPts={drawingH - 8}
        />
      </View>

      <View style={styles.table}>
        <Text style={styles.h2}>Cut list for this sheet</Text>
        <CutListTable rows={grouped} unit={project.unit} />
      </View>
      <Footer />
    </Page>
  )
}

interface CutListTableProps {
  rows: SheetCutRow[]
  unit: Unit
}

function CutListTable({ rows, unit }: CutListTableProps) {
  return (
    <View>
      <View style={styles.rowHead}>
        <Text style={sheetCellHead}>Label</Text>
        <Text style={sheetCellHead}>L ({unit})</Text>
        <Text style={sheetCellHead}>W ({unit})</Text>
        <Text style={sheetCellNarrowHead}>Qty</Text>
      </View>
      {rows.map((r, i) => (
        <View key={i} style={styles.row}>
          <Text style={sheetCell}>{r.label}</Text>
          <Text style={sheetCell}>{formatFromMm(r.widthMm, unit)}</Text>
          <Text style={sheetCell}>{formatFromMm(r.heightMm, unit)}</Text>
          <Text style={sheetCellNarrow}>{r.qty}</Text>
        </View>
      ))}
      {rows.length === 0 && (
        <Text style={{ marginTop: 4, fontSize: 9, color: '#737373' }}>
          No parts placed on this sheet.
        </Text>
      )}
    </View>
  )
}
