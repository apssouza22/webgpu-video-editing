import type { Sidebar } from '../common/Sidebar';
import type { SidebarPanelId } from '../common/types';
import { MediaLibraryPanel } from './MediaLibraryPanel';
import { PropertiesPanel } from './PropertiesPanel';
import { UIComponent } from './UIComponent';

const PANELS: Array<{ id: SidebarPanelId; label: string; icon: string }> = [
  { id: 'video', label: 'Video', icon: '▶' },
  { id: 'image', label: 'Image', icon: '▣' },
  { id: 'audio', label: 'Audio', icon: '♪' },
  { id: 'text', label: 'Text', icon: 'T' },
  { id: 'properties', label: 'Properties', icon: '⚙' },
];

interface SidebarRefs {
  panels: Map<SidebarPanelId, HTMLElement>;
  navButtons: Map<SidebarPanelId, HTMLButtonElement>;
  contentHost: HTMLDivElement;
}

const SIDEBAR_REFS = Symbol('sidebarViewRefs');

type ShellElement = HTMLElement & { [SIDEBAR_REFS]?: SidebarRefs };

function getSidebarRefs(shell: HTMLElement): SidebarRefs {
  const refs = (shell as ShellElement)[SIDEBAR_REFS];
  if (!refs) {
    throw new Error('SidebarView refs are not initialized');
  }
  return refs;
}

export class SidebarView extends UIComponent<Sidebar> {
  private get sidebar(): Sidebar {
    return this.context;
  }

  protected createElement(): HTMLElement {
    const panels = new Map<SidebarPanelId, HTMLElement>();
    const navButtons = new Map<SidebarPanelId, HTMLButtonElement>();

    const shell = document.createElement('div');
    shell.className =
      'grid grid-cols-[56px_minmax(0,1fr)] h-full min-h-0 bg-es-panel text-es-text';

    const rail = document.createElement('nav');
    rail.className =
      'flex flex-col items-center gap-1 py-3 border-r border-es-border bg-[#12161d]';
    rail.setAttribute('aria-label', 'Editor sidebar');

    for (const panel of PANELS) {
      const button = document.createElement('button');
      button.type = 'button';
      button.title = panel.label;
      button.dataset.panel = panel.id;
      button.className =
        'w-10 h-10 rounded-lg border border-transparent text-es-muted hover:text-es-text hover:bg-white/[0.04] cursor-pointer flex items-center justify-center text-sm';
      button.innerHTML = `<span aria-hidden="true">${panel.icon}</span><span class="sr-only">${panel.label}</span>`;
      button.addEventListener('click', () => this.sidebar.setActivePanel(panel.id));
      navButtons.set(panel.id, button);
      rail.append(button);
    }

    const contentHost = document.createElement('div');
    contentHost.className = 'min-h-0 overflow-y-auto p-4 flex flex-col gap-4';

    const videoPanel = new MediaLibraryPanel(this.sidebar, 'video');
    const imagePanel = new MediaLibraryPanel(this.sidebar, 'image');
    const audioPanel = new MediaLibraryPanel(this.sidebar, 'audio');
    const textPanel = this.createTextPanel();
    const propertiesPanel = new PropertiesPanel(this.sidebar);

    panels.set('video', videoPanel.element);
    panels.set('image', imagePanel.element);
    panels.set('audio', audioPanel.element);
    panels.set('text', textPanel);
    panels.set('properties', propertiesPanel.element);

    const refs: SidebarRefs = { panels, navButtons, contentHost };
    (shell as ShellElement)[SIDEBAR_REFS] = refs;

    shell.append(rail, contentHost);
    this.applyPanel(this.sidebar.getActivePanel(), refs);
    return shell;
  }

  protected bind(): void {
    this.track(
      this.sidebar.on('panel:changed', ({ panel }) => {
        this.showPanel(panel);
      }),
    );

    this.track(
      this.sidebar.on('selection:changed', ({ selectedElement }) => {
        if (selectedElement) {
          this.showPanel('properties');
        }
      }),
    );
  }

  private showPanel(panel: SidebarPanelId): void {
    this.applyPanel(panel, getSidebarRefs(this.element));
  }

  private applyPanel(panel: SidebarPanelId, refs: SidebarRefs): void {
    const node = refs.panels.get(panel);
    if (!node) {
      return;
    }

    refs.contentHost.replaceChildren(node);

    for (const [id, button] of refs.navButtons) {
      const active = id === panel;
      button.className = active
        ? 'w-10 h-10 rounded-lg border border-es-accent bg-[rgba(62,138,245,0.15)] text-es-accent cursor-pointer flex items-center justify-center text-sm'
        : 'w-10 h-10 rounded-lg border border-transparent text-es-muted hover:text-es-text hover:bg-white/[0.04] cursor-pointer flex items-center justify-center text-sm';
      button.setAttribute('aria-current', active ? 'page' : 'false');
    }
  }

  private createTextPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'flex flex-col gap-3';

    panel.innerHTML = `
      <div class="flex flex-col gap-1">
        <h2 class="m-0 text-lg font-semibold">Text</h2>
        <p class="m-0 text-es-muted text-sm">Add a text layer at the current playhead position.</p>
      </div>
    `;

    const textarea = document.createElement('textarea');
    textarea.className =
      'border border-es-border rounded-lg px-3 py-2 bg-[#11151d] text-es-text min-h-24 resize-y';
    textarea.value = 'Your title here';

    const addButton = document.createElement('button');
    addButton.type = 'button';
    addButton.className =
      'border border-es-border rounded-lg px-3 py-2 bg-es-accent text-white cursor-pointer hover:bg-es-accent-hover';
    addButton.textContent = 'Add text to canvas';

    addButton.addEventListener('click', () => {
      this.sidebar.addTextToCanvas(textarea.value.trim() || 'New text');
    });

    panel.append(textarea, addButton);
    return panel;
  }
}

export function mountSidebar(container: HTMLElement, sidebar: Sidebar): () => void {
  const view = new SidebarView(container, sidebar);
  return () => view.destroy();
}
