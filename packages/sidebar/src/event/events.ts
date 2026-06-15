import type {
  SidebarEventHandler,
  SidebarEventMap,
  SidebarEventName,
} from '../common/types';

type ListenerMap = {
  [K in SidebarEventName]: Set<SidebarEventHandler<K>>;
};

export class SidebarEventEmitter {
  private readonly listeners: ListenerMap = {
    'property:changed': new Set(),
    'selection:changed': new Set(),
    'panel:changed': new Set(),
    'media:added': new Set(),
    'media:removed': new Set(),
    'media:selected': new Set(),
    'export:requested': new Set(),
    'export:status': new Set(),
    'export:availability': new Set(),
  };

  on<T extends SidebarEventName>(event: T, handler: SidebarEventHandler<T>): () => void {
    this.listeners[event].add(handler);
    return () => this.off(event, handler);
  }

  off<T extends SidebarEventName>(event: T, handler: SidebarEventHandler<T>): void {
    this.listeners[event].delete(handler);
  }

  emit<T extends SidebarEventName>(event: T, payload: SidebarEventMap[T]): void {
    for (const handler of this.listeners[event]) {
      handler(payload);
    }
  }
}
