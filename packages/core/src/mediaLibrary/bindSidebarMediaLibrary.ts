import {
  AudioClip,
  ImageClip,
  VideoClip,
  type CompositionCanvasAPI,
} from '@opensource/video-canvas';
import type { MediaLibraryItem, Sidebar } from '@opensource/sidebar';

import type { MediaLibrary } from './MediaLibrary';

export interface BindSidebarMediaLibraryOptions {
  sidebar: Sidebar;
  canvas: CompositionCanvasAPI;
  mediaLibrary: MediaLibrary;
}

export function bindSidebarMediaLibrary({
  sidebar,
  canvas,
  mediaLibrary,
}: BindSidebarMediaLibraryOptions): () => void {
  const disposers: Array<() => void> = [];

  disposers.push(
    sidebar.on('media:upload:requested', ({ file, addToCanvas, startTime }) => {
      const item = mediaLibrary.addFromFile(file);
      sidebar.notifyMediaAdded(item);

      if (addToCanvas !== false) {
        addMediaToCanvas(canvas, item, startTime);
      }
    }),
  );

  disposers.push(
    sidebar.on('media:selected', ({ item, startTime }) => {
      addMediaToCanvas(canvas, item, startTime);
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

export function addMediaToCanvas(
  canvas: CompositionCanvasAPI,
  item: MediaLibraryItem,
  startTime?: number,
): void {
  const at = startTime ?? canvas.getCurrentTime();

  if (item.type === 'video') {
    canvas.addLayer(new VideoClip(item.src, at));
    return;
  }

  if (item.type === 'image') {
    canvas.addLayer(new ImageClip(item.src, at));
    return;
  }

  canvas.addLayer(new AudioClip(item.src, at));
}
