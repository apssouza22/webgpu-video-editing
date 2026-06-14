import type { AddClipInput, Clip } from '@opensource/timeline';
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
  switch (clip.type) {
    case 'video':
      return new VideoClip(clip.url ?? '', clip.startTime, clip.duration);
    case 'image':
      return new ImageClip(clip.url ?? '', clip.startTime, clip.duration);
    case 'audio':
      return new AudioClip(clip.url ?? '', clip.startTime, clip.duration);
    case 'text':
      return new TextClip(
        clip.textContent?.trim() || clip.name,
        clip.startTime,
        clip.duration,
      );
  }
}

export function isLinkedAudioCompanion(clip: Clip, addedClips: Clip[]): boolean {
  if (clip.type !== 'audio' || !clip.linkedClipId) {
    return false;
  }

  return addedClips.some(
    (candidate) => candidate.type === 'video' && candidate.id === clip.linkedClipId,
  );
}
