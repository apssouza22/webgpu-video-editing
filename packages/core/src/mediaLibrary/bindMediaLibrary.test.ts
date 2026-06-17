import { describe, expect, it, vi } from 'vitest';
import type { CompositionPreviewAPI } from '@opensource/video-preview';
import type { MediaLibraryItem } from '@opensource/sidebar';
import type { Timeline } from '@opensource/timeline';

import { bindMediaLibrary } from './bindMediaLibrary';
import { MediaLibrary } from './MediaLibrary';

function createCanvasStub(): CompositionPreviewAPI {
  return {
    getCurrentTime: () => 2,
    addElement: vi.fn(),
  } as unknown as CompositionPreviewAPI;
}

function createTimelineStub(): Timeline {
  return {
    addClip: vi.fn(),
  } as unknown as Timeline;
}

describe('bindMediaLibrary', () => {
  it('adds uploaded files to the library without adding to the timeline by default', async () => {
    vi.stubGlobal('URL', {
      createObjectURL: () => 'blob:upload-1',
      revokeObjectURL: vi.fn(),
    });

    const mediaLibrary = new MediaLibrary();
    const canvas = createCanvasStub();
    const timeline = createTimelineStub();
    const dispose = bindMediaLibrary({ timeline, preview: canvas, mediaLibrary });

    const added = vi.fn();
    mediaLibrary.on('added', added);

    const file = new File(['video'], 'clip.mp4', { type: 'video/mp4' });
    mediaLibrary.requestUpload(file);
    await Promise.resolve();

    expect(mediaLibrary.list()).toHaveLength(1);
    expect(added).toHaveBeenCalledTimes(1);
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

    const mediaLibrary = new MediaLibrary();
    const canvas = createCanvasStub();
    const timeline = createTimelineStub();
    const dispose = bindMediaLibrary({ timeline, preview: canvas, mediaLibrary });

    const file = new File(['video'], 'clip.mp4', { type: 'video/mp4' });
    mediaLibrary.requestUpload(file, { addToCanvas: true });
    await Promise.resolve();

    expect(mediaLibrary.list()).toHaveLength(1);
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
    const mediaLibrary = new MediaLibrary();
    const canvas = createCanvasStub();
    const timeline = createTimelineStub();
    const persistedItem: MediaLibraryItem = {
      id: 'lib-1',
      assetId: 'asset-1',
      type: 'video',
      name: 'clip.mp4',
      src: 'blob:persisted',
      createdAt: 1,
      source: 'library',
    };

    const added = vi.fn();
    mediaLibrary.on('added', added);

    const dispose = bindMediaLibrary({
      timeline,
      preview: canvas,
      mediaLibrary,
      importUploadedFile: async () => persistedItem,
    });

    mediaLibrary.requestUpload(new File(['video'], 'clip.mp4', { type: 'video/mp4' }));
    await Promise.resolve();

    expect(mediaLibrary.list()).toHaveLength(0);
    expect(added).not.toHaveBeenCalled();
    expect(timeline.addClip).not.toHaveBeenCalled();
    expect(canvas.addElement).not.toHaveBeenCalled();

    dispose();
    mediaLibrary.destroy();
  });

  it('does not add to the timeline when persisted import throws', async () => {
    const mediaLibrary = new MediaLibrary();
    const canvas = createCanvasStub();
    const timeline = createTimelineStub();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const added = vi.fn();
    mediaLibrary.on('added', added);

    const dispose = bindMediaLibrary({
      timeline,
      preview: canvas,
      mediaLibrary,
      importUploadedFile: async () => {
        throw new Error('Save failed');
      },
    });

    mediaLibrary.requestUpload(new File(['video'], 'clip.mp4', { type: 'video/mp4' }));
    await Promise.resolve();

    expect(mediaLibrary.list()).toHaveLength(0);
    expect(added).not.toHaveBeenCalled();
    expect(timeline.addClip).not.toHaveBeenCalled();
    expect(canvas.addElement).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalled();

    dispose();
    mediaLibrary.destroy();
    consoleError.mockRestore();
  });

  it('adds selected items to the timeline', () => {
    const mediaLibrary = new MediaLibrary();
    const canvas = createCanvasStub();
    const timeline = createTimelineStub();
    const dispose = bindMediaLibrary({ timeline, preview: canvas, mediaLibrary });

    const item: MediaLibraryItem = {
      id: 'lib-1',
      type: 'image',
      name: 'photo.png',
      src: 'blob:photo',
      createdAt: 1,
      source: 'upload',
    };

    mediaLibrary.selectItem(item, 3);

    expect(timeline.addClip).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'image',
        url: 'blob:photo',
        startTime: 3,
      }),
    );

    dispose();
    mediaLibrary.destroy();
  });
});
