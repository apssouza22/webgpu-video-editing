# Replace TimelinePreviewSyncer with two subscribers

**Complexity:** ⚠️ Medium — Large class split with shared sync state.

## Goal

Align clip/preview sync with AGENTS.md: one subscriber per component plus a service for external coordination.

## Steps

- [x] Extract `ClipPreviewSyncService` (mappings, pause/resume, rebuild)
- [x] Add `TimelineSubscriber` (timeline events → preview)
- [x] Add `CompositionPreviewSubscriber` (preview events → timeline)
- [x] Replace `bindClipPreviewSync` wiring and remove `TimelinePreviewSyncer`
- [x] Update `VideoEditor`, project, and transcription imports
- [x] Add subscriber tests and run core typecheck/tests

## Validation

- [x] `npm run typecheck -w @opensource/core` passes
- [x] `npm run test -w @opensource/core` passes
