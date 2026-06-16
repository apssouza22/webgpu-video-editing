import { CompositionCanvas } from '@opensource/video-canvas';
import type { TimelineOptions } from '@opensource/timeline';
import { Timeline } from '@opensource/timeline';
import {
  Sidebar,
  mountSidebar,
  type SidebarOptions,
} from '@opensource/sidebar';

import { AnimationFrameLoop } from './animationFrameLoop';
import { bindClipCanvasSync, ClipCanvasSync } from './clipCanvasSync';
import { bindEditorPlayback } from './editorPlayback';
import {
  bindSidebarExport,
  downloadBlob,
  exportVideoFromCanvas,
  type ExportVideoOptions,
  type ExportVideoResult,
} from './export';
import { bindSidebarMediaLibrary, MediaLibrary } from './mediaLibrary';
import {
  bindProjectPersistence,
  type ProjectPersistenceApi,
  type ProjectPersistenceOptions,
} from './project';
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
  project?: ProjectPersistenceOptions;
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
  readonly mediaLibrary: MediaLibrary;
  readonly sidebar: Sidebar | null;
  readonly transcription: TranscriptionService;
  readonly frameLoop: AnimationFrameLoop;
  readonly clipCanvasSync: ClipCanvasSync;
  projectPersistence?: ProjectPersistenceApi;
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
    this.mediaLibrary = new MediaLibrary();
    this.transcription = new TranscriptionService({
      mockTranscription: options.transcription?.mockTranscription ?? false,
      language: options.transcription?.language,
    });

    if (sidebarContainer) {
      if (options.sidebarClassName) {
        sidebarContainer.classList.add(...options.sidebarClassName.split(/\s+/).filter(Boolean));
      }
      this.sidebar = new Sidebar(this.canvas, {
        ...options.sidebar,
        mediaLibrary: this.mediaLibrary,
      });
      const unmountSidebar = mountSidebar(sidebarContainer, this.sidebar);
      this.disposables.push(unmountSidebar);

      this.disposables.push(
        bindSidebarMediaLibrary({
          sidebar: this.sidebar,
          canvas: this.canvas,
          mediaLibrary: this.mediaLibrary,
          importUploadedFile: async (file) => {
            const persistence = this.projectPersistence;
            if (!persistence?.session.isOpen()) {
              return null;
            }
            return persistence.importUploadedFile(file);
          },
        }),
      );

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
    const clipCanvasBinding = bindClipCanvasSync({ timeline: this.timeline, canvas: this.canvas });
    this.clipCanvasSync = clipCanvasBinding.sync;
    this.disposables.push(
      bindEditorPlayback({
        timeline: this.timeline,
        canvas: this.canvas,
        frameLoop: this.frameLoop,
      }),
    );
    this.disposables.push(() => clipCanvasBinding.dispose());

    if (options.project) {
      this.disposables.push(
        bindProjectPersistence({
          editor: this,
          clipCanvasSync: this.clipCanvasSync,
          ...options.project,
        }),
      );
    }
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
    this.mediaLibrary.destroy();
    this.sidebar?.destroy();
    this.timeline.destroy();
    this.canvas.destroy();
  }
}
