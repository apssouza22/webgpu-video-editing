import { describe, expect, it } from 'vitest';
import type { Clip } from '@opensource/timeline';

import {
  fromPreviewElementToTimelineClip,
  getTimelineClipZIndex,
  isLinkedAudioCompanion,
} from './converters';

describe('getTimelineClipZIndex', () => {
  const tracks = [{ id: 'v1' }, { id: 'v2' }, { id: 'a1' }];

  it('maps visual clips to their track index', () => {
    expect(getTimelineClipZIndex({ type: 'video', trackId: 'v1' }, tracks)).toBe(0);
    expect(getTimelineClipZIndex({ type: 'image', trackId: 'v2' }, tracks)).toBe(1);
  });

  it('keeps audio out of the visual layer stack', () => {
    expect(getTimelineClipZIndex({ type: 'audio', trackId: 'a1' }, tracks)).toBe(0);
  });

  it('returns 0 when the track is unknown', () => {
    expect(getTimelineClipZIndex({ type: 'video', trackId: 'missing' }, tracks)).toBe(0);
  });
});

describe('isLinkedAudioCompanion', () => {
  it('detects audio linked to a video clip in the same add batch', () => {
    const video = {
      id: 'v1',
      type: 'video',
      linkedClipId: 'a1',
    } as Clip;
    const audio = {
      id: 'a1',
      type: 'audio',
      linkedClipId: 'v1',
    } as Clip;

    expect(isLinkedAudioCompanion(audio, [video, audio])).toBe(true);
    expect(isLinkedAudioCompanion(video, [video, audio])).toBe(false);
  });
});

describe('canvasElementToAddClipInput', () => {
  it('maps canvas timing fields onto timeline clip input', () => {
    const input = fromPreviewElementToTimelineClip({
      id: 'el-1',
      type: 'video',
      name: 'Scene',
      src: 'clip.mp4',
      startTime: 2,
      duration: 8,
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      rotation: 0,
      opacity: 1,
      zIndex: 0,
      muted: false,
      loop: false,
    });

    expect(input).toMatchObject({
      type: 'video',
      name: 'Scene',
      url: 'clip.mp4',
      startTime: 2,
      duration: 8,
      hasAudio: true,
    });
  });
});
