# Core Package OOP Refactor

**Complexity:** ⚠️ Medium — Structural extractions with public API preserved.

## Goal

Align `@opensource/core` with AGENTS.md boundaries: prefer OOP + composition, organize by domain, and add domain tests for integration logic.

## Steps

- [x] Extract `VideoEditor` from `index.ts` into `src/VideoEditor.ts`
- [x] Extract sidebar export wiring into `src/export/bindSidebarExport.ts` (mirror transcription)
- [x] Refactor `bindEditorPlayback` into `EditorPlayback` class + factory (mirror `ClipCanvasSync`)
- [x] Add Vitest and domain tests for `converters` and `exportOptions`
- [x] Slim `index.ts` to public re-exports only
- [x] Run `npm run typecheck` and `npm run test -w @opensource/core`

## Validation

- [x] `npm run typecheck -w @opensource/core` passes
- [x] `npm run test -w @opensource/core` passes
- [x] `npm run build -w @opensource/core` passes
