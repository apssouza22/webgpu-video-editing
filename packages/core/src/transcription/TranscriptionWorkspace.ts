import type { TranscriptionResult, TranscriptionWordRemovedPayload } from './types';
import { TranscriptionWorkspaceEventEmitter } from './TranscriptionWorkspaceEventEmitter';
import type {
  TranscriptionWorkspaceEventHandler,
  TranscriptionWorkspaceEventName,
  TranscriptionWorkspaceView,
} from './uiTypes';

/** Integration surface for the transcription sidebar panel. */
export class TranscriptionWorkspace {
  readonly events = new TranscriptionWorkspaceEventEmitter();
  private view: TranscriptionWorkspaceView | null = null;
  private canTranscribe = false;

  getCanTranscribe(): boolean {
    return this.canTranscribe;
  }

  on<T extends TranscriptionWorkspaceEventName>(
    event: T,
    handler: TranscriptionWorkspaceEventHandler<T>,
  ): () => void {
    return this.events.on(event, handler);
  }

  off<T extends TranscriptionWorkspaceEventName>(
    event: T,
    handler: TranscriptionWorkspaceEventHandler<T>,
  ): void {
    this.events.off(event, handler);
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
    this.events.emit('transcription:requested', { sourceId });
  }

  seekTranscription(timestamp: number, sourceId: string): void {
    this.events.emit('transcription:seek', { timestamp, sourceId });
  }

  requestTranscriptionCaptions(results: TranscriptionResult[]): void {
    this.events.emit('transcription:captions:requested', { results });
  }

  removeTranscriptionWord(payload: TranscriptionWordRemovedPayload): void {
    this.events.emit('transcription:word:removed', payload);
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
