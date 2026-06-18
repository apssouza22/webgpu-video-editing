export interface TranscriptionChunk {
  text: string;
  timestamp: [number, number];
}

export interface TranscriptionResult {
  text: string;
  chunks: TranscriptionChunk[];
  sourceId?: string;
  clipId?: string;
}

export interface TranscriptionProgress {
  status: string;
  progress?: number;
  task?: string;
  message?: string;
  file?: string;
}

export interface ModelParams {
  chunk_length_s: number;
  stride_length_s: number;
  return_timestamps: string;
  language?: string;
}

export type ProgressCallback = (data: TranscriptionProgress) => void;

export type Pipeline = (
  audio: Float32Array,
  params: ModelParams,
) => Promise<TranscriptionResult>;

export interface WorkerMessageBase {
  task?: string;
  status?: string;
  data?: unknown;
  audio?: Float32Array;
}

export interface LoadModelMessage extends WorkerMessageBase {
  task: 'load-model';
}

export interface TranscribeMessage extends WorkerMessageBase {
  audio: Float32Array;
  sourceId: string;
}

export interface WorkerResponseMessage extends WorkerMessageBase {
  status: 'progress' | 'complete' | 'initiate' | 'ready' | 'error' | 'done';
  task?: string;
  data?: TranscriptionResult | TranscriptionProgress | Error;
  progress?: number;
  file?: string;
}

export type WorkerMessage = LoadModelMessage | TranscribeMessage;

export interface TranscriptionError extends Error {
  status?: string;
  task?: string;
  data?: unknown;
}

export interface TranscriptionEventMap {
  'transcription:progress': TranscriptionProgress;
  'transcription:complete': { result: TranscriptionResult };
  'transcription:error': { error: Error };
  'transcription:word:removed': TranscriptionWordRemovedPayload;
  'transcription:requested': { sourceId?: string };
  'transcription:seek': { timestamp: number; sourceId: string; clipId?: string };
  'transcription:captions:requested': { results: TranscriptionResult[] };
}

export interface TranscriptionWordRemovedPayload {
  clipId: string;
  startTime: number;
  duration: number;
  text: string;
}

export type TranscriptionEventName = keyof TranscriptionEventMap;

export type TranscriptionEventHandler<T extends TranscriptionEventName> = (
  payload: TranscriptionEventMap[T],
) => void;

export interface TranscriptionOptions {
  /** Use mocked transcription output instead of running the Whisper model. */
  mockTranscription?: boolean;
  /** Whisper language code passed to the model. */
  language?: string;
}
