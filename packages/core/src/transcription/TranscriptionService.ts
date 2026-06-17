import { prepareAudioForWhisper } from './audioTransform';
import type { ExtractAudioOptions } from './extractAudio';
import { createMockTranscriptionResult } from './mockTranscription';
import { extractAudioFromMediaUrl } from './extractAudio';
import { TranscriptionEventEmitter } from './TranscriptionEventEmitter';
import type {
  TranscriptionEventHandler,
  TranscriptionEventName,
  TranscriptionOptions,
  TranscriptionProgress,
  TranscriptionResult,
  TranscriptionWordRemovedPayload,
  WorkerResponseMessage,
} from './types';

interface PendingAudioTranscription {
  sourceId: string;
  resolve: (result: TranscriptionResult) => void;
  reject: (error: Error) => void;
}

export class TranscriptionService {
  readonly events = new TranscriptionEventEmitter();
  private readonly options: TranscriptionOptions;
  private worker: Worker | null = null;
  private transcribing = false;
  private pendingAudioTranscription: PendingAudioTranscription | null = null;

  constructor(options: TranscriptionOptions = {}) {
    this.options = options;
  }

  get isTranscribing(): boolean {
    return this.transcribing;
  }

  loadModel(): void {
    this.ensureWorker();
    this.worker?.postMessage({ task: 'load-model' });
  }

  async transcribeMedia(
    url: string,
    mediaType: 'video' | 'audio',
    sourceId: string,
    extractOptions: ExtractAudioOptions = {},
  ): Promise<TranscriptionResult | null> {
    if (this.transcribing) {
      throw new Error('A transcription is already in progress.');
    }

    this.transcribing = true;

    try {
      if (this.options.mockTranscription) {
        await delay(600);
        const result = createMockTranscriptionResult(sourceId);
        this.events.emit('transcription:complete', { result });
        return result;
      }

      const audioBuffer = await extractAudioFromMediaUrl(url, mediaType, extractOptions);
      return await this.transcribeAudioBuffer(audioBuffer, sourceId);
    } catch (error) {
      const normalized = normalizeError(error);
      this.events.emit('transcription:error', { error: normalized });
      throw normalized;
    } finally {
      this.transcribing = false;
    }
  }

  async transcribeAudioBuffer(
    audioBuffer: AudioBuffer,
    sourceId: string,
  ): Promise<TranscriptionResult | null> {
    if (this.options.mockTranscription) {
      const result = createMockTranscriptionResult(sourceId);
      this.events.emit('transcription:complete', { result });
      return result;
    }

    this.ensureWorker();
    const audio = await prepareAudioForWhisper(audioBuffer);

    return new Promise((resolve, reject) => {
      this.pendingAudioTranscription = { sourceId, resolve, reject };
      this.worker?.postMessage({ audio, sourceId });
    });
  }

  on<T extends TranscriptionEventName>(
    event: T,
    handler: TranscriptionEventHandler<T>,
  ): () => void {
    return this.events.on(event, handler);
  }

  off<T extends TranscriptionEventName>(
    event: T,
    handler: TranscriptionEventHandler<T>,
  ): void {
    this.events.off(event, handler);
  }

  notifyWordRemoved(payload: TranscriptionWordRemovedPayload): void {
    this.events.emit('transcription:word:removed', payload);
  }

  destroy(): void {
    this.worker?.terminate();
    this.worker = null;
    this.transcribing = false;
    this.pendingAudioTranscription = null;
  }

  private ensureWorker(): void {
    if (this.worker) {
      return;
    }

    this.worker = new Worker(new URL('./worker.ts', import.meta.url), {
      type: 'module',
    });

    this.worker.addEventListener('message', (event: MessageEvent<WorkerResponseMessage>) => {
      this.handleWorkerMessage(event.data);
    });
  }

  private handleWorkerMessage(message: WorkerResponseMessage): void {
    switch (message.status) {
      case 'progress':
      case 'initiate':
      case 'done':
        if (isProgressPayload(message.data)) {
          this.events.emit('transcription:progress', message.data);
        }
        break;

      case 'ready':
        break;

      case 'complete':
        if (message.data && isTranscriptionResult(message.data)) {
          const result = message.data;
          const pending = this.pendingAudioTranscription;
          if (pending && pending.sourceId === result.sourceId) {
            this.pendingAudioTranscription = null;
            pending.resolve(result);
          }
          this.events.emit('transcription:complete', { result });
        }
        break;

      case 'error': {
        const error = normalizeWorkerError(message.data);
        const pending = this.pendingAudioTranscription;
        if (pending) {
          this.pendingAudioTranscription = null;
          pending.reject(error);
        }
        this.events.emit('transcription:error', { error });
        break;
      }

      default:
        break;
    }
  }
}

function isProgressPayload(data: unknown): data is TranscriptionProgress {
  return typeof data === 'object' && data !== null && 'status' in data;
}

function isTranscriptionResult(data: unknown): data is TranscriptionResult {
  return (
    typeof data === 'object' &&
    data !== null &&
    'text' in data &&
    'chunks' in data &&
    Array.isArray((data as TranscriptionResult).chunks)
  );
}

function normalizeWorkerError(data: unknown): Error {
  if (data instanceof Error) {
    return data;
  }

  if (typeof data === 'object' && data !== null && 'message' in data) {
    return new Error(String((data as Error).message));
  }

  return new Error('Transcription failed.');
}

function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}
