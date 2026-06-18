import type {Clip, Timeline, TimelineEventMap, TimelineState} from '@opensource/timeline';
import type {CompositionPreview} from '@opensource/video-preview';

import type {EditorPlayback} from '../loop/EditorPlayback';
import type {PreviewTimelineSync} from './PreviewTimelineSync';

import {getTimelineClipZIndex, timelineClipToCanvasElement,} from './converters';

export interface TimelineSubscriberOptions {
  timeline: Timeline;
  preview: CompositionPreview;
  timelinePreviewSync: PreviewTimelineSync;
  editorPlayback: EditorPlayback;
}

class TimelineSubscriber {
  private readonly timeline: Timeline;
  private readonly preview: CompositionPreview;
  private readonly timelinePreviewSync: PreviewTimelineSync;
  private readonly editorPlayback: EditorPlayback;

  constructor({timeline, preview, timelinePreviewSync, editorPlayback}: TimelineSubscriberOptions) {
    this.timeline = timeline;
    this.preview = preview;
    this.timelinePreviewSync = timelinePreviewSync;
    this.editorPlayback = editorPlayback;
  }

  bind(): void {
    this.timeline.on('playhead:change', (payload) => this.editorPlayback.onPlayheadChange(payload));
    this.timeline.on('playhead:play', (payload) => this.editorPlayback.onPlay(payload));
    this.timeline.on('playhead:pause', (payload) => this.editorPlayback.onPause(payload));
    this.timeline.on('playhead:rate', (payload) => this.editorPlayback.onRateChange(payload));
    this.timeline.on('clip:add', (payload) => this.onTimelineClipAdd(payload));
    this.timeline.on('clip:remove', (payload) => this.onTimelineClipRemove(payload));
    this.timeline.on('clip:drag', (payload) => this.onTimelineClipMoved(payload));
    this.timeline.on('clip:drag:end', (payload) => this.onTimelineClipMoved(payload));
    this.timeline.on('clip:trim', (payload) => this.onTimelineClipTrimmed(payload));
    this.timeline.on('clip:split', (payload) => this.onTimelineClipSplit(payload));
    this.timeline.on('clip:cut', (payload) => this.onTimelineClipCut(payload));
    this.timeline.on('clip:select', (payload) => this.onTimelineClipSelect(payload));
    this.timeline.on('track:reorder', (payload) => this.syncAllZIndicesFromTimeline(payload.state));
    this.timeline.on('track:add', (payload) => this.syncAllZIndicesFromTimeline(payload.state));
    this.timeline.on('track:remove', (payload) => this.syncAllZIndicesFromTimeline(payload.state));
  }

  private onTimelineClipAdd({clips, state}: TimelineEventMap['clip:add']): void {
    if (this.timelinePreviewSync.isPaused()) {
      return;
    }

    this.timelinePreviewSync.runAs('timeline', () => {
      for (const clip of clips) {
        this.addCanvasLayerForClip(clip, state);
      }
    });
  }

  private onTimelineClipRemove({clipIds}: TimelineEventMap['clip:remove']): void {
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
    state,
  }: TimelineEventMap['clip:drag']): void {
    if (this.timelinePreviewSync.isPaused()) {
      return;
    }

    this.syncTimelineClipsToCanvas([clipId, linkedClipId], state);
  }

  private onTimelineClipTrimmed({clipId, state}: TimelineEventMap['clip:trim']): void {
    if (this.timelinePreviewSync.isPaused()) {
      return;
    }

    const clip = state.clips.find((item) => item.id === clipId);
    if (!clip) {
      return;
    }

    this.syncTimelineClipsToCanvas([clipId, clip.linkedClipId], state);
  }

  private onTimelineClipSplit({
    originalClipId,
    newClipIds,
    state,
  }: TimelineEventMap['clip:split']): void {
    if (this.timelinePreviewSync.shouldIgnoreTimelineOrigin()) {
      return;
    }

    const [firstId, secondId] = newClipIds;
    const firstClip = state.clips.find((item) => item.id === firstId);
    const secondClip = state.clips.find((item) => item.id === secondId);
    if (!firstClip || !secondClip) {
      return;
    }

    const orphanedClipIds = this.timelinePreviewSync.getOrphanedClipIds();
    const companionClipId = orphanedClipIds.find((id) => id !== originalClipId);

    this.timelinePreviewSync.runAs('timeline', () => {
      this.syncSplitClip(originalClipId, firstClip, secondClip, state);

      if (companionClipId && firstClip.linkedClipId && secondClip.linkedClipId) {
        const firstLinked = state.clips.find((item) => item.id === firstClip.linkedClipId);
        const secondLinked = state.clips.find((item) => item.id === secondClip.linkedClipId);
        if (firstLinked && secondLinked) {
          this.syncSplitClip(companionClipId, firstLinked, secondLinked, state);
        }
      }

      for (const clipId of orphanedClipIds) {
        this.timelinePreviewSync.unmapClip(clipId);
      }
    });

    this.refreshCanvasPreview(state);
  }

  private onTimelineClipCut({
    originalClipId,
    clipIds,
    mode,
    state,
  }: TimelineEventMap['clip:cut']): void {
    if (this.timelinePreviewSync.shouldIgnoreTimelineOrigin()) {
      return;
    }

    this.timelinePreviewSync.runAs('timeline', () => {
      if (mode === 'middle') {
        const [firstId, secondId] = clipIds as [string, string];
        const firstClip = state.clips.find((item) => item.id === firstId);
        const secondClip = state.clips.find((item) => item.id === secondId);
        if (!firstClip || !secondClip) {
          return;
        }

        const orphanedClipIds = this.timelinePreviewSync.getOrphanedClipIds();
        const companionClipId = orphanedClipIds.find((id) => id !== originalClipId);

        this.syncSplitClip(originalClipId, firstClip, secondClip, state);

        if (companionClipId && firstClip.linkedClipId && secondClip.linkedClipId) {
          const firstLinked = state.clips.find((item) => item.id === firstClip.linkedClipId);
          const secondLinked = state.clips.find((item) => item.id === secondClip.linkedClipId);
          if (firstLinked && secondLinked) {
            this.syncSplitClip(companionClipId, firstLinked, secondLinked, state);
          }
        }

        for (const clipId of orphanedClipIds) {
          this.timelinePreviewSync.unmapClip(clipId);
        }
        return;
      }

      const clipId = clipIds[0];
      const clip = state.clips.find((item) => item.id === clipId);
      if (!clip) {
        return;
      }

      this.applyClipTimingToCanvas(clip, state);
      if (clip.linkedClipId) {
        const linked = state.clips.find((item) => item.id === clip.linkedClipId);
        if (linked) {
          this.applyClipTimingToCanvas(linked, state);
        }
      }
    });

    this.refreshCanvasPreview(state);
  }

  private onTimelineClipSelect({primaryId}: TimelineEventMap['clip:select']): void {
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

  private syncTimelineClipsToCanvas(clipIds: Array<string | undefined>, state: TimelineState): void {
    if (this.timelinePreviewSync.isPaused()) {
      return;
    }

    const uniqueIds = [...new Set(clipIds.filter((id): id is string => Boolean(id)))];
    if (uniqueIds.length === 0) {
      return;
    }

    this.timelinePreviewSync.runAs('timeline', () => {
      for (const clipId of uniqueIds) {
        const clip = state.clips.find((item) => item.id === clipId);
        if (clip) {
          this.applyClipTimingToCanvas(clip, state);
        }
      }
    });

    this.refreshCanvasPreview(state);
  }

  private syncSplitClip(
    originalClipId: string,
    firstClip: Clip,
    secondClip: Clip,
    state: TimelineState,
  ): void {
    const elementId = this.timelinePreviewSync.getElementIdForClip(originalClipId);
    if (elementId) {
      this.applyClipTimingToCanvas(firstClip, state, elementId);
      this.timelinePreviewSync.register(elementId, firstClip.id);
    } else {
      this.addCanvasLayerForClip(firstClip, state);
    }

    this.addCanvasLayerForClip(secondClip, state);
  }

  private addCanvasLayerForClip(clip: Clip, state: TimelineState): void {
    if (this.timelinePreviewSync.getElementIdForClip(clip.id)) {
      return;
    }

    const element = timelineClipToCanvasElement(clip, {
      zIndex: getTimelineClipZIndex(clip, state.tracks),
      playerSize: this.preview.getPlayerSize(),
    });
    const elementId = this.preview.addElement(element);
    this.timelinePreviewSync.register(elementId, clip.id);
  }

  private applyClipTimingToCanvas(clip: Clip, state: TimelineState, elementId?: string): void {
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
      zIndex: getTimelineClipZIndex(clip, state.tracks),
    });
  }

  private syncAllZIndicesFromTimeline(state: TimelineState): void {
    if (this.timelinePreviewSync.shouldIgnoreTimelineOrigin()) {
      return;
    }

    const {tracks, clips} = state;

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

    this.refreshCanvasPreview(state);
  }

  private refreshCanvasPreview(state: TimelineState): void {
    if (state.isPlaying) {
      return;
    }

    this.preview.render(this.preview.getCurrentTime(), {playing: false});
  }
}


export interface TimelineSubsOptions {
  timeline: Timeline;
  preview: CompositionPreview;
  timelinePreviewSync: PreviewTimelineSync;
  editorPlayback: EditorPlayback;
}

export function bindTimeline({timeline, preview, timelinePreviewSync, editorPlayback}: TimelineSubsOptions): void {
  const timelineSubscriber = new TimelineSubscriber({timeline, preview, timelinePreviewSync, editorPlayback});
  timelineSubscriber.bind();
}
