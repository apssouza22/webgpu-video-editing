import type { TranscriptionResult } from './types';
import { TranscriptionUIEventEmitter } from './uiEventEmitter';
import type { TranscriptionUIEventHandler, TranscriptionUIEventName } from './uiTypes';

/** UI event surface for the transcription sidebar panel. */
export class TranscriptionWorkspace {
  readonly events = new TranscriptionUIEventEmitter();
  private canTranscribe = false;

  getCanTranscribe(): boolean {
    return this.canTranscribe;
  }

  setCanTranscribe(value: boolean): void {
    if (this.canTranscribe === value) {
      return;
    }
    this.canTranscribe = value;
    this.events.emit('transcription:availability', { canTranscribe: value });
  }

  requestTranscription(sourceId?: string): void {
    this.events.emit('transcription:requested', { sourceId });
  }

  seekTranscription(timestamp: number, sourceId: string): void {
    this.events.emit('transcription:seek', { timestamp, sourceId });
  }

  removeTranscriptionChunk(startTime: number, endTime: number, sourceId: string): void {
    this.events.emit('transcription:chunk:removed', { startTime, endTime, sourceId });
  }

  requestTranscriptionCaptions(results: TranscriptionResult[]): void {
    this.events.emit('transcription:captions:requested', { results });
  }

  setTranscriptionStatus(message: string, transcribing = false): void {
    this.events.emit('transcription:status', { message, transcribing });
  }

  setTranscriptionResult(result: TranscriptionResult | null): void {
    this.events.emit('transcription:result', { result });
  }

  highlightTranscriptionAt(time: number): void {
    this.events.emit('transcription:highlight', { time });
  }

  on<T extends TranscriptionUIEventName>(
    event: T,
    handler: TranscriptionUIEventHandler<T>,
  ): () => void {
    return this.events.on(event, handler);
  }

  off<T extends TranscriptionUIEventName>(
    event: T,
    handler: TranscriptionUIEventHandler<T>,
  ): void {
    this.events.off(event, handler);
  }
}
