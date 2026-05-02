export interface SheetPreset {
  name: string
  widthMm: number
  heightMm: number
}

export const SHEET_PRESETS: SheetPreset[] = [
  { name: '4×8 Plywood (in)', widthMm: 2438.4, heightMm: 1219.2 },
  { name: '4×8 Plywood (mm)', widthMm: 2440, heightMm: 1220 },
  { name: '5×5 Baltic Birch', widthMm: 1524, heightMm: 1524 },
  { name: '4×4 Sheet', widthMm: 1219.2, heightMm: 1219.2 },
  { name: '2520×1830 (metric)', widthMm: 2520, heightMm: 1830 },
]
