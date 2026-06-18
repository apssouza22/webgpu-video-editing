import type { CompositionPreviewAPI, CanvasElement } from '@opensource/video-preview';

import { SidebarEventEmitter } from '../event/events';
import type { SidebarEventHandler, SidebarEventName } from './types';
import type {
  SidebarOptions,
  SidebarPanelFactory,
  SidebarPanelId,
} from './types';

export class Sidebar {
  readonly events = new SidebarEventEmitter();
  private readonly preview: CompositionPreviewAPI;
  private readonly panelFactories: Partial<Record<SidebarPanelId, SidebarPanelFactory>>;
  private readonly disposables: Array<() => void> = [];
  private activePanel: SidebarPanelId;

  constructor(preview: CompositionPreviewAPI, options: SidebarOptions = {}) {
    this.preview = preview;
    this.panelFactories = options.panelFactories ?? {};
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

  createPanelElement(panel: SidebarPanelId): HTMLElement | undefined {
    return this.panelFactories[panel]?.(this);
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

  addTextToCanvas(content = 'New text', startTime?: number): void {
    this.events.emit('text:add:requested', {
      content,
      startTime: startTime ?? this.preview.getCurrentTime(),
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
