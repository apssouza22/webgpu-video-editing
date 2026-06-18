import type { LeftNav } from './LeftNav';
import type { LeftNavPanelId } from './types';
import { LEFTNAV_ICONS } from './leftnavIcons';
import { PropertiesPanel } from './PropertiesPanel';
import { UIComponent } from './UIComponent';

const PANELS: Array<{ id: LeftNavPanelId; label: string; icon: string }> = [
  { id: 'media', label: 'Media', icon: LEFTNAV_ICONS.media },
  { id: 'text', label: 'Text', icon: LEFTNAV_ICONS.text },
  { id: 'properties', label: 'Properties', icon: LEFTNAV_ICONS.properties },
  { id: 'export', label: 'Export', icon: LEFTNAV_ICONS.export },
  { id: 'transcription', label: 'Transcription', icon: LEFTNAV_ICONS.transcription },
];

interface LeftNavRefs {
  panels: Map<LeftNavPanelId, HTMLElement>;
  navButtons: Map<LeftNavPanelId, HTMLButtonElement>;
  contentHost: HTMLDivElement;
}

const LEFTNAV_REFS = Symbol('leftNavViewRefs');

type ShellElement = HTMLElement & { [LEFTNAV_REFS]?: LeftNavRefs };

function getLeftNavRefs(shell: HTMLElement): LeftNavRefs {
  const refs = (shell as ShellElement)[LEFTNAV_REFS];
  if (!refs) {
    throw new Error('LeftNavView refs are not initialized');
  }
  return refs;
}

export class LeftNavView extends UIComponent<LeftNav> {
  private get leftNav(): LeftNav {
    return this.context;
  }

  protected createElement(): HTMLElement {
    const panels = new Map<LeftNavPanelId, HTMLElement>();
    const navButtons = new Map<LeftNavPanelId, HTMLButtonElement>();

    const shell = document.createElement('div');
    shell.className = 'leftnav-shell';

    const tabHeader = document.createElement('nav');
    tabHeader.className = 'leftnav-tab-header';
    tabHeader.setAttribute('aria-label', 'Editor left navigation');

    for (const panel of PANELS) {
      const button = document.createElement('button');
      button.type = 'button';
      button.title = panel.label;
      button.dataset.panel = panel.id;
      button.className = 'leftnav-tab-button';
      button.innerHTML = `${panel.icon}<span class="sr-only">${panel.label}</span>`;
      button.addEventListener('click', () => this.leftNav.setActivePanel(panel.id));
      navButtons.set(panel.id, button);
      tabHeader.append(button);
    }

    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'leftnav-tab-content-wrapper';

    const contentHost = document.createElement('div');
    contentHost.className = 'leftnav-tab-content';

    const mediaPanel =
      this.leftNav.createPanelElement('media') ?? this.createMissingPanel('Media');
    const textPanel = this.createTextPanel();
    const propertiesPanel = new PropertiesPanel(this.leftNav);
    const exportPanel =
      this.leftNav.createPanelElement('export') ?? this.createMissingPanel('Export');
    const transcriptionPanel =
      this.leftNav.createPanelElement('transcription') ??
      this.createMissingPanel('Transcription');

    panels.set('media', mediaPanel);
    panels.set('text', textPanel);
    panels.set('properties', propertiesPanel.element);
    panels.set('export', exportPanel);
    panels.set('transcription', transcriptionPanel);

    const refs: LeftNavRefs = { panels, navButtons, contentHost };
    (shell as ShellElement)[LEFTNAV_REFS] = refs;

    contentWrapper.append(contentHost);
    shell.append(tabHeader, contentWrapper);
    this.applyPanel(this.leftNav.getActivePanel(), refs);
    return shell;
  }

  protected bind(): void {
    this.leftNav.on('panel:changed', ({ panel }) => {
      this.showPanel(panel);
    });
  }

  private showPanel(panel: LeftNavPanelId): void {
    this.applyPanel(panel, getLeftNavRefs(this.element));
  }

  private applyPanel(panel: LeftNavPanelId, refs: LeftNavRefs): void {
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
    title.className = 'leftnav-section-title';
    title.textContent = 'Add Text Layer';

    const description = document.createElement('p');
    description.className = 'm-0 text-es-muted text-sm';
    description.textContent = 'Add a text layer at the current playhead position.';

    const textarea = document.createElement('textarea');
    textarea.className = 'leftnav-textarea';
    textarea.placeholder = 'Enter your text here…';
    textarea.rows = 3;
    textarea.value = 'Your title here';

    const addButton = document.createElement('button');
    addButton.type = 'button';
    addButton.className = 'leftnav-action-button leftnav-action-button--primary';
    addButton.textContent = 'Add text to canvas';

    addButton.addEventListener('click', () => {
      this.leftNav.addTextToCanvas(textarea.value.trim() || 'New text');
    });

    panel.append(title, description, textarea, addButton);
    return panel;
  }
}

export function mountLeftNav(container: HTMLElement, leftNav: LeftNav): void {
  new LeftNavView(container, leftNav);
}
