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
  private readonly disposables: Array<() => void> = [];
  private activePanel: LeftNavPanelId;

  constructor(preview: CompositionPreviewAPI, options: LeftNavOptions = {}) {
    this.preview = preview;
    this.panelFactories = options.panelFactories ?? {};
    this.activePanel = options.initialPanel ?? 'media';
    this.bindCanvas();
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

  getSelectedId(): string | null {
    return this.preview.getSelectedId();
  }

  updateElement(id: string, patch: Partial<CanvasElement>): void {
    this.preview.updateElement(id, patch);
  }

  updateProperty<K extends keyof CanvasElement>(
    id: string,
    key: K,
    value: CanvasElement[K],
  ): void {
    this.preview.updateElement(id, { [key]: value } as Partial<CanvasElement>);
  }

  getElement(id: string): CanvasElement | undefined {
    return this.preview.getElement(id);
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

  destroy(): void {
    for (const unsubscribe of this.disposables) {
      unsubscribe();
    }
    this.disposables.length = 0;
  }

  private bindCanvas(): void {
    let skipNextPropertiesPanel = false;

    this.disposables.push(
      this.preview.on('element:added', () => {
        skipNextPropertiesPanel = true;
      }),
      this.preview.on('selection:changed', ({ selectedId, selectedElement }) => {
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
      this.preview.on('element:updated', ({ id, patch, element }) => {
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
  }
}
