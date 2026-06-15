import type { VideoFrameContext } from '../types';
import { ExporterCanvas } from '../gpu/ExporterCanvas';
import { GpuCompositor, type CompositorLayer } from '../gpu/GpuCompositor';
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
    const decodedFrames: DecodedVideoFrame[] = [];

    try {
      const compositorLayers = await this.buildCompositorLayers(frameContext, decodedFrames);
      await this.gpuCompositor.renderFrame(this.canvasContext, {
        time: frameContext.time,
        layers: compositorLayers,
      });
      await this.encodeFrame(frameContext);
    } finally {
      for (const sourceFrame of decodedFrames) {
        sourceFrame.close();
      }
    }
  }

  private async buildCompositorLayers(
    context: VideoFrameContext,
    decodedFrames: DecodedVideoFrame[],
  ): Promise<CompositorLayer[]> {
    const layers: CompositorLayer[] = [];

    for (const layer of context.layers) {
      if (layer.type === 'video') {
        const sourceFrame = await layer.nextSourceFrame();
        decodedFrames.push(sourceFrame);
        layers.push({
          type: 'video',
          videoFrame: sourceFrame.frame,
          videoClip: layer.clip,
        });
        continue;
      }

      layers.push({
        type: 'image',
        image: await layer.clip.loadImageElement(),
        imageClip: layer.clip,
      });
    }

    return layers;
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
