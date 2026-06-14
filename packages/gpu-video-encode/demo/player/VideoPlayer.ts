import type { Composition, ImageClip } from '@opensource/gpu-video-encode';
import { GpuCompositor } from '../../src/gpu/GpuCompositor';
import { PlayerCanvas } from '../gpu/PlayerCanvas';

export class VideoPlayer {
  private readonly playerCanvas: PlayerCanvas;
  private readonly gpuCompositor: GpuCompositor;
  private readonly imageLayers: readonly ImageClip[];
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
    const compositor = await GpuCompositor.create(device, playerCanvas.getFormat());

    return new VideoPlayer(composition, playerCanvas, compositor);
  }

  private constructor(
    private readonly composition: Composition,
    playerCanvas: PlayerCanvas,
    compositor: GpuCompositor,
  ) {
    this.playerCanvas = playerCanvas;
    this.gpuCompositor = compositor;
    this.imageLayers = composition.imageLayers;
  }

  getCanvas(): HTMLCanvasElement {
    return this.playerCanvas.getCanvas();
  }

  async render(time: number, duration: number): Promise<void> {
    const renderVersion = ++this.renderVersion;
    const renderTime = Math.min(time, Math.max(0, duration - 0.001));
    const frameContext = this.composition.getFrameContextAtTime(renderTime);
    if (frameContext.videos.length === 0) {
      return;
    }

    const videoFrames = await Promise.all(
      frameContext.videos.map((videoLayer) => videoLayer.nextSourceFrame()),
    );
    const imageLayers = await Promise.all(
      this.currentImageLayers(renderTime).map(async (imageClip) => ({
        image: await imageClip.loadImageElement(),
        imageClip,
      })),
    );

    let videoLayers = frameContext.videos.map((videoLayer, index) => ({
      videoFrame: videoFrames[index].frame,
      videoClip: videoLayer.clip,
    }));

    try {
      if (renderVersion !== this.renderVersion) {
        return;
      }
      await this.gpuCompositor.renderFrame(this.playerCanvas.getContext(), {
        time: renderTime,
        videoLayers: videoLayers,
        imageLayers: imageLayers,
      });
    } finally {
      for (const sourceFrame of videoFrames) {
        sourceFrame.close();
      }
    }
  }

  destroy(): void {
    this.gpuCompositor.destroy();
    this.playerCanvas.destroy();
  }

  private currentImageLayers(time: number): readonly ImageClip[] {
    return this.imageLayers.filter((clip) => clip.containsTime(time));
  }
}
