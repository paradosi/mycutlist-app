# /new-component

Create a new React component for the cutlist optimizer.

Component name and description: $ARGUMENTS

Requirements:
- TypeScript strict, no `any`
- Use Tailwind CSS v4 for styling
- Use shadcn/ui primitives where appropriate (Button, Input, Label, Dialog, etc.)
- Accept props via a typed interface defined in the same file
- Export as named export AND default export
- Include a brief JSDoc comment on the component describing its purpose
- Place the file in the correct directory based on its purpose:
  - UI primitive → src/components/ui/
  - Layout/input panel → src/components/layout/
  - Renderer → src/components/renderer/
  - Export-related → src/components/pdf/
- Do NOT use `any`, do NOT use inline styles, do NOT use class components
- After creating, run `pnpm typecheck` to verify no type errors
