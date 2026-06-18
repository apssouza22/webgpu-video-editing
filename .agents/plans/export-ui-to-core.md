# Move Export UI Logic to Core

**Complexity:** ⚠️ Medium — Cross-package refactor mirroring media-library pattern.

## Goal

Move export panel UI and export event surface from `@opensource/sidebar` into `@opensource/core/src/export`. Sidebar keeps only the export tab slot via `panelFactories`.

## Steps

- [x] Create `ExportService` with events (`export:requested`, `export:status`, `export:availability`) and preview availability tracking
- [x] Move `ExportPanel` to `packages/core/src/export/ExportPanel.ts`, wired to `ExportService`
- [x] Add `ExportSubscriber` to wire `ExportService` to the export pipeline (replaces `bindSidebarExport`)
- [x] Update `VideoEditor` to create `ExportService`, mount `ExportPanel` via `panelFactories`, and bind `ExportSubscriber`
- [x] Remove export UI, types, and events from `@opensource/sidebar`
- [x] Update public exports in `packages/core/src/index.ts` and `packages/core/src/export/index.ts`
- [x] Run typecheck and tests

## Validation

- [x] `npm run typecheck` passes
- [x] `npm run test -w @opensource/core` passes
