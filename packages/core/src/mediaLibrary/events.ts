import type {
  MediaLibraryEventHandler,
  MediaLibraryEventMap,
  MediaLibraryEventName,
} from './types';

type ListenerMap = {
  [K in MediaLibraryEventName]: Set<MediaLibraryEventHandler<K>>;
};

export class MediaLibraryEventEmitter {
  private readonly listeners: ListenerMap = {
    'added': new Set(),
    'removed': new Set(),
    'changed': new Set(),
  };

  on<T extends MediaLibraryEventName>(
    event: T,
    handler: MediaLibraryEventHandler<T>,
  ): () => void {
    this.listeners[event].add(handler);
    return () => this.off(event, handler);
  }

  off<T extends MediaLibraryEventName>(
    event: T,
    handler: MediaLibraryEventHandler<T>,
  ): void {
    this.listeners[event].delete(handler);
  }

  emit<T extends MediaLibraryEventName>(
    event: T,
    payload: MediaLibraryEventMap[T],
  ): void {
    for (const handler of this.listeners[event]) {
      handler(payload);
    }
  }
}
