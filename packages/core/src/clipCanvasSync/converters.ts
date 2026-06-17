import type { AddClipInput, Clip, Track } from '@opensource/timeline';
import {
  createCanvasElement,
  type CanvasElement,
  type CanvasSize,
} from '@opensource/video-canvas';

export interface TimelineClipToElementContext {
  zIndex: number;
  playerSize: CanvasSize;
}

export function fromPreviewElementToTimelineClip(element: CanvasElement): AddClipInput {
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

export function timelineClipToCanvasElement(
  clip: Clip,
  context: TimelineClipToElementContext,
): CanvasElement {
  const sourceOffset = clip.inPoint;

  switch (clip.type) {
    case 'video': {
      const defaults = createCanvasElement({
        type: 'video',
        src: clip.url ?? '',
        zIndex: context.zIndex,
        playerSize: context.playerSize,
      });

      if (defaults.type !== 'video') {
        throw new Error('Expected video canvas element');
      }

      return {
        ...defaults,
        name: clip.name,
        startTime: clip.startTime,
        duration: clip.duration,
        sourceOffset,
        muted: Boolean(clip.linkedClipId),
      };
    }
    case 'image': {
      const defaults = createCanvasElement({
        type: 'image',
        src: clip.url ?? '',
        zIndex: context.zIndex,
        playerSize: context.playerSize,
      });

      if (defaults.type !== 'image') {
        throw new Error('Expected image canvas element');
      }

      return {
        ...defaults,
        name: clip.name,
        startTime: clip.startTime,
        duration: clip.duration,
      };
    }
    case 'audio': {
      const defaults = createCanvasElement({
        type: 'audio',
        src: clip.url ?? '',
        zIndex: context.zIndex,
        playerSize: context.playerSize,
      });

      if (defaults.type !== 'audio') {
        throw new Error('Expected audio canvas element');
      }

      return {
        ...defaults,
        name: clip.name,
        startTime: clip.startTime,
        duration: clip.duration,
        sourceOffset,
      };
    }
    case 'text': {
      const defaults = createCanvasElement({
        type: 'text',
        zIndex: context.zIndex,
        playerSize: context.playerSize,
      });

      if (defaults.type !== 'text') {
        throw new Error('Expected text canvas element');
      }

      return {
        ...defaults,
        name: clip.name,
        content: clip.textContent?.trim() || clip.name,
        startTime: clip.startTime,
        duration: clip.duration,
      };
    }
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
