import type { Sidebar } from '@opensource/sidebar';
import type { CompositionPreview } from '@opensource/video-preview';
import type { Timeline } from '@opensource/timeline';
import type { CanvasElement } from '@opensource/video-preview';

import type { TimelinePreviewSyncer } from '../glueComponents';
import type { TranscriptionService } from './TranscriptionService';
import type { TranscriptionResult } from './types';
import type { TranscriptionWorkspace } from './TranscriptionWorkspace';

export interface BindTranscriptionOptions {
  workspace: TranscriptionWorkspace;
  timeline: Timeline;
  preview: CompositionPreview;
  transcription: TranscriptionService;
  clipPreviewSync: TimelinePreviewSyncer;
  sidebar?: Sidebar | null;
}

export function bindTranscription({
  workspace,
  timeline,
  preview,
  transcription,
  clipPreviewSync,
  sidebar = null,
}: BindTranscriptionOptions): () => void {
  const disposers: Array<() => void> = [];

  const updateAvailability = (): void => {
    workspace.setCanTranscribe(
      preview
        .getElements()
        .some((element) => element.type === 'video' || element.type === 'audio'),
    );
  };

  disposers.push(
    workspace.setHandlers({
      onTranscriptionRequested: async (sourceId) => {
        const source = findTranscriptionSource(preview, sourceId);
        if (!source) {
          workspace.setTranscriptionStatus(
            'Add a video or audio layer before transcribing.',
            false,
          );
          return;
        }

        sidebar?.setActivePanel('transcription');
        workspace.setTranscriptionStatus('Preparing audio for transcription…', true);

        try {
          transcription.loadModel();
          const result = await transcription.transcribeMedia(
            getMediaSourceUrl(source),
            source.type === 'audio' ? 'audio' : 'video',
            source.id,
            getTranscriptionClipOptions(source),
          );

          if (result) {
            const clipId = clipPreviewSync.getClipIdForElement(source.id);
            workspace.setTranscriptionResult({
              ...result,
              clipId,
            });
            workspace.setTranscriptionStatus('Transcription complete.', false);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          workspace.setTranscriptionStatus(`Transcription failed: ${message}`, false);
          console.error(error);
        }
      },
      onSeek: (timestamp) => {
        timeline.pause();
        timeline.setPlayhead(timestamp);
      },
      onCaptionsRequested: (results) => {
        addCaptionClips(timeline, results);
        workspace.setTranscriptionStatus('Caption layers added to the timeline.', false);
      },
      onWordRemoved: (payload) => {
        transcription.notifyWordRemoved(payload);
      },
    }),
  );

  disposers.push(
    transcription.setHandlers({
      onProgress: (progress) => {
        if (progress.message || progress.status) {
          workspace.setTranscriptionStatus(
            progress.message ?? progress.status,
            true,
          );
        }
      },
    }),
  );

  disposers.push(
    timeline.on('playhead:change', ({ time }) => {
      workspace.highlightTranscriptionAt(time);
    }),
  );

  disposers.push(
    preview.on('element:added', updateAvailability),
    preview.on('element:removed', updateAvailability),
  );
  updateAvailability();

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
