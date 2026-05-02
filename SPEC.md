# MyCutList — Phase 1 Spec

## Goal
Ship a working, publicly accessible web app where a woodworker can:
1. Enter the sheet stock they have (size, quantity, material)
2. Enter the parts they need to cut (dimensions, quantity, grain direction)
3. Click "Optimize" and see a visual SVG cut layout
4. Download a PDF cut sheet

No login required. Works offline. No usage caps.

---

## Scaffold

### Package setup
```bash
pnpm create next-app@latest mycutlist-app \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*"
cd mycutlist-app
pnpm add zustand immer idb zod react-hook-form @hookform/resolvers \
  @tanstack/react-table @react-pdf/renderer comlink
pnpm add -D vitest @vitest/ui fast-check @playwright/test \
  @types/node typescript
pnpm dlx shadcn@latest init
```

### shadcn/ui components to install
```bash
pnpm dlx shadcn@latest add button input label select dialog \
  table tooltip badge separator card
```

---

## Types (src/types/index.ts)

Implement ALL types listed in CLAUDE.md under "Core Data Types". Also add:

```ts
interface Placement {
  partId: string
  x: number        // mm from left edge of sheet (after trim)
  y: number        // mm from top edge of sheet (after trim)
  rotated: boolean
}

interface Cut {
  index: number
  direction: 'rip' | 'crosscut'
  offset: number   // mm from reference edge
  fromX: number
  fromY: number
  toX: number
  toY: number
}

interface Offcut {
  x: number
  y: number
  widthMm: number
  heightMm: number
}

interface OptimizerInput {
  parts: Part[]
  sheets: Sheet[]
  materials: Material[]
  kerfMm: number
  cutStrategy: CutStrategy
  algorithm: Algorithm
}

interface OptimizerResult {
  packedSheets: PackedSheet[]
  unplacedPartIds: string[]
  totalSheets: number
  averageUtilization: number
  totalWasteMm2: number
  durationMs: number
}

type OptimizerProgress = {
  type: 'progress'
  generation: number
  bestUtilization: number
}

type OptimizerMessage = OptimizerProgress | { type: 'result'; result: OptimizerResult } | { type: 'error'; message: string }
```

---

## Units Library (src/lib/units.ts)

### `parseToMm(input: string, unit: Unit): number`
Accepts: `"23 7/8"`, `"23.875"`, `'23 7/8"'`, `"607mm"`, `"60.7cm"`, `"607"` (assumes current unit)
Returns: millimeters as a float
Throws: `InvalidDimensionError` if unparseable

### `formatFromMm(mm: number, unit: Unit, fractionBase?: 64 | 32 | 16 | 8): string`
- For `mm`: returns `"607.0"` 
- For `in`: returns nearest fraction: `"23 7/8"` not `"23.875"`
- Default fractionBase: 32 (nearest 1/32")

Write Vitest tests covering at minimum:
- All input formats above
- Round-trip: parse → format → parse = original (within 0.1mm tolerance)
- Edge cases: `0`, `0.5`, `48`, `96`, negative (should throw)

---

## Zustand Store (src/lib/store/project.ts)

```ts
interface ProjectStore {
  project: Project
  isDirty: boolean
  
  // Project actions
  setProjectName: (name: string) => void
  setUnit: (unit: Unit) => void
  setKerf: (kerfMm: number) => void
  setCutStrategy: (strategy: CutStrategy) => void
  setAlgorithm: (algorithm: Algorithm) => void
  
  // Material actions
  addMaterial: (material: Omit<Material, 'id'>) => void
  updateMaterial: (id: string, updates: Partial<Material>) => void
  removeMaterial: (id: string) => void
  
  // Sheet actions
  addSheet: (sheet: Omit<Sheet, 'id'>) => void
  updateSheet: (id: string, updates: Partial<Sheet>) => void
  removeSheet: (id: string) => void
  
  // Part actions
  addPart: (part: Omit<Part, 'id'>) => void
  updatePart: (id: string, updates: Partial<Part>) => void
  removePart: (id: string) => void
  duplicatePart: (id: string) => void
  
  // Results
  setResults: (results: OptimizerResult) => void
  clearResults: () => void
  
  // Persistence
  saveToIndexedDB: () => Promise<void>
  loadFromIndexedDB: (projectId: string) => Promise<void>
  newProject: () => void
}
```

Use `immer` middleware for immutable updates. Use `persist` middleware with an `idb` storage adapter. Generate IDs with `crypto.randomUUID()`.

---

## Default Project State

```ts
const DEFAULT_PROJECT: Project = {
  id: crypto.randomUUID(),
  name: 'My Project',
  unit: 'in',
  kerfMm: 3.175,  // 1/8"
  cutStrategy: 'yield',
  algorithm: 'guillotine',
  materials: [
    { id: crypto.randomUUID(), name: '3/4" Plywood', thicknessMm: 19.05, hasGrain: true }
  ],
  sheets: [
    { id: crypto.randomUUID(), materialId: '<first material id>', widthMm: 2438.4, heightMm: 1219.2, quantity: 2, trimMm: 3.175 }
  ],
  parts: []
}
```

---

## Guillotine Algorithm (src/lib/optimizer/guillotine.ts)

Implement the Guillotine bin packing algorithm per Jylänki 2010.

### Key function signatures:
```ts
export function guillotinePack(input: OptimizerInput): OptimizerResult

function packSheet(
  parts: ExpandedPart[],        // pre-expanded by quantity
  sheet: Sheet,
  kerfMm: number,
  strategy: CutStrategy
): PackedSheet

function scoreRect(
  part: ExpandedPart,
  freeRect: Rect,
  heuristic: 'BSSF' | 'BAF'
): number

function splitFreeRect(
  freeRect: Rect,
  placed: Rect,
  kerfMm: number,
  splitRule: 'MAXAS' | 'MINAS'
): [Rect, Rect]
```

### Algorithm:
1. Expand parts by quantity into a flat list of `ExpandedPart[]`
2. Sort descending by area (largest first — reduces fragmentation)
3. For each sheet copy:
   a. Initialize free rects = `[{ x: trimMm, y: trimMm, w: sheet.widthMm - 2*trimMm - kerfMm, h: sheet.heightMm - 2*trimMm - kerfMm }]`
   b. For each unplaced part, find the free rect with best BSSF score
   c. Place the part, remove the used free rect, add two new split rects (MAXAS rule)
   d. Merge free rects (remove contained rects)
   e. Track placements, compute utilization
4. Return `PackedSheet[]` + `unplacedPartIds[]`

**Grain enforcement:** if `part.grain === 'with'`, never set `rotated = true`. If `grain === 'across'`, always set `rotated = true`. If `grain === 'either'`, try both orientations and pick the better BSSF score.

**Guillotine validity:** After packing, validate that every placement is reachable by guillotine cuts (edge-to-edge). Log a warning if not — don't throw.

---

## Web Worker (src/lib/optimizer/worker.ts)

```ts
import { expose } from 'comlink'
import { guillotinePack } from './guillotine'

let cancelled = false

const optimizer = {
  async optimize(input: OptimizerInput, onProgress: (p: OptimizerProgress) => void): Promise<OptimizerResult> {
    cancelled = false
    // For Phase 1: just call guillotinePack directly (GA wrapper in Phase 2)
    const result = guillotinePack(input)
    onProgress({ type: 'progress', generation: 1, bestUtilization: result.averageUtilization })
    return result
  },
  cancel() {
    cancelled = true
  }
}

expose(optimizer)
```

Hook in React: `src/hooks/useOptimizer.ts` — wraps the worker with `comlink.wrap`, exposes `{ optimize, cancel, isRunning, progress, result, error }`.

---

## UI Components

### Sheet Stock Presets (src/lib/presets.ts)
```ts
export const SHEET_PRESETS = [
  { name: '4×8 Plywood (in)', widthMm: 2438.4, heightMm: 1219.2 },
  { name: '4×8 Plywood (mm)', widthMm: 2440, heightMm: 1220 },
  { name: '5×5 Baltic Birch', widthMm: 1524, heightMm: 1524 },
  { name: '4×4 Sheet', widthMm: 1219.2, heightMm: 1219.2 },
  { name: '2520×1830 (metric)', widthMm: 2520, heightMm: 1830 },
]
```

### PartListEditor (src/components/layout/PartListEditor.tsx)
- TanStack Table with editable cells (inline editing on click)
- Columns: Label | L | W | Qty | Material | Grain | Actions
- Grain dropdown: None / With Grain / Across Grain / Either
- Add row button at bottom
- Duplicate and delete row actions
- Displays dimensions in the project's current unit (in/mm)
- Zod validation: dimensions must be positive, qty must be 1–999

### SheetStockManager (src/components/layout/SheetStockManager.tsx)
- Card per sheet type with: Material name, L × W, Qty (or "Unlimited"), Trim margin
- "Add Sheet" button opens a Dialog with preset picker + custom dimensions
- Preset picker shown first, "Custom" option at bottom
- Dimensions input accepts imperial fraction format when unit is 'in'

### OptimizerControls (src/components/layout/OptimizerControls.tsx)
- Kerf width input (shows in current unit)
- Cut type: "Table/Panel Saw (Guillotine)" | "CNC / Jigsaw (Max Efficiency)"
- Cut preference (when Guillotine): "Best Yield" | "Rip Cuts First"
- Big "Optimize" button — shows spinner + "Calculating..." when running
- Cancel button while running
- Small stats line below button when results exist: "3 sheets · 84% avg utilization · 0.42 m² waste"

### SheetLayoutRenderer (src/components/renderer/SheetLayoutRenderer.tsx)
- One `<svg>` per packed sheet
- Sheet = light gray background rect
- Each placed part = colored rect (color hashed from part label) with:
  - Part label (centered, truncated)
  - Dimensions below label (in current unit)
  - Grain arrow if grain !== 'none'
  - Thin red kerf gap lines
- Sheet header: "Sheet 1 of 3 — 84% utilized"
- Zoom controls (+ / - / fit)
- SVG export button per sheet (downloads `sheet-1.svg`)

### PDF Template (src/components/pdf/CutListPDF.tsx)
Pages:
1. Cover: project name, date, totals
2. One page per sheet: header + SVG layout embedded + cut list table
3. Parts BOM

---

## App Layout (src/app/page.tsx)

Two-panel layout:
- **Left panel (1/3):** Tabs — "Parts" / "Sheets" / "Settings"
  - Parts tab: `<PartListEditor />`
  - Sheets tab: `<SheetStockManager />`
  - Settings tab: project name, unit toggle, kerf — `<OptimizerControls />`
- **Right panel (2/3):** Results area
  - Empty state: illustration + "Add your sheets and parts, then click Optimize →"
  - Running state: progress bar + utilization estimate
  - Results: scrollable list of `<SheetLayoutRenderer />` + PDF download button

---

## Testing Requirements

Before Phase 1 is considered done:
- `pnpm typecheck` — zero errors
- `pnpm lint` — zero warnings
- `pnpm test` — all pass, including:
  - Unit parser: 15+ cases
  - Guillotine algorithm: property-based tests (no overlaps, fits within bounds, kerf gaps correct)
- Manual smoke test: create a basic 5-part cabinet carcass job, optimize, verify SVG layout looks correct, download PDF
