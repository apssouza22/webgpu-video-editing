import type { Timeline } from '@opensource/timeline';

import type { TranscriptionService } from '../transcription/transcription';

export interface BindTranscriptionTimelineCutOptions {
  timeline: Timeline;
  transcription: TranscriptionService;
}

export function bindTranscriptionTimelineCut({
  timeline,
  transcription,
}: BindTranscriptionTimelineCutOptions): () => void {
  return transcription.on('transcription:word:removed', ({ clipId, startTime, duration }) => {
    const target = resolveClipCutTarget(timeline, clipId, startTime);
    if (!target) {
      return;
    }

    timeline.cut(target.clipId, target.localStartTime, duration);
  });
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
