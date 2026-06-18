# Move Transcription Bindings to TranscriptionSubscriber

**Complexity:** ✅ Simple — Consolidate existing bind functions into one subscriber class.

## Goal

Move all transcription wiring (`bindTranscription`, `bindTranscriptionTimelineCut`) into a `TranscriptionSubscriber` class in `packages/core/src/subscribers/`, matching `ExportSubscriber` and `MediaLibrarySubscriber`.

## Steps

- [x] Create `TranscriptionSubscriber.ts` with merged binding logic from `bindTranscription.ts` and `bindTranscriptionTimelineCut.ts`
- [x] Export `TranscriptionSubscriber`, `bindTranscription`, and options from `subscribers/index.ts`
- [x] Update `VideoEditor` to use `bindTranscription` from subscribers (single call, includes timeline cut)
- [x] Remove old `bindTranscription.ts` and `bindTranscriptionTimelineCut.ts`; re-export `bindTranscription` from `transcription/index.ts` for backward compatibility
- [x] Update `packages/core/src/index.ts` exports
- [x] Run typecheck and tests

## Validation

- [x] `npm run typecheck -w @opensource/core` passes
- [x] `npm run test -w @opensource/core` passes
