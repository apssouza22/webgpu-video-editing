import {
  AudioClip,
  ImageClip,
  TextClip,
  VideoClip,
  type CompositionCanvasAPI,
  type CanvasElement,
} from '@opensource/video-canvas';

import { SidebarEventEmitter } from '../event/events';
import type { SidebarEventHandler, SidebarEventName } from './types';
import { createStockMedia, MediaLibrary } from './mediaLibrary';
import type {
  AddMediaFromFileOptions,
  ExportSettings,
  MediaLibraryItem,
  SidebarOptions,
  SidebarPanelId,
} from './types';

export class Sidebar {
  readonly events = new SidebarEventEmitter();
  private readonly canvas: CompositionCanvasAPI;
  private readonly library: MediaLibrary;
  private readonly disposables: Array<() => void> = [];
  private activePanel: SidebarPanelId;

  constructor(canvas: CompositionCanvasAPI, options: SidebarOptions = {}) {
    this.canvas = canvas;
    this.library = new MediaLibrary(options.stockMedia ?? createStockMedia());
    this.activePanel = options.initialPanel ?? 'video';
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
    return this.library.list(type);
  }

  addMediaItem(item: Omit<MediaLibraryItem, 'id' | 'createdAt'>): MediaLibraryItem {
    const entry = this.library.add(item);
    this.events.emit('media:added', { item: entry });
    return entry;
  }

  removeMediaItem(id: string): MediaLibraryItem | undefined {
    const item = this.library.remove(id);
    if (item) {
      this.events.emit('media:removed', { id });
    }
    return item;
  }

  addMediaFromFile(
    file: File,
    options: AddMediaFromFileOptions = {},
  ): MediaLibraryItem {
    const item = this.library.addFromFile(file);
    this.events.emit('media:added', { item });

    if (options.addToCanvas !== false) {
      this.addMediaToCanvas(item, options.startTime);
    }

    return item;
  }

  selectMediaItem(item: MediaLibraryItem): void {
    this.events.emit('media:selected', { item });
    this.addMediaToCanvas(item);
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

  addTextToCanvas(content = 'New text', startTime?: number): void {
    const clip = new TextClip(content, startTime ?? this.canvas.getCurrentTime());
    this.canvas.addLayer(clip);
  }

  addMediaToCanvas(item: MediaLibraryItem, startTime?: number): void {
    const at = startTime ?? this.canvas.getCurrentTime();

    if (item.type === 'video') {
      this.canvas.addLayer(new VideoClip(item.src, at));
      return;
    }

    if (item.type === 'image') {
      this.canvas.addLayer(new ImageClip(item.src, at));
      return;
    }

    this.canvas.addLayer(new AudioClip(item.src, at));
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
    this.library.destroy();
  }

  private bindCanvas(): void {
    this.disposables.push(
      this.canvas.on('selection:changed', ({ selectedId, selectedElement }) => {
        this.events.emit('selection:changed', { selectedId, selectedElement });
        if (selectedElement) {
          this.activePanel = 'properties';
          this.events.emit('panel:changed', { panel: 'properties' });
        }
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

    this.disposables.push(
      this.canvas.on('element:added', notifyExportAvailability),
      this.canvas.on('element:removed', notifyExportAvailability),
    );
    notifyExportAvailability();
  }
}
