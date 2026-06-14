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

export interface CompositorFrameInput {
  time: number;
  videoLayers: VideoLayerInput[];
  imageLayers: ImageLayerInput[];
}

export class GpuCompositor {
  private constructor(
      private readonly videoRenderer: GpuVideoRenderer,
      private readonly imageRenderer: GpuImageRenderer,
  ) {
  }

  static async create(
      device: GPUDevice,
      canvasFormat: GPUTextureFormat,
  ): Promise<GpuCompositor> {
    const [videoRenderer, imageRenderer] = await Promise.all([
      GpuVideoRenderer.create(device, canvasFormat),
      GpuImageRenderer.create(device, canvasFormat),
    ]);

    return new GpuCompositor(videoRenderer, imageRenderer);
  }

  async renderFrame(
      canvasContext: GPUCanvasContext,
      input: CompositorFrameInput,
  ): Promise<void> {
    const {videoLayers, imageLayers} = input;
    const outputView = canvasContext.getCurrentTexture().createView();

    for (const [index, videoInput] of videoLayers.entries()) {
      this.videoRenderer.render(outputView, videoInput, index === 0 ? 'clear' : 'load');
    }

    for (const {image, imageClip} of imageLayers) {
      this.imageRenderer.render(outputView, image, imageClip, videoLayers.length === 0 ? 'clear' : 'load');
    }
  }

  destroy(): void {
    this.videoRenderer.destroy();
    this.imageRenderer.destroy();
  }
}
