import type { VideoFrameContext } from '../types';
import { ExporterCanvas } from '../gpu/ExporterCanvas';
import { GpuCompositor } from '../gpu/GpuCompositor';
import { VideoEncoderService } from './VideoEncoderService';
import type { DecodedVideoFrame } from '../media/VideoFrameSource';

export interface FrameRenderOptions {
  frameDurationUs: number;
  compositor: GpuCompositor;
  canvasContext: GPUCanvasContext;
  exportCanvas: ExporterCanvas;
  device: GPUDevice;
  videoEncoder: VideoEncoderService;
}

export class FrameRender {
  private readonly frameDurationUs: number;
  private readonly gpuCompositor: GpuCompositor;
  private readonly canvasContext: GPUCanvasContext;
  private readonly exportCanvas: ExporterCanvas;
  private readonly device: GPUDevice;
  private readonly videoEncoder: VideoEncoderService;

  constructor(options: FrameRenderOptions) {
    this.frameDurationUs = options.frameDurationUs;
    this.gpuCompositor = options.compositor;
    this.canvasContext = options.canvasContext;
    this.exportCanvas = options.exportCanvas;
    this.device = options.device;
    this.videoEncoder = options.videoEncoder;
  }

  async renderAndEncode(frameContext: VideoFrameContext): Promise<void> {
    if (frameContext.videos.length === 0) {
      throw new Error(`No video clip is active at ${frameContext.time.toFixed(3)}s`);
    }

    const sourceFrames = await this.nextSourceFrames(frameContext);

    try {
      await this.renderFrame(frameContext, sourceFrames);
      await this.encodeFrame(frameContext);
    } finally {
      for (const sourceFrame of sourceFrames) {
        sourceFrame.close();
      }
    }
  }

  private async nextSourceFrames(context: VideoFrameContext): Promise<DecodedVideoFrame[]> {
    return Promise.all(context.videos.map((videoLayer) => videoLayer.nextSourceFrame()));
  }

  private async renderFrame(
    context: VideoFrameContext,
    sourceFrames: DecodedVideoFrame[],
  ): Promise<void> {
    const overlays = await Promise.all(
      context.images.map(async ({ clip }) => ({
        image: await clip.loadImageElement(),
        imageClip: clip,
      })),
    );

    await this.gpuCompositor.renderFrame(this.canvasContext, {
      time: context.time,
      videoLayers: context.videos.map((videoLayer, index) => ({
        videoFrame: sourceFrames[index].frame,
        videoClip: videoLayer.clip,
      })),
      imageLayers: overlays,
    });
  }

  private async encodeFrame(context: VideoFrameContext): Promise<void> {
    const videoFrame = await this.exportCanvas.captureVideoFrame(
      this.device,
      context.timestampUs,
      this.frameDurationUs,
    );

    try {
      await this.videoEncoder.encodeVideoFrame(videoFrame, context.frame);
    } finally {
      videoFrame.close();
    }
  }
}
