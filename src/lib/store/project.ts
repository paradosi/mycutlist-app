import { create } from 'zustand'
import { persist, type PersistStorage } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import type {
  Algorithm,
  CutStrategy,
  OptimizerResult,
  Part,
  Project,
  Sheet,
  Unit,
} from '@/types'
import { createIdbStorage } from '@/lib/db/idb-storage'
import { DEFAULT_MATERIAL_IDS } from '@/lib/store/materials'

const newId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `id-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`
}

function buildDefaultProject(): Project {
  return {
    id: newId(),
    name: 'My Project',
    unit: 'in',
    kerfMm: 3.175,
    cutStrategy: 'yield',
    algorithm: 'guillotine',
    sheets: [
      {
        id: newId(),
        materialId: DEFAULT_MATERIAL_IDS.PLY_3_4,
        widthMm: 2438.4,
        heightMm: 1219.2,
        quantity: 2,
        trimMm: 3.175,
      },
    ],
    parts: [],
  }
}

export interface ProjectStore {
  project: Project
  isDirty: boolean

  setProjectName: (name: string) => void
  setUnit: (unit: Unit) => void
  setKerf: (kerfMm: number) => void
  setCutStrategy: (strategy: CutStrategy) => void
  setAlgorithm: (algorithm: Algorithm) => void

  addSheet: (sheet: Omit<Sheet, 'id'>) => void
  updateSheet: (id: string, updates: Partial<Sheet>) => void
  removeSheet: (id: string) => void

  addPart: (part: Omit<Part, 'id'>) => void
  updatePart: (id: string, updates: Partial<Part>) => void
  removePart: (id: string) => void
  duplicatePart: (id: string) => void

  setResults: (results: OptimizerResult) => void
  clearResults: () => void

  newProject: () => void
}

const STORAGE_KEY = 'cutlist-optimizer:project'

const persistAvailable = typeof window !== 'undefined' && typeof indexedDB !== 'undefined'

export const useProjectStore = create<ProjectStore>()(
  persist(
    immer((set) => ({
      project: buildDefaultProject(),
      isDirty: false,

      setProjectName: (name) =>
        set((s) => {
          s.project.name = name
          s.isDirty = true
        }),

      setUnit: (unit) =>
        set((s) => {
          s.project.unit = unit
          s.isDirty = true
        }),

      setKerf: (kerfMm) =>
        set((s) => {
          s.project.kerfMm = kerfMm
          s.isDirty = true
        }),

      setCutStrategy: (strategy) =>
        set((s) => {
          s.project.cutStrategy = strategy
          s.isDirty = true
        }),

      setAlgorithm: (algorithm) =>
        set((s) => {
          s.project.algorithm = algorithm
          s.isDirty = true
        }),

      addSheet: (sheet) =>
        set((s) => {
          s.project.sheets.push({ ...sheet, id: newId() })
          s.isDirty = true
        }),

      updateSheet: (id, updates) =>
        set((s) => {
          const sh = s.project.sheets.find((x) => x.id === id)
          if (sh) Object.assign(sh, updates)
          s.isDirty = true
        }),

      removeSheet: (id) =>
        set((s) => {
          s.project.sheets = s.project.sheets.filter((x) => x.id !== id)
          s.isDirty = true
        }),

      addPart: (part) =>
        set((s) => {
          s.project.parts.push({ ...part, id: newId() })
          s.isDirty = true
        }),

      updatePart: (id, updates) =>
        set((s) => {
          const p = s.project.parts.find((x) => x.id === id)
          if (p) Object.assign(p, updates)
          s.isDirty = true
        }),

      removePart: (id) =>
        set((s) => {
          s.project.parts = s.project.parts.filter((x) => x.id !== id)
          s.isDirty = true
        }),

      duplicatePart: (id) =>
        set((s) => {
          const p = s.project.parts.find((x) => x.id === id)
          if (p) {
            s.project.parts.push({ ...p, id: newId() })
            s.isDirty = true
          }
        }),

      setResults: (results) =>
        set((s) => {
          s.project.results = results
        }),

      clearResults: () =>
        set((s) => {
          s.project.results = undefined
        }),

      newProject: () =>
        set((s) => {
          s.project = buildDefaultProject()
          s.isDirty = false
        }),
    })),
    {
      name: STORAGE_KEY,
      storage: (persistAvailable
        ? createIdbStorage<ProjectStore>()
        : {
            getItem: async () => null,
            setItem: async () => {},
            removeItem: async () => {},
          }) as PersistStorage<ProjectStore>,
      partialize: (s) => ({ project: s.project, isDirty: s.isDirty }) as ProjectStore,
    },
  ),
)
