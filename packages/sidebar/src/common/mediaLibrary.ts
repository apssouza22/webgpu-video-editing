import { SAMPLE_IMAGE_SRC, SAMPLE_VIDEO_SRC } from '@opensource/video-canvas';

import type { MediaLibraryItem } from './types';

let nextMediaId = 0;

function createMediaId(): string {
  nextMediaId += 1;
  return `media-${nextMediaId}`;
}

export function createStockMedia(): MediaLibraryItem[] {
  return [
    {
      id: createMediaId(),
      type: 'video',
      name: 'Sample clip',
      src: SAMPLE_VIDEO_SRC,
      thumbnail: SAMPLE_IMAGE_SRC,
      createdAt: Date.now(),
      source: 'stock',
    },
    {
      id: createMediaId(),
      type: 'image',
      name: 'Sample image',
      src: SAMPLE_IMAGE_SRC,
      thumbnail: SAMPLE_IMAGE_SRC,
      createdAt: Date.now(),
      source: 'stock',
    },
  ];
}

export class MediaLibrary {
  private readonly items = new Map<string, MediaLibraryItem>();
  private readonly objectUrls = new Set<string>();

  constructor(stockMedia: MediaLibraryItem[] = createStockMedia()) {
    for (const item of stockMedia) {
      this.items.set(item.id, item);
    }
  }

  list(type?: MediaLibraryItem['type']): MediaLibraryItem[] {
    const all = [...this.items.values()].sort((a, b) => b.createdAt - a.createdAt);
    return type ? all.filter((item) => item.type === type) : all;
  }

  get(id: string): MediaLibraryItem | undefined {
    return this.items.get(id);
  }

  add(item: Omit<MediaLibraryItem, 'id' | 'createdAt'> & { id?: string }): MediaLibraryItem {
    const entry: MediaLibraryItem = {
      ...item,
      id: item.id ?? createMediaId(),
      createdAt: Date.now(),
    };
    this.items.set(entry.id, entry);
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

  remove(id: string): MediaLibraryItem | undefined {
    const item = this.items.get(id);
    if (!item) {
      return undefined;
    }

    if (item.source === 'upload' && item.src.startsWith('blob:')) {
      URL.revokeObjectURL(item.src);
      this.objectUrls.delete(item.src);
    }

    this.items.delete(id);
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
