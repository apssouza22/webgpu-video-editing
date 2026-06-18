import type { CanvasElement } from '@opensource/video-preview';

import type { LeftNav } from './LeftNav';

export type LeftNavPanelId = 'project' | 'media' | 'text' | 'properties' | 'export' | 'transcription';

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
