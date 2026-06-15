import type { Timeline } from '@opensource/timeline';
import type { CompositionCanvas } from '@opensource/video-canvas';
import type { Sidebar } from '@opensource/sidebar';

import type { ClipCanvasSync } from '../clipCanvasSync';
import { FileSystemProjectStore } from './FileSystemProjectStore';
import { IndexedDbProjectIndex } from './IndexedDbProjectIndex';
import { MediaAssetService } from './MediaAssetService';
import {
  captureProjectDocument,
  createEmptyProjectDocument,
  resolveProjectDocument,
} from './ProjectSerializer';
import { pickMediaFiles, pickProjectDirectory } from './fileSystemAccess';
import type {
  ProjectDocument,
  ProjectMetadata,
  ProjectPersistenceStatus,
} from './types';

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
  private readonly debounceMs: number;
  private saveContext: {
    timeline: Timeline;
    canvas: CompositionCanvas;
    sidebar: Sidebar | null;
  } | null = null;

  constructor(private readonly options: ProjectSessionOptions = {}) {
    this.debounceMs = options.debounceMs ?? 1000;
  }

  setSaveContext(context: {
    timeline: Timeline;
    canvas: CompositionCanvas;
    sidebar: Sidebar | null;
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
    return this.document !== null && this.store !== null;
  }

  async createProject(
    name: string,
    directoryHandle: FileSystemDirectoryHandle,
    timeline: Timeline,
    canvas: CompositionCanvas,
  ): Promise<ProjectDocument> {
    this.emitStatus({ phase: 'loading', message: 'Creating project…' });

    const store = new FileSystemProjectStore(directoryHandle);
    await store.ensureAccess();

    const document = createEmptyProjectDocument(name, timeline.getState(), canvas.getState());
    await store.writeDocument(document);

    await this.openWithDocument(store, document);
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

  async pickAndImportMedia(sidebar: Sidebar): Promise<void> {
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
      sidebar.addFromResolvedMedia({
        assetId: imported.asset.id,
        type: imported.type,
        name: imported.asset.name,
        src: imported.url,
      }, { addToCanvas: false });
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
    canvas: CompositionCanvas,
    sidebar: Sidebar | null,
    clipCanvasSync: ClipCanvasSync,
  ): Promise<void> {
    if (!this.document || !this.mediaAssets) {
      return;
    }

    this.emitStatus({ phase: 'loading', message: 'Loading project state…' });
    clipCanvasSync.pause();

    try {
      await this.mediaAssets.hydrate(this.document.media);
      const resolved = resolveProjectDocument(this.document, this.mediaAssets);

      timeline.loadState(resolved.timeline);
      canvas.loadState(resolved.canvas);

      if (sidebar) {
        sidebar.loadPersistedMedia(resolved.mediaLibrary);
      }

      clipCanvasSync.rebuildMappings();
      canvas.render(canvas.getCurrentTime(), { playing: false });
    } finally {
      clipCanvasSync.resume();
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
    canvas?: CompositionCanvas,
    sidebar?: Sidebar | null,
  ): Promise<void> {
    const resolvedTimeline = timeline ?? this.saveContext?.timeline;
    const resolvedCanvas = canvas ?? this.saveContext?.canvas;
    const resolvedSidebar = sidebar ?? this.saveContext?.sidebar ?? null;

    if (!this.pendingSave || !this.store || !this.mediaAssets || !this.document) {
      return;
    }

    if (!resolvedTimeline || !resolvedCanvas) {
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
      const mediaLibrary = resolvedSidebar?.getPersistedMedia() ?? [];
      this.document = captureProjectDocument({
        meta: this.document.meta,
        timeline: resolvedTimeline.getState(),
        canvas: resolvedCanvas.getState(),
        mediaLibrary,
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
