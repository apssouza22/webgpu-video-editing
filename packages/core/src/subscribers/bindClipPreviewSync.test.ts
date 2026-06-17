import { describe, expect, it, vi } from 'vitest';
import type { CompositionPreview } from '@opensource/video-preview';
import type { Timeline } from '@opensource/timeline';

import { bindClipPreviewSync } from './bindClipPreviewSync';

function createPreviewStub(): CompositionPreview {
  const elements: Array<{ id: string; type: string; src?: string; startTime: number; duration: number; name: string }> = [];
  let nextId = 0;

  return {
    getElements: () => elements,
    getPlayerSize: () => ({ width: 1920, height: 1080 }),
    getSelectedId: () => null,
    getCurrentTime: () => 0,
    addElement: vi.fn((element) => {
      nextId += 1;
      const id = `element-${nextId}`;
      elements.push({ ...element, id });
      return id;
    }),
    removeElement: vi.fn(),
    updateElement: vi.fn(),
    selectElement: vi.fn(),
    render: vi.fn(),
    on: vi.fn(() => () => undefined),
  } as unknown as CompositionPreview;
}

function createTimelineStub(): Timeline & { emit: (event: string, payload: unknown) => void } {
  const listeners = new Map<string, Set<(payload: unknown) => void>>();
  const state = {
    clips: [] as Array<{
      id: string;
      type: string;
      name: string;
      url?: string;
      startTime: number;
      duration: number;
      inPoint: number;
      trackId: string;
    }>,
    tracks: [{ id: 'track-1', index: 0 }],
    isPlaying: false,
    selectedClipIds: [] as string[],
    primarySelectedClipId: null as string | null,
  };

  const timeline = {
    getState: () => state,
    on: vi.fn((event: string, handler: (payload: unknown) => void) => {
      const set = listeners.get(event) ?? new Set();
      set.add(handler);
      listeners.set(event, set);
      return () => set.delete(handler);
    }),
    emit: (event: string, payload: unknown) => {
      for (const handler of listeners.get(event) ?? []) {
        handler(payload);
      }
    },
  };

  return timeline as unknown as Timeline & { emit: (event: string, payload: unknown) => void };
}

describe('bindClipPreviewSync', () => {
  it('exposes pause, resume, and mapping helpers through the sync service', () => {
    const timeline = createTimelineStub();
    const preview = createPreviewStub();
    const { sync, dispose } = bindClipPreviewSync({ timeline, preview });

    sync.pause();
    sync.resume();
    sync.rebuildMappings();

    expect(sync.getClipIdForElement('missing')).toBeUndefined();
    expect(sync.getElementIdForClip('missing')).toBeUndefined();

    dispose();
  });

  it('adds a canvas element when the timeline emits clip:add', () => {
    const timeline = createTimelineStub();
    const preview = createPreviewStub();
    const { sync, dispose } = bindClipPreviewSync({ timeline, preview });

    timeline.emit('clip:add', {
      clips: [{
        id: 'clip-1',
        type: 'image',
        name: 'photo.png',
        url: 'blob:photo',
        startTime: 0,
        duration: 5,
        inPoint: 0,
        trackId: 'track-1',
      }],
    });

    expect(preview.addElement).toHaveBeenCalledTimes(1);
    expect(sync.getElementIdForClip('clip-1')).toBe('element-1');
    expect(sync.getClipIdForElement('element-1')).toBe('clip-1');

    dispose();
  });

  it('ignores timeline clip:add while paused', () => {
    const timeline = createTimelineStub();
    const preview = createPreviewStub();
    const { sync, dispose } = bindClipPreviewSync({ timeline, preview });

    sync.pause();
    timeline.emit('clip:add', {
      clips: [{
        id: 'clip-1',
        type: 'image',
        name: 'photo.png',
        url: 'blob:photo',
        startTime: 0,
        duration: 5,
        inPoint: 0,
        trackId: 'track-1',
      }],
    });

    expect(preview.addElement).not.toHaveBeenCalled();
    expect(sync.getElementIdForClip('clip-1')).toBeUndefined();

    dispose();
  });
});
