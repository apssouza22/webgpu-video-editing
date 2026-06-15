import type {ImageClip, VideoClip} from '../types';
import {GpuImageRenderer} from './GpuImageRenderer';
import {GpuVideoRenderer} from './GpuVideoRenderer';

export interface VideoLayerInput {
  videoFrame: VideoFrame;
  videoClip: VideoClip;
}

export interface ImageLayerInput {
  image: HTMLImageElement;
  imageClip: ImageClip;
}

export type CompositorLayer =
  | ({ type: 'video' } & VideoLayerInput)
  | ({ type: 'image' } & ImageLayerInput);

export interface CompositorFrameInput {
  time: number;
  layers: CompositorLayer[];
}

export class GpuCompositor {
  private constructor(
      private readonly device: GPUDevice,
      private readonly videoRenderer: GpuVideoRenderer,
      private readonly imageRenderer: GpuImageRenderer,
  ) {
  }

  static async create(
      device: GPUDevice,
      canvasFormat: GPUTextureFormat,
      width: number,
      height: number,
  ): Promise<GpuCompositor> {
    const aspectRatio = width / height;
    const [videoRenderer, imageRenderer] = await Promise.all([
      GpuVideoRenderer.create(device, canvasFormat, aspectRatio),
      GpuImageRenderer.create(device, canvasFormat, aspectRatio),
    ]);

    return new GpuCompositor(device, videoRenderer, imageRenderer);
  }

  async renderFrame(
      canvasContext: GPUCanvasContext,
      input: CompositorFrameInput,
  ): Promise<void> {
    const outputView = canvasContext.getCurrentTexture().createView();

    if (input.layers.length === 0) {
      this.clearFrame(outputView);
      return;
    }

    for (const [index, layer] of input.layers.entries()) {
      const loadOp: GPULoadOp = index === 0 ? 'clear' : 'load';

      if (layer.type === 'video') {
        this.videoRenderer.render(outputView, layer, loadOp);
        continue;
      }

      this.imageRenderer.render(outputView, layer.image, layer.imageClip, loadOp);
    }
  }

  destroy(): void {
    this.videoRenderer.destroy();
    this.imageRenderer.destroy();
  }

  private clearFrame(outputView: GPUTextureView): void {
    const encoder = this.device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: outputView,
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    });
    pass.end();
    this.device.queue.submit([encoder.finish()]);
  }
}
