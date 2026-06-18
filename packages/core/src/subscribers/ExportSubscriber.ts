import type { CompositionPreview } from '@opensource/video-preview';
import type { Timeline } from '@opensource/timeline';

import type { ExportService } from '../export/ExportService';
import { downloadBlob, exportVideoFromPreview } from '../export';
import type { ExportVideoOptions } from '../export/exportOptions';
import type { ExportVideoResult } from '../export/exportVideo';

export interface ExportSubscriberOptions {
  exportService: ExportService;
  timeline: Timeline;
  preview: CompositionPreview;
}

export class ExportSubscriber {
  private readonly exportService: ExportService;
  private readonly timeline: Timeline;
  private readonly preview: CompositionPreview;

  constructor({ exportService, timeline, preview }: ExportSubscriberOptions) {
    this.exportService = exportService;
    this.timeline = timeline;
    this.preview = preview;
  }

  /**
   * Renders the current canvas composition with WebGPU and encodes an MP4 download.
   */
  async exportVideo(options: ExportVideoOptions = {}): Promise<ExportVideoResult> {
    this.timeline.pause();
    this.preview.render(this.preview.getCurrentTime(), {playing: false});

    const result = await exportVideoFromPreview(this.preview, {
      ...options,
      playbackRate: options.playbackRate ?? this.timeline.getPlaybackRate(),
    });
    downloadBlob(result.blob, result.filename);
    return result;
  }

  bind(): void {
    this.exportService.on('export:requested', async ({ settings }) => {
      this.exportService.setExportStatus('Starting GPU export (WebCodecs + MediaBunny)…', true);

      try {
        const result = await this.exportVideo({
          ...settings,
          onProgress: (progress) => {
            this.exportService.setExportStatus(
              `[${progress.phase}] ${progress.percent.toFixed(1)}% — ${progress.message}`,
              true,
            );
          },
        });

        const speedLabel = result.settings.playbackRate === 1 ? '' : ` @ ${result.settings.playbackRate}x`;
        this.exportService.setExportStatus(
          `Export complete (${result.settings.width}×${result.settings.height} @ ${result.settings.fps}fps${speedLabel}). Download started.`,
          false,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.exportService.setExportStatus(`Export failed: ${message}`, false);
        console.error(error);
      }
    });
  }
}

export function bindExport(options: ExportSubscriberOptions): void {
  const subscriber = new ExportSubscriber(options);
  subscriber.bind();
}
