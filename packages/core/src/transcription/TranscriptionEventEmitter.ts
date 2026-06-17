import type {
  TranscriptionEventHandler,
  TranscriptionEventMap,
  TranscriptionEventName,
} from './types';

type ListenerMap = {
  [K in TranscriptionEventName]: Set<TranscriptionEventHandler<K>>;
};

export class TranscriptionEventEmitter {
  private readonly listeners: ListenerMap = {
    'transcription:progress': new Set(),
    'transcription:complete': new Set(),
    'transcription:error': new Set(),
    'transcription:word:removed': new Set(),
  };

  on<T extends TranscriptionEventName>(
    event: T,
    handler: TranscriptionEventHandler<T>,
  ): () => void {
    this.listeners[event].add(handler);
    return () => this.off(event, handler);
  }

  off<T extends TranscriptionEventName>(
    event: T,
    handler: TranscriptionEventHandler<T>,
  ): void {
    this.listeners[event].delete(handler);
  }

  emit<T extends TranscriptionEventName>(
    event: T,
    payload: TranscriptionEventMap[T],
  ): void {
    for (const handler of this.listeners[event]) {
      handler(payload);
    }
  }
}
