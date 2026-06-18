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

    this.renderCanvas(this.timeline.getPlayhead(), false);
  }

  private renderCanvas(time: number, playing: boolean): void {
    this.preview.render(time, {
      playing,
      playbackRate: this.timeline.getPlaybackRate(),
      ...(playing ? { playbackStartedAt: this.playbackStartedAt } : {}),
    });
  }

  private syncCanvasOnScrub({ time }: { time: number }): void {
    if (this.timeline.getState().isPlaying) {
      return;
    }
    this.renderCanvas(time, false);
  }

  private onPlay({ time }: { time: number }): void {
    this.playbackStartedAt = time;
    this.preview.selectElement(null);
    this.renderCanvas(time, true);
    this.frameLoop.start();
  }

  private onPause({ time }: { time: number }): void {
    this.frameLoop.stop();
    this.renderCanvas(time, false);
  }

  private onRateChange(): void {
    const state = this.timeline.getState();
    if (!state.isPlaying) {
      this.renderCanvas(state.playheadPosition, false);
      return;
    }

    this.playbackStartedAt = state.playheadPosition;
    this.renderCanvas(this.playbackStartedAt, true);
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
      this.renderCanvas(state.duration, false);
      return;
    }

    this.timeline.render(nextTime, { scroll: 'visible' });
    this.renderCanvas(nextTime, true);
  }
}

export function bindEditorPlayback(options: EditorPlaybackOptions): void {
  const playback = new EditorPlayback(options);
  playback.bind();
}
