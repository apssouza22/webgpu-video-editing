import type {
  TranscriptionUIEventHandler,
  TranscriptionUIEventMap,
  TranscriptionUIEventName,
} from './uiTypes';

type ListenerMap = {
  [K in TranscriptionUIEventName]: Set<TranscriptionUIEventHandler<K>>;
};

export class TranscriptionUIEventEmitter {
  private readonly listeners: ListenerMap = {
    'transcription:requested': new Set(),
    'transcription:seek': new Set(),
    'transcription:chunk:removed': new Set(),
    'transcription:captions:requested': new Set(),
    'transcription:status': new Set(),
    'transcription:result': new Set(),
    'transcription:highlight': new Set(),
    'transcription:availability': new Set(),
  };

  on<T extends TranscriptionUIEventName>(
    event: T,
    handler: TranscriptionUIEventHandler<T>,
  ): () => void {
    this.listeners[event].add(handler);
    return () => this.off(event, handler);
  }

  off<T extends TranscriptionUIEventName>(
    event: T,
    handler: TranscriptionUIEventHandler<T>,
  ): void {
    this.listeners[event].delete(handler);
  }

  emit<T extends TranscriptionUIEventName>(
    event: T,
    payload: TranscriptionUIEventMap[T],
  ): void {
    for (const handler of this.listeners[event]) {
      handler(payload);
    }
  }
}
