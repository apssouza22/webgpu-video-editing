import { describe, expect, it, vi } from 'vitest';
import type { Clip, Timeline, TimelineState } from '@opensource/timeline';
import type { CompositionPreview } from '@opensource/video-preview';

import type { TranscriptionService } from '../../src/transcription/transcription';
import {
  bindTranscription,
  resolveTimelineToTranscriptTime,
  resolveTranscriptSeekTimelineTime,
} from '../../src/subscribers/TranscriptionSubscriber';
import { PreviewTimelineSync } from '../../src/subscribers/PreviewTimelineSync';

function createTimelineState(clips: Clip[]): TimelineState {
  return {
    clips,
    tracks: [],
    playheadPosition: 0,
    duration: 60,
    isPlaying: false,
    playbackRate: 1,
    zoom: 1,
    scrollLeft: 0,
    selectedClipIds: [],
  } as TimelineState;
}

function createTimelineStub(state: TimelineState): Timeline {
  const listeners = new Map<string, (payload: unknown) => void>();

  return {
    getState: () => state,
    setPlayhead: vi.fn((time: number) => {
      state.playheadPosition = time;
    }),
    pause: vi.fn(() => {
      state.isPlaying = false;
    }),
    play: vi.fn(() => {
      state.isPlaying = true;
    }),
    on: vi.fn((event: string, handler: (payload: unknown) => void) => {
      listeners.set(event, handler);
      return () => listeners.delete(event);
    }),
    emit: (event: string, payload: unknown) => {
      listeners.get(event)?.(payload);
    },
  } as unknown as Timeline;
}

function createPreviewStub(): CompositionPreview {
  return {
    getElements: () => [],
    on: vi.fn(() => () => {}),
  } as unknown as CompositionPreview;
}

describe('resolveTranscriptSeekTimelineTime', () => {
  it('offsets transcript time by the clip start time on the timeline', () => {
    const clip: Clip = {
      id: 'clip-1',
      type: 'video',
      name: 'Clip',
      startTime: 12,
      duration: 8,
      trackId: 'track-1',
      url: 'blob:video',
    };
    const timeline = createTimelineStub(createTimelineState([clip]));

    expect(
      resolveTranscriptSeekTimelineTime(timeline, 3.5, {
        clipId: 'clip-1',
      }),
    ).toBe(15.5);
  });

  it('resolves the clip from the preview element mapping when clipId is missing', () => {
    const clip: Clip = {
      id: 'clip-2',
      type: 'audio',
      name: 'Audio',
      startTime: 4,
      duration: 10,
      trackId: 'track-1',
      url: 'blob:audio',
    };
    const timeline = createTimelineStub(createTimelineState([clip]));
    const preview = createPreviewStub();
    const clipPreviewSync = new PreviewTimelineSync(timeline, preview);
    clipPreviewSync.register('element-1', 'clip-2');

    expect(
      resolveTranscriptSeekTimelineTime(timeline, 2, {
        sourceId: 'element-1',
        clipPreviewSync,
      }),
    ).toBe(6);
  });
});

describe('resolveTimelineToTranscriptTime', () => {
  const clip: Clip = {
    id: 'clip-1',
    type: 'video',
    name: 'Clip',
    startTime: 12,
    duration: 8,
    trackId: 'track-1',
    url: 'blob:video',
  };

  it('converts timeline playhead time to clip-local transcript time', () => {
    const timeline = createTimelineStub(createTimelineState([clip]));

    expect(
      resolveTimelineToTranscriptTime(timeline, 15.5, {
        clipId: 'clip-1',
      }),
    ).toBe(3.5);
  });

  it('returns null when the playhead is outside the transcribed clip', () => {
    const timeline = createTimelineStub(createTimelineState([clip]));

    expect(
      resolveTimelineToTranscriptTime(timeline, 10, {
        clipId: 'clip-1',
      }),
    ).toBeNull();
    expect(
      resolveTimelineToTranscriptTime(timeline, 21, {
        clipId: 'clip-1',
      }),
    ).toBeNull();
  });
});

function createTranscriptionStub(): TranscriptionService {
  const handlers = new Map<string, (payload: unknown) => void>();

  return {
    on: vi.fn((event: string, handler: (payload: unknown) => void) => {
      handlers.set(event, handler);
      return () => handlers.delete(event);
    }),
    seekToTimestamp: vi.fn((timestamp: number, sourceId: string, clipId?: string) => {
      handlers.get('transcription:seek')?.({ timestamp, sourceId, clipId });
    }),
    setCanTranscribe: vi.fn(),
    setTranscriptionStatus: vi.fn(),
    highlightTranscriptionAt: vi.fn(),
  } as unknown as TranscriptionService;
}

describe('TranscriptionSubscriber', () => {
  it('seeks the timeline without pausing playback', () => {
    const clip: Clip = {
      id: 'clip-1',
      type: 'video',
      name: 'Clip',
      startTime: 10,
      duration: 20,
      trackId: 'track-1',
      url: 'blob:video',
    };
    const state = createTimelineState([clip]);
    state.isPlaying = true;
    const timeline = createTimelineStub(state);
    const preview = createPreviewStub();
    const clipPreviewSync = new PreviewTimelineSync(timeline, preview);
    const transcription = createTranscriptionStub();

    bindTranscription({
      transcription,
      timeline,
      preview,
      clipPreviewSync,
    });

    transcription.seekToTimestamp(5, 'element-1', 'clip-1');

    expect(timeline.setPlayhead).toHaveBeenCalledWith(15);
    expect(timeline.pause).not.toHaveBeenCalled();
    expect(state.isPlaying).toBe(true);
  });

  it('highlights transcription using clip-local time during playhead changes', async () => {
    const clip: Clip = {
      id: 'clip-1',
      type: 'video',
      name: 'Clip',
      startTime: 10,
      duration: 20,
      trackId: 'track-1',
      url: 'blob:video',
    };
    const state = createTimelineState([clip]);
    const timeline = createTimelineStub(state) as Timeline & {
      emit: (event: string, payload: unknown) => void;
    };
    const preview = {
      getElements: () => [
        {
          id: 'element-1',
          type: 'video',
          src: 'blob:video',
          duration: 20,
          sourceOffset: 0,
        },
      ],
      getElement: vi.fn((id: string) =>
        id === 'element-1'
          ? {
              id: 'element-1',
              type: 'video',
              src: 'blob:video',
              duration: 20,
              sourceOffset: 0,
            }
          : null,
      ),
      getSelectedElement: vi.fn(() => null),
      on: vi.fn(() => () => {}),
    } as unknown as CompositionPreview;
    const clipPreviewSync = new PreviewTimelineSync(timeline, preview);
    clipPreviewSync.register('element-1', 'clip-1');

    const handlers = new Map<string, (payload: unknown) => void | Promise<void>>();
    const transcription = {
      on: vi.fn((event: string, handler: (payload: unknown) => void | Promise<void>) => {
        handlers.set(event, handler);
        return () => handlers.delete(event);
      }),
      seekToTimestamp: vi.fn(),
      setCanTranscribe: vi.fn(),
      setTranscriptionStatus: vi.fn(),
      highlightTranscriptionAt: vi.fn(),
      loadModel: vi.fn(),
      transcribeMedia: vi.fn().mockResolvedValue({
        text: 'hello',
        chunks: [{ text: 'hello', timestamp: [0, 1] as [number, number] }],
        sourceId: 'element-1',
      }),
      setTranscriptionResult: vi.fn(),
    } as unknown as TranscriptionService;

    bindTranscription({
      transcription,
      timeline,
      preview,
      clipPreviewSync,
    });

    await handlers.get('transcription:requested')?.({ sourceId: 'element-1' });

    timeline.emit('playhead:change', { time: 15, state });

    expect(transcription.highlightTranscriptionAt).toHaveBeenCalledWith(5);
  });
});
