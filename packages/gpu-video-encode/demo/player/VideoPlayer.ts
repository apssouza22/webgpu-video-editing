import type { Composition } from '@opensource/gpu-video-encode';
import { GpuCompositor, type CompositorLayer } from '../../src/gpu/GpuCompositor';
import { PlayerCanvas } from '../gpu/PlayerCanvas';

export class VideoPlayer {
  private readonly playerCanvas: PlayerCanvas;
  private readonly gpuCompositor: GpuCompositor;
  private renderVersion = 0;

  static async create(composition: Composition): Promise<VideoPlayer> {
    if (!navigator.gpu) {
      throw new Error('WebGPU is not available');
    }

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      throw new Error('Failed to acquire GPU adapter');
    }

    const device = await adapter.requestDevice();
    const playerCanvas = new PlayerCanvas();
    playerCanvas.init(device, composition.width, composition.height);
    const compositor = await GpuCompositor.create(
      device,
      playerCanvas.getFormat(),
      composition.width,
      composition.height,
    );

    return new VideoPlayer(composition, playerCanvas, compositor);
  }

  private constructor(
    private readonly composition: Composition,
    playerCanvas: PlayerCanvas,
    compositor: GpuCompositor,
  ) {
    this.playerCanvas = playerCanvas;
    this.gpuCompositor = compositor;
  }

  getCanvas(): HTMLCanvasElement {
    return this.playerCanvas.getCanvas();
  }

  async render(time: number, duration: number): Promise<void> {
    const renderVersion = ++this.renderVersion;
    const renderTime = Math.min(time, Math.max(0, duration - 0.001));
    const frameContext = this.composition.getFrameContextAtTime(renderTime);
    const decodedFrames: Array<{ frame: VideoFrame; close: () => void }> = [];

    try {
      const compositorLayers: CompositorLayer[] = [];

      for (const layer of frameContext.layers) {
        if (layer.type === 'video') {
          const sourceFrame = await layer.nextSourceFrame();
          decodedFrames.push(sourceFrame);
          compositorLayers.push({
            type: 'video',
            videoFrame: sourceFrame.frame,
            videoClip: layer.clip,
          });
          continue;
        }

        compositorLayers.push({
          type: 'image',
          image: await layer.clip.loadImageElement(),
          imageClip: layer.clip,
        });
      }

      if (renderVersion !== this.renderVersion) {
        return;
      }

      await this.gpuCompositor.renderFrame(this.playerCanvas.getContext(), {
        time: renderTime,
        layers: compositorLayers,
      });
    } finally {
      for (const sourceFrame of decodedFrames) {
        sourceFrame.close();
      }
    }
  }

  destroy(): void {
    this.gpuCompositor.destroy();
    this.playerCanvas.destroy();
  }
}
