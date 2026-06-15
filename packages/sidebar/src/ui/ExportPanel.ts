import type { Sidebar } from '../common/Sidebar';
import type { ExportFormat, ExportQuality, ExportResolutionPreset, ExportSettings } from '../common/types';

export class ExportPanel {
  private readonly root: HTMLElement;
  private readonly form: HTMLFormElement;
  private readonly exportButton: HTMLButtonElement;
  private readonly statusEl: HTMLParagraphElement;
  private exporting = false;

  constructor(private readonly sidebar: Sidebar) {
    this.root = document.createElement('div');
    this.root.className = 'flex flex-col gap-4';

    const title = document.createElement('h2');
    title.className = 'sidebar-section-title';
    title.textContent = 'Export Video';

    const description = document.createElement('p');
    description.className = 'm-0 text-es-muted text-sm leading-snug';
    description.textContent =
      'Render the composition with WebGPU and download an MP4.';

    this.form = document.createElement('form');
    this.form.className = 'sidebar-export-options';
    this.form.setAttribute('aria-label', 'Export settings');
    this.form.innerHTML = `
      <div class="sidebar-export-field">
        <label for="sidebar-export-quality">Quality</label>
        <select id="sidebar-export-quality" name="quality">
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high" selected>High</option>
          <option value="max">Max</option>
        </select>
      </div>
      <div class="sidebar-export-field">
        <label for="sidebar-export-fps">FPS</label>
        <select id="sidebar-export-fps" name="fps">
          <option value="24">24</option>
          <option value="30" selected>30</option>
          <option value="60">60</option>
        </select>
      </div>
      <div class="sidebar-export-field">
        <label for="sidebar-export-format">Format</label>
        <select id="sidebar-export-format" name="format">
          <option value="mp4" selected>MP4</option>
        </select>
      </div>
      <div class="sidebar-export-field">
        <label for="sidebar-export-resolution">Resolution</label>
        <select id="sidebar-export-resolution" name="resolution">
          <option value="source" selected>Source</option>
          <option value="480p">480p</option>
          <option value="720p">720p</option>
          <option value="1080p">1080p</option>
          <option value="1440p">1440p</option>
          <option value="4k">4K</option>
        </select>
      </div>
    `;

    this.exportButton = document.createElement('button');
    this.exportButton.type = 'submit';
    this.exportButton.className = 'sidebar-action-button sidebar-action-button--primary';
    this.exportButton.textContent = 'Export video';

    this.statusEl = document.createElement('p');
    this.statusEl.className = 'sidebar-export-status';
    this.statusEl.setAttribute('aria-live', 'polite');

    this.form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (this.exportButton.disabled) {
        return;
      }
      this.sidebar.requestExport(this.readSettings());
    });

    this.form.append(this.exportButton);
    this.root.append(title, description, this.form, this.statusEl);

    this.sidebar.on('export:status', ({ message, exporting }) => {
      this.exporting = exporting;
      this.statusEl.textContent = message;
      this.updateButtonState(this.sidebar.canExport());
    });

    this.sidebar.on('export:availability', ({ canExport }) => {
      this.updateButtonState(canExport);
    });

    this.updateButtonState(this.sidebar.canExport());
  }

  get element(): HTMLElement {
    return this.root;
  }

  private readSettings(): ExportSettings {
    const formData = new FormData(this.form);

    return {
      quality: (formData.get('quality') as ExportQuality | null) ?? 'high',
      fps: Number(formData.get('fps') ?? 30),
      format: (formData.get('format') as ExportFormat | null) ?? 'mp4',
      resolution: {
        preset: (formData.get('resolution') as ExportResolutionPreset | null) ?? 'source',
      },
    };
  }

  private updateButtonState(canExport: boolean): void {
    const enabled = canExport && !this.exporting;
    this.exportButton.disabled = !enabled;
    this.exportButton.title = canExport
      ? 'Render the composition with WebGPU and download an MP4'
      : 'Add at least one visual layer before exporting';
  }
}
