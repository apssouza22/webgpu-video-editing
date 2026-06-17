import { CompositionPreview } from '@opensource/video-preview';
import type { TimelineOptions } from '@opensource/timeline';
import { Timeline } from '@opensource/timeline';
import {
  Sidebar,
  mountSidebar,
  type SidebarOptions,
} from '@opensource/sidebar';

import { AnimationFrameLoop, bindEditorPlayback } from './loop';
import { bindClipPreviewSync, TimelinePreviewSyncer } from './glueComponents';
import {
  bindSidebarExport,
  downloadBlob,
  exportVideoFromPreview,
  type ExportVideoOptions,
  type ExportVideoResult,
} from './export';
import { bindMediaLibrary, MediaLibrary, MediaLibraryPanel } from './mediaLibrary';
import {
  bindProjectPersistence,
  type ProjectPersistenceApi,
  type ProjectPersistenceOptions,
} from './project';
import {
  bindTranscription,
  TranscriptionPanel,
  TranscriptionService,
  TranscriptionWorkspace,
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
  /** When true (default), handles `export:requested` from the sidebar. */
  bindSidebarExport?: boolean;
  transcription?: TranscriptionOptions;
  /** When true (default), wires transcription panel and service. */
  bindTranscription?: boolean;
  project?: ProjectPersistenceOptions;
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
  readonly mediaLibrary: MediaLibrary;
  readonly sidebar: Sidebar | null;
  readonly transcription: TranscriptionService;
  readonly transcriptionWorkspace: TranscriptionWorkspace;
  readonly frameLoop: AnimationFrameLoop;
  readonly clipPreviewSync: TimelinePreviewSyncer;
  projectPersistence?: ProjectPersistenceApi;
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
    this.mediaLibrary = new MediaLibrary();
    this.transcription = new TranscriptionService({
      mockTranscription: options.transcription?.mockTranscription ?? false,
      language: options.transcription?.language,
    });
    this.transcriptionWorkspace = new TranscriptionWorkspace();

    if (sidebarContainer) {
      if (options.sidebarClassName) {
        sidebarContainer.classList.add(...options.sidebarClassName.split(/\s+/).filter(Boolean));
      }
      this.sidebar = new Sidebar(this.preview, {
        ...options.sidebar,
        panelFactories: {
          ...options.sidebar?.panelFactories,
          media: () => new MediaLibraryPanel(this.mediaLibrary).element,
          transcription: () => new TranscriptionPanel(this.transcriptionWorkspace).element,
        },
      });
      const unmountSidebar = mountSidebar(sidebarContainer, this.sidebar);
      this.disposables.push(unmountSidebar);

      if (options.bindTranscription !== false) {
        this.disposables.push(
          bindTranscription({
            workspace: this.transcriptionWorkspace,
            timeline: this.timeline,
            preview: this.preview,
            transcription: this.transcription,
            sidebar: this.sidebar,
          }),
        );
      }

      this.disposables.push(
        bindMediaLibrary({
          timeline: this.timeline,
          preview: this.preview,
          mediaLibrary: this.mediaLibrary,
          importUploadedFile: async (file) => {
            const persistence = this.projectPersistence;
            if (!persistence?.session.isOpen() || persistence.session.isBusy()) {
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

    } else {
      this.sidebar = null;
    }

    this.frameLoop = new AnimationFrameLoop();
    const clipPreviewBinding = bindClipPreviewSync({ timeline: this.timeline, preview: this.preview });
    this.clipPreviewSync = clipPreviewBinding.sync;
    this.disposables.push(
      bindEditorPlayback({
        timeline: this.timeline,
        preview: this.preview,
        frameLoop: this.frameLoop,
      }),
    );
    this.disposables.push(() => clipPreviewBinding.dispose());

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

    if (options.project) {
      this.disposables.push(
        bindProjectPersistence({
          editor: this,
          clipPreviewSync: this.clipPreviewSync,
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
    this.sidebar?.destroy();
    this.timeline.destroy();
    this.preview.destroy();
  }
}
