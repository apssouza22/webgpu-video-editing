import type { Sidebar } from '../common/Sidebar';
import type { MediaLibraryItem, MediaType } from '../common/types';

const PANEL_COPY: Record<
  MediaType,
  { title: string; empty: string; accept: string; uploadLabel: string }
> = {
  video: {
    title: 'Video',
    empty: 'Use the search or upload to add videos to your library.',
    accept: 'video/*',
    uploadLabel: 'Upload video',
  },
  image: {
    title: 'Image',
    empty: 'Upload images or pick from stock to add them to the canvas.',
    accept: 'image/*',
    uploadLabel: 'Upload image',
  },
  audio: {
    title: 'Audio',
    empty: 'Upload audio files to use them in your composition.',
    accept: 'audio/*',
    uploadLabel: 'Upload audio',
  },
};

export class MediaLibraryPanel {
  private readonly root: HTMLElement;
  private readonly grid: HTMLElement;
  private readonly emptyState: HTMLElement;
  private readonly searchInput: HTMLInputElement;
  private readonly fileInput: HTMLInputElement;
  private readonly type: MediaType;
  private libraryTab: 'stock' | 'library' = 'stock';
  private query = '';

  constructor(
    private readonly sidebar: Sidebar,
    type: MediaType,
  ) {
    this.type = type;
    const copy = PANEL_COPY[type];

    this.root = document.createElement('div');
    this.root.className = 'flex flex-col gap-3 min-h-0';

    const header = document.createElement('div');
    header.className = 'flex flex-col gap-1';
    header.innerHTML = `
      <h2 class="m-0 text-lg font-semibold">${copy.title}</h2>
      <p class="m-0 text-es-muted text-sm">Stock and your library — click an item to add it to the canvas.</p>
    `;

    const tabs = document.createElement('div');
    tabs.className =
      'inline-flex gap-1 p-1 rounded-lg bg-white/[0.03] border border-es-border self-start';
    const stockTab = this.createTab('Stock', true);
    const libraryTab = this.createTab('My Library', false);
    tabs.append(stockTab, libraryTab);

    this.searchInput = document.createElement('input');
    this.searchInput.type = 'search';
    this.searchInput.placeholder = `Search ${copy.title.toLowerCase()}…`;
    this.searchInput.className =
      'border border-es-border rounded-lg px-3 py-2 bg-[#11151d] text-es-text text-sm';

    const uploadButton = document.createElement('button');
    uploadButton.type = 'button';
    uploadButton.className =
      'border border-dashed border-es-border rounded-lg px-3 py-2.5 bg-white/[0.02] text-es-text text-sm cursor-pointer hover:border-es-accent hover:bg-[#1a2233]';
    uploadButton.textContent = copy.uploadLabel;

    this.fileInput = document.createElement('input');
    this.fileInput.type = 'file';
    this.fileInput.accept = copy.accept;
    this.fileInput.hidden = true;

    uploadButton.addEventListener('click', () => this.fileInput.click());
    this.fileInput.addEventListener('change', () => {
      const file = this.fileInput.files?.[0];
      if (file) {
        this.sidebar.addMediaFromFile(file);
        this.libraryTab = 'library';
        this.setTabState(stockTab, libraryTab);
        this.renderItems();
      }
      this.fileInput.value = '';
    });

    this.emptyState = document.createElement('p');
    this.emptyState.className = 'm-0 text-es-muted text-sm text-center py-8 px-4';
    this.emptyState.textContent = copy.empty;

    this.grid = document.createElement('div');
    this.grid.className =
      'grid grid-cols-2 gap-2.5 overflow-y-auto min-h-0 max-h-[min(420px,45vh)] pr-0.5';

    stockTab.addEventListener('click', () => {
      this.libraryTab = 'stock';
      this.setTabState(stockTab, libraryTab);
      this.renderItems();
    });

    libraryTab.addEventListener('click', () => {
      this.libraryTab = 'library';
      this.setTabState(stockTab, libraryTab);
      this.renderItems();
    });

    this.searchInput.addEventListener('input', () => {
      this.query = this.searchInput.value.trim().toLowerCase();
      this.renderItems();
    });

    this.sidebar.on('media:added', () => this.renderItems());
    this.sidebar.on('media:removed', () => this.renderItems());

    this.root.append(header, tabs, this.searchInput, uploadButton, this.fileInput, this.grid, this.emptyState);
    this.renderItems();
  }

  get element(): HTMLElement {
    return this.root;
  }

  private createTab(label: string, active: boolean): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.className = active
      ? 'px-3 py-1.5 rounded-md text-sm bg-es-accent text-white cursor-pointer'
      : 'px-3 py-1.5 rounded-md text-sm text-es-muted hover:text-es-text cursor-pointer';
    return button;
  }

  private setTabState(stockTab: HTMLButtonElement, libraryTab: HTMLButtonElement): void {
    const activeClass = 'px-3 py-1.5 rounded-md text-sm bg-es-accent text-white cursor-pointer';
    const idleClass =
      'px-3 py-1.5 rounded-md text-sm text-es-muted hover:text-es-text cursor-pointer';
    stockTab.className = this.libraryTab === 'stock' ? activeClass : idleClass;
    libraryTab.className = this.libraryTab === 'library' ? activeClass : idleClass;
  }

  private renderItems(): void {
    const items = this.sidebar
      .getMediaLibrary(this.type)
      .filter((item) => (this.libraryTab === 'stock' ? item.source === 'stock' : item.source !== 'stock'))
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
    meta.textContent = item.source;

    card.append(thumb, label, meta);
    card.addEventListener('click', () => this.sidebar.selectMediaItem(item));
    return card;
  }
}
