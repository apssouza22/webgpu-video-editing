import { describe, expect, it, vi } from 'vitest';

import { MediaLibraryService } from '../mediaLibrary';
import { ProjectSession } from './ProjectSession';
import { FileSystemProjectStore } from './FileSystemProjectStore';

vi.mock('./IndexedDbProjectIndex', () => ({
  IndexedDbProjectIndex: class {
    upsertProject = vi.fn(async () => undefined);
    upsertMediaAsset = vi.fn(async () => undefined);
    getLastOpenedProject = vi.fn(async () => null);
  },
}));

function createMockStore() {
  const mediaFiles = new Map<string, Blob>();
  const rootFiles = new Map<string, string>();

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
    async getFileHandle(name: string, options?: { create?: boolean }) {
      if (!rootFiles.has(name) && !options?.create) {
        throw new DOMException('Not found', 'NotFoundError');
      }
      if (options?.create) {
        rootFiles.set(name, '{}');
      }
      return {
        async getFile() {
          return new File([rootFiles.get(name) ?? '{}'], name, { type: 'application/json' });
        },
        async createWritable() {
          const chunks: string[] = [];
          return {
            async write(data: string) {
              chunks.push(data);
            },
            async close() {
              rootFiles.set(name, chunks.join(''));
            },
          };
        },
      };
    },
    async getDirectoryHandle(_name: string, options?: { create?: boolean }) {
      if (options?.create) {
        return mediaDir;
      }
      return mediaDir;
    },
  } as unknown as FileSystemDirectoryHandle;

  return {
    store: new FileSystemProjectStore(directoryHandle),
    directoryHandle,
    mediaFiles,
    rootFiles,
  };
}

describe('ProjectSession', () => {
  it('persists uploaded media into the open project', async () => {
    const { store, directoryHandle } = createMockStore();
    const session = new ProjectSession();
    const mediaLibrary = new MediaLibraryService();

    const timeline = {
      getState: () => ({
        tracks: [],
        clips: [],
        playheadPosition: 0,
        duration: 10,
        zoom: 50,
        scrollX: 0,
        snappingEnabled: true,
        isPlaying: false,
        playbackRate: 1,
        toolMode: 'select' as const,
        selectedClipIds: [],
        primarySelectedClipId: null,
      }),
      loadState: vi.fn(),
      on: vi.fn(() => () => undefined),
    };

    const canvas = {
      getState: () => ({
        elements: [],
        selectedId: null,
        playerSize: { width: 1920, height: 1080 },
        aspectRatio: '16:9' as const,
      }),
      loadState: vi.fn(),
      getCurrentTime: () => 0,
      render: vi.fn(),
      on: vi.fn(() => () => undefined),
    };

    session.setSaveContext({
      timeline: timeline as never,
      preview: canvas as never,
      sidebar: null,
      mediaLibrary,
    });

    await session.createProject(
      'Test project',
      directoryHandle,
      timeline as never,
      canvas as never,
      mediaLibrary,
      null,
    );

    const file = new File(['video-bytes'], 'upload.mp4', { type: 'video/mp4' });
    const item = await session.importUploadedFile(file, mediaLibrary, null);
    await session.flushSave(timeline as never, canvas as never, null, mediaLibrary);

    expect(item.source).toBe('library');
    expect(item.assetId).toBeDefined();
    expect(item.name).toBe('upload.mp4');
    expect(mediaLibrary.getPersistedItems()).toHaveLength(1);

    const document = session.getDocument();
    expect(document?.media).toHaveLength(1);
    expect(document?.mediaLibrary).toHaveLength(1);

    const saved = await store.readDocument();
    expect(saved?.media).toHaveLength(1);
    expect(saved?.mediaLibrary[0]?.assetId).toBe(item.assetId);

    session.destroy();
    mediaLibrary.destroy();
  });
});
