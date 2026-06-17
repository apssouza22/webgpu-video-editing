import type {
  TranscriptionWorkspaceEventHandler,
  TranscriptionWorkspaceEventMap,
  TranscriptionWorkspaceEventName,
} from './uiTypes';

type ListenerMap = {
  [K in TranscriptionWorkspaceEventName]: Set<TranscriptionWorkspaceEventHandler<K>>;
};

export class TranscriptionWorkspaceEventEmitter {
  private readonly listeners: ListenerMap = {
    'transcription:requested': new Set(),
    'transcription:seek': new Set(),
    'transcription:captions:requested': new Set(),
    'transcription:word:removed': new Set(),
  };

  on<T extends TranscriptionWorkspaceEventName>(
    event: T,
    handler: TranscriptionWorkspaceEventHandler<T>,
  ): () => void {
    this.listeners[event].add(handler);
    return () => this.off(event, handler);
  }

  off<T extends TranscriptionWorkspaceEventName>(
    event: T,
    handler: TranscriptionWorkspaceEventHandler<T>,
  ): void {
    this.listeners[event].delete(handler);
  }

  emit<T extends TranscriptionWorkspaceEventName>(
    event: T,
    payload: TranscriptionWorkspaceEventMap[T],
  ): void {
    for (const handler of this.listeners[event]) {
      handler(payload);
    }
  }
}
