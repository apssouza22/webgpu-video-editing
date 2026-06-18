import type { CompositionPreviewAPI, CanvasElement } from '@opensource/video-preview';

import { LeftNavEventEmitter } from './events';
import type { LeftNavEventHandler, LeftNavEventName } from './types';
import type {
  LeftNavOptions,
  LeftNavPanelFactory,
  LeftNavPanelId,
} from './types';

export class LeftNav {
  readonly events = new LeftNavEventEmitter();
  private readonly preview: CompositionPreviewAPI;
  private readonly panelFactories: Partial<Record<LeftNavPanelId, LeftNavPanelFactory>>;
  private activePanel: LeftNavPanelId;
  private skipNextPropertiesPanel = false;

  constructor(preview: CompositionPreviewAPI, options: LeftNavOptions = {}) {
    this.preview = preview;
    this.panelFactories = options.panelFactories ?? {};
    this.activePanel = options.initialPanel ?? 'media';
  }

  getActivePanel(): LeftNavPanelId {
    return this.activePanel;
  }

  setActivePanel(panel: LeftNavPanelId): void {
    if (this.activePanel === panel) {
      return;
    }
    this.activePanel = panel;
    this.events.emit('panel:changed', { panel });
  }

  selectElement(id: string | null): void {
    this.preview.selectElement(id);
  }

  getSelectedElement(): CanvasElement | null {
    return this.preview.getSelectedElement();
  }

  updateElement(id: string, patch: Partial<CanvasElement>): void {
    this.preview.updateElement(id, patch);
  }

  createPanelElement(panel: LeftNavPanelId): HTMLElement | undefined {
    return this.panelFactories[panel]?.(this);
  }

  addTextToCanvas(content = 'New text', startTime?: number): void {
    this.events.emit('text:add:requested', {
      content,
      startTime: startTime ?? this.preview.getCurrentTime(),
    });
  }

  on<T extends LeftNavEventName>(event: T, handler: LeftNavEventHandler<T>): () => void {
    return this.events.on(event, handler);
  }

  off<T extends LeftNavEventName>(event: T, handler: LeftNavEventHandler<T>): void {
    this.events.off(event, handler);
  }

  handlePreviewElementAdded(): void {
    this.skipNextPropertiesPanel = true;
  }

  handlePreviewSelectionChanged({
    selectedId,
    selectedElement,
  }: {
    selectedId: string | null;
    selectedElement: CanvasElement | null;
  }): void {
    this.events.emit('selection:changed', { selectedId, selectedElement });
    if (!selectedElement) {
      return;
    }

    if (this.skipNextPropertiesPanel) {
      this.skipNextPropertiesPanel = false;
      return;
    }

    this.setActivePanel('properties');
  }

  handlePreviewElementUpdated({
    id,
    patch,
    element,
  }: {
    id: string;
    patch: Partial<CanvasElement>;
    element: CanvasElement;
  }): void {
    for (const [key, value] of Object.entries(patch)) {
      this.events.emit('property:changed', {
        id,
        key,
        value,
        element,
      });
    }
  }
}
