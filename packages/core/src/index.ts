import { CompositionCanvas } from '@opensource/video-canvas';
import type { TimelineOptions } from '@opensource/timeline';
import { Timeline } from '@opensource/timeline';
import {
  Sidebar,
  mountSidebar,
  type SidebarOptions,
} from '@opensource/sidebar';
import { AnimationFrameLoop } from './animationFrameLoop';
import { bindClipCanvasSync } from './clipCanvasSync';
import { bindEditorPlayback } from './editorPlayback';

import '@opensource/sidebar/style.css';
import '@opensource/timeline/style.css';
import '@opensource/video-canvas/style.css';

export interface VideoEditorOptions {
  timeline?: TimelineOptions;
  timelineClassName?: string;
  canvasClassName?: string;
  sidebar?: SidebarOptions;
  sidebarClassName?: string;
}

export interface VideoEditorMount {
  timelineContainer: HTMLElement;
  canvasContainer: HTMLElement;
  sidebarContainer?: HTMLElement;
}

/**
 * Wires the timeline transport to the composition canvas preview.
 */
export class VideoEditor {
  readonly timeline: Timeline;
  readonly canvas: CompositionCanvas;
  readonly sidebar: Sidebar | null;
  readonly frameLoop: AnimationFrameLoop;
  private readonly disposables: Array<() => void> = [];

  constructor(
    { timelineContainer, canvasContainer, sidebarContainer }: VideoEditorMount,
    options: VideoEditorOptions = {},
  ) {
    if (options.timelineClassName) {
      timelineContainer.classList.add(...options.timelineClassName.split(/\s+/).filter(Boolean));
    }

    this.timeline = new Timeline(timelineContainer, options.timeline);
    this.canvas = new CompositionCanvas(canvasContainer, {
      className: options.canvasClassName,
    });

    if (sidebarContainer) {
      if (options.sidebarClassName) {
        sidebarContainer.classList.add(...options.sidebarClassName.split(/\s+/).filter(Boolean));
      }
      this.sidebar = new Sidebar(this.canvas, options.sidebar);
      const unmountSidebar = mountSidebar(sidebarContainer, this.sidebar);
      this.disposables.push(unmountSidebar);
    } else {
      this.sidebar = null;
    }

    this.frameLoop = new AnimationFrameLoop();
    this.disposables.push(
      bindEditorPlayback({
        timeline: this.timeline,
        canvas: this.canvas,
        frameLoop: this.frameLoop,
      }),
    );
    this.disposables.push(bindClipCanvasSync({ timeline: this.timeline, canvas: this.canvas }));
  }

  destroy(): void {
    for (const unsubscribe of this.disposables) {
      unsubscribe();
    }
    this.disposables.length = 0;
    this.frameLoop.destroy();
    this.sidebar?.destroy();
    this.timeline.destroy();
    this.canvas.destroy();
  }
}

export { Timeline } from '@opensource/timeline';
export type { TimelineOptions, TimelineState } from '@opensource/timeline';
export { CompositionCanvas } from '@opensource/video-canvas';
export type { CompositionCanvasOptions } from '@opensource/video-canvas';
export {
  bindClipCanvasSync,
  ClipCanvasSync,
  canvasElementToAddClipInput,
  getTimelineClipZIndex,
  timelineClipToCompositionClip,
} from './clipCanvasSync';
export type { ClipCanvasSyncOptions } from './clipCanvasSync';
export {
  AnimationFrameLoop,
  type AnimationFrameLoopOptions,
  type FrameCallback,
  type FrameContext,
} from './animationFrameLoop';
export { bindEditorPlayback, type EditorPlaybackOptions } from './editorPlayback';
export {
  Sidebar,
  mountSidebar,
  SidebarEventEmitter,
  SidebarView,
} from '@opensource/sidebar';
export type {
  SidebarOptions,
  SidebarEventMap,
  SidebarEventName,
  SidebarEventHandler,
  MediaLibraryItem,
  SidebarPanelId,
} from '@opensource/sidebar';
