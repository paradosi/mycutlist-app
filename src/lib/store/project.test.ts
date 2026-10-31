import { describe, it, expect, beforeEach } from 'vitest'
import { useProjectStore } from './project'
import { useMaterialsStore } from './materials'
import type { OptimizerResult } from '@/types'

const RESULT: OptimizerResult = {
  packedSheets: [],
  unplacedPartIds: ['x'],
  totalSheets: 0,
  averageUtilization: 0,
  totalRemainingMm2: 0,
  durationMs: 1,
}

function seed() {
  const s = useProjectStore.getState()
  s.newProject()
  s.setProjectName('Garage cabinets')
  s.setUnit('mm')
  s.setKerf(2)
  s.addSheet({ materialId: 'mat-seed-ply-1-2', widthMm: 1524, heightMm: 1524, quantity: 1, trimMm: 0 })
  s.addPart({ label: 'Side', materialId: 'mat-seed-ply-3-4', widthMm: 700, heightMm: 500, quantity: 2, grain: 'with', rotationLocked: false })
  s.addPart({ label: 'Shelf', materialId: 'mat-seed-ply-3-4', widthMm: 600, heightMm: 400, quantity: 1, grain: 'either', rotationLocked: false })
  s.setResults(RESULT)
}

describe('project store — clearing', () => {
  beforeEach(seed)

  it('clearParts removes parts and results but keeps sheets and settings', () => {
    const before = useProjectStore.getState().project
    useProjectStore.getState().clearParts()
    const after = useProjectStore.getState().project
    expect(after.parts).toEqual([])
    expect(after.results).toBeUndefined()
    expect(after.sheets).toEqual(before.sheets)
    expect({ ...after, parts: before.parts, results: before.results }).toEqual(before)
  })

  it('newProject resets everything but leaves the materials library alone', () => {
    const materialsBefore = useMaterialsStore.getState().materials
    useMaterialsStore.getState().addMaterial({ name: 'Walnut ply', thicknessMm: 18, hasGrain: true })
    const materials = useMaterialsStore.getState().materials
    const oldId = useProjectStore.getState().project.id
    useProjectStore.getState().newProject()
    const p = useProjectStore.getState().project
    expect(p.id).not.toBe(oldId)
    expect(p.name).toBe('My Project')
    expect(p.unit).toBe('in')
    expect(p.parts).toEqual([])
    expect(p.results).toBeUndefined()
    expect(p.sheets).toHaveLength(1)
    expect(useMaterialsStore.getState().materials).toEqual(materials)
    expect(materials.length).toBe(materialsBefore.length + 1)
  })

  it('restoreProject undoes either clear exactly', () => {
    for (const clear of ['clearParts', 'newProject'] as const) {
      seed()
      const snapshot = useProjectStore.getState().project
      useProjectStore.getState()[clear]()
      useProjectStore.getState().restoreProject(snapshot)
      expect(useProjectStore.getState().project).toEqual(snapshot)
    }
  })
})

  describe('project store — a changed input invalidates the layout', () => {
    beforeEach(seed)

    it('editing a part clears the stale layout', () => {
      const id = useProjectStore.getState().project.parts[0].id
      useProjectStore.getState().updatePart(id, { widthMm: 999 })
      expect(useProjectStore.getState().project.results).toBeUndefined()
    })

    it('deleting a part clears it — the drawing must not keep placements for a part that is gone', () => {
      const id = useProjectStore.getState().project.parts[0].id
      useProjectStore.getState().removePart(id)
      expect(useProjectStore.getState().project.results).toBeUndefined()
    })

    it('adding or duplicating a part clears it', () => {
      useProjectStore.getState().addPart({
        label: 'Rail', materialId: 'mat-seed-ply-3-4', widthMm: 300, heightMm: 100,
        quantity: 1, grain: 'either', rotationLocked: false,
      })
      expect(useProjectStore.getState().project.results).toBeUndefined()

      seed()
      useProjectStore.getState().duplicatePart(useProjectStore.getState().project.parts[0].id)
      expect(useProjectStore.getState().project.results).toBeUndefined()
    })

    it('changing a sheet or the kerf clears it', () => {
      useProjectStore.getState().setKerf(4)
      expect(useProjectStore.getState().project.results).toBeUndefined()

      seed()
      const sheetId = useProjectStore.getState().project.sheets[0].id
      useProjectStore.getState().updateSheet(sheetId, { widthMm: 2500 })
      expect(useProjectStore.getState().project.results).toBeUndefined()
    })

    it('a cosmetic change leaves the layout alone (renaming, switching display units)', () => {
      useProjectStore.getState().setProjectName('Something else')
      useProjectStore.getState().setUnit('in')
      expect(useProjectStore.getState().project.results).toBeDefined()
    })
  })
