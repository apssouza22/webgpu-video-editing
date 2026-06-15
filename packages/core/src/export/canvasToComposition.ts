import {
  AudioClip,
  Composition,
  ImageClip,
  VideoClip,
} from '@opensource/gpu-video-encode';
import type { CompositionCanvas, CanvasElement, CanvasSize } from '@opensource/video-canvas';
import { rasterizeTextElement } from './rasterizeTextElement';
import {
  DEFAULT_EXPORT_FPS,
  DEFAULT_EXPORT_FORMAT,
  resolveOutputFilename,
  type ExportFormat,
} from './exportOptions';

export interface CanvasToCompositionOptions {
  fps?: number;
  width?: number;
  height?: number;
  format?: ExportFormat;
  outputFilename?: string;
}

export interface CanvasToCompositionResult {
  composition: Composition;
  /** Object URLs created during conversion (e.g. rasterized text). */
  revokeUrls: string[];
}

function normalizeRect(
  element: Pick<CanvasElement, 'x' | 'y' | 'width' | 'height'>,
  playerSize: CanvasSize,
) {
  return {
    x: element.x / playerSize.width,
    y: element.y / playerSize.height,
    width: element.width / playerSize.width,
    height: element.height / playerSize.height,
  };
}

function sortVisualElements(elements: CanvasElement[]): CanvasElement[] {
  return [...elements]
    .filter((element) => element.type !== 'audio')
    .sort((left, right) => left.zIndex - right.zIndex);
}

export async function canvasElementsToComposition(
  canvas: CompositionCanvas,
  options: CanvasToCompositionOptions = {},
): Promise<CanvasToCompositionResult> {
  const playerSize = canvas.getPlayerSize();
  const elements = canvas.getElements();
  const visualElements = sortVisualElements(elements);
  const audioElements = elements.filter((element) => element.type === 'audio');
  const videoElements = elements.filter((element) => element.type === 'video');

  if (visualElements.length === 0) {
    throw new Error(
      'Export requires at least one visual layer (video, image, or text).',
    );
  }

  const fps = options.fps ?? DEFAULT_EXPORT_FPS;
  const width = options.width ?? playerSize.width;
  const height = options.height ?? playerSize.height;
  const format = options.format ?? DEFAULT_EXPORT_FORMAT;

  const composition = new Composition(fps, width, height, {
    duration: canvas.getDuration(),
    outputFilename: resolveOutputFilename(format, options.outputFilename),
  });

  const revokeUrls: string[] = [];

  for (const element of visualElements) {
    const rect = normalizeRect(element, playerSize);

    switch (element.type) {
      case 'video':
        composition.addLayer(
          new VideoClip(
            element.src,
            element.startTime,
            element.duration,
            rect.x,
            rect.y,
            rect.width,
            rect.height,
            element.sourceOffset ?? 0,
            element.zIndex,
            element.rotation,
            element.opacity,
          ),
        );
        break;
      case 'image':
        composition.addLayer(
          new ImageClip(
            element.src,
            element.startTime,
            element.duration,
            rect.x,
            rect.y,
            rect.width,
            rect.height,
            element.opacity,
            element.zIndex,
            element.rotation,
          ),
        );
        break;
      case 'text': {
        const textImageUrl = await rasterizeTextElement(element);
        revokeUrls.push(textImageUrl);
        composition.addLayer(
          new ImageClip(
            textImageUrl,
            element.startTime,
            element.duration,
            rect.x,
            rect.y,
            rect.width,
            rect.height,
            element.opacity,
            element.zIndex,
            element.rotation,
          ),
        );
        break;
      }
    }
  }

  for (const element of audioElements) {
    composition.addLayer(
      new AudioClip(
        element.src,
        element.startTime,
        element.duration,
        element.sourceOffset ?? 0,
      ),
    );
  }

  for (const element of videoElements) {
    if (element.muted) {
      continue;
    }

    composition.addLayer(
      new AudioClip(
        element.src,
        element.startTime,
        element.duration,
        element.sourceOffset ?? 0,
      ),
    );
  }

  return { composition, revokeUrls };
}
