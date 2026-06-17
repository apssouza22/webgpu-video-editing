import type { TranscriptionProgress, TranscriptionResult } from './types';

/** Wired by {@link bindTranscription}; not part of the public event surface. */
export interface TranscriptionWorkspaceHandlers {
  onTranscriptionRequested?: (sourceId?: string) => void | Promise<void>;
  onSeek?: (timestamp: number, sourceId: string) => void;
  onCaptionsRequested?: (results: TranscriptionResult[]) => void;
}

/** UI delegate registered by {@link TranscriptionPanel}. */
export interface TranscriptionWorkspaceView {
  setStatus(message: string, transcribing: boolean): void;
  setResult(result: TranscriptionResult | null): void;
  highlightAt(time: number): void;
  setCanTranscribe(canTranscribe: boolean): void;
}

/** Wired by {@link bindTranscription}; not part of the public event surface. */
export interface TranscriptionServiceHandlers {
  onProgress?: (progress: TranscriptionProgress) => void;
}
