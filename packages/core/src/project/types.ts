import type { TimelineState } from '@opensource/timeline';
import type {
  AspectRatioId,
  CanvasElement,
  CanvasSize,
} from '@opensource/video-canvas';
import type { MediaLibraryItem, TranscriptionResult } from '@opensource/sidebar';

export const PROJECT_DOCUMENT_VERSION = 1 as const;
export const PROJECT_JSON_FILENAME = 'project.json';
export const PROJECT_MEDIA_DIR = 'media';
export const IDB_DATABASE_NAME = 'gpu-video-editor';
export const IDB_PROJECTS_STORE = 'projects';
export const IDB_MEDIA_ASSETS_STORE = 'mediaAssets';

export type ProjectDocumentVersion = typeof PROJECT_DOCUMENT_VERSION;

export interface ProjectMetadata {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export interface PersistedMediaAsset {
  id: string;
  relativePath: string;
  name: string;
  mimeType: string;
  size: number;
  lastModified: number;
}

export interface PersistedMediaLibraryEntry {
  id: string;
  assetId: string;
  type: MediaLibraryItem['type'];
  name: string;
  source: 'library';
  createdAt: number;
  thumbnailAssetId?: string;
}

export interface PersistedClip {
  assetId?: string;
  url?: string;
  thumbnailAssetId?: string;
  thumbnailUrl?: string;
}

export type PersistedCanvasElement =
  | (Omit<Extract<CanvasElement, { type: 'video' }>, 'src'> & {
      src?: string;
      assetId?: string;
    })
  | (Omit<Extract<CanvasElement, { type: 'image' }>, 'src'> & {
      src?: string;
      assetId?: string;
    })
  | (Omit<Extract<CanvasElement, { type: 'audio' }>, 'src'> & {
      src?: string;
      assetId?: string;
    })
  | Extract<CanvasElement, { type: 'text' }>;

export interface ProjectDocument {
  version: ProjectDocumentVersion;
  meta: ProjectMetadata;
  media: PersistedMediaAsset[];
  timeline: Omit<TimelineState, 'isPlaying'>;
  canvas: {
    aspectRatio: AspectRatioId;
    playerSize: CanvasSize;
    elements: PersistedCanvasElement[];
    selectedId: string | null;
  };
  mediaLibrary: PersistedMediaLibraryEntry[];
  transcription?: TranscriptionResult[];
}

export interface IndexedDbProjectRecord {
  projectId: string;
  name: string;
  directoryHandle: FileSystemDirectoryHandle;
  updatedAt: number;
  lastOpenedAt: number;
}

export interface IndexedDbMediaAssetRecord {
  assetId: string;
  projectId: string;
  relativePath: string;
  name: string;
  mimeType: string;
  size: number;
  lastModified: number;
}

export interface ResolvedMediaAsset {
  assetId: string;
  url: string;
  name: string;
  mimeType: string;
  size: number;
  lastModified: number;
}

export interface ImportMediaResult {
  asset: PersistedMediaAsset;
  url: string;
  type: MediaLibraryItem['type'];
}

export interface ProjectPersistenceStatus {
  phase: 'idle' | 'saving' | 'loading' | 'importing' | 'ready' | 'error';
  message?: string;
  projectId?: string;
  projectName?: string;
}

export interface ProjectPersistenceOptions {
  autoSave?: boolean;
  autoRestore?: boolean;
  debounceMs?: number;
  onStatus?: (status: ProjectPersistenceStatus) => void;
  onError?: (error: Error) => void;
  onReady?: (restored: boolean) => void;
}

export interface BindProjectPersistenceOptions extends ProjectPersistenceOptions {
  editor: import('../VideoEditor').VideoEditor;
  clipCanvasSync: import('../clipCanvasSync').ClipCanvasSync;
}
