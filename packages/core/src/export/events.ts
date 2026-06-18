import type { ExportVideoOptions } from './exportOptions';

/** User-selected export options from the export panel. */
export type ExportSettings = Pick<
  ExportVideoOptions,
  'fps' | 'quality' | 'format' | 'resolution' | 'outputFilename'
>;

export interface ExportEventMap {
  'export:requested': { settings: ExportSettings };
  'export:status': { message: string; exporting: boolean };
  'export:availability': { canExport: boolean };
}

export type ExportEventName = keyof ExportEventMap;

export type ExportEventHandler<T extends ExportEventName> = (
  payload: ExportEventMap[T],
) => void;

type ListenerMap = {
  [K in ExportEventName]: Set<ExportEventHandler<K>>;
};

export class ExportEventEmitter {
  private readonly listeners: ListenerMap = {
    'export:requested': new Set(),
    'export:status': new Set(),
    'export:availability': new Set(),
  };

  on<T extends ExportEventName>(event: T, handler: ExportEventHandler<T>): () => void {
    this.listeners[event].add(handler);
    return () => this.off(event, handler);
  }

  off<T extends ExportEventName>(event: T, handler: ExportEventHandler<T>): void {
    this.listeners[event].delete(handler);
  }

  emit<T extends ExportEventName>(event: T, payload: ExportEventMap[T]): void {
    for (const handler of this.listeners[event]) {
      handler(payload);
    }
  }
}
