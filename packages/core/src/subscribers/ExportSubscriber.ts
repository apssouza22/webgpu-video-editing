import type { ExportService } from '../export/ExportService';
import type { ExportVideoOptions } from '../export/exportOptions';
import type { ExportVideoResult } from '../export/exportVideo';

export interface ExportSubscriberOptions {
  exportService: ExportService;
  exportVideo: (options: ExportVideoOptions) => Promise<ExportVideoResult>;
}

export class ExportSubscriber {
  private readonly exportService: ExportService;
  private readonly exportVideo: (options: ExportVideoOptions) => Promise<ExportVideoResult>;
  private readonly disposables: Array<() => void> = [];

  constructor({ exportService, exportVideo }: ExportSubscriberOptions) {
    this.exportService = exportService;
    this.exportVideo = exportVideo;
  }

  bind(): () => void {
    this.disposables.push(
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
      }),
    );

    return () => this.destroy();
  }

  destroy(): void {
    while (this.disposables.length > 0) {
      this.disposables.pop()?.();
    }
  }
}

export function bindExport(options: ExportSubscriberOptions): {
  dispose: () => void;
  subscriber: ExportSubscriber;
} {
  const subscriber = new ExportSubscriber(options);
  const unbind = subscriber.bind();
  return {
    subscriber,
    dispose: () => {
      unbind();
      subscriber.destroy();
    },
  };
}
