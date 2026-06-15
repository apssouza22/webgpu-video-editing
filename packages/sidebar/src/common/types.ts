import type { CanvasElement } from '@opensource/video-canvas';

export type MediaType = 'video' | 'image' | 'audio';

export type SidebarPanelId = 'media' | 'text' | 'properties' | 'export' | 'transcription';

export interface TranscriptionChunk {
  text: string;
  timestamp: [number, number];
}

export interface TranscriptionResult {
  text: string;
  chunks: TranscriptionChunk[];
  sourceId?: string;
}

export type ExportQuality = 'low' | 'medium' | 'high' | 'max';
export type ExportFormat = 'mp4';
export type ExportResolutionPreset =
  | 'source'
  | '480p'
  | '720p'
  | '1080p'
  | '1440p'
  | '4k';

export interface ExportResolution {
  preset?: ExportResolutionPreset;
  width?: number;
  height?: number;
  scale?: number;
}

/** User-selected export options emitted by the sidebar export panel. */
export interface ExportSettings {
  fps?: number;
  quality?: ExportQuality;
  format?: ExportFormat;
  resolution?: ExportResolution;
  outputFilename?: string;
}

export type MediaLibrarySource = 'upload' | 'library';

export interface MediaLibraryItem {
  id: string;
  type: MediaType;
  name: string;
  src: string;
  thumbnail?: string;
  createdAt: number;
  source: MediaLibrarySource;
  /** Stable reference to a persisted project media asset. */
  assetId?: string;
}

export interface ResolvedMediaInput {
  assetId: string;
  type: MediaType;
  name: string;
  src: string;
  thumbnail?: string;
  id?: string;
}

export interface SidebarEventMap {
  'property:changed': {
    id: string;
    key: string;
    value: unknown;
    element: CanvasElement;
  };
  'selection:changed': {
    selectedId: string | null;
    selectedElement: CanvasElement | null;
  };
  'panel:changed': { panel: SidebarPanelId };
  'media:added': { item: MediaLibraryItem };
  'media:removed': { id: string };
  'media:selected': { item: MediaLibraryItem; startTime?: number };
  'media:upload:requested': { file: File } & AddMediaFromFileOptions;
  'media:remove:requested': { id: string };
  'export:requested': { settings: ExportSettings };
  'export:status': { message: string; exporting: boolean };
  'export:availability': { canExport: boolean };
  'transcription:requested': { sourceId?: string };
  'transcription:seek': { timestamp: number; sourceId: string };
  'transcription:chunk:removed': {
    startTime: number;
    endTime: number;
    sourceId: string;
  };
  'transcription:captions:requested': { results: TranscriptionResult[] };
  'transcription:status': { message: string; transcribing: boolean };
  'transcription:result': { result: TranscriptionResult | null };
  'transcription:highlight': { time: number };
  'transcription:availability': { canTranscribe: boolean };
}

export type SidebarEventName = keyof SidebarEventMap;

export type SidebarEventHandler<T extends SidebarEventName> = (
  payload: SidebarEventMap[T],
) => void;

export interface SidebarOptions {
  /** Initial sidebar panel. */
  initialPanel?: SidebarPanelId;
  /** Media library data source for UI panels. */
  mediaLibrary?: MediaLibraryHost;
}

export interface AddMediaFromFileOptions {
  addToCanvas?: boolean;
  startTime?: number;
}

/** Read-only media library access for sidebar UI panels. */
export interface MediaLibraryHost {
  list(type?: MediaType): MediaLibraryItem[];
}
