import type { Clip, Timeline } from '@opensource/timeline';
import type { CompositionPreview } from '@opensource/video-preview';

import type { PreviewTimelineSync } from './PreviewTimelineSync';
import {
  getTimelineClipZIndex,
  timelineClipToCanvasElement,
} from './converters';

export interface TimelineSubscriberOptions {
  timeline: Timeline;
  preview: CompositionPreview;
  sync: PreviewTimelineSync;
}

export class TimelineSubscriber {
  private readonly timeline: Timeline;
  private readonly preview: CompositionPreview;
  private readonly sync: PreviewTimelineSync;
  private readonly disposables: Array<() => void> = [];

  constructor({ timeline, preview, sync }: TimelineSubscriberOptions) {
    this.timeline = timeline;
    this.preview = preview;
    this.sync = sync;
  }

  bind(): () => void {
    this.disposables.push(
      this.timeline.on('clip:add', (payload) => this.onTimelineClipAdd(payload.clips)),
      this.timeline.on('clip:remove', (payload) => this.onTimelineClipRemove(payload.clipIds)),
      this.timeline.on('clip:drag', (payload) => this.onTimelineClipMoved(payload)),
      this.timeline.on('clip:drag:end', (payload) => this.onTimelineClipMoved(payload)),
      this.timeline.on('clip:trim', (payload) => this.onTimelineClipTrimmed(payload)),
      this.timeline.on('clip:split', (payload) => this.onTimelineClipSplit(payload)),
      this.timeline.on('clip:cut', (payload) => this.onTimelineClipCut(payload)),
      this.timeline.on('clip:select', (payload) => this.onTimelineClipSelect(payload.primaryId)),
      this.timeline.on('track:reorder', () => this.syncAllZIndicesFromTimeline()),
      this.timeline.on('track:add', () => this.syncAllZIndicesFromTimeline()),
      this.timeline.on('track:remove', () => this.syncAllZIndicesFromTimeline()),
    );

    return () => this.destroy();
  }

  destroy(): void {
    while (this.disposables.length > 0) {
      this.disposables.pop()?.();
    }
  }

  private onTimelineClipAdd(clips: Clip[]): void {
    if (this.sync.isPaused()) {
      return;
    }

    this.sync.runAs('timeline', () => {
      for (const clip of clips) {
        this.addCanvasLayerForClip(clip);
      }
    });
  }

  private onTimelineClipRemove(clipIds: string[]): void {
    if (this.sync.shouldIgnoreTimelineOrigin()) {
      return;
    }

    this.sync.runAs('timeline', () => {
      const removedElements = new Set<string>();

      for (const clipId of clipIds) {
        const elementId = this.sync.getElementIdForClip(clipId);
        if (!elementId || removedElements.has(elementId)) {
          this.sync.unmapClip(clipId);
          continue;
        }

        if (this.sync.getClipIdForElement(elementId) !== clipId) {
          this.sync.unmapClip(clipId);
          continue;
        }

        this.preview.removeElement(elementId);
        this.sync.unmapElement(elementId);
        removedElements.add(elementId);
      }
    });
  }

  private onTimelineClipMoved({
    clipId,
    linkedClipId,
  }: {
    clipId: string;
    startTime: number;
    trackId: string;
    linkedClipId?: string;
  }): void {
    if (this.sync.isPaused()) {
      return;
    }

    this.syncTimelineClipsToCanvas([clipId, linkedClipId]);
  }

  private onTimelineClipTrimmed({ clipId }: { clipId: string }): void {
    if (this.sync.isPaused()) {
      return;
    }

    const clip = this.timeline.getState().clips.find((item) => item.id === clipId);
    if (!clip) {
      return;
    }

    this.syncTimelineClipsToCanvas([clipId, clip.linkedClipId]);
  }

  private onTimelineClipSplit({
    originalClipId,
    newClipIds,
  }: {
    originalClipId: string;
    newClipIds: [string, string];
    time: number;
  }): void {
    if (this.sync.shouldIgnoreTimelineOrigin()) {
      return;
    }

    const state = this.timeline.getState();
    const [firstId, secondId] = newClipIds;
    const firstClip = state.clips.find((item) => item.id === firstId);
    const secondClip = state.clips.find((item) => item.id === secondId);
    if (!firstClip || !secondClip) {
      return;
    }

    const orphanedClipIds = this.sync.getOrphanedClipIds();
    const companionClipId = orphanedClipIds.find((id) => id !== originalClipId);

    this.sync.runAs('timeline', () => {
      this.syncSplitClip(originalClipId, firstClip, secondClip);

      if (companionClipId && firstClip.linkedClipId && secondClip.linkedClipId) {
        const firstLinked = state.clips.find((item) => item.id === firstClip.linkedClipId);
        const secondLinked = state.clips.find((item) => item.id === secondClip.linkedClipId);
        if (firstLinked && secondLinked) {
          this.syncSplitClip(companionClipId, firstLinked, secondLinked);
        }
      }

      for (const clipId of orphanedClipIds) {
        this.sync.unmapClip(clipId);
      }
    });

    this.refreshCanvasPreview();
  }

  private onTimelineClipCut({
    originalClipId,
    clipIds,
    mode,
  }: {
    originalClipId: string;
    clipIds: string[];
    startTime: number;
    duration: number;
    mode: 'start' | 'end' | 'middle';
  }): void {
    if (this.sync.shouldIgnoreTimelineOrigin()) {
      return;
    }

    this.sync.runAs('timeline', () => {
      if (mode === 'middle') {
        const [firstId, secondId] = clipIds as [string, string];
        const state = this.timeline.getState();
        const firstClip = state.clips.find((item) => item.id === firstId);
        const secondClip = state.clips.find((item) => item.id === secondId);
        if (!firstClip || !secondClip) {
          return;
        }

        const orphanedClipIds = this.sync.getOrphanedClipIds();
        const companionClipId = orphanedClipIds.find((id) => id !== originalClipId);

        this.syncSplitClip(originalClipId, firstClip, secondClip);

        if (companionClipId && firstClip.linkedClipId && secondClip.linkedClipId) {
          const firstLinked = state.clips.find((item) => item.id === firstClip.linkedClipId);
          const secondLinked = state.clips.find((item) => item.id === secondClip.linkedClipId);
          if (firstLinked && secondLinked) {
            this.syncSplitClip(companionClipId, firstLinked, secondLinked);
          }
        }

        for (const clipId of orphanedClipIds) {
          this.sync.unmapClip(clipId);
        }
        return;
      }

      const clipId = clipIds[0];
      const clip = this.timeline.getState().clips.find((item) => item.id === clipId);
      if (!clip) {
        return;
      }

      this.applyClipTimingToCanvas(clip);
      if (clip.linkedClipId) {
        const linked = this.timeline.getState().clips.find((item) => item.id === clip.linkedClipId);
        if (linked) {
          this.applyClipTimingToCanvas(linked);
        }
      }
    });

    this.refreshCanvasPreview();
  }

  private onTimelineClipSelect(primaryId: string | null): void {
    if (this.sync.shouldIgnoreTimelineOrigin()) {
      return;
    }

    const elementId = primaryId ? this.sync.getElementIdForClip(primaryId) ?? null : null;
    if (elementId === this.preview.getSelectedId()) {
      return;
    }

    this.sync.runAs('timeline', () => {
      this.preview.selectElement(elementId);
    });
  }

  private syncTimelineClipsToCanvas(clipIds: Array<string | undefined>): void {
    if (this.sync.isPaused()) {
      return;
    }

    const uniqueIds = [...new Set(clipIds.filter((id): id is string => Boolean(id)))];
    if (uniqueIds.length === 0) {
      return;
    }

    this.sync.runAs('timeline', () => {
      for (const clipId of uniqueIds) {
        const clip = this.timeline.getState().clips.find((item) => item.id === clipId);
        if (clip) {
          this.applyClipTimingToCanvas(clip);
        }
      }
    });

    this.refreshCanvasPreview();
  }

  private syncSplitClip(originalClipId: string, firstClip: Clip, secondClip: Clip): void {
    const elementId = this.sync.getElementIdForClip(originalClipId);
    if (elementId) {
      this.applyClipTimingToCanvas(firstClip, elementId);
      this.sync.register(elementId, firstClip.id);
    } else {
      this.addCanvasLayerForClip(firstClip);
    }

    this.addCanvasLayerForClip(secondClip);
  }

  private addCanvasLayerForClip(clip: Clip): void {
    if (this.sync.getElementIdForClip(clip.id)) {
      return;
    }

    const { tracks } = this.timeline.getState();
    const element = timelineClipToCanvasElement(clip, {
      zIndex: getTimelineClipZIndex(clip, tracks),
      playerSize: this.preview.getPlayerSize(),
    });
    const elementId = this.preview.addElement(element);
    this.sync.register(elementId, clip.id);
  }

  private applyClipTimingToCanvas(clip: Clip, elementId?: string): void {
    const targetId = elementId ?? this.sync.getElementIdForClip(clip.id);
    if (!targetId) {
      return;
    }

    if (!elementId) {
      const mappedClipId = this.sync.getClipIdForElement(targetId);
      if (mappedClipId && mappedClipId !== clip.id) {
        return;
      }
    }

    this.preview.updateElement(targetId, {
      startTime: clip.startTime,
      duration: clip.duration,
      sourceOffset: clip.inPoint,
      zIndex: getTimelineClipZIndex(clip, this.timeline.getState().tracks),
    });
  }

  private syncAllZIndicesFromTimeline(): void {
    if (this.sync.shouldIgnoreTimelineOrigin()) {
      return;
    }

    const { tracks, clips } = this.timeline.getState();

    this.sync.runAs('timeline', () => {
      for (const clip of clips) {
        const elementId = this.sync.getElementIdForClip(clip.id);
        if (!elementId || this.sync.getClipIdForElement(elementId) !== clip.id) {
          continue;
        }

        this.preview.updateElement(elementId, {
          zIndex: getTimelineClipZIndex(clip, tracks),
        });
      }
    });

    this.refreshCanvasPreview();
  }

  private refreshCanvasPreview(): void {
    if (this.timeline.getState().isPlaying) {
      return;
    }

    this.preview.render(this.preview.getCurrentTime(), { playing: false });
  }
}
