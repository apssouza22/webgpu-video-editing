import type { Timeline } from '@opensource/timeline';
import type { CompositionPreview } from '@opensource/video-preview';

import type { AnimationFrameLoop } from './AnimationFrameLoop';

export interface EditorPlaybackOptions {
  timeline: Timeline;
  preview: CompositionPreview;
  frameLoop: AnimationFrameLoop;
}

/**
 * Drives timeline transport and canvas preview from a shared animation frame loop.
 */
export class EditorPlayback {
  private readonly timeline: Timeline;
  private readonly preview: CompositionPreview;
  private readonly frameLoop: AnimationFrameLoop;
  private playbackStartedAt: number;
  private advancingFrame = false;

  constructor({ timeline, preview, frameLoop }: EditorPlaybackOptions) {
    this.timeline = timeline;
    this.preview = preview;
    this.frameLoop = frameLoop;
    this.playbackStartedAt = timeline.getPlayhead();
  }

  bind(): void {
    this.timeline.on('playhead:change', (payload) => this.syncCanvasOnScrub(payload));
    this.timeline.on('playhead:play', (payload) => this.onPlay(payload));
    this.timeline.on('playhead:pause', (payload) => this.onPause(payload));
    this.timeline.on('playhead:rate', () => this.onRateChange());
    this.frameLoop.subscribe(({ deltaTime }) => this.onFrame(deltaTime));

    this.renderPreview(this.timeline.getPlayhead(), false);
  }

  private renderPreview(time: number, playing: boolean): void {
    this.preview.render(time, {
      playing,
      playbackRate: this.timeline.getPlaybackRate(),
      ...(playing ? { playbackStartedAt: this.playbackStartedAt } : {}),
    });
  }

  private syncCanvasOnScrub({ time }: { time: number }): void {
    if (this.timeline.getState().isPlaying) {
      if (this.advancingFrame) {
        return;
      }

      this.playbackStartedAt = time;
      this.renderPreview(time, true);
      return;
    }

    this.renderPreview(time, false);
  }

  private onPlay({ time }: { time: number }): void {
    this.playbackStartedAt = time;
    this.preview.selectElement(null);
    this.renderPreview(time, true);
    this.frameLoop.start();
  }

  private onPause({ time }: { time: number }): void {
    this.frameLoop.stop();
    this.renderPreview(time, false);
  }

  private onRateChange(): void {
    const state = this.timeline.getState();
    if (!state.isPlaying) {
      this.renderPreview(state.playheadPosition, false);
      return;
    }

    this.playbackStartedAt = state.playheadPosition;
    this.renderPreview(this.playbackStartedAt, true);
  }

  private onFrame(deltaTime: number): void {
    const state = this.timeline.getState();
    if (!state.isPlaying) {
      return;
    }

    let nextTime = state.playheadPosition + deltaTime * state.playbackRate;
    if (nextTime >= state.duration) {
      this.timeline.render(state.duration, { scroll: 'visible' });
      this.timeline.pause();
      this.renderPreview(state.duration, false);
      return;
    }

    this.advancingFrame = true;
    try {
      this.timeline.render(nextTime, { scroll: 'visible' });
      this.renderPreview(nextTime, true);
    } finally {
      this.advancingFrame = false;
    }
  }
}

export function bindEditorPlayback(options: EditorPlaybackOptions): void {
  const playback = new EditorPlayback(options);
  playback.bind();
}
