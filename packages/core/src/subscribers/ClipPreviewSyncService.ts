import type { Clip } from '@opensource/timeline';
import type { Timeline } from '@opensource/timeline';
import type { CanvasElement, CompositionPreview } from '@opensource/video-preview';

export type ClipPreviewSyncSource = 'preview' | 'timeline';

export class ClipPreviewSyncService {
  private source: ClipPreviewSyncSource | null = null;
  private paused = false;
  private readonly elementToClip = new Map<string, string>();
  private readonly clipToElement = new Map<string, string>();

  constructor(
    private readonly timeline: Timeline,
    private readonly preview: CompositionPreview,
  ) {}

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  isPaused(): boolean {
    return this.paused;
  }

  isApplyingFrom(source: ClipPreviewSyncSource): boolean {
    return this.source === source;
  }

  shouldIgnorePreviewOrigin(): boolean {
    return this.paused || this.source === 'timeline';
  }

  shouldIgnoreTimelineOrigin(): boolean {
    return this.paused || this.source === 'preview';
  }

  runAs(source: ClipPreviewSyncSource, fn: () => void): void {
    this.source = source;
    try {
      fn();
    } finally {
      this.source = null;
    }
  }

  destroy(): void {
    this.elementToClip.clear();
    this.clipToElement.clear();
    this.source = null;
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

  getOrphanedClipIds(): string[] {
    const clipIds = new Set(this.timeline.getState().clips.map((clip) => clip.id));
    return [...this.clipToElement.keys()].filter((clipId) => !clipIds.has(clipId));
  }

  register(elementId: string, primaryClipId: string): void {
    this.elementToClip.set(elementId, primaryClipId);
    this.clipToElement.set(primaryClipId, elementId);
  }

  unmapElement(elementId: string): void {
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

  unmapClip(clipId: string): void {
    const elementId = this.clipToElement.get(clipId);
    this.clipToElement.delete(clipId);

    if (elementId && this.elementToClip.get(elementId) === clipId) {
      this.elementToClip.delete(elementId);
    }
  }

  matchesClip(element: CanvasElement, clip: Clip): boolean {
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
}
