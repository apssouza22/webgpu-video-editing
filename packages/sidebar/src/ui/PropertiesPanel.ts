import type { CanvasElement } from '@opensource/video-preview';

import type { Sidebar } from '../common/Sidebar';

const labelClass = 'flex flex-col gap-1.5 text-[0.8rem] text-es-muted';
const inputClass =
  'border border-es-border rounded-lg px-2.5 py-2 bg-[#11151d] text-es-text w-full';

export class PropertiesPanel {
  private readonly root: HTMLElement;
  private mountedId: string | null = null;

  constructor(private readonly sidebar: Sidebar) {
    this.root = document.createElement('div');
    this.root.className = 'flex flex-col gap-3';
    this.sidebar.on('selection:changed', () => this.render());
    this.sidebar.on('property:changed', () => this.render());
    this.render();
  }

  get element(): HTMLElement {
    return this.root;
  }

  private render(): void {
    const selected = this.sidebar.getSelectedElement();

    if (!selected) {
      this.mountedId = null;
      this.root.innerHTML = `
        <h2 class="sidebar-section-title">Properties</h2>
        <p class="m-0 text-es-muted text-sm leading-snug">Select an element on the canvas to edit its properties.</p>
      `;
      return;
    }

    if (selected.id !== this.mountedId) {
      this.mountedId = selected.id;
      this.root.replaceChildren(this.buildForm(selected));
      return;
    }

    this.syncFields(selected);
  }

  private syncFields(element: CanvasElement): void {
    const setValue = (field: string, value: string | number) => {
      const input = this.root.querySelector<HTMLInputElement | HTMLTextAreaElement>(
        `[data-field="${field}"]`,
      );
      if (input && document.activeElement !== input) {
        input.value = String(value);
      }
    };

    setValue('name', element.name);
    setValue('x', Math.round(element.x));
    setValue('y', Math.round(element.y));
    setValue('width', Math.round(element.width));
    setValue('height', Math.round(element.height));
    setValue('rotation', Math.round(element.rotation));
    setValue('opacity', element.opacity);

    if (element.type === 'text') {
      setValue('content', element.content);
      setValue('fontSize', element.fontSize);
      setValue('color', element.color);
    }
  }

  private buildForm(element: CanvasElement): DocumentFragment {
    const fragment = document.createDocumentFragment();

    const title = document.createElement('h2');
    title.className = 'sidebar-section-title';
    title.textContent = element.name;

    const type = document.createElement('p');
    type.className = 'm-0 text-es-accent text-xs uppercase tracking-wider';
    type.textContent = element.type;

    const nameLabel = this.createLabel('Name');
    const nameInput = document.createElement('input');
    nameInput.className = inputClass;
    nameInput.dataset.field = 'name';
    nameInput.value = element.name;
    nameInput.addEventListener('input', () => {
      this.sidebar.updateElement(element.id, { name: nameInput.value });
    });
    nameLabel.append(nameInput);

    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-2 gap-2.5';
    grid.append(
      this.createNumberField('X', 'x', element.x, (value) =>
        this.sidebar.updateElement(element.id, { x: value }),
      ),
      this.createNumberField('Y', 'y', element.y, (value) =>
        this.sidebar.updateElement(element.id, { y: value }),
      ),
      this.createNumberField('Width', 'width', element.width, (value) =>
        this.sidebar.updateElement(element.id, { width: value }),
      ),
      this.createNumberField('Height', 'height', element.height, (value) =>
        this.sidebar.updateElement(element.id, { height: value }),
      ),
      this.createNumberField('Rotation', 'rotation', element.rotation, (value) =>
        this.sidebar.updateElement(element.id, { rotation: value }),
      ),
      this.createNumberField('Opacity', 'opacity', element.opacity, (value) =>
        this.sidebar.updateElement(element.id, { opacity: value }),
      ),
    );

    fragment.append(title, type, nameLabel, grid);

    if (element.type === 'text') {
      fragment.append(...this.buildTextFields(element));
    }

    if (element.type === 'image') {
      fragment.append(this.buildImageFields(element));
    }

    if (element.type === 'video') {
      fragment.append(
        this.createCheckbox('Muted', element.muted, (checked) =>
          this.sidebar.updateElement(element.id, { muted: checked }),
        ),
        this.createCheckbox('Loop', element.loop, (checked) =>
          this.sidebar.updateElement(element.id, { loop: checked }),
        ),
      );
    }

    if (element.type === 'audio') {
      fragment.append(
        this.createNumberField('Volume', 'volume', element.volume, (value) =>
          this.sidebar.updateElement(element.id, { volume: value }),
        ),
        this.createCheckbox('Loop', element.loop, (checked) =>
          this.sidebar.updateElement(element.id, { loop: checked }),
        ),
      );
    }

    return fragment;
  }

  private buildTextFields(element: Extract<CanvasElement, { type: 'text' }>): HTMLElement[] {
    const contentLabel = this.createLabel('Content');
    const contentInput = document.createElement('textarea');
    contentInput.className = inputClass;
    contentInput.dataset.field = 'content';
    contentInput.rows = 3;
    contentInput.value = element.content;
    contentInput.addEventListener('input', () => {
      this.sidebar.updateElement(element.id, { content: contentInput.value });
    });
    contentLabel.append(contentInput);

    const fontSizeLabel = this.createLabel('Font size');
    const fontSizeInput = document.createElement('input');
    fontSizeInput.type = 'number';
    fontSizeInput.className = inputClass;
    fontSizeInput.dataset.field = 'fontSize';
    fontSizeInput.value = String(element.fontSize);
    fontSizeInput.addEventListener('input', () => {
      this.sidebar.updateElement(element.id, { fontSize: Number(fontSizeInput.value) });
    });
    fontSizeLabel.append(fontSizeInput);

    const colorLabel = this.createLabel('Color');
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.className = inputClass;
    colorInput.dataset.field = 'color';
    colorInput.value = element.color;
    colorInput.addEventListener('input', () => {
      this.sidebar.updateElement(element.id, { color: colorInput.value });
    });
    colorLabel.append(colorInput);

    const alignLabel = this.createLabel('Align');
    const alignSelect = document.createElement('select');
    alignSelect.className = inputClass;
    for (const option of ['left', 'center', 'right'] as const) {
      const opt = document.createElement('option');
      opt.value = option;
      opt.textContent = option.charAt(0).toUpperCase() + option.slice(1);
      alignSelect.append(opt);
    }
    alignSelect.value = element.textAlign;
    alignSelect.addEventListener('change', () => {
      this.sidebar.updateElement(element.id, {
        textAlign: alignSelect.value as 'left' | 'center' | 'right',
      });
    });
    alignLabel.append(alignSelect);

    return [contentLabel, fontSizeLabel, colorLabel, alignLabel];
  }

  private buildImageFields(element: Extract<CanvasElement, { type: 'image' }>): HTMLElement {
    const fitLabel = this.createLabel('Fit');
    const fitSelect = document.createElement('select');
    fitSelect.className = inputClass;
    for (const option of ['cover', 'contain', 'fill'] as const) {
      const opt = document.createElement('option');
      opt.value = option;
      opt.textContent = option.charAt(0).toUpperCase() + option.slice(1);
      fitSelect.append(opt);
    }
    fitSelect.value = element.objectFit;
    fitSelect.addEventListener('change', () => {
      this.sidebar.updateElement(element.id, {
        objectFit: fitSelect.value as 'cover' | 'contain' | 'fill',
      });
    });
    fitLabel.append(fitSelect);
    return fitLabel;
  }

  private createLabel(text: string): HTMLLabelElement {
    const label = document.createElement('label');
    label.className = labelClass;
    label.textContent = text;
    return label;
  }

  private createNumberField(
    label: string,
    field: string,
    value: number,
    onChange: (value: number) => void,
  ): HTMLLabelElement {
    const fieldLabel = this.createLabel(label);
    const input = document.createElement('input');
    input.type = 'number';
    input.className = inputClass;
    input.dataset.field = field;
    input.value = String(Math.round(value * 100) / 100);
    input.addEventListener('input', () => onChange(Number(input.value)));
    fieldLabel.append(input);
    return fieldLabel;
  }

  private createCheckbox(
    label: string,
    checked: boolean,
    onChange: (checked: boolean) => void,
  ): HTMLLabelElement {
    const field = this.createLabel(label);
    field.className = `${labelClass} flex-row items-center gap-2`;
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = checked;
    input.addEventListener('change', () => onChange(input.checked));
    field.prepend(input);
    return field;
  }
}
