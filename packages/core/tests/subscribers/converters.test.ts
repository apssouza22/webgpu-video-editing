import { describe, expect, it } from 'vitest';
import type { Clip } from '@opensource/timeline';

import {
  fromPreviewElementToTimelineClip,
  getTimelineClipZIndex,
  isLinkedAudioCompanion,
  timelineClipToCanvasElement,
} from '../../src/subscribers/converters';

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

describe('timelineClipToCanvasElement', () => {
  it('maps timeline clip fields onto a canvas element', () => {
    const element = timelineClipToCanvasElement(
      {
        id: 'clip-1',
        type: 'video',
        name: 'Scene',
        url: 'clip.mp4',
        startTime: 2,
        duration: 8,
        inPoint: 1.5,
        outPoint: 9.5,
        trackId: 'v1',
      } as Clip,
      {
        zIndex: 3,
        playerSize: { width: 1280, height: 720 },
      },
    );

    expect(element).toMatchObject({
      type: 'video',
      name: 'Scene',
      src: 'clip.mp4',
      startTime: 2,
      duration: 8,
      sourceOffset: 1.5,
      zIndex: 3,
    });
  });

  it('mutes video when linked to a separate audio clip', () => {
    const element = timelineClipToCanvasElement(
      {
        id: 'clip-1',
        type: 'video',
        name: 'Scene',
        url: 'clip.mp4',
        startTime: 0,
        duration: 5,
        inPoint: 0,
        outPoint: 5,
        trackId: 'v1',
        linkedClipId: 'audio-1',
      } as Clip,
      {
        zIndex: 0,
        playerSize: { width: 1280, height: 720 },
      },
    );

    expect(element.type).toBe('video');
    if (element.type === 'video') {
      expect(element.muted).toBe(true);
    }
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
