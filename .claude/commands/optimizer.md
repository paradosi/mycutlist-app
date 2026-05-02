# /optimizer

Work on the cut list optimizer algorithm.

Task: $ARGUMENTS

Rules for all optimizer work:
- All functions must be pure (no side effects, no imports from React or browser APIs)
- Every heuristic step must have a comment citing the relevant section of Jylänki 2010
- Guillotine cuts are the hard constraint — validate that no cut is partial (must go edge-to-edge)
- Internal units are always millimeters — never accept or return inches in algorithm code
- After implementing, write a Vitest property-based test using `fast-check` that verifies:
  1. All placed parts fit within sheet bounds
  2. No two placed parts overlap
  3. All gaps between adjacent parts are exactly kerfMm
  4. Parts with grain='with' are not rotated, grain='across' are rotated 90°, grain='either' may be either
- Run `pnpm test` to verify tests pass before finishing
