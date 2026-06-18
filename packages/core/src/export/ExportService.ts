import type { CompositionPreviewAPI } from '@opensource/video-preview';

import { ExportEventEmitter } from './events';
import type { ExportEventHandler, ExportEventName, ExportSettings } from './events';

export class ExportService {
  readonly events = new ExportEventEmitter();
  private readonly preview: CompositionPreviewAPI;
  private readonly disposables: Array<() => void> = [];

  constructor(preview: CompositionPreviewAPI) {
    this.preview = preview;
    this.bindPreview();
  }

  canExport(): boolean {
    return this.preview
      .getElements()
      .some((element) => element.type !== 'audio');
  }

  requestExport(settings: ExportSettings): void {
    this.events.emit('export:requested', { settings });
  }

  setExportStatus(message: string, exporting = false): void {
    this.events.emit('export:status', { message, exporting });
  }

  on<T extends ExportEventName>(event: T, handler: ExportEventHandler<T>): () => void {
    return this.events.on(event, handler);
  }

  off<T extends ExportEventName>(event: T, handler: ExportEventHandler<T>): void {
    this.events.off(event, handler);
  }

  destroy(): void {
    for (const unsubscribe of this.disposables) {
      unsubscribe();
    }
    this.disposables.length = 0;
  }

  private bindPreview(): void {
    const notifyExportAvailability = (): void => {
      this.events.emit('export:availability', { canExport: this.canExport() });
    };

    this.disposables.push(
      this.preview.on('element:added', notifyExportAvailability),
      this.preview.on('element:removed', notifyExportAvailability),
    );
    notifyExportAvailability();
  }
}
