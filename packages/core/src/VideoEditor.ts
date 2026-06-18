import { CompositionPreview } from '@opensource/video-preview';
import type { TimelineOptions } from '@opensource/timeline';
import { Timeline } from '@opensource/timeline';

import { LeftNav, mountLeftNav, type LeftNavOptions } from './leftnav';
import { AnimationFrameLoop, bindEditorPlayback } from './loop';
import {
  bindClipPreviewSync,
  bindExport,
  bindMediaLibraryTimeline,
  bindTranscription,
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
  createTranscriptionService,
  TranscriptionService,
  type TranscriptionOptions,
} from './transcription';

import './leftnav/leftnav.css';
import '@opensource/timeline/style.css';
import '@opensource/video-preview/style.css';

export interface VideoEditorOptions {
  timeline?: TimelineOptions;
  timelineClassName?: string;
  previewClassName?: string;
  leftNav?: LeftNavOptions;
  leftNavClassName?: string;
  /** When true (default), wires export panel and export pipeline. */
  bindExport?: boolean;
  transcription?: TranscriptionOptions;
  /** When true (default), wires transcription panel and service. */
  bindTranscription?: boolean;
}

export interface VideoEditorMount {
  timelineContainer: HTMLElement;
  previewContainer: HTMLElement;
  leftNavContainer?: HTMLElement;
}

/**
 * Wires the timeline transport to the composition canvas preview.
 */
export class VideoEditor {
  readonly timeline: Timeline;
  readonly preview: CompositionPreview;
  readonly mediaLibrary: MediaLibraryService;
  readonly exportService: ExportService | null;
  readonly leftNav: LeftNav | null;
  readonly transcription: TranscriptionService;
  readonly frameLoop: AnimationFrameLoop;
  readonly clipPreviewSync: ClipPreviewSyncService;
  private readonly disposables: Array<() => void> = [];

  constructor(
    { timelineContainer, previewContainer, leftNavContainer }: VideoEditorMount,
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
    this.exportService = leftNavContainer ? new ExportService(this.preview) : null;
    this.transcription = createTranscriptionService({
      mockTranscription: options.transcription?.mockTranscription ?? false,
      language: options.transcription?.language,
    });

    const clipPreviewBinding = bindClipPreviewSync({ timeline: this.timeline, preview: this.preview });
    this.clipPreviewSync = clipPreviewBinding.sync;
    this.disposables.push(() => clipPreviewBinding.dispose());

    if (leftNavContainer) {
      if (options.leftNavClassName) {
        leftNavContainer.classList.add(...options.leftNavClassName.split(/\s+/).filter(Boolean));
      }
      this.leftNav = new LeftNav(this.preview, {
        ...options.leftNav,
        panelFactories: {
          ...options.leftNav?.panelFactories,
          media: () => new MediaLibraryPanel(this.mediaLibrary).element,
          export: () => new ExportPanel(this.exportService!).element,
          transcription: () => this.transcription.view.element,
        },
      });
      const unmountLeftNav = mountLeftNav(leftNavContainer, this.leftNav);
      this.disposables.push(unmountLeftNav);

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
      this.leftNav = null;
    }

    this.frameLoop = new AnimationFrameLoop();
    this.disposables.push(
      bindEditorPlayback({
        timeline: this.timeline,
        preview: this.preview,
        frameLoop: this.frameLoop,
      }),
    );
    if (options.bindTranscription !== false) {
      this.disposables.push(
        bindTranscription({
          transcription: this.transcription,
          timeline: this.timeline,
          preview: this.preview,
          clipPreviewSync: this.clipPreviewSync,
          leftNav: this.leftNav,
        }).dispose,
      );
    }

    if (this.leftNav) {
      this.disposables.push(
        this.leftNav.on('text:add:requested', ({ content, startTime }) => {
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
    this.leftNav?.destroy();
    this.timeline.destroy();
    this.preview.destroy();
  }
}
