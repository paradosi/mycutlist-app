'use client'

import * as React from 'react'
import { useMaterialsStore } from '@/lib/store/materials'
import { useProjectStore } from '@/lib/store/project'

// Repairs project state when a part or sheet refers to a materialId that
// doesn't exist in the materials store. Happens to users whose IDB state
// predates the materials-store refactor (sheets persisted with random
// per-project UUIDs that no longer exist anywhere).
//
// Re-runs only when the materials list itself changes; uses store snapshots
// (not subscribed parts/sheets state) to avoid an effect-loop where each
// repair re-triggers the effect.
export function useMaterialSelfHeal(): void {
  const materials = useMaterialsStore((s) => s.materials)
  const updatePart = useProjectStore((s) => s.updatePart)
  const updateSheet = useProjectStore((s) => s.updateSheet)

  React.useEffect(() => {
    if (materials.length === 0) return
    const validIds = new Set(materials.map((m) => m.id))
    const fallbackId = materials[0].id
    const project = useProjectStore.getState().project
    let repaired = 0
    for (const p of project.parts) {
      if (!validIds.has(p.materialId)) {
        updatePart(p.id, { materialId: fallbackId })
        repaired++
      }
    }
    for (const sh of project.sheets) {
      if (!validIds.has(sh.materialId)) {
        updateSheet(sh.id, { materialId: fallbackId })
        repaired++
      }
    }
    if (repaired > 0 && typeof window !== 'undefined') {
      // eslint-disable-next-line no-console
      console.warn(
        `[cutlist] repaired ${repaired} part/sheet entries with invalid materialId; defaulted to "${materials[0].name}"`,
      )
    }
  }, [materials, updatePart, updateSheet])
}
