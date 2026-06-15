import type { TimelineState } from '@opensource/timeline';
import type { CanvasState } from '@opensource/video-canvas';
import { describe, expect, it } from 'vitest';

import { MediaAssetService } from './MediaAssetService';
import { captureProjectDocument, resolveProjectDocument } from './ProjectSerializer';
import { FileSystemProjectStore } from './FileSystemProjectStore';
import { IndexedDbProjectIndex } from './IndexedDbProjectIndex';
import type { PersistedMediaAsset, ProjectMetadata } from './types';

function createMockStore(): FileSystemProjectStore {
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
      return createFileHandle(name, mediaFiles);
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

  return new FileSystemProjectStore(directoryHandle);
}

function createFileHandle(name: string, mediaFiles: Map<string, Blob>) {
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
}

const meta: ProjectMetadata = {
  id: 'project-1',
  name: 'Test',
  createdAt: 1,
  updatedAt: 1,
};

describe('ProjectSerializer', () => {
  it('round-trips project media via assetId indirection', async () => {
    const store = createMockStore();
    const index = new IndexedDbProjectIndex();
    const mediaAssets = new MediaAssetService(store, index, meta.id);

    const source = new File(['video-bytes'], 'clip.mp4', { type: 'video/mp4' });
    const asset: PersistedMediaAsset = {
      id: 'asset-1',
      relativePath: 'media/asset-1-clip.mp4',
      name: 'clip.mp4',
      mimeType: 'video/mp4',
      size: source.size,
      lastModified: source.lastModified,
    };

    await store.writeMediaFile(asset.relativePath, source);
    const handle = await store.getMediaFileHandle(asset.relativePath);
    const projectFile = await handle.getFile();
    const url = URL.createObjectURL(projectFile);
    mediaAssets.registerResolvedAsset(asset, url);

    const timeline: TimelineState = {
      tracks: [],
      clips: [
        {
          id: 'clip-1',
          trackId: 'track-1',
          type: 'video',
          name: 'clip.mp4',
          startTime: 0,
          duration: 5,
          inPoint: 0,
          outPoint: 5,
          url,
        },
      ],
      playheadPosition: 0,
      duration: 10,
      zoom: 50,
      scrollX: 0,
      snappingEnabled: true,
      isPlaying: false,
      playbackRate: 1,
      toolMode: 'select',
      selectedClipIds: [],
      primarySelectedClipId: null,
    };

    const canvas: CanvasState = {
      elements: [
        {
          id: 'element-1',
          type: 'video',
          name: 'clip.mp4',
          src: url,
          x: 0,
          y: 0,
          width: 1920,
          height: 1080,
          rotation: 0,
          zIndex: 0,
          startTime: 0,
          duration: 5,
          opacity: 1,
          muted: false,
          loop: false,
        },
      ],
      selectedId: null,
      playerSize: { width: 1920, height: 1080 },
      aspectRatio: '16:9',
    };

    const document = captureProjectDocument({
      meta,
      timeline,
      canvas,
      mediaLibrary: [
        {
          id: 'media-1',
          assetId: 'asset-1',
          type: 'video',
          name: 'clip.mp4',
          src: url,
          createdAt: 1,
          source: 'library',
        },
      ],
      mediaAssets,
    });

    expect(document.timeline.clips[0]?.url).toBeUndefined();
    expect((document.timeline.clips[0] as { assetId?: string }).assetId).toBe('asset-1');
    expect(document.canvas.elements[0]).toMatchObject({ assetId: 'asset-1' });

    const resolved = resolveProjectDocument(document, mediaAssets);
    expect(resolved.timeline.clips[0]?.url).toBe(url);
    expect(resolved.canvas.elements[0]?.type === 'video' && resolved.canvas.elements[0].src).toBe(url);

    URL.revokeObjectURL(url);
    mediaAssets.destroy();
  });
});
