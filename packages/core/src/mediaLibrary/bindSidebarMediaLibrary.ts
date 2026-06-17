import type { AddClipInput, Timeline } from '@opensource/timeline';
import type { MediaLibraryItem, Sidebar } from '@opensource/sidebar';
import type { CompositionCanvasAPI } from '@opensource/video-canvas';

import type { MediaLibrary } from './MediaLibrary';

export interface BindSidebarMediaLibraryOptions {
  sidebar: Sidebar;
  timeline: Timeline;
  canvas: CompositionCanvasAPI;
  mediaLibrary: MediaLibrary;
  /** When set, uploads are routed through project persistence when a project is open. */
  importUploadedFile?: (file: File) => Promise<MediaLibraryItem | null>;
}

export function bindSidebarMediaLibrary({
  sidebar,
  timeline,
  canvas,
  mediaLibrary,
  importUploadedFile,
}: BindSidebarMediaLibraryOptions): () => void {
  const disposers: Array<() => void> = [];

  disposers.push(
    sidebar.on('media:upload:requested', async ({ file, addToCanvas, startTime }) => {
      let item: MediaLibraryItem | null = null;

      try {
        if (importUploadedFile) {
          item = await importUploadedFile(file);
        }

        if (!item) {
          item = mediaLibrary.addFromFile(file);
        }
      } catch (error) {
        console.error('Media upload failed:', error);
        return;
      }

      sidebar.notifyMediaAdded(item);

      if (addToCanvas === true) {
        addMediaToTimeline(timeline, canvas, item, startTime);
      }
    }),
  );

  disposers.push(
    sidebar.on('media:selected', ({ item, startTime }) => {
      addMediaToTimeline(timeline, canvas, item, startTime);
    }),
  );

  disposers.push(
    sidebar.on('media:remove:requested', ({ id }) => {
      const item = mediaLibrary.remove(id);
      if (item) {
        sidebar.notifyMediaRemoved(id);
      }
    }),
  );

  return () => {
    while (disposers.length > 0) {
      disposers.pop()?.();
    }
  };
}

export function mediaLibraryItemToAddClipInput(
  item: MediaLibraryItem,
  startTime: number,
): AddClipInput {
  const base = {
    name: item.name,
    startTime,
    duration: 5,
    sourceDuration: 5,
  };

  switch (item.type) {
    case 'video':
      return {
        ...base,
        type: 'video',
        url: item.src,
        hasAudio: true,
      };
    case 'image':
      return {
        ...base,
        type: 'image',
        url: item.src,
      };
    case 'audio':
      return {
        ...base,
        type: 'audio',
        url: item.src,
        hasAudio: false,
      };
  }
}

export function addMediaToTimeline(
  timeline: Timeline,
  canvas: CompositionCanvasAPI,
  item: MediaLibraryItem,
  startTime?: number,
): void {
  const at = startTime ?? canvas.getCurrentTime();
  timeline.addClip(mediaLibraryItemToAddClipInput(item, at));
}
