export interface FrameContext {
  /** DOMHighResTimeStamp from requestAnimationFrame. */
  timestamp: number;
  /** Seconds elapsed since the previous delivered frame. */
  deltaTime: number;
  /** Whether the document is currently visible. */
  isVisible: boolean;
}

export type FrameCallback = (context: FrameContext) => void;

export interface AnimationFrameLoopOptions {
  /**
   * Upper bound for delta time in seconds. Prevents large jumps after tab
   * switches or debugger breakpoints.
   */
  maxDeltaTime?: number;
  requestFrame?: (callback: FrameRequestCallback) => number;
  cancelFrame?: (handle: number) => void;
}

const DEFAULT_MAX_DELTA_TIME = 0.1;

export class AnimationFrameLoop {
  private readonly maxDeltaTime: number;
  private readonly requestFrame: (callback: FrameRequestCallback) => number;
  private readonly cancelFrame: (handle: number) => void;
  private readonly subscribers = new Set<FrameCallback>();

  private rafId: number | null = null;
  private running = false;
  private lastTimestamp: number | null = null;
  private destroyed = false;
  private readonly onVisibilityChange = (): void => {
    if (document.hidden) {
      this.lastTimestamp = null;
    }
  };

  constructor(options: AnimationFrameLoopOptions = {}) {
    this.maxDeltaTime = options.maxDeltaTime ?? DEFAULT_MAX_DELTA_TIME;
    this.requestFrame = options.requestFrame ?? ((callback) => requestAnimationFrame(callback));
    this.cancelFrame = options.cancelFrame ?? ((handle) => cancelAnimationFrame(handle));

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.onVisibilityChange);
    }
  }

  get isRunning(): boolean {
    return this.running;
  }

  subscribe(callback: FrameCallback): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  start(): void {
    if (this.destroyed || this.running) {
      return;
    }

    this.running = true;
    this.lastTimestamp = null;
    this.schedule();
  }

  stop(): void {
    this.running = false;
    this.cancelScheduledFrame();
    this.lastTimestamp = null;
  }

  destroy(): void {
    if (this.destroyed) {
      return;
    }

    this.destroyed = true;
    this.stop();
    this.subscribers.clear();

    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.onVisibilityChange);
    }
  }

  private schedule(): void {
    if (!this.running || this.rafId !== null) {
      return;
    }

    this.rafId = this.requestFrame((timestamp) => {
      this.rafId = null;
      this.tick(timestamp);

      if (this.running) {
        this.schedule();
      }
    });
  }

  private tick(timestamp: number): void {
    const isVisible = typeof document === 'undefined' || !document.hidden;
    let deltaTime = 0;

    if (this.lastTimestamp !== null) {
      deltaTime = Math.min(
        Math.max(0, (timestamp - this.lastTimestamp) / 1000),
        this.maxDeltaTime,
      );
    }

    this.lastTimestamp = timestamp;

    if (deltaTime === 0) {
      return;
    }

    const context: FrameContext = { timestamp, deltaTime, isVisible };
    for (const callback of this.subscribers) {
      callback(context);
    }
  }

  private cancelScheduledFrame(): void {
    if (this.rafId === null) {
      return;
    }

    this.cancelFrame(this.rafId);
    this.rafId = null;
  }
}
