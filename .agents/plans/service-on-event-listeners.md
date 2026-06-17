# Replace setHandlers with service.on() event listeners

**Complexity:** ✅ Simple — Pattern already applied; cleanup stale exports.

## Goal

Stop using `componentService.setHandlers({ ... })` and register listeners with `componentService.on("event", handler)` for readability.

## Steps

- [x] Audit codebase for `setHandlers` / `*Handlers` callback bags
- [x] Confirm `MediaLibraryService`, `TranscriptionWorkspace`, and `TranscriptionService` expose `.on(event, handler)`
- [x] Confirm subscribers (`MediaLibraryTimelineSubscriber`, `bindTranscription`) use `.on()`
- [x] Remove stale `TranscriptionServiceHandlers` / `TranscriptionWorkspaceHandlers` exports from `core/index.ts`
- [x] Run typecheck and tests

## Validation

- [x] `npm run typecheck -w @opensource/core` passes
- [x] `npm run test -w @opensource/core` passes
