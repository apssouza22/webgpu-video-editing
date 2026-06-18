import type { TranscriptionChunk, TranscriptionResult } from './types';
import type { TranscriptionService } from './transcription';

export class TranscriptionView {
  private readonly root: HTMLElement;
  private readonly transcribeButton: HTMLButtonElement;
  private readonly captionsButton: HTMLButtonElement;
  private readonly statusEl: HTMLParagraphElement;
  private readonly chunksContainer: HTMLDivElement;
  private transcribing = false;
  private canTranscribe = false;

  constructor(private readonly transcriptionManager: TranscriptionService) {
    this.root = document.createElement('div');
    this.root.className = 'flex flex-col gap-4';

    const title = document.createElement('h2');
    title.className = 'leftnav-section-title';
    title.textContent = 'Transcription';

    const description = document.createElement('p');
    description.className = 'm-0 text-es-muted text-sm leading-snug';
    description.textContent =
      'Generate word-level captions from video or audio layers using Whisper in the browser.';

    this.transcribeButton = document.createElement('button');
    this.transcribeButton.type = 'button';
    this.transcribeButton.className = 'leftnav-action-button leftnav-action-button--primary';
    this.transcribeButton.textContent = 'Transcribe media';

    this.captionsButton = document.createElement('button');
    this.captionsButton.type = 'button';
    this.captionsButton.className = 'leftnav-action-button';
    this.captionsButton.textContent = 'Add caption layers';
    this.captionsButton.hidden = true;

    this.statusEl = document.createElement('p');
    this.statusEl.className = 'leftnav-transcription-status';
    this.statusEl.setAttribute('aria-live', 'polite');

    this.chunksContainer = document.createElement('div');
    this.chunksContainer.className = 'leftnav-transcription-chunks';

    this.transcribeButton.addEventListener('click', () => {
      this.transcriptionManager.requestTranscription();
    });

    this.captionsButton.addEventListener('click', () => {
      const results = this.#buildCurrentTranscription();
      if (results.length > 0) {
        this.transcriptionManager.requestTranscriptionCaptions(results);
      }
    });

    this.root.append(
      title,
      description,
      this.transcribeButton,
      this.captionsButton,
      this.statusEl,
      this.chunksContainer,
    );
  }

  get element(): HTMLElement {
    return this.root;
  }

  setStatus(message: string, transcribing: boolean): void {
    this.transcribing = transcribing;
    this.statusEl.textContent = message;
    this.#updateButtonState();
  }

  setCanTranscribe(canTranscribe: boolean): void {
    this.canTranscribe = canTranscribe;
    this.#updateButtonState();
  }

  updateTranscription(result: TranscriptionResult): void {
    this.showLoading(false);
    this.renderResult(result);
    this.#updateButtonState();
  }

  showLoading(loading = true): void {
    if (loading) {
      this.setStatus('Transcribing… Please wait.', true);
      this.captionsButton.hidden = true;
    }
  }

  highlightChunksByTime(currentTime: number): void {
    const chunks = this.chunksContainer.querySelectorAll<HTMLElement>(
      '.leftnav-transcription-chunk',
    );

    for (const chunk of chunks) {
      const startTime = Number(chunk.dataset.startTime ?? 0);
      const endTime = Number(chunk.dataset.endTime ?? 0);
      chunk.classList.toggle(
        'is-active',
        currentTime >= startTime && currentTime <= endTime,
      );
    }
  }

  private renderResult(result: TranscriptionResult | null): void {
    this.chunksContainer.replaceChildren();

    if (!result) {
      this.captionsButton.hidden = true;
      return;
    }

    for (const [index, chunk] of result.chunks.entries()) {
      this.chunksContainer.append(
        this.#createChunkElement(chunk, index, result.sourceId ?? '', result.clipId ?? ''),
      );
    }

    this.captionsButton.hidden = result.chunks.length === 0;
  }

  #createChunkElement(
    chunk: TranscriptionChunk,
    index: number,
    sourceId: string,
    clipId: string,
  ): HTMLElement {
    const chunkEl = document.createElement('button');
    chunkEl.type = 'button';
    chunkEl.className = 'leftnav-transcription-chunk';
    chunkEl.dataset.index = String(index);
    chunkEl.dataset.startTime = String(chunk.timestamp[0]);
    chunkEl.dataset.endTime = String(chunk.timestamp[1]);
    chunkEl.dataset.sourceId = sourceId;
    chunkEl.dataset.clipId = clipId;

    const text = document.createElement('span');
    text.className = 'leftnav-transcription-chunk-text';
    text.textContent = chunk.text;

    const remove = document.createElement('span');
    remove.className = 'leftnav-transcription-chunk-remove';
    remove.setAttribute('aria-label', 'Remove chunk');
    remove.textContent = '×';

    remove.addEventListener('click', (event) => {
      event.stopPropagation();
      const startTime = Number(chunkEl.dataset.startTime ?? 0);
      const endTime = Number(chunkEl.dataset.endTime ?? 0);
      this.#removeChunk(chunkEl, startTime, endTime);
    });

    chunkEl.addEventListener('click', () => {
      this.transcriptionManager.seekToTimestamp(chunk.timestamp[0], sourceId);
    });

    chunkEl.append(text, remove);
    return chunkEl;
  }

  #removeChunk(chunkElement: HTMLElement, startTime: number, endTime: number): void {
    if (!chunkElement.parentNode) {
      return;
    }

    const removedDuration = endTime - startTime;
    const sourceId = chunkElement.dataset.sourceId ?? '';
    const clipId = chunkElement.dataset.clipId ?? '';
    const text =
      chunkElement.querySelector('.leftnav-transcription-chunk-text')?.textContent?.trim() ?? '';

    this.transcriptionManager.removeInterval(startTime, endTime, sourceId, {
      clipId,
      text,
      duration: removedDuration,
    });
    this.#updateSubsequentTimestamps(startTime, removedDuration);

    chunkElement.remove();
    this.captionsButton.hidden = this.chunksContainer.childElementCount === 0;
  }

  #updateSubsequentTimestamps(removedStartTime: number, removedDuration: number): void {
    const chunks = this.#getCurrentChunks();

    for (const chunk of chunks) {
      const chunkStartTime = Number(chunk.dataset.startTime ?? 0);
      const chunkEndTime = Number(chunk.dataset.endTime ?? 0);

      if (chunkStartTime > removedStartTime) {
        chunk.dataset.startTime = String(chunkStartTime - removedDuration);
        chunk.dataset.endTime = String(chunkEndTime - removedDuration);
      }
    }
  }

  #getCurrentChunks(): HTMLElement[] {
    return Array.from(
      this.chunksContainer.querySelectorAll<HTMLElement>('.leftnav-transcription-chunk'),
    );
  }

  #buildCurrentTranscription(): TranscriptionResult[] {
    const grouped = new Map<string, TranscriptionResult>();
    const chunks = this.chunksContainer.querySelectorAll<HTMLElement>(
      '.leftnav-transcription-chunk',
    );

    for (const chunkEl of chunks) {
      const sourceId = chunkEl.dataset.sourceId ?? '';
      const clipId = chunkEl.dataset.clipId ?? '';
      const text = chunkEl.querySelector('.leftnav-transcription-chunk-text')?.textContent ?? '';
      const startTime = Number(chunkEl.dataset.startTime ?? 0);
      const endTime = Number(chunkEl.dataset.endTime ?? 0);
      const entry = grouped.get(sourceId) ?? { sourceId, clipId, text: '', chunks: [] };

      entry.chunks.push({
        text,
        timestamp: [startTime, endTime],
      });
      entry.text += text;
      grouped.set(sourceId, entry);
    }

    return [...grouped.values()];
  }

  #updateButtonState(): void {
    const enabled = this.canTranscribe && !this.transcribing;
    this.transcribeButton.disabled = !enabled;
    this.transcribeButton.title = this.canTranscribe
      ? 'Transcribe the first video or audio layer'
      : 'Add a video or audio layer before transcribing';
  }
}
