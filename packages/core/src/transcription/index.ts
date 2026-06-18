import { TranscriptionService } from './transcription';

export { configureTranscriptionEnv } from './configureEnv';
export { bindTranscription, type BindTranscriptionOptions } from './bindTranscription';
export { TranscriptionView } from './transcription-view';
export { TranscriptionService } from './transcription';
export { TranscriptionEventEmitter } from './TranscriptionEventEmitter';
export { PipelineFactory, transcribe, onModelInferenceError } from './model';
export {
  prepareAudioForWhisper,
  WHISPER_SAMPLE_RATE,
} from './audioTransform';
export { extractAudioFromMediaUrl, type ExtractAudioOptions } from './extractAudio';
export { createMockTranscriptionResult } from './mockTranscription';
export type {
  ModelParams,
  Pipeline,
  ProgressCallback,
  TranscriptionChunk,
  TranscriptionError,
  TranscriptionEventHandler,
  TranscriptionEventMap,
  TranscriptionEventName,
  TranscriptionOptions,
  TranscriptionProgress,
  TranscriptionResult,
  TranscriptionWordRemovedPayload,
  WorkerMessage,
  WorkerResponseMessage,
} from './types';

export function createTranscriptionService(
  options?: import('./types').TranscriptionOptions,
): TranscriptionService {
  return new TranscriptionService(options);
}
