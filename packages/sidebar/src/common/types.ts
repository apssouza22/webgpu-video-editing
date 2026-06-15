import type { CanvasElement } from '@opensource/video-canvas';

export type MediaType = 'video' | 'image' | 'audio';

export type SidebarPanelId = MediaType | 'text' | 'properties' | 'export';

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

export type MediaLibrarySource = 'stock' | 'upload' | 'library';

export interface MediaLibraryItem {
  id: string;
  type: MediaType;
  name: string;
  src: string;
  thumbnail?: string;
  createdAt: number;
  source: MediaLibrarySource;
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
  'media:selected': { item: MediaLibraryItem };
  'export:requested': { settings: ExportSettings };
  'export:status': { message: string; exporting: boolean };
  'export:availability': { canExport: boolean };
}

export type SidebarEventName = keyof SidebarEventMap;

export type SidebarEventHandler<T extends SidebarEventName> = (
  payload: SidebarEventMap[T],
) => void;

export interface SidebarOptions {
  /** Initial sidebar panel. */
  initialPanel?: SidebarPanelId;
  /** Stock media shown before any uploads. */
  stockMedia?: MediaLibraryItem[];
}

export interface AddMediaFromFileOptions {
  addToCanvas?: boolean;
  startTime?: number;
}
