import type { CanvasElement } from '@opensource/video-canvas';

export type MediaType = 'video' | 'image' | 'audio';

export type SidebarPanelId = MediaType | 'text' | 'properties';

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
