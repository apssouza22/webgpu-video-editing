import type {Clip, Timeline} from '@opensource/timeline';
import type {CompositionPreview} from '@opensource/video-preview';

import type {PreviewTimelineSync} from './PreviewTimelineSync';

import {getTimelineClipZIndex, timelineClipToCanvasElement,} from './converters';

export interface TimelineSubscriberOptions {
  timeline: Timeline;
  preview: CompositionPreview;
  timelinePreviewSync: PreviewTimelineSync;
}

class TimelineSubscriber {
  private readonly timeline: Timeline;
  private readonly preview: CompositionPreview;
  private readonly timelinePreviewSync: PreviewTimelineSync;

  constructor({timeline, preview, timelinePreviewSync}: TimelineSubscriberOptions) {
    this.timeline = timeline;
    this.preview = preview;
    this.timelinePreviewSync = timelinePreviewSync;
  }

  bind(): void {
    this.timeline.on('clip:add', (payload) => this.onTimelineClipAdd(payload.clips));
    this.timeline.on('clip:remove', (payload) => this.onTimelineClipRemove(payload.clipIds));
    this.timeline.on('clip:drag', (payload) => this.onTimelineClipMoved(payload));
    this.timeline.on('clip:drag:end', (payload) => this.onTimelineClipMoved(payload));
    this.timeline.on('clip:trim', (payload) => this.onTimelineClipTrimmed(payload));
    this.timeline.on('clip:split', (payload) => this.onTimelineClipSplit(payload));
    this.timeline.on('clip:cut', (payload) => this.onTimelineClipCut(payload));
    this.timeline.on('clip:select', (payload) => this.onTimelineClipSelect(payload.primaryId));
    this.timeline.on('track:reorder', () => this.syncAllZIndicesFromTimeline());
    this.timeline.on('track:add', () => this.syncAllZIndicesFromTimeline());
    this.timeline.on('track:remove', () => this.syncAllZIndicesFromTimeline());
  }

  private onTimelineClipAdd(clips: Clip[]): void {
    if (this.timelinePreviewSync.isPaused()) {
      return;
    }

    this.timelinePreviewSync.runAs('timeline', () => {
      for (const clip of clips) {
        this.addCanvasLayerForClip(clip);
      }
    });
  }

  private onTimelineClipRemove(clipIds: string[]): void {
    if (this.timelinePreviewSync.shouldIgnoreTimelineOrigin()) {
      return;
    }

    this.timelinePreviewSync.runAs('timeline', () => {
      const removedElements = new Set<string>();

      for (const clipId of clipIds) {
        const elementId = this.timelinePreviewSync.getElementIdForClip(clipId);
        if (!elementId || removedElements.has(elementId)) {
          this.timelinePreviewSync.unmapClip(clipId);
          continue;
        }

        if (this.timelinePreviewSync.getClipIdForElement(elementId) !== clipId) {
          this.timelinePreviewSync.unmapClip(clipId);
          continue;
        }

        this.preview.removeElement(elementId);
        this.timelinePreviewSync.unmapElement(elementId);
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
    if (this.timelinePreviewSync.isPaused()) {
      return;
    }

    this.syncTimelineClipsToCanvas([clipId, linkedClipId]);
  }

  private onTimelineClipTrimmed({clipId}: { clipId: string }): void {
    if (this.timelinePreviewSync.isPaused()) {
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
    if (this.timelinePreviewSync.shouldIgnoreTimelineOrigin()) {
      return;
    }

    const state = this.timeline.getState();
    const [firstId, secondId] = newClipIds;
    const firstClip = state.clips.find((item) => item.id === firstId);
    const secondClip = state.clips.find((item) => item.id === secondId);
    if (!firstClip || !secondClip) {
      return;
    }

    const orphanedClipIds = this.timelinePreviewSync.getOrphanedClipIds();
    const companionClipId = orphanedClipIds.find((id) => id !== originalClipId);

    this.timelinePreviewSync.runAs('timeline', () => {
      this.syncSplitClip(originalClipId, firstClip, secondClip);

      if (companionClipId && firstClip.linkedClipId && secondClip.linkedClipId) {
        const firstLinked = state.clips.find((item) => item.id === firstClip.linkedClipId);
        const secondLinked = state.clips.find((item) => item.id === secondClip.linkedClipId);
        if (firstLinked && secondLinked) {
          this.syncSplitClip(companionClipId, firstLinked, secondLinked);
        }
      }

      for (const clipId of orphanedClipIds) {
        this.timelinePreviewSync.unmapClip(clipId);
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
    if (this.timelinePreviewSync.shouldIgnoreTimelineOrigin()) {
      return;
    }

    this.timelinePreviewSync.runAs('timeline', () => {
      if (mode === 'middle') {
        const [firstId, secondId] = clipIds as [string, string];
        const state = this.timeline.getState();
        const firstClip = state.clips.find((item) => item.id === firstId);
        const secondClip = state.clips.find((item) => item.id === secondId);
        if (!firstClip || !secondClip) {
          return;
        }

        const orphanedClipIds = this.timelinePreviewSync.getOrphanedClipIds();
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
          this.timelinePreviewSync.unmapClip(clipId);
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
    if (this.timelinePreviewSync.shouldIgnoreTimelineOrigin()) {
      return;
    }

    const elementId = primaryId ? this.timelinePreviewSync.getElementIdForClip(primaryId) ?? null : null;
    if (elementId === this.preview.getSelectedId()) {
      return;
    }

    this.timelinePreviewSync.runAs('timeline', () => {
      this.preview.selectElement(elementId);
    });
  }

  private syncTimelineClipsToCanvas(clipIds: Array<string | undefined>): void {
    if (this.timelinePreviewSync.isPaused()) {
      return;
    }

    const uniqueIds = [...new Set(clipIds.filter((id): id is string => Boolean(id)))];
    if (uniqueIds.length === 0) {
      return;
    }

    this.timelinePreviewSync.runAs('timeline', () => {
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
    const elementId = this.timelinePreviewSync.getElementIdForClip(originalClipId);
    if (elementId) {
      this.applyClipTimingToCanvas(firstClip, elementId);
      this.timelinePreviewSync.register(elementId, firstClip.id);
    } else {
      this.addCanvasLayerForClip(firstClip);
    }

    this.addCanvasLayerForClip(secondClip);
  }

  private addCanvasLayerForClip(clip: Clip): void {
    if (this.timelinePreviewSync.getElementIdForClip(clip.id)) {
      return;
    }

    const {tracks} = this.timeline.getState();
    const element = timelineClipToCanvasElement(clip, {
      zIndex: getTimelineClipZIndex(clip, tracks),
      playerSize: this.preview.getPlayerSize(),
    });
    const elementId = this.preview.addElement(element);
    this.timelinePreviewSync.register(elementId, clip.id);
  }

  private applyClipTimingToCanvas(clip: Clip, elementId?: string): void {
    const targetId = elementId ?? this.timelinePreviewSync.getElementIdForClip(clip.id);
    if (!targetId) {
      return;
    }

    if (!elementId) {
      const mappedClipId = this.timelinePreviewSync.getClipIdForElement(targetId);
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
    if (this.timelinePreviewSync.shouldIgnoreTimelineOrigin()) {
      return;
    }

    const {tracks, clips} = this.timeline.getState();

    this.timelinePreviewSync.runAs('timeline', () => {
      for (const clip of clips) {
        const elementId = this.timelinePreviewSync.getElementIdForClip(clip.id);
        if (!elementId || this.timelinePreviewSync.getClipIdForElement(elementId) !== clip.id) {
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

    this.preview.render(this.preview.getCurrentTime(), {playing: false});
  }
}


export interface TimelineSubsOptions {
  timeline: Timeline;
  preview: CompositionPreview;
  timelinePreviewSync: PreviewTimelineSync;
}

export function bindTimeline({timeline,preview,timelinePreviewSync}: TimelineSubsOptions): void {
  const timelineSubscriber = new TimelineSubscriber({timeline, preview, timelinePreviewSync});
  timelineSubscriber.bind();
}
