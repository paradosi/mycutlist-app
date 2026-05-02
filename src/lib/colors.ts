// Shared between the on-screen SVG renderer and the PDF renderer so a part's
// color is the same in both places. Picked perceptually distinct pastels —
// short, alphabetically-clustered labels like "shelf"/"back" still land on
// visibly different swatches because the FNV-1a hash mixes much better than
// length-of-string-based hashes.

export const PART_COLORS = [
  '#f3a5a5', // soft red
  '#f4c28a', // peach
  '#f0d57a', // mustard
  '#cde084', // lime
  '#a4d8a0', // mint
  '#9ad8c4', // seafoam
  '#9ec9e6', // sky
  '#a8b4e8', // periwinkle
  '#b89ce0', // lavender
  '#d59ad8', // orchid
  '#e89ec0', // rose
  '#e2c0a4', // tan
] as const

export function hashLabel(label: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < label.length; i++) {
    h ^= label.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

export function colorForLabel(label: string): string {
  return PART_COLORS[hashLabel(label) % PART_COLORS.length]
}
