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
      this.timeline.on('clip:drag:end', (payload) => this.onTimelineClipMoved(payload)),
      this.timeline.on('clip:trim', (payload) => this.onTimelineClipTrimmed(payload)),
      this.timeline.on('clip:select', (payload) => this.onTimelineClipSelect(payload.primaryId)),
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
        this.register(this.pendingElementId, primary.id, linkedAudio?.id);
      }
      return;
    }

    this.source = 'timeline';
    try {
      for (const clip of clips) {
        if (isLinkedAudioCompanion(clip, clips)) {
          const videoClip = clips.find((candidate) => candidate.id === clip.linkedClipId);
          if (videoClip) {
            const elementId = this.clipToElement.get(videoClip.id);
            if (elementId) {
              this.clipToElement.set(clip.id, elementId);
            }
          }
          continue;
        }

        if (this.clipToElement.has(clip.id)) {
          continue;
        }

        this.canvas.addLayer(timelineClipToCompositionClip(clip));
        const element = this.canvas.getElements().at(-1);
        if (element) {
          this.register(element.id, clip.id, clip.linkedClipId);
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
    startTime,
  }: {
    clipId: string;
    startTime: number;
  }): void {
    const elementId = this.clipToElement.get(clipId);
    if (!elementId || this.elementToClip.get(elementId) !== clipId) {
      return;
    }

    this.source = 'timeline';
    try {
      this.canvas.updateElement(elementId, { startTime });
    } finally {
      this.source = null;
    }
  }

  private onTimelineClipTrimmed({
    clipId,
    startTime,
    duration,
  }: {
    clipId: string;
    startTime: number;
    duration: number;
  }): void {
    const elementId = this.clipToElement.get(clipId);
    if (!elementId || this.elementToClip.get(elementId) !== clipId) {
      return;
    }

    this.source = 'timeline';
    try {
      this.canvas.updateElement(elementId, { startTime, duration });
    } finally {
      this.source = null;
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

  private register(elementId: string, primaryClipId: string, linkedClipId?: string): void {
    this.elementToClip.set(elementId, primaryClipId);
    this.clipToElement.set(primaryClipId, elementId);
    if (linkedClipId) {
      this.clipToElement.set(linkedClipId, elementId);
    }
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
