import { describe, expect, it } from 'vitest';
import type { CompositionPreview } from '@opensource/video-preview';

import {
  resolveExportDimensions,
  resolveExportSettings,
  resolveOutputFilename,
} from './exportOptions';

function createCanvasStub(size: { width: number; height: number }): CompositionPreview {
  return {
    getPlayerSize: () => size,
  } as CompositionPreview;
}

describe('resolveExportDimensions', () => {
  const sourceSize = { width: 1280, height: 720 };

  it('preserves aspect ratio for named presets', () => {
    expect(resolveExportDimensions(sourceSize, { preset: '720p' })).toEqual({
      width: 1280,
      height: 720,
    });
  });

  it('applies explicit scale factors with even dimensions', () => {
    expect(resolveExportDimensions(sourceSize, { scale: 0.5 })).toEqual({
      width: 640,
      height: 360,
    });
  });
});

describe('resolveOutputFilename', () => {
  it('uses the provided filename when set', () => {
    expect(resolveOutputFilename('mp4', 'final-cut.mp4')).toBe('final-cut.mp4');
  });

  it('falls back to a default filename', () => {
    expect(resolveOutputFilename('mp4')).toBe('composition-export.mp4');
  });
});

describe('resolveExportSettings', () => {
  it('normalizes invalid playback rates to 1', () => {
    const settings = resolveExportSettings(
      createCanvasStub({ width: 1280, height: 720 }),
      { playbackRate: -2 },
    );

    expect(settings.playbackRate).toBe(1);
  });

  it('keeps a valid playback rate', () => {
    const settings = resolveExportSettings(
      createCanvasStub({ width: 1280, height: 720 }),
      { playbackRate: 2 },
    );

    expect(settings.playbackRate).toBe(2);
  });
});
