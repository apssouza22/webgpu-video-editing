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
  /** When set, uploads are routed through project persistence when a project is open. */
  importUploadedFile?: (file: File) => Promise<MediaLibraryItem | null>;
}

export function bindSidebarMediaLibrary({
  sidebar,
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
