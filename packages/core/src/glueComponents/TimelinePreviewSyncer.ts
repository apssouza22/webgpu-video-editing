import {
  cloneState,
  computeDuration,
  moveClip,
  selectClip,
  type Timeline,
} from '@opensource/timeline';
import type { Clip } from '@opensource/timeline';
import type { CompositionPreview, CanvasElement } from '@opensource/video-preview';

import {
  getTimelineClipZIndex,
  timelineClipToCanvasElement,
} from './converters';

type SyncSource = 'preview' | 'timeline';

export interface ClipPreviewSyncOptions {
  timeline: Timeline;
  preview: CompositionPreview;
}

export class TimelinePreviewSyncer {
  private readonly timeline: Timeline;
  private readonly preview: CompositionPreview;
  private readonly disposables: Array<() => void> = [];
  private source: SyncSource | null = null;
  private paused = false;
  private readonly elementToClip = new Map<string, string>();
  private readonly clipToElement = new Map<string, string>();

  constructor({ timeline, preview }: ClipPreviewSyncOptions) {
    this.timeline = timeline;
    this.preview = preview;
  }

  bind(): () => void {
    this.disposables.push(
      this.preview.on('element:removed', (payload) => this.onCanvasElementRemoved(payload.id)),
      this.preview.on('element:updated', (payload) => this.onCanvasElementUpdated(payload)),
      this.preview.on('selection:changed', (payload) => this.onCanvasSelectionChanged(payload.selectedId)),
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
    this.elementToClip.clear();
    this.clipToElement.clear();
    this.source = null;
    this.paused = false;
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  rebuildMappings(): void {
    this.elementToClip.clear();
    this.clipToElement.clear();

    const elements = this.preview.getElements();
    const clips = this.timeline.getState().clips;
    const usedElements = new Set<string>();

    for (const clip of clips) {
      const element = elements.find((candidate) => {
        if (usedElements.has(candidate.id)) {
          return false;
        }
        return this.matchesClip(candidate, clip);
      });

      if (element) {
        this.register(element.id, clip.id);
        usedElements.add(element.id);
      }
    }
  }

  getClipIdForElement(elementId: string): string | undefined {
    return this.elementToClip.get(elementId);
  }

  getElementIdForClip(clipId: string): string | undefined {
    return this.clipToElement.get(clipId);
  }

  private matchesClip(element: CanvasElement, clip: Clip): boolean {
    if (element.type !== clip.type) {
      return false;
    }

    if (Math.abs(element.startTime - clip.startTime) > 0.001) {
      return false;
    }

    if (Math.abs(element.duration - clip.duration) > 0.001) {
      return false;
    }

    if (element.type === 'text') {
      const content = element.content.trim() || element.name;
      const clipText = clip.textContent?.trim() || clip.name;
      return content === clipText;
    }

    const clipUrl = clip.url ?? '';
    return element.src === clipUrl;
  }

  private onCanvasElementRemoved(elementId: string): void {
    if (this.paused || this.source === 'timeline') {
      return;
    }

    const clipId = this.elementToClip.get(elementId);
    if (!clipId) {
      return;
    }

    this.source = 'preview';
    try {
      this.timeline.removeClip(clipId, { removeLinked: true });
      this.unmapElement(elementId);
    } finally {
      this.source = null;
    }
  }

  private onCanvasElementUpdated({
    id,
    patch,
  }: {
    id: string;
    patch: Partial<{ startTime: number; duration: number }>;
  }): void {
    if (this.paused || this.source === 'timeline') {
      return;
    }

    if (patch.startTime === undefined && patch.duration === undefined) {
      return;
    }

    this.updateTimelineTiming(id, patch);
  }

  private onCanvasSelectionChanged(selectedId: string | null): void {
    if (this.paused || this.source === 'timeline') {
      return;
    }

    const clipId = selectedId ? this.elementToClip.get(selectedId) ?? null : null;
    const state = selectClip(cloneState(this.timeline.getState()), clipId);
    if (
      state.selectedClipIds.join(',') === this.timeline.getState().selectedClipIds.join(',') &&
      state.primarySelectedClipId === this.timeline.getState().primarySelectedClipId
    ) {
      return;
    }

    this.source = 'preview';
    try {
      this.timeline.loadState(state);
    } finally {
      this.source = null;
    }
  }

  private onTimelineClipAdd(clips: Clip[]): void {
    if (this.paused) {
      return;
    }

    this.source = 'timeline';
    try {
      for (const clip of clips) {
        this.addCanvasLayerForClip(clip);
      }
    } finally {
      this.source = null;
    }
  }

  private onTimelineClipRemove(clipIds: string[]): void {
    if (this.paused || this.source === 'preview') {
      return;
    }

    this.source = 'timeline';
    try {
      const removedElements = new Set<string>();

      for (const clipId of clipIds) {
        const elementId = this.clipToElement.get(clipId);
        if (!elementId || removedElements.has(elementId)) {
          this.unmapClip(clipId);
          continue;
        }

        if (this.elementToClip.get(elementId) !== clipId) {
          this.unmapClip(clipId);
          continue;
        }

        this.preview.removeElement(elementId);
        this.unmapElement(elementId);
        removedElements.add(elementId);
      }
    } finally {
      this.source = null;
    }
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
    if (this.paused) {
      return;
    }

    this.syncTimelineClipsToCanvas([clipId, linkedClipId]);
  }

  private onTimelineClipTrimmed({ clipId }: { clipId: string }): void {
    if (this.paused) {
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
    if (this.paused || this.source === 'preview') {
      return;
    }

    const state = this.timeline.getState();
    const [firstId, secondId] = newClipIds;
    const firstClip = state.clips.find((item) => item.id === firstId);
    const secondClip = state.clips.find((item) => item.id === secondId);
    if (!firstClip || !secondClip) {
      return;
    }

    const orphanedClipIds = this.getOrphanedClipIds(state);
    const companionClipId = orphanedClipIds.find((id) => id !== originalClipId);

    this.source = 'timeline';
    try {
      this.syncSplitClip(originalClipId, firstClip, secondClip);

      if (companionClipId && firstClip.linkedClipId && secondClip.linkedClipId) {
        const firstLinked = state.clips.find((item) => item.id === firstClip.linkedClipId);
        const secondLinked = state.clips.find((item) => item.id === secondClip.linkedClipId);
        if (firstLinked && secondLinked) {
          this.syncSplitClip(companionClipId, firstLinked, secondLinked);
        }
      }

      for (const clipId of orphanedClipIds) {
        this.unmapClip(clipId);
      }
    } finally {
      this.source = null;
      this.refreshCanvasPreview();
    }
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
    if (this.paused || this.source === 'preview') {
      return;
    }

    this.source = 'timeline';
    try {
      if (mode === 'middle') {
        const [firstId, secondId] = clipIds as [string, string];
        const state = this.timeline.getState();
        const firstClip = state.clips.find((item) => item.id === firstId);
        const secondClip = state.clips.find((item) => item.id === secondId);
        if (!firstClip || !secondClip) {
          return;
        }

        const orphanedClipIds = this.getOrphanedClipIds(state);
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
          this.unmapClip(clipId);
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
    } finally {
      this.source = null;
      this.refreshCanvasPreview();
    }
  }

  private onTimelineClipSelect(primaryId: string | null): void {
    if (this.paused || this.source === 'preview') {
      return;
    }

    const elementId = primaryId ? this.clipToElement.get(primaryId) ?? null : null;
    if (elementId === this.preview.getSelectedId()) {
      return;
    }

    this.source = 'timeline';
    try {
      this.preview.selectElement(elementId);
    } finally {
      this.source = null;
    }
  }

  private syncTimelineClipsToCanvas(clipIds: Array<string | undefined>): void {
    if (this.paused) {
      return;
    }

    const uniqueIds = [...new Set(clipIds.filter((id): id is string => Boolean(id)))];
    if (uniqueIds.length === 0) {
      return;
    }

    this.source = 'timeline';
    try {
      for (const clipId of uniqueIds) {
        const clip = this.timeline.getState().clips.find((item) => item.id === clipId);
        if (clip) {
          this.applyClipTimingToCanvas(clip);
        }
      }
    } finally {
      this.source = null;
      this.refreshCanvasPreview();
    }
  }

  private syncSplitClip(originalClipId: string, firstClip: Clip, secondClip: Clip): void {
    const elementId = this.clipToElement.get(originalClipId);
    if (elementId) {
      this.applyClipTimingToCanvas(firstClip, elementId);
      this.register(elementId, firstClip.id);
    } else {
      this.addCanvasLayerForClip(firstClip);
    }

    this.addCanvasLayerForClip(secondClip);
  }

  private addCanvasLayerForClip(clip: Clip): void {
    if (this.clipToElement.has(clip.id)) {
      return;
    }

    const { tracks } = this.timeline.getState();
    const element = timelineClipToCanvasElement(clip, {
      zIndex: getTimelineClipZIndex(clip, tracks),
      playerSize: this.preview.getPlayerSize(),
    });
    const elementId = this.preview.addElement(element);
    this.register(elementId, clip.id);
  }

  private applyClipTimingToCanvas(clip: Clip, elementId?: string): void {
    const targetId = elementId ?? this.clipToElement.get(clip.id);
    if (!targetId) {
      return;
    }

    if (!elementId) {
      const mappedClipId = this.elementToClip.get(targetId);
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
    if (this.paused || this.source === 'preview') {
      return;
    }

    const { tracks, clips } = this.timeline.getState();

    this.source = 'timeline';
    try {
      for (const clip of clips) {
        const elementId = this.clipToElement.get(clip.id);
        if (!elementId || this.elementToClip.get(elementId) !== clip.id) {
          continue;
        }

        this.preview.updateElement(elementId, {
          zIndex: getTimelineClipZIndex(clip, tracks),
        });
      }
    } finally {
      this.source = null;
      this.refreshCanvasPreview();
    }
  }

  private getOrphanedClipIds(state: ReturnType<Timeline['getState']>): string[] {
    const clipIds = new Set(state.clips.map((clip) => clip.id));
    return [...this.clipToElement.keys()].filter((clipId) => !clipIds.has(clipId));
  }

  private refreshCanvasPreview(): void {
    if (this.timeline.getState().isPlaying) {
      return;
    }

    this.preview.render(this.preview.getCurrentTime(), { playing: false });
  }

  private updateTimelineTiming(
    elementId: string,
    patch: Partial<{ startTime: number; duration: number }>,
  ): void {
    const clipId = this.elementToClip.get(elementId);
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

    this.source = 'preview';
    try {
      this.timeline.loadState(state);
    } finally {
      this.source = null;
    }
  }

  private register(elementId: string, primaryClipId: string): void {
    this.elementToClip.set(elementId, primaryClipId);
    this.clipToElement.set(primaryClipId, elementId);
  }

  private unmapElement(elementId: string): void {
    const primaryClipId = this.elementToClip.get(elementId);
    if (!primaryClipId) {
      return;
    }

    this.elementToClip.delete(elementId);
    this.clipToElement.delete(primaryClipId);

    const clip = this.timeline.getState().clips.find((item) => item.id === primaryClipId);
    if (clip?.linkedClipId) {
      this.clipToElement.delete(clip.linkedClipId);
    }
  }

  private unmapClip(clipId: string): void {
    const elementId = this.clipToElement.get(clipId);
    this.clipToElement.delete(clipId);

    if (elementId && this.elementToClip.get(elementId) === clipId) {
      this.elementToClip.delete(elementId);
    }
  }
}

export function bindClipPreviewSync(options: ClipPreviewSyncOptions): {
  dispose: () => void;
  sync: TimelinePreviewSyncer;
} {
  const sync = new TimelinePreviewSyncer(options);
  const unbind = sync.bind();
  return {
    sync,
    dispose: () => {
      unbind();
      sync.destroy();
    },
  };
}
