import type { Sidebar } from '../common/Sidebar';

export class ProjectPanel {
  private readonly root: HTMLElement;
  private readonly nameInput: HTMLInputElement;
  private readonly createButton: HTMLButtonElement;
  private readonly openButton: HTMLButtonElement;
  private readonly statusEl: HTMLParagraphElement;
  private readonly currentProjectEl: HTMLParagraphElement;
  private busy = false;
  private canManage = false;

  constructor(private readonly sidebar: Sidebar) {
    this.root = document.createElement('div');
    this.root.className = 'flex flex-col gap-4';

    const title = document.createElement('h2');
    title.className = 'sidebar-section-title';
    title.textContent = 'Project';

    const description = document.createElement('p');
    description.className = 'm-0 text-es-muted text-sm leading-snug';
    description.textContent =
      'Save your edit as a project folder with media files and project.json, or open an existing project.';

    const nameField = document.createElement('div');
    nameField.className = 'sidebar-export-field';

    const nameLabel = document.createElement('label');
    nameLabel.htmlFor = 'sidebar-project-name';
    nameLabel.textContent = 'Project name';

    this.nameInput = document.createElement('input');
    this.nameInput.id = 'sidebar-project-name';
    this.nameInput.name = 'projectName';
    this.nameInput.type = 'text';
    this.nameInput.className =
      'border border-es-border rounded-lg px-3 py-2 bg-[#11151d] text-es-text text-sm w-full';
    this.nameInput.value = 'Untitled project';
    this.nameInput.autocomplete = 'off';

    nameField.append(nameLabel, this.nameInput);

    this.createButton = document.createElement('button');
    this.createButton.type = 'button';
    this.createButton.className = 'sidebar-action-button sidebar-action-button--primary';
    this.createButton.textContent = 'Create new project';
    this.createButton.addEventListener('click', () => {
      if (this.createButton.disabled) {
        return;
      }
      const name = this.nameInput.value.trim() || 'Untitled project';
      this.sidebar.requestCreateProject(name);
    });

    this.openButton = document.createElement('button');
    this.openButton.type = 'button';
    this.openButton.className = 'sidebar-action-button';
    this.openButton.textContent = 'Open project';
    this.openButton.addEventListener('click', () => {
      if (this.openButton.disabled) {
        return;
      }
      this.sidebar.requestOpenProject();
    });

    this.currentProjectEl = document.createElement('p');
    this.currentProjectEl.className = 'm-0 text-es-muted text-sm';
    this.currentProjectEl.hidden = true;

    this.statusEl = document.createElement('p');
    this.statusEl.className = 'sidebar-export-status';
    this.statusEl.setAttribute('aria-live', 'polite');

    this.root.append(
      title,
      description,
      nameField,
      this.createButton,
      this.openButton,
      this.currentProjectEl,
      this.statusEl,
    );

    this.sidebar.on('project:status', ({ message, busy, projectName, isOpen }) => {
      this.busy = busy;
      this.statusEl.textContent = message;
      this.currentProjectEl.hidden = !isOpen || !projectName;
      if (projectName && isOpen) {
        this.currentProjectEl.textContent = `Current project: ${projectName}`;
      }
      this.updateButtonState();
    });

    this.sidebar.on('project:availability', ({ canManage }) => {
      this.canManage = canManage;
      this.updateButtonState();
    });

    this.canManage = this.sidebar.canManageProject();
    this.updateButtonState();
  }

  get element(): HTMLElement {
    return this.root;
  }

  private updateButtonState(): void {
    const enabled = this.canManage && !this.busy;
    this.createButton.disabled = !enabled;
    this.openButton.disabled = !enabled;
    this.nameInput.disabled = !enabled;

    const unavailableMessage = this.canManage
      ? ''
      : 'Project folders require a browser with the File System Access API.';

    this.createButton.title = unavailableMessage || 'Create a project folder and save the current edit';
    this.openButton.title = unavailableMessage || 'Open an existing project folder';
  }
}
