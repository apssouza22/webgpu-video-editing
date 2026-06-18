import { describe, expect, it, vi } from 'vitest';
import type { CompositionPreviewAPI } from '@opensource/video-preview';
import type { Timeline } from '@opensource/timeline';

import { MediaLibraryService } from '../mediaLibrary/MediaLibraryService';
import type { MediaLibraryItem } from '../mediaLibrary/types';
import { bindMediaLibraryTimeline } from './MediaLibrarySubscriber';

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

describe('MediaLibraryTimelineSubscriber', () => {
  it('adds uploaded files to the library without adding to the timeline by default', async () => {
    vi.stubGlobal('URL', {
      createObjectURL: () => 'blob:upload-1',
      revokeObjectURL: vi.fn(),
    });

    const mediaLibrary = new MediaLibraryService();
    const canvas = createCanvasStub();
    const timeline = createTimelineStub();
    const { dispose } = bindMediaLibraryTimeline({ timeline, preview: canvas, mediaLibrary });

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

    const mediaLibrary = new MediaLibraryService();
    const canvas = createCanvasStub();
    const timeline = createTimelineStub();
    const { dispose } = bindMediaLibraryTimeline({ timeline, preview: canvas, mediaLibrary });

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

  it('adds selected items to the timeline', () => {
    const mediaLibrary = new MediaLibraryService();
    const canvas = createCanvasStub();
    const timeline = createTimelineStub();
    const { dispose } = bindMediaLibraryTimeline({ timeline, preview: canvas, mediaLibrary });

    const item: MediaLibraryItem = {
      id: 'lib-1',
      type: 'image',
      name: 'photo.png',
      src: 'blob:photo',
      createdAt: 1,
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

  it('uses the media duration when adding video clips', () => {
    const mediaLibrary = new MediaLibraryService();
    const canvas = createCanvasStub();
    const timeline = createTimelineStub();
    const { dispose } = bindMediaLibraryTimeline({ timeline, preview: canvas, mediaLibrary });

    const item: MediaLibraryItem = {
      id: 'lib-2',
      type: 'video',
      name: 'clip.mp4',
      src: 'blob:clip',
      duration: 12.5,
      createdAt: 1,
    };

    mediaLibrary.selectItem(item);

    expect(timeline.addClip).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'video',
        duration: 12.5,
        sourceDuration: 12.5,
      }),
    );

    dispose();
    mediaLibrary.destroy();
  });
});
