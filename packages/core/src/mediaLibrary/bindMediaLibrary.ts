import type { AddClipInput, Timeline } from '@opensource/timeline';
import type { MediaLibraryItem } from '@opensource/sidebar';
import type { CompositionPreviewAPI } from '@opensource/video-preview';

import type { MediaLibrary } from './MediaLibrary';

export interface BindMediaLibraryOptions {
  timeline: Timeline;
  preview: CompositionPreviewAPI;
  mediaLibrary: MediaLibrary;
  /** When set, uploads are routed through project persistence when a project is open. */
  importUploadedFile?: (file: File) => Promise<MediaLibraryItem | null>;
}

export function bindMediaLibrary({
  timeline,
  preview,
  mediaLibrary,
  importUploadedFile,
}: BindMediaLibraryOptions): () => void {
  return mediaLibrary.setHandlers({
    onUpload: async (file, { addToCanvas, startTime } = {}) => {
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

      if (addToCanvas === true) {
        addMediaToTimeline(timeline, preview, item, startTime);
      }
    },
    onSelect: (item, startTime) => {
      addMediaToTimeline(timeline, preview, item, startTime);
    },
  });
}

export function mediaLibraryItemToAddClipInput(
  item: MediaLibraryItem,
  startTime: number,
): AddClipInput {
  const mediaDuration = item.duration ?? 5;
  const base = {
    name: item.name,
    startTime,
    duration: mediaDuration,
    sourceDuration: mediaDuration,
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
  preview: CompositionPreviewAPI,
  item: MediaLibraryItem,
  startTime?: number,
): void {
  const at = startTime ?? preview.getCurrentTime();
  timeline.addClip(mediaLibraryItemToAddClipInput(item, at));
}
