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
import {
  bindSidebarExport,
  downloadBlob,
  exportVideoFromCanvas,
  type ExportVideoOptions,
  type ExportVideoResult,
} from './export';
import {
  bindSidebarTranscription,
  TranscriptionService,
  type TranscriptionOptions,
} from './transcription';

import '@opensource/sidebar/style.css';
import '@opensource/timeline/style.css';
import '@opensource/video-canvas/style.css';

export interface VideoEditorOptions {
  timeline?: TimelineOptions;
  timelineClassName?: string;
  canvasClassName?: string;
  sidebar?: SidebarOptions;
  sidebarClassName?: string;
  /** When true (default), handles `export:requested` from the sidebar. */
  bindSidebarExport?: boolean;
  transcription?: TranscriptionOptions;
  /** When true (default), handles sidebar transcription events. */
  bindSidebarTranscription?: boolean;
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
  readonly transcription: TranscriptionService;
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
    this.transcription = new TranscriptionService({
      mockTranscription: options.transcription?.mockTranscription ?? false,
      language: options.transcription?.language,
    });

    if (sidebarContainer) {
      if (options.sidebarClassName) {
        sidebarContainer.classList.add(...options.sidebarClassName.split(/\s+/).filter(Boolean));
      }
      this.sidebar = new Sidebar(this.canvas, options.sidebar);
      const unmountSidebar = mountSidebar(sidebarContainer, this.sidebar);
      this.disposables.push(unmountSidebar);

      if (options.bindSidebarExport !== false) {
        this.disposables.push(
          bindSidebarExport({
            sidebar: this.sidebar,
            exportVideo: (exportOptions) => this.exportVideo(exportOptions),
          }),
        );
      }

      if (options.bindSidebarTranscription !== false) {
        this.disposables.push(
          bindSidebarTranscription({
            sidebar: this.sidebar,
            timeline: this.timeline,
            canvas: this.canvas,
            transcription: this.transcription,
          }),
        );
      }
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

  /**
   * Renders the current canvas composition with WebGPU and encodes an MP4 download.
   */
  async exportVideo(options: ExportVideoOptions = {}): Promise<ExportVideoResult> {
    this.timeline.pause();
    this.canvas.render(this.canvas.getCurrentTime(), { playing: false });

    const result = await exportVideoFromCanvas(this.canvas, {
      ...options,
      playbackRate: options.playbackRate ?? this.timeline.getPlaybackRate(),
    });
    downloadBlob(result.blob, result.filename);
    return result;
  }

  destroy(): void {
    for (const unsubscribe of this.disposables) {
      unsubscribe();
    }
    this.disposables.length = 0;
    this.frameLoop.destroy();
    this.transcription.destroy();
    this.sidebar?.destroy();
    this.timeline.destroy();
    this.canvas.destroy();
  }
}
