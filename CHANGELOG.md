# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] — 2026-05-01

Initial Phase 1 implementation. Working end-to-end: define materials, sheets,
parts → optimize → SVG layouts → printable PDF + CSV import/export.

### Added

#### Core types and units

- Shared TypeScript types in `src/types/index.ts` (Material, Sheet, Part,
  Project, PackedSheet, Placement, Cut, Offcut, OptimizerInput,
  OptimizerResult, OptimizerProgress, OptimizerMessage, InvalidDimensionError)
- `src/lib/units.ts` with `parseToMm`, `formatFromMm`, `formatAreaFromMm2`
  — handles imperial fractions (`23 7/8`), decimal, `mm`/`cm`/`m` suffixes,
  fallback to project unit for bare numbers, with 32 unit-parser tests

#### State

- Zustand `useProjectStore` with `immer` + `persist` middleware backed by
  IndexedDB via `idb`
- Separate `useMaterialsStore` for the materials library (persists across
  `New Project`)
- Self-healing `useMaterialSelfHeal` hook that repoints any part/sheet whose
  `materialId` no longer resolves to a real material

#### Optimizer

- Guillotine bin packing per Jylänki 2010 (BSSF rectangle choice + MAXAS split
  rule) in `src/lib/optimizer/guillotine.ts`
- Material isolation — parts only place on sheets of matching material
- Grain enforcement (`with` never rotates, `across` always rotates,
  `either`/`none` try both orientations)
- Retry pass after the main loop fits late-considered small parts into the
  remaining free space of already-packed sheets, in place
- Web Worker via `comlink` exposed in `src/lib/optimizer/worker.ts`
- `useOptimizer` hook with main-thread fallback
- 8 algorithm correctness tests + 4 `fast-check` property-based tests
  (bounds, no-overlap, kerf gap, grain rules, utilization range, retry pass)

#### UI

- Hand-authored UI primitives (Button, Input, Label, Select, Card, Badge,
  HelpTip via React portal so it can't be clipped by parent overflow)
- PartListEditor with inline editing and per-row Dup/Del; CSV import/export
- SheetStockManager with preset picker and add-sheet dialog
- MaterialsEditor (Add/Edit/Delete) — block delete if material is in use
- OptimizerControls with kerf, cut type (Table/Track Saw vs CNC/Jigsaw), cut
  preference, Optimize button, stats line
- SheetLayoutRenderer — responsive SVG that fits its container width via
  `ResizeObserver`, zoom +/-/Fit, per-sheet SVG export
- HelpTips on Grain, Kerf, Cut type, Cut preference, Trim margin, Quantity,
  Material has-grain, Material cost, Unit toggle

#### CSV

- `papaparse`-based import with header auto-detection (Label/Name/Part/Description,
  L/Length/Long, W/Width/Wide, Qty/Quantity/Count, Material/Mat, Grain)
- Manual column mapping fallback when auto-detect can't find required columns
- Preview table with per-row warnings, error summary, new-material notice
- Export to CSV using project's current display unit; proper RFC 4180 escaping
  for commas, quotes, and newlines
- 27 CSV unit tests

#### PDF

- `@react-pdf/renderer` document with cover page (project meta + summary) +
  one page per packed sheet (auto portrait/landscape based on sheet aspect)
  + final consolidated BOM page
- Vector-drawn layout per sheet using react-pdf's SVG primitives — same
  colors, kerf lines, and dim/label rendering as on-screen
- Shrink-to-fit text in small parts (Helvetica avg-char-width estimate;
  shrinks to 5pt min, then truncates with ellipsis, hides if even ellipsis
  won't fit)
- BOM consolidation — duplicate (`label`, L, W, material) rows are summed
- Fixed BOM column widths (Label 30 / L 12 / W 12 / Qty 8 / Material 25 / Grain 13)

#### Layout / UX

- Two-section layout (data entry on top, results below) tuned for ultrawide
  monitors with auto-scroll to results after Optimize completes
- "Remaining" terminology throughout (formerly "waste") since the unused
  area is offcut material the user keeps
- Imperial waste/remaining displayed in **ft²**, metric in m² — never mixed

### Fixed

- Imperial waste-area unit was always `m²` regardless of project unit
- Duplicate stats bar between OptimizerControls and the results panel header
- `colorForLabel` hash collisions (`shelf` and `back` produced near-identical
  hues with the prior djb2-shift hash); replaced with FNV-1a + curated
  12-color palette
- PDF SVG layout drawings not rendering due to Yoga collapsing the parent
  flex container; removed `<G>` wrappers and replaced flex centering with
  fixed-size box
- Material lookup falling back to "Unknown material" for parts/sheets with
  stale `materialId`s from before the materials-store refactor — now
  self-healed at app load
- `useOptimizer` falling back to main thread when the worker URL fails to
  resolve
