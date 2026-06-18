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
    'text:add:requested': new Set(),
    'project:create:requested': new Set(),
    'project:open:requested': new Set(),
    'project:status': new Set(),
    'project:availability': new Set(),
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
