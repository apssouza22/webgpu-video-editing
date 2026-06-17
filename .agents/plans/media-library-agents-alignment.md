# Align Media Library with AGENTS.md Architecture

**Complexity:** ⚠️ Medium — Refactor naming, boundaries, and subscriber pattern across core and sidebar.

## Goal

Refactor the media library domain to follow AGENTS.md recommendations: service class for external communication, subscriber class in `subscribers/`, domain types owned by core, and minimal public exports (services + data objects only).

## Steps

- [x] Move `MediaLibraryItem`, `MediaLibrarySource`, `MediaType`, and `ResolvedMediaInput` from sidebar into core `mediaLibrary/types.ts`
- [x] Rename `MediaLibrary` to `MediaLibraryService` and update internal imports
- [x] Create `MediaLibraryTimelineSubscriber` in `subscribers/` (replace functional `bindMediaLibrary`)
- [x] Move timeline clip conversion helpers into the subscriber module
- [x] Tighten `mediaLibrary/index.ts` and `core/index.ts` exports to service + data types only
- [x] Remove media domain types from sidebar; update sidebar demo imports
- [x] Update `VideoEditor`, project persistence, and tests
- [x] Run typecheck and tests

## Validation

- [x] `npm run typecheck` passes
- [x] `npm run test -w @opensource/core` passes
