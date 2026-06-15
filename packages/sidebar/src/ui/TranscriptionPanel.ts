import type { Sidebar } from '../common/Sidebar';
import type { TranscriptionChunk, TranscriptionResult } from '../common/types';

export class TranscriptionPanel {
  private readonly root: HTMLElement;
  private readonly transcribeButton: HTMLButtonElement;
  private readonly captionsButton: HTMLButtonElement;
  private readonly statusEl: HTMLParagraphElement;
  private readonly chunksContainer: HTMLDivElement;
  private transcribing = false;

  constructor(private readonly sidebar: Sidebar) {
    this.root = document.createElement('div');
    this.root.className = 'flex flex-col gap-4';

    const title = document.createElement('h2');
    title.className = 'sidebar-section-title';
    title.textContent = 'Transcription';

    const description = document.createElement('p');
    description.className = 'm-0 text-es-muted text-sm leading-snug';
    description.textContent =
      'Generate word-level captions from video or audio layers using Whisper in the browser.';

    this.transcribeButton = document.createElement('button');
    this.transcribeButton.type = 'button';
    this.transcribeButton.className = 'sidebar-action-button sidebar-action-button--primary';
    this.transcribeButton.textContent = 'Transcribe media';

    this.captionsButton = document.createElement('button');
    this.captionsButton.type = 'button';
    this.captionsButton.className = 'sidebar-action-button';
    this.captionsButton.textContent = 'Add caption layers';
    this.captionsButton.hidden = true;

    this.statusEl = document.createElement('p');
    this.statusEl.className = 'sidebar-transcription-status';
    this.statusEl.setAttribute('aria-live', 'polite');

    this.chunksContainer = document.createElement('div');
    this.chunksContainer.className = 'sidebar-transcription-chunks';

    this.transcribeButton.addEventListener('click', () => {
      this.sidebar.requestTranscription();
    });

    this.captionsButton.addEventListener('click', () => {
      const results = this.buildResultsFromDom();
      if (results.length > 0) {
        this.sidebar.requestTranscriptionCaptions(results);
      }
    });

    this.sidebar.on('transcription:status', ({ message, transcribing }) => {
      this.transcribing = transcribing;
      this.statusEl.textContent = message;
      this.updateButtonState(this.sidebar.canTranscribe());
    });

    this.sidebar.on('transcription:result', ({ result }) => {
      this.renderResult(result);
      this.updateButtonState(this.sidebar.canTranscribe());
    });

    this.sidebar.on('transcription:highlight', ({ time }) => {
      this.highlightChunksByTime(time);
    });

    this.sidebar.on('transcription:availability', ({ canTranscribe }) => {
      this.updateButtonState(canTranscribe);
    });

    this.root.append(
      title,
      description,
      this.transcribeButton,
      this.captionsButton,
      this.statusEl,
      this.chunksContainer,
    );

    this.updateButtonState(this.sidebar.canTranscribe());
  }

  get element(): HTMLElement {
    return this.root;
  }

  private renderResult(result: TranscriptionResult | null): void {
    this.chunksContainer.replaceChildren();

    if (!result) {
      this.captionsButton.hidden = true;
      return;
    }

    for (const [index, chunk] of result.chunks.entries()) {
      this.chunksContainer.append(this.createChunkElement(chunk, index, result.sourceId ?? ''));
    }

    this.captionsButton.hidden = result.chunks.length === 0;
  }

  private createChunkElement(
    chunk: TranscriptionChunk,
    index: number,
    sourceId: string,
  ): HTMLElement {
    const chunkEl = document.createElement('button');
    chunkEl.type = 'button';
    chunkEl.className = 'sidebar-transcription-chunk';
    chunkEl.dataset.index = String(index);
    chunkEl.dataset.startTime = String(chunk.timestamp[0]);
    chunkEl.dataset.endTime = String(chunk.timestamp[1]);
    chunkEl.dataset.sourceId = sourceId;

    const text = document.createElement('span');
    text.className = 'sidebar-transcription-chunk-text';
    text.textContent = chunk.text;

    const remove = document.createElement('span');
    remove.className = 'sidebar-transcription-chunk-remove';
    remove.setAttribute('aria-label', 'Remove chunk');
    remove.textContent = '×';

    remove.addEventListener('click', (event) => {
      event.stopPropagation();
      const startTime = Number(chunkEl.dataset.startTime ?? 0);
      const endTime = Number(chunkEl.dataset.endTime ?? 0);
      this.sidebar.removeTranscriptionChunk(startTime, endTime, sourceId);
      this.removeChunkElement(chunkEl, startTime, endTime);
    });

    chunkEl.addEventListener('click', () => {
      this.sidebar.seekTranscription(chunk.timestamp[0], sourceId);
    });

    chunkEl.append(text, remove);
    return chunkEl;
  }

  private removeChunkElement(
    chunkElement: HTMLElement,
    startTime: number,
    endTime: number,
  ): void {
    const removedDuration = endTime - startTime;
    const chunks = Array.from(
      this.chunksContainer.querySelectorAll<HTMLElement>('.sidebar-transcription-chunk'),
    );

    for (const chunk of chunks) {
      const chunkStart = Number(chunk.dataset.startTime ?? 0);
      const chunkEnd = Number(chunk.dataset.endTime ?? 0);

      if (chunkStart > startTime) {
        chunk.dataset.startTime = String(chunkStart - removedDuration);
        chunk.dataset.endTime = String(chunkEnd - removedDuration);
      }
    }

    chunkElement.remove();
    this.captionsButton.hidden = this.chunksContainer.childElementCount === 0;
  }

  private buildResultsFromDom(): TranscriptionResult[] {
    const grouped = new Map<string, TranscriptionResult>();
    const chunks = this.chunksContainer.querySelectorAll<HTMLElement>(
      '.sidebar-transcription-chunk',
    );

    for (const chunkEl of chunks) {
      const sourceId = chunkEl.dataset.sourceId ?? '';
      const text = chunkEl.querySelector('.sidebar-transcription-chunk-text')?.textContent ?? '';
      const startTime = Number(chunkEl.dataset.startTime ?? 0);
      const endTime = Number(chunkEl.dataset.endTime ?? 0);
      const entry = grouped.get(sourceId) ?? { sourceId, text: '', chunks: [] };

      entry.chunks.push({
        text,
        timestamp: [startTime, endTime],
      });
      entry.text += text;
      grouped.set(sourceId, entry);
    }

    return [...grouped.values()];
  }

  private highlightChunksByTime(currentTime: number): void {
    const chunks = this.chunksContainer.querySelectorAll<HTMLElement>(
      '.sidebar-transcription-chunk',
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

  private updateButtonState(canTranscribe: boolean): void {
    const enabled = canTranscribe && !this.transcribing;
    this.transcribeButton.disabled = !enabled;
    this.transcribeButton.title = canTranscribe
      ? 'Transcribe the first video or audio layer'
      : 'Add a video or audio layer before transcribing';
  }
}
