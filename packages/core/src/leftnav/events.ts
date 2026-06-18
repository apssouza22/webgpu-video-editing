import type {
  LeftNavEventHandler,
  LeftNavEventMap,
  LeftNavEventName,
} from './types';

type ListenerMap = {
  [K in LeftNavEventName]: Set<LeftNavEventHandler<K>>;
};

export class LeftNavEventEmitter {
  private readonly listeners: ListenerMap = {
    'property:changed': new Set(),
    'selection:changed': new Set(),
    'panel:changed': new Set(),
    'text:add:requested': new Set(),
  };

  on<T extends LeftNavEventName>(event: T, handler: LeftNavEventHandler<T>): () => void {
    this.listeners[event].add(handler);
    return () => this.off(event, handler);
  }

  off<T extends LeftNavEventName>(event: T, handler: LeftNavEventHandler<T>): void {
    this.listeners[event].delete(handler);
  }

  emit<T extends LeftNavEventName>(event: T, payload: LeftNavEventMap[T]): void {
    for (const handler of this.listeners[event]) {
      handler(payload);
    }
  }
}
