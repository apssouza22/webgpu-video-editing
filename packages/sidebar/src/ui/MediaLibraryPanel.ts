import type { Sidebar } from '../common/Sidebar';
import type { MediaLibraryItem } from '../common/types';

const MEDIA_ACCEPT = 'video/*,image/*,audio/*';

export class MediaLibraryPanel {
  private readonly root: HTMLElement;
  private readonly grid: HTMLElement;
  private readonly emptyState: HTMLElement;
  private readonly searchInput: HTMLInputElement;
  private readonly fileInput: HTMLInputElement;
  private query = '';

  constructor(private readonly sidebar: Sidebar) {
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
          this.sidebar.requestMediaUpload(file);
        }
        this.renderItems();
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

    this.sidebar.on('media:added', () => this.renderItems());
    this.sidebar.on('media:removed', () => this.renderItems());

    this.root.append(header, this.searchInput, uploadButton, this.fileInput, this.grid, this.emptyState);
    this.renderItems();
  }

  get element(): HTMLElement {
    return this.root;
  }

  private renderItems(): void {
    const items = this.sidebar
      .getMediaLibrary()
      .filter((item) => !this.query || item.name.toLowerCase().includes(this.query));

    this.grid.replaceChildren();
    this.emptyState.hidden = items.length > 0;

    for (const item of items) {
      this.grid.append(this.createCard(item));
    }
  }

  private createCard(item: MediaLibraryItem): HTMLButtonElement {
    const card = document.createElement('button');
    card.type = 'button';
    card.className =
      'flex flex-col gap-2 p-2 border border-es-border rounded-xl bg-white/[0.02] text-left cursor-pointer hover:border-es-accent hover:bg-[#1a2233] overflow-hidden';

    const thumb = document.createElement('div');
    thumb.className =
      'aspect-video rounded-lg bg-[#11151d] border border-es-border overflow-hidden flex items-center justify-center';

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

    const label = document.createElement('span');
    label.className = 'text-xs text-es-text truncate';
    label.textContent = item.name;

    const meta = document.createElement('span');
    meta.className = 'text-[0.65rem] uppercase tracking-wide text-es-muted';
    meta.textContent = item.type;

    card.append(thumb, label, meta);
    card.addEventListener('click', () => this.sidebar.selectMediaItem(item));
    return card;
  }
}
