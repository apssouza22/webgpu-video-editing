import type { TranscriptionResult, TranscriptionWordRemovedPayload } from './types';

/** UI delegate registered by {@link TranscriptionPanel}. */
export interface TranscriptionWorkspaceView {
  setStatus(message: string, transcribing: boolean): void;
  setResult(result: TranscriptionResult | null): void;
  highlightAt(time: number): void;
  setCanTranscribe(canTranscribe: boolean): void;
}

export interface TranscriptionWorkspaceEventMap {
  'transcription:requested': { sourceId?: string };
  'transcription:seek': { timestamp: number; sourceId: string };
  'transcription:captions:requested': { results: TranscriptionResult[] };
  'transcription:word:removed': TranscriptionWordRemovedPayload;
}

export type TranscriptionWorkspaceEventName = keyof TranscriptionWorkspaceEventMap;

export type TranscriptionWorkspaceEventHandler<T extends TranscriptionWorkspaceEventName> = (
  payload: TranscriptionWorkspaceEventMap[T],
) => void;
