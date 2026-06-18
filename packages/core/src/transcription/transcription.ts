import { prepareAudioForWhisper } from './audioTransform';
import type { ExtractAudioOptions } from './extractAudio';
import { createMockTranscriptionResult } from './mockTranscription';
import { extractAudioFromMediaUrl } from './extractAudio';
import { TranscriptionEventEmitter } from './TranscriptionEventEmitter';
import { TranscriptionView } from './transcription-view';
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
  private readonly worker: Worker;
  private readonly transcriptionView: TranscriptionView;
  private transcribing = false;
  private pendingAudioTranscription: PendingAudioTranscription | null = null;

  constructor(options: TranscriptionOptions = {}) {
    this.options = options;
    this.worker = new Worker(new URL('./worker.ts', import.meta.url), {
      type: 'module',
    });
    this.transcriptionView = new TranscriptionView(this);
    this.#addEventListener();
  }

  get view(): TranscriptionView {
    return this.transcriptionView;
  }

  get isTranscribing(): boolean {
    return this.transcribing;
  }

  loadModel(): void {
    this.worker.postMessage({ task: 'load-model' });
  }

  requestTranscription(sourceId?: string): void {
    this.events.emit('transcription:requested', { sourceId });
  }

  requestTranscriptionCaptions(results: TranscriptionResult[]): void {
    this.events.emit('transcription:captions:requested', { results });
  }

  removeInterval(
    startTime: number,
    endTime: number,
    _sourceId: string,
    payload?: Pick<TranscriptionWordRemovedPayload, 'clipId' | 'text' | 'duration'>,
  ): void {
    const duration = payload?.duration ?? endTime - startTime;
    if (payload?.clipId && duration > 0) {
      this.events.emit('transcription:word:removed', {
        clipId: payload.clipId,
        startTime,
        duration,
        text: payload.text ?? '',
      });
    }
  }

  seekToTimestamp(timestamp: number, sourceId: string): void {
    this.events.emit('transcription:seek', { timestamp, sourceId });
  }

  setCanTranscribe(value: boolean): void {
    this.transcriptionView.setCanTranscribe(value);
  }

  setTranscriptionStatus(message: string, transcribing = false): void {
    this.transcriptionView.setStatus(message, transcribing);
  }

  setTranscriptionResult(result: TranscriptionResult | null): void {
    if (result) {
      this.transcriptionView.updateTranscription(result);
      return;
    }

    this.transcriptionView.setStatus('', false);
  }

  highlightTranscriptionAt(time: number): void {
    this.transcriptionView.highlightChunksByTime(time);
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
        this.#onTranscriptionComplete(result);
        return result;
      }

      const audioBuffer = await extractAudioFromMediaUrl(url, mediaType, extractOptions);
      return await this.startTranscription(audioBuffer, sourceId);
    } catch (error) {
      const normalized = normalizeError(error);
      this.events.emit('transcription:error', { error: normalized });
      throw normalized;
    } finally {
      this.transcribing = false;
    }
  }

  async startTranscription(
    audioBuffer: AudioBuffer,
    sourceId: string,
  ): Promise<TranscriptionResult | null> {
    if (this.options.mockTranscription) {
      const result = createMockTranscriptionResult(sourceId);
      this.#onTranscriptionComplete(result);
      return result;
    }

    this.transcriptionView.showLoading();
    const audio = await prepareAudioForWhisper(audioBuffer);

    return new Promise((resolve, reject) => {
      this.pendingAudioTranscription = { sourceId, resolve, reject };
      this.worker.postMessage({ audio, sourceId });
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

  #addEventListener(): void {
    this.worker.addEventListener('message', (event: MessageEvent<WorkerResponseMessage>) => {
      const message = event.data;

      switch (message.status) {
        case 'progress':
          break;

        case 'complete':
          if (message.data && isTranscriptionResult(message.data)) {
            this.#onTranscriptionComplete(message.data);
          }
          break;

        case 'initiate':
          break;

        case 'ready':
          console.log('Transcription model ready');
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

        case 'done':
          if (message.file) {
            console.log('Model file done loaded:', message.file);
          }
          if (isProgressPayload(message.data)) {
            this.events.emit('transcription:progress', message.data);
          }
          break;

        default:
          if (isProgressPayload(message.data)) {
            this.events.emit('transcription:progress', message.data);
          }
          break;
      }
    });
  }

  #onTranscriptionComplete(data: TranscriptionResult): void {
    const pending = this.pendingAudioTranscription;
    if (pending && pending.sourceId === data.sourceId) {
      this.pendingAudioTranscription = null;
      pending.resolve(data);
    }

    this.transcriptionView.updateTranscription(data);
    this.events.emit('transcription:complete', { result: data });
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
