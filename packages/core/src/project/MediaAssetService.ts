import type { MediaLibraryItem } from '../mediaLibrary/types';

import { FileSystemProjectStore } from './FileSystemProjectStore';
import { IndexedDbProjectIndex } from './IndexedDbProjectIndex';
import { mediaTypeFromMime } from './fileSystemAccess';
import type {
  ImportMediaResult,
  PersistedMediaAsset,
  ResolvedMediaAsset,
} from './types';

function createAssetId(): string {
  return `asset-${crypto.randomUUID()}`;
}

export class MediaAssetService {
  private readonly urlByAssetId = new Map<string, string>();
  private readonly assetIdByUrl = new Map<string, string>();
  private readonly objectUrls = new Set<string>();
  private readonly assets = new Map<string, PersistedMediaAsset>();

  constructor(
    private readonly store: FileSystemProjectStore,
    private readonly index: IndexedDbProjectIndex,
    private projectId: string,
  ) {}

  setProjectId(projectId: string): void {
    this.projectId = projectId;
  }

  listAssets(): PersistedMediaAsset[] {
    return [...this.assets.values()];
  }

  getAsset(assetId: string): PersistedMediaAsset | undefined {
    return this.assets.get(assetId);
  }

  resolveUrl(assetId: string): string | undefined {
    return this.urlByAssetId.get(assetId);
  }

  findAssetIdByUrl(url: string): string | undefined {
    return this.assetIdByUrl.get(url);
  }

  registerResolvedAsset(asset: PersistedMediaAsset, url: string): void {
    this.assets.set(asset.id, asset);
    this.urlByAssetId.set(asset.id, url);
    this.assetIdByUrl.set(url, asset.id);
    if (url.startsWith('blob:')) {
      this.objectUrls.add(url);
    }
  }

  async importFromHandle(fileHandle: FileSystemFileHandle): Promise<ImportMediaResult> {
    const sourceFile = await fileHandle.getFile();
    return this.importFromFile(sourceFile);
  }

  async importFromFile(sourceFile: File | Blob, fileName?: string): Promise<ImportMediaResult> {
    const name = fileName ?? (sourceFile instanceof File ? sourceFile.name : 'media');
    const assetId = createAssetId();
    const relativePath = this.store.buildMediaRelativePath(assetId, name);

    await this.store.writeMediaFile(relativePath, sourceFile);

    const asset: PersistedMediaAsset = {
      id: assetId,
      relativePath,
      name,
      mimeType: sourceFile.type || 'application/octet-stream',
      size: sourceFile.size,
      lastModified: sourceFile instanceof File ? sourceFile.lastModified : Date.now(),
    };

    const projectFileHandle = await this.store.getMediaFileHandle(relativePath);
    const projectFile = await projectFileHandle.getFile();
    const url = URL.createObjectURL(projectFile);

    this.registerResolvedAsset(asset, url);
    await this.index.upsertMediaAsset({
      assetId: asset.id,
      projectId: this.projectId,
      relativePath: asset.relativePath,
      name: asset.name,
      mimeType: asset.mimeType,
      size: asset.size,
      lastModified: asset.lastModified,
    });

    return {
      asset,
      url,
      type: mediaTypeFromMime(asset.mimeType),
    };
  }

  async hydrate(assets: PersistedMediaAsset[]): Promise<ResolvedMediaAsset[]> {
    const resolved: ResolvedMediaAsset[] = [];

    for (const asset of assets) {
      const fileHandle = await this.store.getMediaFileHandle(asset.relativePath);
      const file = await fileHandle.getFile();
      const url = URL.createObjectURL(file);
      this.registerResolvedAsset(asset, url);
      resolved.push({
        assetId: asset.id,
        url,
        name: asset.name,
        mimeType: asset.mimeType,
        size: asset.size,
        lastModified: asset.lastModified,
      });
    }

    return resolved;
  }

  toMediaLibraryItem(
    entry: {
      id: string;
      assetId: string;
      type: MediaLibraryItem['type'];
      name: string;
      createdAt: number;
      thumbnailAssetId?: string;
    },
  ): MediaLibraryItem | null {
    const url = this.resolveUrl(entry.assetId);
    if (!url) {
      return null;
    }

    const thumbnail = entry.thumbnailAssetId
      ? this.resolveUrl(entry.thumbnailAssetId)
      : undefined;

    return {
      id: entry.id,
      assetId: entry.assetId,
      type: entry.type,
      name: entry.name,
      src: url,
      thumbnail,
      createdAt: entry.createdAt,
      source: 'library',
    };
  }

  destroy(): void {
    for (const url of this.objectUrls) {
      URL.revokeObjectURL(url);
    }
    this.objectUrls.clear();
    this.urlByAssetId.clear();
    this.assetIdByUrl.clear();
    this.assets.clear();
  }
}
