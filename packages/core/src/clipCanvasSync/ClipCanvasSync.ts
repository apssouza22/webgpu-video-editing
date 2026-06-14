import {
  cloneState,
  computeDuration,
  moveClip,
  selectClip,
  type Timeline,
} from '@opensource/timeline';
import type { Clip } from '@opensource/timeline';
import type { CompositionCanvas, CanvasElement } from '@opensource/video-canvas';

import {
  canvasElementToAddClipInput,
  getTimelineClipZIndex,
  isLinkedAudioCompanion,
  timelineClipToCompositionClip,
} from './converters';

type SyncSource = 'canvas' | 'timeline';

export interface ClipCanvasSyncOptions {
  timeline: Timeline;
  canvas: CompositionCanvas;
}

export class ClipCanvasSync {
  private readonly timeline: Timeline;
  private readonly canvas: CompositionCanvas;
  private readonly disposables: Array<() => void> = [];
  private source: SyncSource | null = null;
  private pendingElementId: string | null = null;
  private readonly elementToClip = new Map<string, string>();
  private readonly clipToElement = new Map<string, string>();

  constructor({ timeline, canvas }: ClipCanvasSyncOptions) {
    this.timeline = timeline;
    this.canvas = canvas;
  }

  bind(): () => void {
    this.disposables.push(
      this.canvas.on('element:added', (payload) => this.onCanvasElementAdded(payload.element)),
      this.canvas.on('element:removed', (payload) => this.onCanvasElementRemoved(payload.id)),
      this.canvas.on('element:updated', (payload) => this.onCanvasElementUpdated(payload)),
      this.canvas.on('selection:changed', (payload) => this.onCanvasSelectionChanged(payload.selectedId)),
      this.timeline.on('clip:add', (payload) => this.onTimelineClipAdd(payload.clips)),
      this.timeline.on('clip:remove', (payload) => this.onTimelineClipRemove(payload.clipIds)),
      this.timeline.on('clip:drag', (payload) => this.onTimelineClipMoved(payload)),
      this.timeline.on('clip:drag:end', (payload) => this.onTimelineClipMoved(payload)),
      this.timeline.on('clip:trim', (payload) => this.onTimelineClipTrimmed(payload)),
      this.timeline.on('clip:split', (payload) => this.onTimelineClipSplit(payload)),
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
    this.pendingElementId = null;
    this.source = null;
  }

  private onCanvasElementAdded(element: CanvasElement): void {
    if (this.source === 'timeline') {
      return;
    }

    this.pendingElementId = element.id;
    this.source = 'canvas';

    try {
      this.timeline.addClip(canvasElementToAddClipInput(element));
    } finally {
      this.pendingElementId = null;
      this.source = null;
    }
  }

  private onCanvasElementRemoved(elementId: string): void {
    if (this.source === 'timeline') {
      return;
    }

    const clipId = this.elementToClip.get(elementId);
    if (!clipId) {
      return;
    }

    this.source = 'canvas';
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
    if (this.source === 'timeline') {
      return;
    }

    if (patch.startTime === undefined && patch.duration === undefined) {
      return;
    }

    this.updateTimelineTiming(id, patch);
  }

  private onCanvasSelectionChanged(selectedId: string | null): void {
    if (this.source === 'timeline') {
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

    this.source = 'canvas';
    try {
      this.timeline.loadState(state);
    } finally {
      this.source = null;
    }
  }

  private onTimelineClipAdd(clips: Clip[]): void {
    if (this.source === 'canvas') {
      if (this.pendingElementId && clips.length > 0) {
        const primary = clips.find((clip) => !isLinkedAudioCompanion(clip, clips)) ?? clips[0];
        const linkedAudio = clips.find(
          (clip) => clip.type === 'audio' && clip.linkedClipId === primary.id,
        );
        this.applyClipTimingToCanvas(primary, this.pendingElementId);
        this.register(this.pendingElementId, primary.id);

        if (linkedAudio) {
          this.canvas.updateElement(this.pendingElementId, { muted: true });
          this.source = 'timeline';
          this.canvas.addLayer(timelineClipToCompositionClip(linkedAudio));
          const audioElement = this.canvas.getElements().at(-1);
          if (audioElement) {
            this.register(audioElement.id, linkedAudio.id);
          }
        }
      }
      return;
    }

    this.source = 'timeline';
    try {
      for (const clip of clips) {
        if (isLinkedAudioCompanion(clip, clips)) {
          if (this.clipToElement.has(clip.id)) {
            continue;
          }

          this.canvas.addLayer(timelineClipToCompositionClip(clip));
          const element = this.canvas.getElements().at(-1);
          if (element) {
            this.register(element.id, clip.id);
          }
          continue;
        }

        if (this.clipToElement.has(clip.id)) {
          continue;
        }

        this.canvas.addLayer(timelineClipToCompositionClip(clip));
        const element = this.canvas.getElements().at(-1);
        if (element) {
          this.register(element.id, clip.id);
        }
      }
    } finally {
      this.source = null;
    }
  }

  private onTimelineClipRemove(clipIds: string[]): void {
    if (this.source === 'canvas') {
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

        this.canvas.removeElement(elementId);
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
    this.syncTimelineClipsToCanvas([clipId, linkedClipId]);
  }

  private onTimelineClipTrimmed({ clipId }: { clipId: string }): void {
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
    if (this.source === 'canvas') {
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

  private onTimelineClipSelect(primaryId: string | null): void {
    if (this.source === 'canvas') {
      return;
    }

    const elementId = primaryId ? this.clipToElement.get(primaryId) ?? null : null;
    if (elementId === this.canvas.getSelectedId()) {
      return;
    }

    this.source = 'timeline';
    try {
      this.canvas.selectElement(elementId);
    } finally {
      this.source = null;
    }
  }

  private syncTimelineClipsToCanvas(clipIds: Array<string | undefined>): void {
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

    this.canvas.addLayer(timelineClipToCompositionClip(clip));
    const element = this.canvas.getElements().at(-1);
    if (element) {
      this.register(element.id, clip.id);
    }
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

    this.canvas.updateElement(targetId, {
      startTime: clip.startTime,
      duration: clip.duration,
      sourceOffset: clip.inPoint,
      zIndex: getTimelineClipZIndex(clip, this.timeline.getState().tracks),
    });
  }

  private syncAllZIndicesFromTimeline(): void {
    if (this.source === 'canvas') {
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

        this.canvas.updateElement(elementId, {
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

    this.canvas.render(this.canvas.getCurrentTime(), { playing: false });
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

    this.source = 'canvas';
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

export function bindClipCanvasSync(options: ClipCanvasSyncOptions): () => void {
  const sync = new ClipCanvasSync(options);
  return sync.bind();
}
