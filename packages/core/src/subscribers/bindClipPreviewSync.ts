import type { Timeline } from '@opensource/timeline';
import type { CompositionPreview } from '@opensource/video-preview';

import { PreviewTimelineSync } from './PreviewTimelineSync';
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
  sync: PreviewTimelineSync;
} {
  const sync = new PreviewTimelineSync(timeline, preview);
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
