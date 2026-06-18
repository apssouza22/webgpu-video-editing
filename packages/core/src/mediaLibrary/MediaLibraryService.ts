import { probeMediaDuration } from './duration';
import { MediaLibraryEventEmitter } from './events';
import type {
  AddMediaFromFileOptions,
  MediaLibraryEventHandler,
  MediaLibraryEventName,
  MediaLibraryItem,
} from './types';

let nextMediaId = 0;

function createMediaId(): string {
  nextMediaId += 1;
  return `media-${nextMediaId}`;
}

export class MediaLibraryService {
  readonly events = new MediaLibraryEventEmitter();
  private readonly items = new Map<string, MediaLibraryItem>();
  private readonly objectUrls = new Set<string>();

  list(type?: MediaLibraryItem['type']): MediaLibraryItem[] {
    const all = [...this.items.values()].sort((a, b) => b.createdAt - a.createdAt);
    return type ? all.filter((item) => item.type === type) : all;
  }

  requestUpload(
    file: File,
    options: AddMediaFromFileOptions = {},
  ): void {
    this.events.emit('upload:requested', { file, ...options });
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
    });
  }

  setDuration(id: string, duration: number): void {
    const item = this.items.get(id);
    if (!item || item.duration === duration) {
      return;
    }

    this.items.set(id, { ...item, duration });
    this.events.emit('changed', {});
  }

  remove(id: string): MediaLibraryItem | undefined {
    const item = this.items.get(id);
    if (!item) {
      return undefined;
    }

    if (item.src.startsWith('blob:')) {
      URL.revokeObjectURL(item.src);
      this.objectUrls.delete(item.src);
    }

    this.items.delete(id);
    this.events.emit('removed', { id });
    return item;
  }

  private add(item: Omit<MediaLibraryItem, 'id' | 'createdAt'> & { id?: string }): MediaLibraryItem {
    const entry: MediaLibraryItem = {
      ...item,
      id: item.id ?? createMediaId(),
      createdAt: Date.now(),
    };
    this.items.set(entry.id, entry);
    this.events.emit('added', { item: entry });
    this.probeDuration(entry);
    return entry;
  }

  private probeDuration(item: MediaLibraryItem): void {
    if (item.type !== 'video' && item.type !== 'audio') {
      return;
    }

    if (item.duration !== undefined) {
      return;
    }

    const kind = item.type === 'audio' ? 'audio' : 'video';
    void probeMediaDuration(item.src, kind).then((duration) => {
      if (duration === undefined) {
        return;
      }

      const current = this.items.get(item.id);
      if (!current || current.src !== item.src) {
        return;
      }

      this.setDuration(item.id, duration);
    });
  }
}
