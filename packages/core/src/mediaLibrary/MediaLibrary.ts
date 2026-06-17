import type { MediaLibraryItem, ResolvedMediaInput } from '@opensource/sidebar';

import { MediaLibraryEventEmitter } from './events';
import type {
  AddMediaFromFileOptions,
  MediaLibraryEventHandler,
  MediaLibraryEventName,
} from './types';

let nextMediaId = 0;

function createMediaId(): string {
  nextMediaId += 1;
  return `media-${nextMediaId}`;
}

export class MediaLibrary {
  readonly events = new MediaLibraryEventEmitter();
  private readonly items = new Map<string, MediaLibraryItem>();
  private readonly objectUrls = new Set<string>();

  list(type?: MediaLibraryItem['type']): MediaLibraryItem[] {
    const all = [...this.items.values()].sort((a, b) => b.createdAt - a.createdAt);
    return type ? all.filter((item) => item.type === type) : all;
  }

  get(id: string): MediaLibraryItem | undefined {
    return this.items.get(id);
  }

  requestUpload(
    file: File,
    options: AddMediaFromFileOptions = {},
  ): void {
    this.events.emit('upload:requested', { file, ...options });
  }

  requestRemove(id: string): void {
    this.events.emit('remove:requested', { id });
  }

  selectItem(item: MediaLibraryItem, startTime?: number): void {
    this.events.emit('selected', { item, startTime });
  }

  on<T extends MediaLibraryEventName>(
    event: T,
    handler: MediaLibraryEventHandler<T>,
  ): () => void {
    return this.events.on(event, handler);
  }

  off<T extends MediaLibraryEventName>(
    event: T,
    handler: MediaLibraryEventHandler<T>,
  ): void {
    this.events.off(event, handler);
  }

  add(item: Omit<MediaLibraryItem, 'id' | 'createdAt'> & { id?: string }): MediaLibraryItem {
    const entry: MediaLibraryItem = {
      ...item,
      id: item.id ?? createMediaId(),
      createdAt: Date.now(),
    };
    this.items.set(entry.id, entry);
    this.events.emit('added', { item: entry });
    return entry;
  }

  addFromFile(file: File): MediaLibraryItem {
    const src = URL.createObjectURL(file);
    this.objectUrls.add(src);

    const type = file.type.startsWith('video/')
      ? 'video'
      : file.type.startsWith('audio/')
        ? 'audio'
        : 'image';

    return this.add({
      type,
      name: file.name,
      src,
      source: 'upload',
    });
  }

  addFromResolvedMedia(input: ResolvedMediaInput): MediaLibraryItem {
    if (input.src.startsWith('blob:')) {
      this.objectUrls.add(input.src);
    }

    return this.add({
      id: input.id,
      assetId: input.assetId,
      type: input.type,
      name: input.name,
      src: input.src,
      thumbnail: input.thumbnail,
      source: 'library',
    });
  }

  loadPersistedItems(items: MediaLibraryItem[]): void {
    for (const item of this.items.values()) {
      if (item.source === 'upload' || item.source === 'library') {
        if (item.src.startsWith('blob:')) {
          URL.revokeObjectURL(item.src);
          this.objectUrls.delete(item.src);
        }
      }
    }

    for (const [id, item] of [...this.items.entries()]) {
      if (item.source === 'upload' || item.source === 'library') {
        this.items.delete(id);
      }
    }

    for (const item of items) {
      if (item.src.startsWith('blob:')) {
        this.objectUrls.add(item.src);
      }
      this.items.set(item.id, item);
    }

    this.events.emit('changed', {});
  }

  getPersistedItems(): MediaLibraryItem[] {
    return this.list().filter((item) => item.source === 'library' && item.assetId);
  }

  remove(id: string): MediaLibraryItem | undefined {
    const item = this.items.get(id);
    if (!item) {
      return undefined;
    }

    if (item.source === 'upload' && item.src.startsWith('blob:')) {
      URL.revokeObjectURL(item.src);
      this.objectUrls.delete(item.src);
    }

    if (item.source === 'library' && item.src.startsWith('blob:')) {
      this.objectUrls.delete(item.src);
    }

    this.items.delete(id);
    this.events.emit('removed', { id });
    return item;
  }

  destroy(): void {
    for (const url of this.objectUrls) {
      URL.revokeObjectURL(url);
    }
    this.objectUrls.clear();
    this.items.clear();
  }
}
