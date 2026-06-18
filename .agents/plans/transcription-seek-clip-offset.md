# Transcription seek uses clip timeline offset

**Complexity:** ✅ Simple — Single-pass executable, low risk

## Goal

When the user clicks a transcription chunk, seek the timeline to `clip.startTime + transcriptTimestamp` instead of the raw transcript time, and keep playback running if it was already playing.

## Steps

- [x] Add `clipId` to `transcription:seek` payload and pass it from the transcription view
- [x] Add `resolveTranscriptSeekTimelineTime` helper and use it in `TranscriptionSubscriber` (remove `pause()`)
- [x] Update `EditorPlayback` so external seeks during playback reset the media anchor without breaking frame-driven playback
- [x] Add unit tests for timeline seek resolution and subscriber behavior
- [x] Run `npm run test -w @opensource/core` and `npm run typecheck -w @opensource/core`

## Follow-up: sync highlight during playback

- [x] Convert timeline playhead time to clip-local transcript time before highlighting
- [x] Clear highlights when playhead is outside the transcribed clip
- [x] Add tests for `resolveTimelineToTranscriptTime`

## Follow-up: audio sync on transcription seek during playback

- [x] Re-seek media in `syncMediaPlayback` when drift exceeds threshold during an active playback session
- [x] Add unit test for external jump during playback
