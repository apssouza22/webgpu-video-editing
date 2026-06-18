import type { Timeline, TimelineEventMap } from '@opensource/timeline';
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
    this.frameLoop.subscribe(({ deltaTime }) => this.onFrame(deltaTime));
    this.renderPreview(this.timeline.getPlayhead(), false, this.timeline.getPlaybackRate());
  }

  onPlayheadChange(payload: TimelineEventMap['playhead:change']): void {
    this.syncCanvasOnScrub(payload);
  }

  onPlay(payload: TimelineEventMap['playhead:play']): void {
    this.handlePlay(payload);
  }

  onPause(payload: TimelineEventMap['playhead:pause']): void {
    this.handlePause(payload);
  }

  onRateChange(payload: TimelineEventMap['playhead:rate']): void {
    this.handleRateChange(payload);
  }

  private renderPreview(time: number, playing: boolean, playbackRate: number): void {
    this.preview.render(time, {
      playing,
      playbackRate,
      ...(playing ? { playbackStartedAt: this.playbackStartedAt } : {}),
    });
  }

  private syncCanvasOnScrub({ time, state }: TimelineEventMap['playhead:change']): void {
    if (state.isPlaying) {
      if (this.advancingFrame) {
        return;
      }

      this.playbackStartedAt = time;
      this.renderPreview(time, true, state.playbackRate);
      return;
    }

    this.renderPreview(time, false, state.playbackRate);
  }

  private handlePlay({ time, state }: TimelineEventMap['playhead:play']): void {
    this.playbackStartedAt = time;
    this.preview.selectElement(null);
    this.renderPreview(time, true, state.playbackRate);
    this.frameLoop.start();
  }

  private handlePause({ time, state }: TimelineEventMap['playhead:pause']): void {
    this.frameLoop.stop();
    this.renderPreview(time, false, state.playbackRate);
  }

  private handleRateChange({ state }: TimelineEventMap['playhead:rate']): void {
    if (!state.isPlaying) {
      this.renderPreview(state.playheadPosition, false, state.playbackRate);
      return;
    }

    this.playbackStartedAt = state.playheadPosition;
    this.renderPreview(this.playbackStartedAt, true, state.playbackRate);
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
      this.renderPreview(state.duration, false, state.playbackRate);
      return;
    }

    this.advancingFrame = true;
    try {
      this.timeline.render(nextTime, { scroll: 'visible' });
      this.renderPreview(nextTime, true, state.playbackRate);
    } finally {
      this.advancingFrame = false;
    }
  }
}

export function bindEditorPlayback(options: EditorPlaybackOptions): void {
  const playback = new EditorPlayback(options);
  playback.bind();
}
