import type { AddClipInput, Clip, Track } from '@opensource/timeline';
import {
  AudioClip,
  ImageClip,
  TextClip,
  VideoClip,
  type CanvasElement,
  type CompositionClip,
} from '@opensource/video-canvas';

export function canvasElementToAddClipInput(element: CanvasElement): AddClipInput {
  const base = {
    name: element.name,
    duration: element.duration,
    startTime: element.startTime,
    sourceDuration: element.duration,
  };

  switch (element.type) {
    case 'video':
      return {
        ...base,
        type: 'video',
        url: element.src,
        hasAudio: true,
      };
    case 'image':
      return {
        ...base,
        type: 'image',
        url: element.src,
      };
    case 'audio':
      return {
        ...base,
        type: 'audio',
        url: element.src,
        hasAudio: false,
      };
    case 'text':
      return {
        ...base,
        type: 'text',
        textContent: element.content,
      };
  }
}

export function timelineClipToCompositionClip(clip: Clip): CompositionClip {
  const sourceOffset = clip.inPoint;

  switch (clip.type) {
    case 'video':
      return new VideoClip(clip.url ?? '', clip.startTime, clip.duration, undefined, undefined, undefined, undefined, {
        sourceOffset,
        muted: Boolean(clip.linkedClipId),
      });
    case 'image':
      return new ImageClip(clip.url ?? '', clip.startTime, clip.duration);
    case 'audio':
      return new AudioClip(clip.url ?? '', clip.startTime, clip.duration, sourceOffset);
    case 'text':
      return new TextClip(
        clip.textContent?.trim() || clip.name,
        clip.startTime,
        clip.duration,
      );
  }
}

export function getTimelineClipZIndex(
  clip: Pick<Clip, 'type' | 'trackId'>,
  tracks: Pick<Track, 'id'>[],
): number {
  const trackIndex = tracks.findIndex((track) => track.id === clip.trackId);
  if (trackIndex < 0) {
    return 0;
  }

  // Audio is not composited visually; keep it out of the layer stack.
  if (clip.type === 'audio') {
    return 0;
  }

  // Lower tracks in the timeline UI render above higher tracks.
  return trackIndex;
}

export function isLinkedAudioCompanion(clip: Clip, addedClips: Clip[]): boolean {
  if (clip.type !== 'audio' || !clip.linkedClipId) {
    return false;
  }

  return addedClips.some(
    (candidate) => candidate.type === 'video' && candidate.id === clip.linkedClipId,
  );
}
