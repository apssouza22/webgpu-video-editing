import type { AddClipInput, Timeline } from '@opensource/timeline';
import type { CompositionPreviewAPI } from '@opensource/video-preview';

import type { MediaLibraryService } from '../mediaLibrary/MediaLibraryService';
import type { MediaLibraryItem } from '../mediaLibrary/types';

export interface MediaLibraryTimelineSubscriberOptions {
  timeline: Timeline;
  preview: CompositionPreviewAPI;
  mediaLibrary: MediaLibraryService;
  /** When set, uploads are handled by this callback instead of the default file import. */
  importUploadedFile?: (file: File) => Promise<MediaLibraryItem | null>;
}

export class MediaLibrarySubscriber {
  private readonly timeline: Timeline;
  private readonly preview: CompositionPreviewAPI;
  private readonly mediaLibrary: MediaLibraryService;
  private readonly importUploadedFile?: (file: File) => Promise<MediaLibraryItem | null>;
  private readonly disposables: Array<() => void> = [];

  constructor({
    timeline,
    preview,
    mediaLibrary,
    importUploadedFile,
  }: MediaLibraryTimelineSubscriberOptions) {
    this.timeline = timeline;
    this.preview = preview;
    this.mediaLibrary = mediaLibrary;
    this.importUploadedFile = importUploadedFile;
  }

  bind(): () => void {
    this.disposables.push(
      this.mediaLibrary.on('upload:requested', async ({ file, addToCanvas, startTime }) => {
        let item: MediaLibraryItem | null = null;

        try {
          if (this.importUploadedFile) {
            item = await this.importUploadedFile(file);
          }

          if (!item) {
            item = this.mediaLibrary.addFromFile(file);
          }
        } catch (error) {
          console.error('Media upload failed:', error);
          return;
        }

        if (addToCanvas === true) {
          this.addMediaToTimeline(item, startTime);
        }
      }),
      this.mediaLibrary.on('selected', ({ item, startTime }) => {
        this.addMediaToTimeline(item, startTime);
      }),
    );

    return () => this.destroy();
  }

  destroy(): void {
    while (this.disposables.length > 0) {
      this.disposables.pop()?.();
    }
  }

  private addMediaToTimeline(item: MediaLibraryItem, startTime?: number): void {
    const at = startTime ?? this.preview.getCurrentTime();
    this.timeline.addClip(mediaLibraryItemToAddClipInput(item, at));
  }
}

function mediaLibraryItemToAddClipInput(
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

export function bindMediaLibraryTimeline(
  options: MediaLibraryTimelineSubscriberOptions,
): {
  dispose: () => void;
  subscriber: MediaLibrarySubscriber;
} {
  const subscriber = new MediaLibrarySubscriber(options);
  const unbind = subscriber.bind();
  return {
    subscriber,
    dispose: () => {
      unbind();
      subscriber.destroy();
    },
  };
}
