import { CompositionCanvas } from '@opensource/video-canvas';
import type { TimelineOptions } from '@opensource/timeline';
import { Timeline } from '@opensource/timeline';

import '@opensource/timeline/style.css';
import '@opensource/video-canvas/style.css';

export interface VideoEditorOptions {
  timeline?: TimelineOptions;
  timelineClassName?: string;
  canvasClassName?: string;
}

export interface VideoEditorMount {
  timelineContainer: HTMLElement;
  canvasContainer: HTMLElement;
}

/**
 * Wires the timeline transport to the composition canvas preview.
 */
export class VideoEditor {
  readonly timeline: Timeline;
  readonly canvas: CompositionCanvas;
  private readonly disposables: Array<() => void> = [];

  constructor({ timelineContainer, canvasContainer }: VideoEditorMount, options: VideoEditorOptions = {}) {
    if (options.timelineClassName) {
      timelineContainer.classList.add(...options.timelineClassName.split(/\s+/).filter(Boolean));
    }

    this.timeline = new Timeline(timelineContainer, options.timeline);
    this.canvas = new CompositionCanvas(canvasContainer, {
      className: options.canvasClassName,
    });

    this.bindPlayback();
  }

  private bindPlayback(): void {
    const syncCanvas = ({ time }: { time: number }) => {
      this.canvas.render(time);
    };

    this.timeline.on('playhead:change', syncCanvas);
    this.disposables.push(() => this.timeline.off('playhead:change', syncCanvas));

    this.canvas.render(this.timeline.getPlayhead());
  }

  destroy(): void {
    for (const unsubscribe of this.disposables) {
      unsubscribe();
    }
    this.disposables.length = 0;
    this.timeline.destroy();
    this.canvas.destroy();
  }
}

export { Timeline } from '@opensource/timeline';
export type { TimelineOptions, TimelineState } from '@opensource/timeline';
export { CompositionCanvas } from '@opensource/video-canvas';
export type { CompositionCanvasOptions } from '@opensource/video-canvas';
