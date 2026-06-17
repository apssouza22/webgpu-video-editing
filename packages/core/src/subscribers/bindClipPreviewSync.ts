import type { Timeline } from '@opensource/timeline';
import type { CompositionPreview } from '@opensource/video-preview';

import { ClipPreviewSyncService } from './ClipPreviewSyncService';
import { CompositionPreviewSubscriber } from './CompositionPreviewSubscriber';
import { TimelineSubscriber } from './TimelineSubscriber';

export interface ClipPreviewSyncOptions {
  timeline: Timeline;
  preview: CompositionPreview;
}

export function bindClipPreviewSync({
  timeline,
  preview,
}: ClipPreviewSyncOptions): {
  dispose: () => void;
  sync: ClipPreviewSyncService;
} {
  const sync = new ClipPreviewSyncService(timeline, preview);
  const timelineSubscriber = new TimelineSubscriber({ timeline, preview, sync });
  const previewSubscriber = new CompositionPreviewSubscriber({ timeline, preview, sync });

  const unbindTimeline = timelineSubscriber.bind();
  const unbindPreview = previewSubscriber.bind();

  return {
    sync,
    dispose: () => {
      unbindPreview();
      unbindTimeline();
      previewSubscriber.destroy();
      timelineSubscriber.destroy();
      sync.destroy();
    },
  };
}
