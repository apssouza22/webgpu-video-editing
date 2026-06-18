import type { CanvasElement } from '@opensource/video-preview';

import type { LeftNav } from './LeftNav';

export type LeftNavPanelId = 'media' | 'text' | 'properties' | 'export' | 'transcription';

export interface LeftNavEventMap {
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
  'panel:changed': { panel: LeftNavPanelId };
  'text:add:requested': { content: string; startTime: number };
}

export type LeftNavEventName = keyof LeftNavEventMap;

export type LeftNavEventHandler<T extends LeftNavEventName> = (
  payload: LeftNavEventMap[T],
) => void;

export type LeftNavPanelFactory = (leftNav: LeftNav) => HTMLElement;

export interface LeftNavOptions {
  /** Initial left nav panel. */
  initialPanel?: LeftNavPanelId;
  /** Optional panel element factories supplied by the host application. */
  panelFactories?: Partial<Record<LeftNavPanelId, LeftNavPanelFactory>>;
}
