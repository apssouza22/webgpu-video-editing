import type { CompositionCanvasAPI, CanvasElement } from '@opensource/video-canvas';

import { SidebarEventEmitter } from '../event/events';
import type { SidebarEventHandler, SidebarEventName } from './types';
import type {
  ExportSettings,
  MediaLibraryHost,
  MediaLibraryItem,
  SidebarOptions,
  SidebarPanelId,
  TranscriptionResult,
} from './types';

export class Sidebar {
  readonly events = new SidebarEventEmitter();
  private readonly canvas: CompositionCanvasAPI;
  private readonly mediaLibrary: MediaLibraryHost | null;
  private readonly disposables: Array<() => void> = [];
  private activePanel: SidebarPanelId;

  constructor(canvas: CompositionCanvasAPI, options: SidebarOptions = {}) {
    this.canvas = canvas;
    this.mediaLibrary = options.mediaLibrary ?? null;
    this.activePanel = options.initialPanel ?? 'media';
    this.bindCanvas();
  }

  getActivePanel(): SidebarPanelId {
    return this.activePanel;
  }

  setActivePanel(panel: SidebarPanelId): void {
    if (this.activePanel === panel) {
      return;
    }
    this.activePanel = panel;
    this.events.emit('panel:changed', { panel });
  }

  selectElement(id: string | null): void {
    this.canvas.selectElement(id);
  }

  getSelectedElement(): CanvasElement | null {
    return this.canvas.getSelectedElement();
  }

  getSelectedId(): string | null {
    return this.canvas.getSelectedId();
  }

  updateElement(id: string, patch: Partial<CanvasElement>): void {
    this.canvas.updateElement(id, patch);
  }

  updateProperty<K extends keyof CanvasElement>(
    id: string,
    key: K,
    value: CanvasElement[K],
  ): void {
    this.canvas.updateElement(id, { [key]: value } as Partial<CanvasElement>);
  }

  getElement(id: string): CanvasElement | undefined {
    return this.canvas.getElement(id);
  }

  getMediaLibrary(type?: MediaLibraryItem['type']): MediaLibraryItem[] {
    return this.mediaLibrary?.list(type) ?? [];
  }

  requestMediaUpload(
    file: File,
    options: { addToCanvas?: boolean; startTime?: number } = {},
  ): void {
    this.events.emit('media:upload:requested', { file, ...options });
  }

  requestMediaRemove(id: string): void {
    this.events.emit('media:remove:requested', { id });
  }

  selectMediaItem(item: MediaLibraryItem, startTime?: number): void {
    this.events.emit('media:selected', { item, startTime });
  }

  notifyMediaAdded(item: MediaLibraryItem): void {
    this.events.emit('media:added', { item });
  }

  notifyMediaRemoved(id: string): void {
    this.events.emit('media:removed', { id });
  }

  notifyMediaLibraryChanged(): void {
    this.events.emit('media:library:changed', {});
  }

  canManageProject(): boolean {
    return 'showDirectoryPicker' in window;
  }

  requestCreateProject(name: string): void {
    this.events.emit('project:create:requested', { name });
  }

  requestOpenProject(): void {
    this.events.emit('project:open:requested', {});
  }

  setProjectStatus(
    message: string,
    options: { busy?: boolean; projectName?: string; isOpen?: boolean } = {},
  ): void {
    this.events.emit('project:status', {
      message,
      busy: options.busy ?? false,
      projectName: options.projectName,
      isOpen: options.isOpen,
    });
  }

  setProjectAvailability(canManage: boolean): void {
    this.events.emit('project:availability', { canManage });
  }

  canExport(): boolean {
    return this.canvas
      .getElements()
      .some((element) => element.type !== 'audio');
  }

  requestExport(settings: ExportSettings): void {
    this.events.emit('export:requested', { settings });
  }

  setExportStatus(message: string, exporting = false): void {
    this.events.emit('export:status', { message, exporting });
  }

  canTranscribe(): boolean {
    return this.canvas
      .getElements()
      .some((element) => element.type === 'video' || element.type === 'audio');
  }

  requestTranscription(sourceId?: string): void {
    this.events.emit('transcription:requested', { sourceId });
  }

  seekTranscription(timestamp: number, sourceId: string): void {
    this.events.emit('transcription:seek', { timestamp, sourceId });
  }

  removeTranscriptionChunk(startTime: number, endTime: number, sourceId: string): void {
    this.events.emit('transcription:chunk:removed', { startTime, endTime, sourceId });
  }

  requestTranscriptionCaptions(results: TranscriptionResult[]): void {
    this.events.emit('transcription:captions:requested', { results });
  }

  setTranscriptionStatus(message: string, transcribing = false): void {
    this.events.emit('transcription:status', { message, transcribing });
  }

  setTranscriptionResult(result: TranscriptionResult | null): void {
    this.events.emit('transcription:result', { result });
  }

  highlightTranscriptionAt(time: number): void {
    this.events.emit('transcription:highlight', { time });
  }

  addTextToCanvas(content = 'New text', startTime?: number): void {
    this.events.emit('text:add:requested', {
      content,
      startTime: startTime ?? this.canvas.getCurrentTime(),
    });
  }

  on<T extends SidebarEventName>(event: T, handler: SidebarEventHandler<T>): () => void {
    return this.events.on(event, handler);
  }

  off<T extends SidebarEventName>(event: T, handler: SidebarEventHandler<T>): void {
    this.events.off(event, handler);
  }

  destroy(): void {
    for (const unsubscribe of this.disposables) {
      unsubscribe();
    }
    this.disposables.length = 0;
  }

  private bindCanvas(): void {
    let skipNextPropertiesPanel = false;

    this.disposables.push(
      this.canvas.on('element:added', () => {
        skipNextPropertiesPanel = true;
      }),
      this.canvas.on('selection:changed', ({ selectedId, selectedElement }) => {
        this.events.emit('selection:changed', { selectedId, selectedElement });
        if (!selectedElement) {
          return;
        }

        if (skipNextPropertiesPanel) {
          skipNextPropertiesPanel = false;
          return;
        }

        this.activePanel = 'properties';
        this.events.emit('panel:changed', { panel: 'properties' });
      }),
    );

    this.disposables.push(
      this.canvas.on('element:updated', ({ id, patch, element }) => {
        for (const [key, value] of Object.entries(patch)) {
          this.events.emit('property:changed', {
            id,
            key,
            value,
            element,
          });
        }
      }),
    );

    const notifyExportAvailability = (): void => {
      this.events.emit('export:availability', { canExport: this.canExport() });
    };

    const notifyTranscriptionAvailability = (): void => {
      this.events.emit('transcription:availability', { canTranscribe: this.canTranscribe() });
    };

    this.disposables.push(
      this.canvas.on('element:added', () => {
        notifyExportAvailability();
        notifyTranscriptionAvailability();
      }),
      this.canvas.on('element:removed', () => {
        notifyExportAvailability();
        notifyTranscriptionAvailability();
      }),
    );
    notifyExportAvailability();
    notifyTranscriptionAvailability();
  }
}
