import {
  cloneState,
  computeDuration,
  moveClip,
  selectClip,
  type Timeline,
} from '@opensource/timeline';
import type {CompositionPreview} from '@opensource/video-preview';

import type {LeftNav} from '../leftnav';
import type {PreviewTimelineSync} from './PreviewTimelineSync';

export interface PreviewSubscriberOptions {
  timeline: Timeline;
  preview: CompositionPreview;
  timelinePreviewSync: PreviewTimelineSync;
  leftNav: LeftNav;
}

class PreviewSubscriber {
  private readonly timeline: Timeline;
  private readonly preview: CompositionPreview;
  private readonly timelinePreviewSync: PreviewTimelineSync;
  private readonly leftNav: LeftNav;

  constructor({timeline, preview, timelinePreviewSync, leftNav}: PreviewSubscriberOptions) {
    this.timeline = timeline;
    this.preview = preview;
    this.timelinePreviewSync = timelinePreviewSync;
    this.leftNav = leftNav;
  }

  bind(): void {
    this.preview.on('element:removed', (payload) => this.onCanvasElementRemoved(payload.id));
    this.preview.on('element:updated', (payload) => {
      this.onCanvasElementUpdated(payload);
      this.leftNav?.handlePreviewElementUpdated(payload);
    });
    this.preview.on('selection:changed', (payload) => {
      this.onCanvasSelectionChanged(payload.selectedId);
      this.leftNav?.handlePreviewSelectionChanged(payload);
    });
    this.preview.on('element:added', () => {
      this.leftNav?.handlePreviewElementAdded();
    });
  }

  private onCanvasElementRemoved(elementId: string): void {
    if (this.timelinePreviewSync.shouldIgnorePreviewOrigin()) {
      return;
    }

    const clipId = this.timelinePreviewSync.getClipIdForElement(elementId);
    if (!clipId) {
      return;
    }

    this.timelinePreviewSync.runAs('preview', () => {
      this.timeline.removeClip(clipId, {removeLinked: true});
      this.timelinePreviewSync.unmapElement(elementId);
    });
  }

  private onCanvasElementUpdated({
                                   id,
                                   patch,
                                 }: {
    id: string;
    patch: Partial<{ startTime: number; duration: number }>;
  }): void {
    if (this.timelinePreviewSync.shouldIgnorePreviewOrigin()) {
      return;
    }

    if (patch.startTime === undefined && patch.duration === undefined) {
      return;
    }

    this.updateTimelineTiming(id, patch);
  }

  private onCanvasSelectionChanged(selectedId: string | null): void {
    if (this.timelinePreviewSync.shouldIgnorePreviewOrigin()) {
      return;
    }

    const clipId = selectedId ? this.timelinePreviewSync.getClipIdForElement(selectedId) ?? null : null;
    const state = selectClip(cloneState(this.timeline.getState()), clipId);
    if (
        state.selectedClipIds.join(',') === this.timeline.getState().selectedClipIds.join(',') &&
        state.primarySelectedClipId === this.timeline.getState().primarySelectedClipId
    ) {
      return;
    }

    this.timelinePreviewSync.runAs('preview', () => {
      this.timeline.loadState(state);
    });
  }

  private updateTimelineTiming(
      elementId: string,
      patch: Partial<{ startTime: number; duration: number }>,
  ): void {
    const clipId = this.timelinePreviewSync.getClipIdForElement(elementId);
    if (!clipId) {
      return;
    }

    let state = cloneState(this.timeline.getState());
    const clip = state.clips.find((item) => item.id === clipId);
    if (!clip) {
      return;
    }

    if (patch.startTime !== undefined) {
      state = moveClip(state, clipId, patch.startTime, clip.trackId);
    }

    if (patch.duration !== undefined) {
      const nextDuration = patch.duration;
      const linkedClipId = clip.linkedClipId;

      state = {
        ...state,
        clips: state.clips.map((item) => {
          const isPrimary = item.id === clipId;
          const isLinked = item.id === linkedClipId || item.linkedClipId === clipId;
          if (!isPrimary && !isLinked) {
            return item;
          }

          return {
            ...item,
            duration: nextDuration,
            outPoint: item.inPoint + nextDuration,
          };
        }),
        duration: computeDuration(
            state.clips.map((item) => {
              const isPrimary = item.id === clipId;
              const isLinked = item.id === linkedClipId || item.linkedClipId === clipId;
              if (!isPrimary && !isLinked) {
                return item;
              }

              return {
                ...item,
                duration: nextDuration,
                outPoint: item.inPoint + nextDuration,
              };
            }),
        ),
      };
    }

    this.timelinePreviewSync.runAs('preview', () => {
      this.timeline.loadState(state);
    });
  }
}


export interface PreviewOptions {
  timeline: Timeline;
  preview: CompositionPreview;
  leftNav: LeftNav;
  timelinePreviewSync: PreviewTimelineSync;
}

export function bindPreview({timeline, preview, leftNav, timelinePreviewSync}: PreviewOptions): void {
  const previewSubscriber = new PreviewSubscriber({timeline, preview, timelinePreviewSync, leftNav});
  previewSubscriber.bind();
}

