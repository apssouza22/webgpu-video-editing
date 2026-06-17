# Move Transcription UI to Core Workspace

**Complexity:** ⚠️ Medium — Cross-package UI move with binding refactor.

## Goal

Move transcription panel UI from `@opensource/sidebar` into `@opensource/core` workspace area. Sidebar drops the transcription tab; core owns workspace UI and wiring.

## Steps

- [x] Create `TranscriptionWorkspace` event surface in `packages/core/src/workspace/`
- [x] Move transcription panel UI and styles into core workspace
- [x] Replace `bindSidebarTranscription` with `bindWorkspaceTranscription`
- [x] Wire `VideoEditor` to mount transcription in workspace container
- [x] Remove transcription panel, events, and styles from sidebar
- [x] Update demo layout and fix type imports
- [x] Run typecheck and tests

## Validation

- [x] `npm run typecheck` passes
- [x] `npm run test -w @opensource/core` passes
