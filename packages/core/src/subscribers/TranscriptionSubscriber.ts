import type { LeftNav } from '../leftnav';
import type { CompositionPreview } from '@opensource/video-preview';
import type { CanvasElement } from '@opensource/video-preview';
import type { Clip, Timeline } from '@opensource/timeline';

import type { TranscriptionService } from '../transcription/transcription';
import type { TranscriptionResult } from '../transcription/types';
import type { PreviewTimelineSync } from './PreviewTimelineSync';

export interface TranscriptionSubscriberOptions {
  transcription: TranscriptionService;
  timeline: Timeline;
  preview: CompositionPreview;
  clipPreviewSync: PreviewTimelineSync;
  leftNav?: LeftNav | null;
}

export class TranscriptionSubscriber {
  private readonly transcription: TranscriptionService;
  private readonly timeline: Timeline;
  private readonly preview: CompositionPreview;
  private readonly clipPreviewSync: PreviewTimelineSync;
  private readonly leftNav: LeftNav | null;
  private activeTranscriptionClipId: string | undefined;

  constructor({
    transcription,
    timeline,
    preview,
    clipPreviewSync,
    leftNav = null,
  }: TranscriptionSubscriberOptions) {
    this.transcription = transcription;
    this.timeline = timeline;
    this.preview = preview;
    this.clipPreviewSync = clipPreviewSync;
    this.leftNav = leftNav;
  }

  bind(): void {
    this.transcription.on('transcription:requested', async ({ sourceId }) => {
      const source = findTranscriptionSource(this.preview, sourceId);
      if (!source) {
        this.transcription.setTranscriptionStatus(
          'Add a video or audio layer before transcribing.',
          false,
        );
        return;
      }

      this.leftNav?.setActivePanel('transcription');
      this.transcription.setTranscriptionStatus('Preparing audio for transcription…', true);

      try {
        this.transcription.loadModel();
        const result = await this.transcription.transcribeMedia(
          getMediaSourceUrl(source),
          source.type === 'audio' ? 'audio' : 'video',
          source.id,
          getTranscriptionClipOptions(source),
        );

        if (result) {
          const clipId = this.clipPreviewSync.getClipIdForElement(source.id);
          this.activeTranscriptionClipId = clipId;
          this.transcription.setTranscriptionResult({
            ...result,
            clipId,
          });
          this.transcription.setTranscriptionStatus('Transcription complete.', false);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.transcription.setTranscriptionStatus(`Transcription failed: ${message}`, false);
        console.error(error);
      }
    });

    this.transcription.on('transcription:seek', ({ timestamp, sourceId, clipId }) => {
      const timelineTime = resolveTranscriptSeekTimelineTime(this.timeline, timestamp, {
        clipId,
        sourceId,
        clipPreviewSync: this.clipPreviewSync,
      });
      this.timeline.setPlayhead(timelineTime);
    });

    this.transcription.on('transcription:captions:requested', ({ results }) => {
      addCaptionClips(this.timeline, results);
      this.transcription.setTranscriptionStatus('Caption layers added to the timeline.', false);
    });

    this.transcription.on('transcription:progress', (progress) => {
      if (progress.message || progress.status) {
        this.transcription.setTranscriptionStatus(progress.message ?? progress.status, true);
      }
    });

    this.transcription.on('transcription:word:removed', ({ clipId, startTime, duration }) => {
      const target = resolveClipCutTarget(this.timeline, clipId, startTime);
      if (!target) {
        return;
      }

      this.timeline.cut(target.clipId, target.localStartTime, duration);
    });

    this.timeline.on('playhead:change', ({ time }) => {
      const transcriptTime = resolveTimelineToTranscriptTime(this.timeline, time, {
        clipId: this.activeTranscriptionClipId,
        clipPreviewSync: this.clipPreviewSync,
      });
      this.transcription.highlightTranscriptionAt(transcriptTime);
    });

    this.preview.on('element:added', () => this.updateAvailability());
    this.preview.on('element:removed', () => this.updateAvailability());

    this.updateAvailability();
  }

  private updateAvailability(): void {
    this.transcription.setCanTranscribe(
      this.preview
        .getElements()
        .some((element) => element.type === 'video' || element.type === 'audio'),
    );
  }
}

export function bindTranscription(options: TranscriptionSubscriberOptions): void {
  const subscriber = new TranscriptionSubscriber(options);
  subscriber.bind();
}

export function resolveTranscriptSeekTimelineTime(
  timeline: Timeline,
  transcriptTime: number,
  options: {
    clipId?: string;
    sourceId?: string;
    clipPreviewSync?: PreviewTimelineSync;
  } = {},
): number {
  const clip = resolveTranscriptionMediaClip(timeline, options);
  if (!clip) {
    return transcriptTime;
  }

  return clip.startTime + transcriptTime;
}

export function resolveTimelineToTranscriptTime(
  timeline: Timeline,
  timelineTime: number,
  options: {
    clipId?: string;
    sourceId?: string;
    clipPreviewSync?: PreviewTimelineSync;
  } = {},
): number | null {
  const clip = resolveTranscriptionMediaClip(timeline, options);
  if (!clip) {
    return null;
  }

  const transcriptTime = timelineTime - clip.startTime;
  if (transcriptTime < -0.001 || transcriptTime > clip.duration + 0.001) {
    return null;
  }

  return Math.max(0, transcriptTime);
}

function resolveTranscriptionMediaClip(
  timeline: Timeline,
  options: {
    clipId?: string;
    sourceId?: string;
    clipPreviewSync?: PreviewTimelineSync;
  },
): Clip | undefined {
  const clips = timeline.getState().clips;

  if (options.clipId) {
    const clip = clips.find((item) => item.id === options.clipId);
    if (clip && isMediaClip(clip)) {
      return clip;
    }
  }

  if (options.sourceId && options.clipPreviewSync) {
    const mappedClipId = options.clipPreviewSync.getClipIdForElement(options.sourceId);
    if (mappedClipId) {
      const clip = clips.find((item) => item.id === mappedClipId);
      if (clip && isMediaClip(clip)) {
        return clip;
      }
    }
  }

  return undefined;
}

function isMediaClip(clip: Clip): boolean {
  return clip.type === 'video' || clip.type === 'audio';
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

function resolveClipCutTarget(
  timeline: Timeline,
  clipId: string,
  transcriptTime: number,
): { clipId: string; localStartTime: number } | null {
  const mediaClips = timeline
    .getState()
    .clips.filter((clip) => clip.type === 'video' || clip.type === 'audio');

  const preferred = mediaClips.find((clip) => clip.id === clipId);
  if (preferred && transcriptTime <= preferred.duration + 0.001) {
    return { clipId: preferred.id, localStartTime: transcriptTime };
  }

  const ordered = [...mediaClips].sort((left, right) => left.startTime - right.startTime);
  let offset = 0;

  for (const clip of ordered) {
    const clipEnd = offset + clip.duration;
    if (transcriptTime < clipEnd - 0.001) {
      return {
        clipId: clip.id,
        localStartTime: Math.max(0, transcriptTime - offset),
      };
    }
    offset = clipEnd;
  }

  if (preferred) {
    return { clipId: preferred.id, localStartTime: transcriptTime };
  }

  const fallback = ordered[0];
  return fallback ? { clipId: fallback.id, localStartTime: transcriptTime } : null;
}
