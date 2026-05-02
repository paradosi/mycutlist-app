# MyCutList — Project CLAUDE.md

## What This Is
An open-source, client-side-first 2D sheet goods cut list optimizer for woodworkers and DIYers.
Differentiators: fully free/unlimited, offline PWA, drag-to-adjust after optimization, persistent offcut inventory.
License: AGPL-3.0. Repo: `paradosi/mycutlist-app` on GitHub. Live at `mycutlist.app`.

## Stack
- **Framework:** Next.js 15 (App Router, TypeScript strict)
- **Styling:** Tailwind CSS v4 + shadcn/ui
- **State:** Zustand with immer + persist middleware
- **Forms:** react-hook-form + zod
- **Tables:** @tanstack/react-table
- **Layout rendering:** Native React + SVG (default); react-konva (drag-edit mode, feature-flagged)
- **Optimizer:** TypeScript Guillotine + MaxRects in a Web Worker via comlink
- **PDF export:** @react-pdf/renderer
- **Persistence:** IndexedDB via `idb` (primary, no account needed); Supabase (optional cloud sync)
- **Backend (opt-in):** Supabase — Postgres + Auth + Storage
- **PWA:** @serwist/next
- **Analytics:** PostHog
- **Testing:** Vitest (unit/algorithm), Playwright (e2e)
- **Package manager:** pnpm

## Key Commands
```bash
pnpm dev          # Start dev server (http://localhost:3000)
pnpm build        # Production build
pnpm typecheck    # tsc --noEmit
pnpm lint         # eslint
pnpm test         # vitest run
pnpm test:watch   # vitest --watch
pnpm test:e2e     # playwright test
```

## Project Structure
```
src/
  app/                    # Next.js App Router pages
  components/
    ui/                   # shadcn/ui primitives
    layout/               # PartListEditor, SheetStockManager, etc.
    renderer/             # SVG layout renderer
    editor/               # Konva drag editor (feature-flagged)
    pdf/                  # @react-pdf/renderer templates
  lib/
    optimizer/            # Algorithm: guillotine.ts, maxrects.ts, ga.ts, worker.ts
    store/                # Zustand stores (project.ts, offcuts.ts, ui.ts)
    db/                   # IndexedDB helpers via idb
    supabase/             # Supabase client, types, RLS helpers
    units/                # Imperial fraction parsing/formatting
    export/               # SVG, DXF, PDF export utilities
  types/                  # Shared TypeScript types (project, part, sheet, result)
  hooks/                  # Custom React hooks
```

## Core Data Types (source of truth — types/index.ts)
```ts
type Unit = 'mm' | 'in'
type Grain = 'with' | 'across' | 'either'
type CutStrategy = 'yield' | 'rip-first'
type Algorithm = 'guillotine' | 'maxrects' | 'mixed'

interface Material { id, name, thicknessMm, hasGrain, costPerSheet? }
interface Sheet { id, materialId, widthMm, heightMm, quantity, trimMm }
interface Part { id, label, materialId, widthMm, heightMm, quantity, grain, rotationLocked, edgeBanding? }
interface Project { id, name, unit, kerfMm, cutStrategy, algorithm, parts, sheets, materials, results? }
interface PackedSheet { sheetId, copyIndex, utilization, placements, cuts, offcuts }
```

## Code Style
- TypeScript strict — no `any`, use `unknown` + type guards
- ESM imports only (no `require`)
- Destructure imports: `import { foo } from 'bar'`
- Prefer `const` — no `let` unless mutation is needed
- Zod schemas live next to the types they validate
- All optimizer functions must be pure (no side effects) — they run in a Web Worker
- Algorithm code: comment each heuristic step with a reference to Jylänki 2010 section

## Key Architectural Rules
1. **Optimizer is always client-side** — never send cut list data to a server for optimization. This is our core free-forever promise.
2. **No account required for any optimizer feature** — Supabase is only for saving/syncing projects.
3. **Guillotine mode is the default** — it produces physically cuttable layouts for table/panel saws. MaxRects ("efficiency") is opt-in.
4. **SVG is the primary render target** — never rasterize the layout for display. Canvas/Konva only in explicit drag-edit mode.
5. **Units are stored internally as mm** — display conversion happens at the UI boundary only.
6. **Imperial fractions must round to the nearest 1/64"** — use the `parseImperial` / `formatImperial` utilities in `lib/units`.
7. **Be Comprehensive, Not Iterative** — implement the full feature including edge cases, not a skeleton. Don't leave TODOs for things we discussed.

## Woodworking Domain Rules (critical for algorithm correctness)
- **Kerf** = blade thickness; must be subtracted from every cut, both rip and crosscut
- **Grain direction:** 'with' = long dimension runs with sheet grain; 'across' = perpendicular; 'either' = optimizer may rotate
- **Trim margin:** strip cut from all four edges of a sheet before packing (produces a clean reference edge)
- **Guillotine cut:** every cut must go edge-to-edge on the current piece — no partial cuts. This is a hard constraint.
- **Rip-first strategy:** prefer cuts along the length of the sheet (parallel to grain) before crosscuts
- **Offcut:** any remaining rectangle above threshold (default: >300mm × >150mm) after all parts are placed

## Algorithm Implementation Notes
- Reference: Jylänki 2010 "A Thousand Ways to Pack the Bin" (pseudocode is the source of truth)
- Guillotine: use BSSF (Best Short Side Fit) split rule + MAXAS (Maximize Larger Area Split) by default
- MaxRects: use BSSF heuristic
- GA wrapper: population=40, generations=60, fitness = yieldScore - ripComplexityPenalty * strategy weight
- Worker communication: use `comlink` — expose `optimize(input): Promise<Result>` and `cancel(): void`
- Post progress events every 10 generations: `{ type: 'progress', generation, utilization }`

## Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
```

## Testing Strategy
- Algorithm functions: fuzz with `fast-check` property-based tests — a valid result must fit all parts within sheets with no overlaps and kerf gaps respected
- SVG renderer: snapshot tests
- Unit parsing: table-driven tests covering edge cases (`23 7/8`, `23.875`, `607mm`, `60.7cm`)
- E2E: Playwright — full project creation → optimization → PDF download flow

## Current Phase
**Phase 1 (active):** Core scaffold → parts/sheets editor → Guillotine optimizer → SVG renderer → PDF export → public preview.
Do NOT build Konva drag editor, Supabase sync, offcut library, or label/QR sheets yet — those are Phase 2+.
