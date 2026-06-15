import { describe, expect, it, vi } from 'vitest';

import { MediaAssetService } from './MediaAssetService';
import { FileSystemProjectStore } from './FileSystemProjectStore';
import { IndexedDbProjectIndex } from './IndexedDbProjectIndex';

function createMockEnvironment() {
  const mediaFiles = new Map<string, Blob>();

  const mediaDir = {
    async getFileHandle(name: string, options?: { create?: boolean }) {
      if (!mediaFiles.has(name) && !options?.create) {
        throw new DOMException('Not found', 'NotFoundError');
      }
      if (options?.create) {
        mediaFiles.set(name, new Blob());
      }
      return {
        async getFile() {
          const blob = mediaFiles.get(name);
          if (!blob) {
            throw new DOMException('Not found', 'NotFoundError');
          }
          return new File([blob], name, { type: blob.type || 'video/mp4' });
        },
        async createWritable() {
          const chunks: BlobPart[] = [];
          return {
            async write(data: Blob) {
              chunks.push(data);
            },
            async close() {
              mediaFiles.set(name, new Blob(chunks, { type: 'video/mp4' }));
            },
          };
        },
      } as unknown as FileSystemFileHandle;
    },
  };

  const directoryHandle = {
    async queryPermission() {
      return 'granted' as const;
    },
    async requestPermission() {
      return 'granted' as const;
    },
    async getDirectoryHandle(_name: string, options?: { create?: boolean }) {
      if (options?.create) {
        return mediaDir;
      }
      return mediaDir;
    },
  } as unknown as FileSystemDirectoryHandle;

  const store = new FileSystemProjectStore(directoryHandle);
  const index = {
    upsertMediaAsset: vi.fn(async () => undefined),
  } as unknown as IndexedDbProjectIndex;

  return { store, index, mediaFiles };
}

describe('MediaAssetService', () => {
  it('copies imported media into the project directory and exposes a runtime URL', async () => {
    const { store, index, mediaFiles } = createMockEnvironment();
    const service = new MediaAssetService(store, index, 'project-1');

    const source = new File(['hello'], 'clip.mp4', { type: 'video/mp4' });
    const sourceHandle = {
      async getFile() {
        return source;
      },
    } as FileSystemFileHandle;

    const result = await service.importFromHandle(sourceHandle);

    expect(result.asset.relativePath).toContain('media/asset-');
    expect(result.asset.relativePath).toContain('clip.mp4');
    expect(result.type).toBe('video');
    expect(result.url.startsWith('blob:')).toBe(true);
    expect([...mediaFiles.keys()].some((name) => name.includes('clip.mp4'))).toBe(true);
    expect(service.resolveUrl(result.asset.id)).toBe(result.url);

    service.destroy();
    URL.revokeObjectURL(result.url);
  });
});
