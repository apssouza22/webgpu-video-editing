import { formatMediaDuration } from './duration';
import type { MediaLibraryService } from './MediaLibraryService';
import type { MediaLibraryItem } from './types';

const MEDIA_ACCEPT = 'video/*,image/*,audio/*';

export class MediaLibraryPanel {
  private readonly root: HTMLElement;
  private readonly grid: HTMLElement;
  private readonly emptyState: HTMLElement;
  private readonly searchInput: HTMLInputElement;
  private readonly fileInput: HTMLInputElement;
  private readonly disposers: Array<() => void> = [];
  private query = '';

  constructor(private readonly mediaLibrary: MediaLibraryService) {
    this.root = document.createElement('div');
    this.root.className = 'flex flex-col gap-3 min-h-0';

    const header = document.createElement('div');
    header.className = 'flex flex-col gap-1';
    header.innerHTML = `
      <h2 class="sidebar-section-title">Media</h2>
      <p class="m-0 text-es-muted text-sm">Upload and browse your videos, images, and audio. Click an item to add it to the canvas.</p>
    `;

    this.searchInput = document.createElement('input');
    this.searchInput.type = 'search';
    this.searchInput.placeholder = 'Search media…';
    this.searchInput.className =
      'border border-es-border rounded-lg px-3 py-2 bg-[#11151d] text-es-text text-sm';

    const uploadButton = document.createElement('button');
    uploadButton.type = 'button';
    uploadButton.className =
      'border border-dashed border-es-border rounded-lg px-3 py-2.5 bg-white/[0.02] text-es-text text-sm cursor-pointer hover:border-es-accent hover:bg-[#1a2233]';
    uploadButton.textContent = 'Upload media';

    this.fileInput = document.createElement('input');
    this.fileInput.type = 'file';
    this.fileInput.accept = MEDIA_ACCEPT;
    this.fileInput.multiple = true;
    this.fileInput.hidden = true;

    uploadButton.addEventListener('click', () => this.fileInput.click());
    this.fileInput.addEventListener('change', () => {
      const files = this.fileInput.files;
      if (files) {
        for (const file of files) {
          this.mediaLibrary.requestUpload(file);
        }
      }
      this.fileInput.value = '';
    });

    this.emptyState = document.createElement('p');
    this.emptyState.className = 'm-0 text-es-muted text-sm text-center py-8 px-4';
    this.emptyState.textContent = 'Upload videos, images, or audio to build your library.';

    this.grid = document.createElement('div');
    this.grid.className =
      'grid grid-cols-2 gap-2.5 overflow-y-auto min-h-0 max-h-[min(420px,45vh)] pr-0.5';

    this.searchInput.addEventListener('input', () => {
      this.query = this.searchInput.value.trim().toLowerCase();
      this.renderItems();
    });

    this.disposers.push(
      this.mediaLibrary.on('added', () => this.renderItems()),
      this.mediaLibrary.on('removed', () => this.renderItems()),
      this.mediaLibrary.on('changed', () => this.renderItems()),
    );

    this.root.append(header, this.searchInput, uploadButton, this.fileInput, this.grid, this.emptyState);
    this.renderItems();
  }

  get element(): HTMLElement {
    return this.root;
  }

  destroy(): void {
    while (this.disposers.length > 0) {
      this.disposers.pop()?.();
    }
  }

  private renderItems(): void {
    const items = this.mediaLibrary
      .list()
      .filter((item) => !this.query || item.name.toLowerCase().includes(this.query));

    this.grid.replaceChildren();
    this.emptyState.hidden = items.length > 0;

    for (const item of items) {
      this.grid.append(this.createCard(item));
    }
  }

  private createCard(item: MediaLibraryItem): HTMLElement {
    const card = document.createElement('article');
    card.className =
      'relative flex flex-col gap-2 p-2 border border-es-border rounded-xl bg-white/[0.02] text-left overflow-hidden hover:border-es-accent hover:bg-[#1a2233]';

    const selectButton = document.createElement('button');
    selectButton.type = 'button';
    selectButton.className =
      'flex flex-col gap-2 w-full p-0 border-0 bg-transparent text-left cursor-pointer';
    selectButton.addEventListener('click', () => this.mediaLibrary.selectItem(item));

    const thumb = document.createElement('div');
    thumb.className =
      'relative aspect-video rounded-lg bg-[#11151d] border border-es-border overflow-hidden flex items-center justify-center';

    if (item.type === 'audio') {
      thumb.innerHTML = `
        <span class="text-es-accent text-2xl" aria-hidden="true">♪</span>
      `;
    } else if (item.thumbnail || item.type === 'image') {
      const img = document.createElement('img');
      img.src = item.thumbnail ?? item.src;
      img.alt = '';
      img.className = 'w-full h-full object-cover';
      thumb.append(img);
    } else {
      const video = document.createElement('video');
      video.src = item.src;
      video.muted = true;
      video.className = 'w-full h-full object-cover';
      thumb.append(video);
    }

    if (item.type === 'video') {
      const durationBadge = document.createElement('span');
      durationBadge.className =
        'absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/70 text-[0.65rem] text-white tabular-nums pointer-events-none';
      durationBadge.textContent = item.duration !== undefined
        ? formatMediaDuration(item.duration)
        : '…';
      thumb.append(durationBadge);
    }

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className =
      'absolute top-3.5 right-3.5 z-10 w-6 h-6 rounded-md border border-es-border bg-[#11151d]/90 text-es-muted text-sm leading-none cursor-pointer hover:text-es-text hover:border-es-accent';
    deleteButton.setAttribute('aria-label', `Delete ${item.name}`);
    deleteButton.textContent = '×';
    deleteButton.addEventListener('click', (event) => {
      event.stopPropagation();
      this.mediaLibrary.remove(item.id);
    });

    const label = document.createElement('span');
    label.className = 'text-xs text-es-text truncate';
    label.textContent = item.name;

    const meta = document.createElement('span');
    meta.className = 'text-[0.65rem] uppercase tracking-wide text-es-muted';
    meta.textContent = item.type;

    selectButton.append(thumb, label, meta);
    card.append(selectButton, deleteButton);
    return card;
  }
}

export function mountMediaLibraryPanel(mediaLibrary: MediaLibraryService): () => void {
  const panel = new MediaLibraryPanel(mediaLibrary);
  return () => panel.destroy();
}
