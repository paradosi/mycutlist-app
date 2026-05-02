import { create } from 'zustand'
import { persist, type PersistStorage } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import type { Material } from '@/types'
import { createIdbStorage } from '@/lib/db/idb-storage'

const newId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `mat-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`
}

// Stable IDs for the seed materials so the default project can reference them
// synchronously at construction time, before the materials store rehydrates.
export const DEFAULT_MATERIAL_IDS = {
  PLY_3_4: 'mat-seed-ply-3-4',
  PLY_1_2: 'mat-seed-ply-1-2',
  MDF_1_4: 'mat-seed-mdf-1-4',
} as const

const SEED_MATERIALS: Material[] = [
  {
    id: DEFAULT_MATERIAL_IDS.PLY_3_4,
    name: '3/4" Plywood',
    thicknessMm: 19.05,
    hasGrain: true,
  },
  {
    id: DEFAULT_MATERIAL_IDS.PLY_1_2,
    name: '1/2" Plywood',
    thicknessMm: 12.7,
    hasGrain: true,
  },
  {
    id: DEFAULT_MATERIAL_IDS.MDF_1_4,
    name: '1/4" MDF',
    thicknessMm: 6.35,
    hasGrain: false,
  },
]

export interface MaterialsStore {
  materials: Material[]
  addMaterial: (material: Omit<Material, 'id'>) => string
  updateMaterial: (id: string, updates: Partial<Omit<Material, 'id'>>) => void
  removeMaterial: (id: string) => void
}

const STORAGE_KEY = 'cutlist-optimizer:materials'

const persistAvailable =
  typeof window !== 'undefined' && typeof indexedDB !== 'undefined'

export const useMaterialsStore = create<MaterialsStore>()(
  persist(
    immer((set) => ({
      materials: SEED_MATERIALS,

      addMaterial: (material) => {
        const id = newId()
        set((s) => {
          s.materials.push({ ...material, id })
        })
        return id
      },

      updateMaterial: (id, updates) =>
        set((s) => {
          const m = s.materials.find((x) => x.id === id)
          if (m) Object.assign(m, updates)
        }),

      removeMaterial: (id) =>
        set((s) => {
          s.materials = s.materials.filter((x) => x.id !== id)
        }),
    })),
    {
      name: STORAGE_KEY,
      storage: (persistAvailable
        ? createIdbStorage<MaterialsStore>()
        : {
            getItem: async () => null,
            setItem: async () => {},
            removeItem: async () => {},
          }) as PersistStorage<MaterialsStore>,
      partialize: (s) => ({ materials: s.materials }) as MaterialsStore,
    },
  ),
)
