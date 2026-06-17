import { describe, expect, it, vi } from 'vitest';
import type { CompositionCanvasAPI } from '@opensource/video-canvas';
import type { MediaLibraryItem, Sidebar } from '@opensource/sidebar';
import type { Timeline } from '@opensource/timeline';

import { bindSidebarMediaLibrary } from './bindSidebarMediaLibrary';
import { MediaLibrary } from './MediaLibrary';

function createSidebarStub(): Sidebar & {
  handlers: Map<string, Set<(payload: unknown) => void>>;
} {
  const handlers = new Map<string, Set<(payload: unknown) => void>>();

  return {
    handlers,
    on(event: string, handler: (payload: unknown) => void) {
      const listeners = handlers.get(event) ?? new Set();
      listeners.add(handler);
      handlers.set(event, listeners);
      return () => listeners.delete(handler);
    },
    notifyMediaAdded: vi.fn(),
  } as unknown as Sidebar & {
    handlers: Map<string, Set<(payload: unknown) => void>>;
  };
}

function createCanvasStub(): CompositionCanvasAPI {
  return {
    getCurrentTime: () => 2,
    addElement: vi.fn(),
  } as unknown as CompositionCanvasAPI;
}

function createTimelineStub(): Timeline {
  return {
    addClip: vi.fn(),
  } as unknown as Timeline;
}

describe('bindSidebarMediaLibrary', () => {
  it('adds uploaded files to the library without adding to the timeline by default', async () => {
    vi.stubGlobal('URL', {
      createObjectURL: () => 'blob:upload-1',
      revokeObjectURL: vi.fn(),
    });

    const sidebar = createSidebarStub();
    const canvas = createCanvasStub();
    const timeline = createTimelineStub();
    const mediaLibrary = new MediaLibrary();
    const dispose = bindSidebarMediaLibrary({ sidebar, timeline, canvas, mediaLibrary });

    const uploadHandler = [...(sidebar.handlers.get('media:upload:requested') ?? [])][0];
    const file = new File(['video'], 'clip.mp4', { type: 'video/mp4' });

    uploadHandler({ file });
    await Promise.resolve();

    expect(mediaLibrary.list()).toHaveLength(1);
    expect(sidebar.notifyMediaAdded).toHaveBeenCalledTimes(1);
    expect(timeline.addClip).not.toHaveBeenCalled();
    expect(canvas.addElement).not.toHaveBeenCalled();

    dispose();
    mediaLibrary.destroy();
    vi.unstubAllGlobals();
  });

  it('adds uploaded files to the timeline when addToCanvas is true', async () => {
    vi.stubGlobal('URL', {
      createObjectURL: () => 'blob:upload-2',
      revokeObjectURL: vi.fn(),
    });

    const sidebar = createSidebarStub();
    const canvas = createCanvasStub();
    const timeline = createTimelineStub();
    const mediaLibrary = new MediaLibrary();
    const dispose = bindSidebarMediaLibrary({ sidebar, timeline, canvas, mediaLibrary });

    const uploadHandler = [...(sidebar.handlers.get('media:upload:requested') ?? [])][0];
    const file = new File(['video'], 'clip.mp4', { type: 'video/mp4' });

    uploadHandler({ file, addToCanvas: true });
    await Promise.resolve();

    expect(mediaLibrary.list()).toHaveLength(1);
    expect(sidebar.notifyMediaAdded).toHaveBeenCalledTimes(1);
    expect(timeline.addClip).toHaveBeenCalledTimes(1);
    expect(timeline.addClip).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'video',
        url: 'blob:upload-2',
        startTime: 2,
        hasAudio: true,
      }),
    );
    expect(canvas.addElement).not.toHaveBeenCalled();

    dispose();
    mediaLibrary.destroy();
    vi.unstubAllGlobals();
  });

  it('does not add persisted uploads to the timeline by default', async () => {
    const sidebar = createSidebarStub();
    const canvas = createCanvasStub();
    const timeline = createTimelineStub();
    const mediaLibrary = new MediaLibrary();
    const persistedItem: MediaLibraryItem = {
      id: 'lib-1',
      assetId: 'asset-1',
      type: 'video',
      name: 'clip.mp4',
      src: 'blob:persisted',
      createdAt: 1,
      source: 'library',
    };

    const dispose = bindSidebarMediaLibrary({
      sidebar,
      timeline,
      canvas,
      mediaLibrary,
      importUploadedFile: async () => persistedItem,
    });

    const uploadHandler = [...(sidebar.handlers.get('media:upload:requested') ?? [])][0];
    uploadHandler({ file: new File(['video'], 'clip.mp4', { type: 'video/mp4' }) });
    await Promise.resolve();

    expect(mediaLibrary.list()).toHaveLength(0);
    expect(sidebar.notifyMediaAdded).toHaveBeenCalledWith(persistedItem);
    expect(timeline.addClip).not.toHaveBeenCalled();
    expect(canvas.addElement).not.toHaveBeenCalled();

    dispose();
    mediaLibrary.destroy();
  });

  it('does not add to the timeline when persisted import throws', async () => {
    const sidebar = createSidebarStub();
    const canvas = createCanvasStub();
    const timeline = createTimelineStub();
    const mediaLibrary = new MediaLibrary();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const dispose = bindSidebarMediaLibrary({
      sidebar,
      timeline,
      canvas,
      mediaLibrary,
      importUploadedFile: async () => {
        throw new Error('Save failed');
      },
    });

    const uploadHandler = [...(sidebar.handlers.get('media:upload:requested') ?? [])][0];
    uploadHandler({ file: new File(['video'], 'clip.mp4', { type: 'video/mp4' }) });
    await Promise.resolve();

    expect(mediaLibrary.list()).toHaveLength(0);
    expect(sidebar.notifyMediaAdded).not.toHaveBeenCalled();
    expect(timeline.addClip).not.toHaveBeenCalled();
    expect(canvas.addElement).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalled();

    dispose();
    mediaLibrary.destroy();
    consoleError.mockRestore();
  });
});
