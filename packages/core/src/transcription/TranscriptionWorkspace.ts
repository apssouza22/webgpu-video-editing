import type { TranscriptionResult, TranscriptionWordRemovedPayload } from './types';
import type {
  TranscriptionWorkspaceHandlers,
  TranscriptionWorkspaceView,
} from './uiTypes';

/** Integration surface for the transcription sidebar panel. */
export class TranscriptionWorkspace {
  private handlers: TranscriptionWorkspaceHandlers = {};
  private view: TranscriptionWorkspaceView | null = null;
  private canTranscribe = false;

  getCanTranscribe(): boolean {
    return this.canTranscribe;
  }

  setHandlers(handlers: TranscriptionWorkspaceHandlers): () => void {
    const previous = this.handlers;
    this.handlers = { ...previous, ...handlers };
    return () => {
      this.handlers = previous;
    };
  }

  setView(view: TranscriptionWorkspaceView): () => void {
    this.view = view;
    return () => {
      if (this.view === view) {
        this.view = null;
      }
    };
  }

  setCanTranscribe(value: boolean): void {
    if (this.canTranscribe === value) {
      return;
    }
    this.canTranscribe = value;
    this.view?.setCanTranscribe(value);
  }

  requestTranscription(sourceId?: string): void {
    void this.handlers.onTranscriptionRequested?.(sourceId);
  }

  seekTranscription(timestamp: number, sourceId: string): void {
    this.handlers.onSeek?.(timestamp, sourceId);
  }

  requestTranscriptionCaptions(results: TranscriptionResult[]): void {
    this.handlers.onCaptionsRequested?.(results);
  }

  removeTranscriptionWord(payload: TranscriptionWordRemovedPayload): void {
    this.handlers.onWordRemoved?.(payload);
  }

  setTranscriptionStatus(message: string, transcribing = false): void {
    this.view?.setStatus(message, transcribing);
  }

  setTranscriptionResult(result: TranscriptionResult | null): void {
    this.view?.setResult(result);
  }

  highlightTranscriptionAt(time: number): void {
    this.view?.highlightAt(time);
  }
}
