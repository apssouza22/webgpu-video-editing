import { CompositionPreview } from '@opensource/video-preview';
import type { TimelineOptions } from '@opensource/timeline';
import { Timeline } from '@opensource/timeline';
import {
  Sidebar,
  mountSidebar,
  type SidebarOptions,
} from '@opensource/sidebar';

import { AnimationFrameLoop, bindEditorPlayback } from './loop';
import {
  bindClipPreviewSync,
  bindExport,
  bindMediaLibraryTimeline,
  bindTranscriptionTimelineCut,
  ClipPreviewSyncService,
} from './subscribers';
import {
  downloadBlob,
  ExportPanel,
  ExportService,
  exportVideoFromPreview,
  type ExportVideoOptions,
  type ExportVideoResult,
} from './export';
import { MediaLibraryPanel, MediaLibraryService } from './mediaLibrary';
import {
  bindTranscription,
  createTranscriptionService,
  TranscriptionService,
  type TranscriptionOptions,
} from './transcription';

import '@opensource/sidebar/style.css';
import '@opensource/timeline/style.css';
import '@opensource/video-preview/style.css';

export interface VideoEditorOptions {
  timeline?: TimelineOptions;
  timelineClassName?: string;
  previewClassName?: string;
  sidebar?: SidebarOptions;
  sidebarClassName?: string;
  /** When true (default), wires export panel and export pipeline. */
  bindExport?: boolean;
  transcription?: TranscriptionOptions;
  /** When true (default), wires transcription panel and service. */
  bindTranscription?: boolean;
}

export interface VideoEditorMount {
  timelineContainer: HTMLElement;
  previewContainer: HTMLElement;
  sidebarContainer?: HTMLElement;
}

/**
 * Wires the timeline transport to the composition canvas preview.
 */
export class VideoEditor {
  readonly timeline: Timeline;
  readonly preview: CompositionPreview;
  readonly mediaLibrary: MediaLibraryService;
  readonly exportService: ExportService | null;
  readonly sidebar: Sidebar | null;
  readonly transcription: TranscriptionService;
  readonly frameLoop: AnimationFrameLoop;
  readonly clipPreviewSync: ClipPreviewSyncService;
  private readonly disposables: Array<() => void> = [];

  constructor(
    { timelineContainer, previewContainer, sidebarContainer }: VideoEditorMount,
    options: VideoEditorOptions = {},
  ) {
    if (options.timelineClassName) {
      timelineContainer.classList.add(...options.timelineClassName.split(/\s+/).filter(Boolean));
    }

    this.timeline = new Timeline(timelineContainer, options.timeline);
    this.preview = new CompositionPreview(previewContainer, {
      className: options.previewClassName,
    });
    this.mediaLibrary = new MediaLibraryService();
    this.exportService = sidebarContainer ? new ExportService(this.preview) : null;
    this.transcription = createTranscriptionService({
      mockTranscription: options.transcription?.mockTranscription ?? false,
      language: options.transcription?.language,
    });

    const clipPreviewBinding = bindClipPreviewSync({ timeline: this.timeline, preview: this.preview });
    this.clipPreviewSync = clipPreviewBinding.sync;
    this.disposables.push(() => clipPreviewBinding.dispose());

    if (sidebarContainer) {
      if (options.sidebarClassName) {
        sidebarContainer.classList.add(...options.sidebarClassName.split(/\s+/).filter(Boolean));
      }
      this.sidebar = new Sidebar(this.preview, {
        ...options.sidebar,
        panelFactories: {
          ...options.sidebar?.panelFactories,
          media: () => new MediaLibraryPanel(this.mediaLibrary).element,
          export: () => new ExportPanel(this.exportService!).element,
          transcription: () => this.transcription.view.element,
        },
      });
      const unmountSidebar = mountSidebar(sidebarContainer, this.sidebar);
      this.disposables.push(unmountSidebar);

      if (options.bindTranscription !== false) {
        this.disposables.push(
          bindTranscription({
            transcription: this.transcription,
            timeline: this.timeline,
            preview: this.preview,
            clipPreviewSync: this.clipPreviewSync,
            sidebar: this.sidebar,
          }),
        );
      }

      this.disposables.push(
        bindMediaLibraryTimeline({
          timeline: this.timeline,
          preview: this.preview,
          mediaLibrary: this.mediaLibrary,
        }).dispose,
      );

      if (options.bindExport !== false && this.exportService) {
        this.disposables.push(
          bindExport({
            exportService: this.exportService,
            exportVideo: (exportOptions) => this.exportVideo(exportOptions),
          }).dispose,
        );
      }

    } else {
      this.sidebar = null;
    }

    this.frameLoop = new AnimationFrameLoop();
    this.disposables.push(
      bindEditorPlayback({
        timeline: this.timeline,
        preview: this.preview,
        frameLoop: this.frameLoop,
      }),
    );
    this.disposables.push(
      bindTranscriptionTimelineCut({
        timeline: this.timeline,
        transcription: this.transcription,
      }),
    );

    if (this.sidebar) {
      this.disposables.push(
        this.sidebar.on('text:add:requested', ({ content, startTime }) => {
          this.timeline.addClip({
            type: 'text',
            name: content.slice(0, 32) || 'Text',
            startTime,
            duration: 5,
            textContent: content,
          });
        }),
      );
    }

  }

  /**
   * Renders the current canvas composition with WebGPU and encodes an MP4 download.
   */
  async exportVideo(options: ExportVideoOptions = {}): Promise<ExportVideoResult> {
    this.timeline.pause();
    this.preview.render(this.preview.getCurrentTime(), { playing: false });

    const result = await exportVideoFromPreview(this.preview, {
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
    this.exportService?.destroy();
    this.sidebar?.destroy();
    this.timeline.destroy();
    this.preview.destroy();
  }
}
