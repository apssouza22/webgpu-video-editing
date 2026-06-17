import type { CanvasElement } from '@opensource/video-preview';

import type { Sidebar } from './Sidebar';

export type MediaType = 'video' | 'image' | 'audio';

export type SidebarPanelId = 'project' | 'media' | 'text' | 'properties' | 'export' | 'transcription';

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
  /** Duration in seconds for video and audio items. */
  duration?: number;
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
  duration?: number;
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
  'text:add:requested': { content: string; startTime: number };
  'export:requested': { settings: ExportSettings };
  'export:status': { message: string; exporting: boolean };
  'export:availability': { canExport: boolean };
  'project:create:requested': { name: string };
  'project:open:requested': Record<string, never>;
  'project:status': {
    message: string;
    busy: boolean;
    projectName?: string;
    isOpen?: boolean;
  };
  'project:availability': { canManage: boolean };
}

export type SidebarEventName = keyof SidebarEventMap;

export type SidebarEventHandler<T extends SidebarEventName> = (
  payload: SidebarEventMap[T],
) => void;

export type SidebarPanelFactory = (sidebar: Sidebar) => HTMLElement;

export interface SidebarOptions {
  /** Initial sidebar panel. */
  initialPanel?: SidebarPanelId;
  /** Optional panel element factories supplied by the host application. */
  panelFactories?: Partial<Record<SidebarPanelId, SidebarPanelFactory>>;
}
