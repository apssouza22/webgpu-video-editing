import type { Timeline } from '@opensource/timeline';
import type { CompositionCanvas } from '@opensource/video-canvas';

import type { AnimationFrameLoop } from '../animationFrameLoop';

export interface EditorPlaybackOptions {
  timeline: Timeline;
  canvas: CompositionCanvas;
  frameLoop: AnimationFrameLoop;
}

/**
 * Drives timeline transport and canvas preview from a shared animation frame loop.
 */
export function bindEditorPlayback({
  timeline,
  canvas,
  frameLoop,
}: EditorPlaybackOptions): () => void {
  const disposables: Array<() => void> = [];
  let playbackStartedAt = timeline.getPlayhead();

  const renderCanvas = (time: number, playing: boolean): void => {
    canvas.render(time, {
      playing,
      playbackRate: timeline.getPlaybackRate(),
      ...(playing ? { playbackStartedAt } : {}),
    });
  };

  const syncCanvasOnScrub = ({ time }: { time: number }): void => {
    if (timeline.getState().isPlaying) {
      return;
    }
    renderCanvas(time, false);
  };

  const onPlay = ({ time }: { time: number }): void => {
    playbackStartedAt = time;
    canvas.selectElement(null);
    renderCanvas(time, true);
    frameLoop.start();
  };

  const onPause = ({ time }: { time: number }): void => {
    frameLoop.stop();
    renderCanvas(time, false);
  };

  const onRateChange = (): void => {
    const state = timeline.getState();
    if (!state.isPlaying) {
      renderCanvas(state.playheadPosition, false);
      return;
    }

    playbackStartedAt = state.playheadPosition;
    renderCanvas(playbackStartedAt, true);
  };

  disposables.push(
    timeline.on('playhead:change', syncCanvasOnScrub),
    timeline.on('playhead:play', onPlay),
    timeline.on('playhead:pause', onPause),
    timeline.on('playhead:rate', onRateChange),
    frameLoop.subscribe(({ deltaTime }) => {
      const state = timeline.getState();
      if (!state.isPlaying) {
        return;
      }

      let nextTime = state.playheadPosition + deltaTime * state.playbackRate;
      if (nextTime >= state.duration) {
        timeline.render(state.duration, { scroll: 'visible' });
        timeline.pause();
        renderCanvas(state.duration, false);
        return;
      }

      timeline.render(nextTime, { scroll: 'visible' });
      renderCanvas(nextTime, true);
    }),
  );

  renderCanvas(timeline.getPlayhead(), false);

  return () => {
    frameLoop.stop();
    for (const unsubscribe of disposables) {
      unsubscribe();
    }
    disposables.length = 0;
  };
}
