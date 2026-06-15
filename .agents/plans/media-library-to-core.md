# Move Media Library Domain to Core

**Complexity:** ⚠️ Medium — Cross-package refactor with binding layer.

## Goal

Move media library business logic (add, remove, persist, stock) from `@opensource/sidebar` into `@opensource/core`. Sidebar keeps UI panels and event surface only.

## Steps

- [x] Create `packages/core/src/mediaLibrary/` with `MediaLibrary`, `createStockMedia`, and types usage
- [x] Add `bindSidebarMediaLibrary` to wire sidebar events to domain + canvas
- [x] Slim `Sidebar` to UI-only media methods and `MediaLibraryHost` injection
- [x] Update `VideoEditor`, `ProjectSession`, and `bindProjectPersistence` to use core `MediaLibrary`
- [x] Add domain tests for `MediaLibrary`
- [x] Run typecheck and tests

## Validation

- [x] `npm run typecheck` passes
- [x] `npm run test -w @opensource/core` passes
