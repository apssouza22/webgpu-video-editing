import {
  cloneState,
  computeDuration,
  moveClip,
  selectClip,
  type Timeline,
} from '@opensource/timeline';
import type { CompositionPreview } from '@opensource/video-preview';

import type { PreviewTimelineSync } from './PreviewTimelineSync';

export interface CompositionPreviewSubscriberOptions {
  timeline: Timeline;
  preview: CompositionPreview;
  sync: PreviewTimelineSync;
}

export class CompositionPreviewSubscriber {
  private readonly timeline: Timeline;
  private readonly preview: CompositionPreview;
  private readonly sync: PreviewTimelineSync;
  private readonly disposables: Array<() => void> = [];

  constructor({ timeline, preview, sync }: CompositionPreviewSubscriberOptions) {
    this.timeline = timeline;
    this.preview = preview;
    this.sync = sync;
  }

  bind(): () => void {
    this.disposables.push(
      this.preview.on('element:removed', (payload) => this.onCanvasElementRemoved(payload.id)),
      this.preview.on('element:updated', (payload) => this.onCanvasElementUpdated(payload)),
      this.preview.on('selection:changed', (payload) => this.onCanvasSelectionChanged(payload.selectedId)),
    );

    return () => this.destroy();
  }

  destroy(): void {
    while (this.disposables.length > 0) {
      this.disposables.pop()?.();
    }
  }

  private onCanvasElementRemoved(elementId: string): void {
    if (this.sync.shouldIgnorePreviewOrigin()) {
      return;
    }

    const clipId = this.sync.getClipIdForElement(elementId);
    if (!clipId) {
      return;
    }

    this.sync.runAs('preview', () => {
      this.timeline.removeClip(clipId, { removeLinked: true });
      this.sync.unmapElement(elementId);
    });
  }

  private onCanvasElementUpdated({
    id,
    patch,
  }: {
    id: string;
    patch: Partial<{ startTime: number; duration: number }>;
  }): void {
    if (this.sync.shouldIgnorePreviewOrigin()) {
      return;
    }

    if (patch.startTime === undefined && patch.duration === undefined) {
      return;
    }

    this.updateTimelineTiming(id, patch);
  }

  private onCanvasSelectionChanged(selectedId: string | null): void {
    if (this.sync.shouldIgnorePreviewOrigin()) {
      return;
    }

    const clipId = selectedId ? this.sync.getClipIdForElement(selectedId) ?? null : null;
    const state = selectClip(cloneState(this.timeline.getState()), clipId);
    if (
      state.selectedClipIds.join(',') === this.timeline.getState().selectedClipIds.join(',') &&
      state.primarySelectedClipId === this.timeline.getState().primarySelectedClipId
    ) {
      return;
    }

    this.sync.runAs('preview', () => {
      this.timeline.loadState(state);
    });
  }

  private updateTimelineTiming(
    elementId: string,
    patch: Partial<{ startTime: number; duration: number }>,
  ): void {
    const clipId = this.sync.getClipIdForElement(elementId);
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

    this.sync.runAs('preview', () => {
      this.timeline.loadState(state);
    });
  }
}
