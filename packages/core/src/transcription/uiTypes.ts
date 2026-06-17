import type { TranscriptionResult } from './types';

export interface TranscriptionUIEventMap {
  'transcription:requested': { sourceId?: string };
  'transcription:seek': { timestamp: number; sourceId: string };
  'transcription:chunk:removed': {
    startTime: number;
    endTime: number;
    sourceId: string;
  };
  'transcription:captions:requested': { results: TranscriptionResult[] };
  'transcription:status': { message: string; transcribing: boolean };
  'transcription:result': { result: TranscriptionResult | null };
  'transcription:highlight': { time: number };
  'transcription:availability': { canTranscribe: boolean };
}

export type TranscriptionUIEventName = keyof TranscriptionUIEventMap;

export type TranscriptionUIEventHandler<T extends TranscriptionUIEventName> = (
  payload: TranscriptionUIEventMap[T],
) => void;
