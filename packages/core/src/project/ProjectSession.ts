import type { Timeline } from '@opensource/timeline';
import type { CompositionPreview } from '@opensource/video-preview';
import type { MediaLibraryItem, Sidebar } from '@opensource/sidebar';

import type { TimelinePreviewSyncer } from '../clipPreviewSync';
import type { MediaLibrary } from '../mediaLibrary';
import { FileSystemProjectStore } from './FileSystemProjectStore';
import { IndexedDbProjectIndex } from './IndexedDbProjectIndex';
import { MediaAssetService } from './MediaAssetService';
import {
  captureProjectDocument,
  resolveProjectDocument,
} from './ProjectSerializer';
import {
  ensureDirectoryPermission,
  pickMediaFiles,
  pickProjectDirectory,
} from './fileSystemAccess';
import { remapCanvasStateUrls, remapTimelineStateUrls } from './remapEditorUrls';
import type {
  ProjectDocument,
  ProjectMetadata,
  ProjectPersistenceStatus,
} from './types';

async function fetchMediaAsFile(src: string, name: string): Promise<File> {
  const response = await fetch(src);
  const blob = await response.blob();
  return new File([blob], name, { type: blob.type || 'application/octet-stream' });
}

export interface ProjectSessionOptions {
  debounceMs?: number;
  onStatus?: (status: ProjectPersistenceStatus) => void;
  onError?: (error: Error) => void;
}

export class ProjectSession {
  private readonly index = new IndexedDbProjectIndex();
  private store: FileSystemProjectStore | null = null;
  private mediaAssets: MediaAssetService | null = null;
  private document: ProjectDocument | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingSave = false;
  private phase: ProjectPersistenceStatus['phase'] = 'idle';
  private readonly debounceMs: number;
  private saveContext: {
    timeline: Timeline;
    preview: CompositionPreview;
    sidebar: Sidebar | null;
    mediaLibrary: MediaLibrary;
  } | null = null;

  constructor(private readonly options: ProjectSessionOptions = {}) {
    this.debounceMs = options.debounceMs ?? 1000;
  }

  setSaveContext(context: {
    timeline: Timeline;
    preview: CompositionPreview;
    sidebar: Sidebar | null;
    mediaLibrary: MediaLibrary;
  }): void {
    this.saveContext = context;
  }

  getDocument(): ProjectDocument | null {
    return this.document;
  }

  getMediaAssets(): MediaAssetService | null {
    return this.mediaAssets;
  }

  isOpen(): boolean {
    return this.document !== null && this.store !== null && this.mediaAssets !== null;
  }

  isBusy(): boolean {
    return this.phase === 'loading' || this.phase === 'saving' || this.phase === 'importing';
  }

  async createProject(
    name: string,
    directoryHandle: FileSystemDirectoryHandle,
    timeline: Timeline,
    preview: CompositionPreview,
    mediaLibrary: MediaLibrary,
    sidebar: Sidebar | null,
    clipPreviewSync?: TimelinePreviewSyncer,
  ): Promise<ProjectDocument> {
    this.emitStatus({ phase: 'loading', message: 'Creating project…' });

    const store = new FileSystemProjectStore(directoryHandle);
    await store.ensureAccess();

    const now = Date.now();
    const meta: ProjectMetadata = {
      id: `project-${crypto.randomUUID()}`,
      name,
      createdAt: now,
      updatedAt: now,
    };

    this.mediaAssets?.destroy();
    this.store = store;
    this.mediaAssets = new MediaAssetService(store, this.index, meta.id);

    const urlMap = await this.importCurrentMediaLibrary(mediaLibrary, sidebar);
    clipPreviewSync?.pause();

    try {
      const timelineState = remapTimelineStateUrls(timeline.getState(), urlMap);
      const canvasState = remapCanvasStateUrls(preview.getState(), urlMap);
      timeline.loadState(timelineState);
      preview.loadState(canvasState);
      clipPreviewSync?.rebuildMappings();
      preview.render(preview.getCurrentTime(), { playing: false });
    } finally {
      clipPreviewSync?.resume();
    }

    const document = captureProjectDocument({
      meta,
      timeline: timeline.getState(),
      canvas: preview.getState(),
      mediaLibrary: mediaLibrary.getPersistedItems(),
      mediaAssets: this.mediaAssets,
    });
    await store.writeDocument(document);

    this.document = document;
    await this.index.upsertProject({
      projectId: document.meta.id,
      name: document.meta.name,
      directoryHandle: store.getDirectoryHandle(),
      updatedAt: document.meta.updatedAt,
      lastOpenedAt: Date.now(),
    });

    this.emitStatus({
      phase: 'ready',
      message: 'Project created.',
      projectId: document.meta.id,
      projectName: document.meta.name,
    });
    return document;
  }

  async openProject(directoryHandle?: FileSystemDirectoryHandle): Promise<ProjectDocument> {
    this.emitStatus({ phase: 'loading', message: 'Opening project…' });

    const handle = directoryHandle ?? (await pickProjectDirectory());
    const store = new FileSystemProjectStore(handle);
    const document = await store.readDocument();
    if (!document) {
      throw new Error('No project.json found in the selected directory.');
    }

    await this.openWithDocument(store, document);
    this.emitStatus({
      phase: 'ready',
      message: 'Project opened.',
      projectId: document.meta.id,
      projectName: document.meta.name,
    });
    return document;
  }

  async restoreLastProject(
    timeline: Timeline,
    preview: CompositionPreview,
    sidebar: Sidebar | null,
    mediaLibrary: MediaLibrary,
    clipPreviewSync: TimelinePreviewSyncer,
  ): Promise<ProjectDocument | null> {
    const record = await this.index.getLastOpenedProject();
    if (!record) {
      return null;
    }

    this.emitStatus({ phase: 'loading', message: 'Restoring last project…' });

    try {
      const granted = await ensureDirectoryPermission(record.directoryHandle, 'readwrite');
      if (!granted) {
        this.emitStatus({
          phase: 'idle',
          message: 'Last project found. Open it to restore your work.',
        });
        return null;
      }

      const store = new FileSystemProjectStore(record.directoryHandle);
      const document = await store.readDocument();
      if (!document) {
        this.emitStatus({
          phase: 'idle',
          message: 'Last project folder is missing project.json.',
        });
        return null;
      }

      await this.openWithDocument(store, document);
      await this.hydrate(timeline, preview, sidebar, mediaLibrary, clipPreviewSync);
      return document;
    } catch (error) {
      this.handleError(error);
      return null;
    }
  }

  async importUploadedFile(
    file: File,
    mediaLibrary: MediaLibrary,
    _sidebar: Sidebar | null,
  ): Promise<MediaLibraryItem> {
    if (!this.store || !this.mediaAssets || !this.document) {
      throw new Error('Open a project before uploading media.');
    }

    this.emitStatus({ phase: 'importing', message: 'Saving media to project…' });

    const imported = await this.mediaAssets.importFromFile(file);
    const item = mediaLibrary.addFromResolvedMedia({
      assetId: imported.asset.id,
      type: imported.type,
      name: imported.asset.name,
      src: imported.url,
    });

    this.scheduleSave();

    this.emitStatus({
      phase: 'ready',
      message: 'Media saved to project.',
      projectId: this.document.meta.id,
      projectName: this.document.meta.name,
    });
    return item;
  }

  async pickAndImportMedia(
    mediaLibrary: MediaLibrary,
    sidebar: Sidebar | null,
  ): Promise<void> {
    if (!this.store || !this.mediaAssets || !this.document) {
      throw new Error('Open a project before importing media.');
    }

    this.emitStatus({ phase: 'importing', message: 'Importing media…' });

    const handles = await pickMediaFiles({
      'video/*': ['.mp4', '.mov', '.webm', '.mkv'],
      'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.gif'],
      'audio/*': ['.mp3', '.wav', '.aac', '.m4a', '.ogg'],
    });

    for (const handle of handles) {
      const imported = await this.mediaAssets.importFromHandle(handle);
      const item = mediaLibrary.addFromResolvedMedia({
        assetId: imported.asset.id,
        type: imported.type,
        name: imported.asset.name,
        src: imported.url,
      });
      sidebar?.notifyMediaAdded(item);
    }

    this.scheduleSave();
    this.emitStatus({
      phase: 'ready',
      message: 'Media imported.',
      projectId: this.document.meta.id,
      projectName: this.document.meta.name,
    });
  }

  async hydrate(
    timeline: Timeline,
    preview: CompositionPreview,
    sidebar: Sidebar | null,
    mediaLibrary: MediaLibrary,
    clipPreviewSync: TimelinePreviewSyncer,
  ): Promise<void> {
    if (!this.document || !this.mediaAssets) {
      return;
    }

    this.emitStatus({ phase: 'loading', message: 'Loading project state…' });
    clipPreviewSync.pause();

    try {
      const inFlightLibraryItems = mediaLibrary.getPersistedItems();

      await this.mediaAssets.hydrate(this.document.media);
      const resolved = resolveProjectDocument(this.document, this.mediaAssets);

      const resolvedIds = new Set(resolved.mediaLibrary.map((item) => item.id));
      const mergedMediaLibrary = [
        ...resolved.mediaLibrary,
        ...inFlightLibraryItems.filter((item) => !resolvedIds.has(item.id)),
      ];

      timeline.loadState(resolved.timeline);
      preview.loadState(resolved.canvas);

      mediaLibrary.loadPersistedItems(mergedMediaLibrary);

      if (sidebar) {
        for (const item of mergedMediaLibrary) {
          sidebar.notifyMediaAdded(item);
        }
      }

      clipPreviewSync.rebuildMappings();
      preview.render(preview.getCurrentTime(), { playing: false });
    } finally {
      clipPreviewSync.resume();
      this.emitStatus({
        phase: 'ready',
        message: 'Project loaded.',
        projectId: this.document.meta.id,
        projectName: this.document.meta.name,
      });
    }
  }

  scheduleSave(): void {
    this.pendingSave = true;
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      void this.flushSave();
    }, this.debounceMs);
  }

  async flushSave(
    timeline?: Timeline,
    preview?: CompositionPreview,
    _sidebar?: Sidebar | null,
    mediaLibrary?: MediaLibrary,
  ): Promise<void> {
    const resolvedTimeline = timeline ?? this.saveContext?.timeline;
    const resolvedPreview = preview ?? this.saveContext?.preview;
    const resolvedMediaLibrary = mediaLibrary ?? this.saveContext?.mediaLibrary;

    if (!this.pendingSave || !this.store || !this.mediaAssets || !this.document) {
      return;
    }

    if (!resolvedTimeline || !resolvedPreview || !resolvedMediaLibrary) {
      return;
    }

    this.pendingSave = false;
    this.emitStatus({
      phase: 'saving',
      message: 'Saving project…',
      projectId: this.document.meta.id,
      projectName: this.document.meta.name,
    });

    try {
      const libraryItems = resolvedMediaLibrary.getPersistedItems();
      this.document = captureProjectDocument({
        meta: this.document.meta,
        timeline: resolvedTimeline.getState(),
        canvas: resolvedPreview.getState(),
        mediaLibrary: libraryItems,
        mediaAssets: this.mediaAssets,
        transcription: this.document.transcription,
      });

      await this.store.writeDocument(this.document);
      await this.index.upsertProject({
        projectId: this.document.meta.id,
        name: this.document.meta.name,
        directoryHandle: this.store.getDirectoryHandle(),
        updatedAt: this.document.meta.updatedAt,
        lastOpenedAt: Date.now(),
      });

      this.emitStatus({
        phase: 'ready',
        message: 'Project saved.',
        projectId: this.document.meta.id,
        projectName: this.document.meta.name,
      });
    } catch (error) {
      this.pendingSave = true;
      this.handleError(error);
      throw error;
    }
  }

  destroy(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    this.mediaAssets?.destroy();
    this.mediaAssets = null;
    this.store = null;
    this.document = null;
  }

  private async importCurrentMediaLibrary(
    mediaLibrary: MediaLibrary,
    sidebar: Sidebar | null,
  ): Promise<Map<string, string>> {
    if (!this.mediaAssets) {
      throw new Error('Media assets are not initialized.');
    }

    const urlMap = new Map<string, string>();
    const updatedItems: MediaLibraryItem[] = [];

    for (const item of mediaLibrary.list()) {
      const sourceFile = await fetchMediaAsFile(item.src, item.name);
      const imported = await this.mediaAssets.importFromFile(sourceFile, item.name);

      if (item.src !== imported.url) {
        urlMap.set(item.src, imported.url);
      }

      let thumbnail = item.thumbnail;
      if (item.thumbnail && item.thumbnail !== item.src) {
        const thumbnailFile = await fetchMediaAsFile(item.thumbnail, `${item.name}-thumb`);
        const importedThumbnail = await this.mediaAssets.importFromFile(
          thumbnailFile,
          `${item.name}-thumb`,
        );
        if (item.thumbnail !== importedThumbnail.url) {
          urlMap.set(item.thumbnail, importedThumbnail.url);
        }
        thumbnail = importedThumbnail.url;
      }

      updatedItems.push({
        ...item,
        assetId: imported.asset.id,
        src: imported.url,
        thumbnail,
        source: 'library',
      });
    }

    mediaLibrary.loadPersistedItems(updatedItems);
    sidebar?.notifyMediaLibraryChanged();

    return urlMap;
  }

  private async openWithDocument(
    store: FileSystemProjectStore,
    document: ProjectDocument,
  ): Promise<void> {
    this.mediaAssets?.destroy();
    this.store = store;
    this.document = document;
    this.mediaAssets = new MediaAssetService(store, this.index, document.meta.id);

    await this.index.upsertProject({
      projectId: document.meta.id,
      name: document.meta.name,
      directoryHandle: store.getDirectoryHandle(),
      updatedAt: document.meta.updatedAt,
      lastOpenedAt: Date.now(),
    });
  }

  private emitStatus(status: ProjectPersistenceStatus): void {
    this.phase = status.phase;
    this.options.onStatus?.(status);
  }

  private handleError(error: unknown): void {
    const normalized = error instanceof Error ? error : new Error(String(error));
    this.emitStatus({
      phase: 'error',
      message: normalized.message,
      projectId: this.document?.meta.id,
      projectName: this.document?.meta.name,
    });
    this.options.onError?.(normalized);
  }
}

export type { ProjectMetadata };
