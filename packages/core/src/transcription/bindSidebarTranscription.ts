import type { CompositionPreview } from '@opensource/video-preview';
import type { Sidebar } from '@opensource/sidebar';
import type { Timeline } from '@opensource/timeline';
import type { CanvasElement } from '@opensource/video-preview';

import type { TranscriptionService } from './TranscriptionService';
import type { TranscriptionResult } from './types';

export interface BindSidebarTranscriptionOptions {
  sidebar: Sidebar;
  timeline: Timeline;
  preview: CompositionPreview;
  transcription: TranscriptionService;
}

export function bindSidebarTranscription({
  sidebar,
  timeline,
  preview,
  transcription,
}: BindSidebarTranscriptionOptions): () => void {
  const disposers: Array<() => void> = [];

  disposers.push(
    sidebar.on('transcription:requested', async ({ sourceId }) => {
      const source = findTranscriptionSource(preview, sourceId);
      if (!source) {
        sidebar.setTranscriptionStatus(
          'Add a video or audio layer before transcribing.',
          false,
        );
        return;
      }

      sidebar.setActivePanel('transcription');
      sidebar.setTranscriptionStatus('Preparing audio for transcription…', true);

      try {
        transcription.loadModel();
        const result = await transcription.transcribeMedia(
          getMediaSourceUrl(source),
          source.type === 'audio' ? 'audio' : 'video',
          source.id,
          getTranscriptionClipOptions(source),
        );

        if (result) {
          sidebar.setTranscriptionResult(result);
          sidebar.setTranscriptionStatus('Transcription complete.', false);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        sidebar.setTranscriptionStatus(`Transcription failed: ${message}`, false);
        console.error(error);
      }
    }),
  );

  disposers.push(
    transcription.on('transcription:progress', (progress) => {
      if (progress.message || progress.status) {
        sidebar.setTranscriptionStatus(
          progress.message ?? progress.status,
          true,
        );
      }
    }),
  );

  disposers.push(
    sidebar.on('transcription:seek', ({ timestamp }) => {
      timeline.pause();
      timeline.setPlayhead(timestamp);
    }),
  );

  disposers.push(
    sidebar.on('transcription:captions:requested', ({ results }) => {
      addCaptionClips(timeline, results);
      sidebar.setTranscriptionStatus('Caption layers added to the timeline.', false);
    }),
  );

  disposers.push(
    timeline.on('playhead:change', ({ time }) => {
      sidebar.highlightTranscriptionAt(time);
    }),
  );

  return () => {
    while (disposers.length > 0) {
      disposers.pop()?.();
    }
  };
}

function findTranscriptionSource(
  preview: CompositionPreview,
  sourceId?: string,
): CanvasElement | null {
  if (sourceId) {
    const selected = preview.getElement(sourceId);
    if (selected && (selected.type === 'video' || selected.type === 'audio')) {
      return selected;
    }
  }

  const selected = preview.getSelectedElement();
  if (selected && (selected.type === 'video' || selected.type === 'audio')) {
    return selected;
  }

  return (
    preview
      .getElements()
      .find((element) => element.type === 'video' || element.type === 'audio') ?? null
  );
}

function getMediaSourceUrl(element: CanvasElement): string {
  if (element.type === 'video' || element.type === 'audio') {
    return element.src;
  }

  throw new Error('Only video and audio layers can be transcribed.');
}

function getTranscriptionClipOptions(
  element: CanvasElement,
): { sourceOffset: number; duration: number } {
  if (element.type === 'video' || element.type === 'audio') {
    return {
      sourceOffset: element.sourceOffset ?? 0,
      duration: element.duration,
    };
  }

  throw new Error('Only video and audio layers can be transcribed.');
}

function addCaptionClips(timeline: Timeline, results: TranscriptionResult[]): void {
  for (const result of results) {
    for (const chunk of result.chunks) {
      const text = chunk.text.trim();
      if (!text) {
        continue;
      }

      const startTime = chunk.timestamp[0];
      const duration = Math.max(0.1, chunk.timestamp[1] - chunk.timestamp[0]);

      timeline.addClip({
        type: 'text',
        name: text.slice(0, 32),
        startTime,
        duration,
        textContent: text,
      });
    }
  }
}
