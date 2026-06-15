import {
  CompositionExporter,
  type ExportProgress,
} from '@opensource/gpu-video-encode';
import type { CompositionCanvas } from '@opensource/video-canvas';
import { canvasElementsToComposition } from './canvasToComposition';

export interface ExportVideoOptions {
  fps?: number;
  outputFilename?: string;
  onProgress?: (progress: ExportProgress) => void;
}

export interface ExportVideoResult {
  blob: Blob;
  filename: string;
}

export async function exportVideoFromCanvas(
  canvas: CompositionCanvas,
  options: ExportVideoOptions = {},
): Promise<ExportVideoResult> {
  const { composition, revokeUrls } = await canvasElementsToComposition(canvas, {
    fps: options.fps,
    outputFilename: options.outputFilename,
  });

  const exporter = new CompositionExporter();

  try {
    const blob = await exporter.export(composition, (progress) => {
      options.onProgress?.(progress);
    });

    return {
      blob,
      filename: composition.outputFilename,
    };
  } finally {
    for (const url of revokeUrls) {
      URL.revokeObjectURL(url);
    }
  }
}
