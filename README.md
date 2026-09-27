# MyCutList

A free, client-side 2D sheet-goods cut list optimizer for woodworkers and DIYers.
Enter your sheet stock, enter your parts, click **Optimize**, and get a printable
PDF cut sheet with the layout drawn for every sheet.

No login. No usage caps. Works offline once loaded.

- **Live:** [mycutlist.app](https://mycutlist.app)
- **Source:** [github.com/paradosi/mycutlist-app](https://github.com/paradosi/mycutlist-app)
- **License:** [AGPL-3.0](LICENSE)

## Why another one

Existing tools either gate basic features behind subscriptions or refuse to do
multi-material projects. This one focuses on doing one thing well: produce
optimized, physically-cuttable layouts for table saws, track saws, and panel
saws — with a UI that explains every domain term inline.

## Features (Phase 1)

- **Parts editor** with inline editing, imperial fractions (`23 7/8`), decimal,
  mm/cm/m suffixes, grain direction, per-row duplicate/delete
- **Sheet stock manager** with presets (`4×8`, `5×5 Baltic`, `4×4`, `2520×1830 mm`)
  and custom dimensions
- **Materials library** persisted across projects — define your own stock types
  with thickness, grain, and optional cost per sheet
- **Guillotine optimizer** (Jylänki 2010 BSSF + MAXAS) running in a Web Worker
  via comlink, with a sheet-elimination pass that empties a poorly used sheet
  into the free space of the others when everything fits
- **Cut preference** — *Best Yield* (MAXAS split) or *Rip Cuts First*
  (full-length rips along the sheet's long axis, then crosscuts)
- **Material isolation** — `3/4" plywood` parts only land on `3/4" plywood`
  sheets; the optimizer respects the material on every part and sheet
- **SVG renderer** with zoom/fit, per-sheet SVG export, kerf gap visualization
- **PDF export** — cover page, one vector-drawn page per packed sheet (auto
  portrait/landscape based on aspect ratio), shrink-to-fit text in small parts,
  consolidated parts BOM
- **CSV import/export** — auto-detects column headers (`Label`/`Name`/`Part`,
  `L`/`Length`/`Long`, etc.), grain normalization, auto-creates missing
  materials, preview before commit
- **Cost stat** when materials have `costPerSheet` set
- **IndexedDB persistence** — your project survives a refresh
- **Clear** — clear just the parts, or start over with a blank project
  (your materials library stays); both confirm first and can be undone for
  a few seconds

## Stack

- Next.js 16 (App Router, Turbopack) · React 19 · TypeScript strict
- Tailwind CSS v4
- Zustand (with `immer` + `persist` middleware) · IndexedDB via `idb`
- Zod schemas · `react-hook-form` form helpers · `@tanstack/react-table`
- `@react-pdf/renderer` (vector SVG primitives) · `papaparse`
- `comlink` Web Worker
- Vitest + `fast-check` (property-based tests)

## Local development

```bash
pnpm install
pnpm dev          # http://localhost:3000

pnpm typecheck    # tsc --noEmit
pnpm lint         # eslint
pnpm test         # vitest run (unit + property-based)
pnpm test:watch
pnpm build        # next build (production)
```

## Project layout

```
src/
  app/                    Next.js App Router (root page, layout)
  components/
    ui/                   Hand-authored UI primitives (Button, Input, Select, ...)
    layout/               PartListEditor, SheetStockManager, MaterialsEditor,
                          OptimizerControls, CsvImportDialog
    renderer/             SheetLayoutRenderer (on-screen SVG)
    pdf/                  CutListPDF, SheetSvgPdf, PdfDownloadButton
  lib/
    optimizer/            guillotine.ts (algorithm), worker.ts (comlink expose)
    store/                project.ts, materials.ts (Zustand + IDB persist)
    db/                   idb-storage.ts (PersistStorage adapter)
    csv.ts                CSV parsing, mapping, export
    units.ts              parseToMm, formatFromMm, formatAreaFromMm2
    colors.ts             FNV-1a hash → curated 12-color palette (UI + PDF share)
    presets.ts            Common sheet sizes
  hooks/
    useOptimizer.ts       comlink wrapper around the worker
    useMaterialSelfHeal.ts  Repairs stale materialIds from older project state
  types/
    index.ts              All shared TypeScript types
```

## Algorithm notes

The packer is a Guillotine bin packing implementation with:

- **Pre-sort** parts by descending area before placement (Jylänki §3.2)
- **BSSF** (Best Short Side Fit) rectangle choice
- **MAXAS** (Maximize Larger Area Split) split rule for *Best Yield*. *Rip Cuts
  First* uses a fixed split instead: the full-span leftover always runs along
  the sheet's long axis, so the layout is strips ripped full-length and then
  crosscut
- **Pruning** of contained free rects after each split
- **Material isolation** — parts only place on sheets of matching material
- **Grain enforcement** — `with` parts never rotate, `across` always rotate,
  `either`/`none` try both
- **Sheet elimination** — the main pass fills sheet copies greedily in order,
  so a part never sees sheets opened after the one it lands on. Afterwards,
  sheets are taken in ascending utilization and the packer tries to move all
  of one sheet's parts into the free space of the other sheets of the same material;
  if every part fits, the sheet is dropped. It repeats until nothing changes.
  Parts only go into existing guillotine free rects, so layouts stay
  cuttable

> [!NOTE]
> There is deliberately no "retry unplaced parts" pass. Free rects only shrink
> as a sheet fills, and an unplaced part has already been tried against every
> sheet of its material, so a retry cannot succeed. 0.1.0 shipped one; it was
> removed after a fuzz comparison showed it never changed a result.

The whole optimizer runs in a Web Worker so the main thread stays responsive
during a calculation.

## Roadmap

**Phase 2 (planned):**

- MaxRects algorithm for CNC / jigsaw cutting. The *Max Efficiency* option is
  in the Cut type dropdown but disabled ("coming soon") until this exists
- Genetic-algorithm wrapper around guillotine for higher yield with rip-cut
  preference
- Konva drag-to-edit after optimize
- Persistent offcut inventory across projects
- Multi-project save/load library
- PWA via `@serwist/next` (offline-first)
- Optional Supabase sync for projects across devices
- Cabinet-builder presets

## License

[AGPL-3.0](LICENSE) — free to use, modify, and self-host. Network-deployed
forks must publish their source under AGPL too.
