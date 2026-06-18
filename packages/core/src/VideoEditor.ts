import {CompositionPreview} from '@opensource/video-preview';
import type {TimelineOptions} from '@opensource/timeline';
import {Timeline} from '@opensource/timeline';

import {LeftNav, type LeftNavOptions, mountLeftNav} from './leftnav';
import {AnimationFrameLoop, bindEditorPlayback} from './loop';
import {bindComponents} from './subscribers';
import {ExportPanel, ExportService,} from './export';
import {MediaLibraryPanel, MediaLibraryService} from './mediaLibrary';
import {createTranscriptionService, type TranscriptionOptions, TranscriptionService,} from './transcription';

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
  leftNavContainer: HTMLElement;
}

/**
 * Wires the timeline transport to the composition canvas preview.
 */
export class VideoEditor {
  readonly timeline: Timeline;
  readonly preview: CompositionPreview;
  readonly mediaLibrary: MediaLibraryService;
  readonly exportService: ExportService;
  readonly leftNav: LeftNav;
  readonly transcription: TranscriptionService;
  readonly frameLoop: AnimationFrameLoop;

  constructor(
      {timelineContainer, previewContainer, leftNavContainer}: VideoEditorMount,
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
    this.exportService = new ExportService(this.preview);
    this.frameLoop = new AnimationFrameLoop();

    this.transcription = createTranscriptionService({
      mockTranscription: options.transcription?.mockTranscription ?? false,
      language: options.transcription?.language,
    });

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
    mountLeftNav(leftNavContainer, this.leftNav);
    this.bindComponents();

    this.leftNav.on('text:add:requested', ({content, startTime}) => {
      this.timeline.addClip({
        type: 'text',
        name: content.slice(0, 32) || 'Text',
        startTime,
        duration: 5,
        textContent: content,
      });
    });

  }

  private bindComponents() {
    bindComponents(
        this.timeline,
        this.preview,
        this.leftNav,
        this.transcription,
        this.mediaLibrary,
        this.exportService,
    );
    bindEditorPlayback({
      timeline: this.timeline,
      preview: this.preview,
      frameLoop: this.frameLoop,
    });
  }
}
