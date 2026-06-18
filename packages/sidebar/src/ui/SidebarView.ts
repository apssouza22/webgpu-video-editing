import type { Sidebar } from '../common/Sidebar';
import type { SidebarPanelId } from '../common/types';
import { ProjectPanel } from './ProjectPanel';
import { PropertiesPanel } from './PropertiesPanel';
import { SIDEBAR_ICONS } from './sidebarIcons';
import { UIComponent } from './UIComponent';

const PANELS: Array<{ id: SidebarPanelId; label: string; icon: string }> = [
  { id: 'project', label: 'Project', icon: SIDEBAR_ICONS.project },
  { id: 'media', label: 'Media', icon: SIDEBAR_ICONS.media },
  { id: 'text', label: 'Text', icon: SIDEBAR_ICONS.text },
  { id: 'properties', label: 'Properties', icon: SIDEBAR_ICONS.properties },
  { id: 'export', label: 'Export', icon: SIDEBAR_ICONS.export },
  { id: 'transcription', label: 'Transcription', icon: SIDEBAR_ICONS.transcription },
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
    shell.className = 'sidebar-shell';

    const tabHeader = document.createElement('nav');
    tabHeader.className = 'sidebar-tab-header';
    tabHeader.setAttribute('aria-label', 'Editor sidebar');

    for (const panel of PANELS) {
      const button = document.createElement('button');
      button.type = 'button';
      button.title = panel.label;
      button.dataset.panel = panel.id;
      button.className = 'sidebar-tab-button';
      button.innerHTML = `${panel.icon}<span class="sr-only">${panel.label}</span>`;
      button.addEventListener('click', () => this.sidebar.setActivePanel(panel.id));
      navButtons.set(panel.id, button);
      tabHeader.append(button);
    }

    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'sidebar-tab-content-wrapper';

    const contentHost = document.createElement('div');
    contentHost.className = 'sidebar-tab-content';

    const projectPanel = new ProjectPanel(this.sidebar);
    const mediaPanel =
      this.sidebar.createPanelElement('media') ?? this.createMissingPanel('Media');
    const textPanel = this.createTextPanel();
    const propertiesPanel = new PropertiesPanel(this.sidebar);
    const exportPanel =
      this.sidebar.createPanelElement('export') ?? this.createMissingPanel('Export');
    const transcriptionPanel =
      this.sidebar.createPanelElement('transcription') ??
      this.createMissingPanel('Transcription');

    panels.set('project', projectPanel.element);
    panels.set('media', mediaPanel);
    panels.set('text', textPanel);
    panels.set('properties', propertiesPanel.element);
    panels.set('export', exportPanel);
    panels.set('transcription', transcriptionPanel);

    const refs: SidebarRefs = { panels, navButtons, contentHost };
    (shell as ShellElement)[SIDEBAR_REFS] = refs;

    contentWrapper.append(contentHost);
    shell.append(tabHeader, contentWrapper);
    this.applyPanel(this.sidebar.getActivePanel(), refs);
    return shell;
  }

  protected bind(): void {
    this.track(
      this.sidebar.on('panel:changed', ({ panel }) => {
        this.showPanel(panel);
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
      button.classList.toggle('is-active', id === panel);
      button.setAttribute('aria-current', id === panel ? 'page' : 'false');
    }
  }

  private createMissingPanel(label: string): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'flex flex-col gap-2 p-4 text-es-muted text-sm';
    panel.textContent = `${label} panel is not mounted.`;
    return panel;
  }

  private createTextPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'flex flex-col gap-4';

    const title = document.createElement('div');
    title.className = 'sidebar-section-title';
    title.textContent = 'Add Text Layer';

    const description = document.createElement('p');
    description.className = 'm-0 text-es-muted text-sm';
    description.textContent = 'Add a text layer at the current playhead position.';

    const textarea = document.createElement('textarea');
    textarea.className = 'sidebar-textarea';
    textarea.placeholder = 'Enter your text here…';
    textarea.rows = 3;
    textarea.value = 'Your title here';

    const addButton = document.createElement('button');
    addButton.type = 'button';
    addButton.className = 'sidebar-action-button sidebar-action-button--primary';
    addButton.textContent = 'Add text to canvas';

    addButton.addEventListener('click', () => {
      this.sidebar.addTextToCanvas(textarea.value.trim() || 'New text');
    });

    panel.append(title, description, textarea, addButton);
    return panel;
  }
}

export function mountSidebar(container: HTMLElement, sidebar: Sidebar): () => void {
  const view = new SidebarView(container, sidebar);
  return () => view.destroy();
}
