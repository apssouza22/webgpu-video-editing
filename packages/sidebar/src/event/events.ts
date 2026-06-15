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
    'media:library:changed': new Set(),
    'media:selected': new Set(),
    'media:upload:requested': new Set(),
    'media:remove:requested': new Set(),
    'export:requested': new Set(),
    'export:status': new Set(),
    'export:availability': new Set(),
    'transcription:requested': new Set(),
    'transcription:seek': new Set(),
    'transcription:chunk:removed': new Set(),
    'transcription:captions:requested': new Set(),
    'transcription:status': new Set(),
    'transcription:result': new Set(),
    'transcription:highlight': new Set(),
    'transcription:availability': new Set(),
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
