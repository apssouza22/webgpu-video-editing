import {
  CompositionExporter,
  type CompositionExportOptions,
  type ExportProgress,
} from '@opensource/gpu-video-encode';
import type { CompositionCanvas } from '@opensource/video-canvas';
import { canvasElementsToComposition } from './canvasToComposition';
import { resolveExportSettings, type ExportVideoOptions } from './exportOptions';

export type { ExportVideoOptions } from './exportOptions';

export interface ExportVideoResult {
  blob: Blob;
  filename: string;
  settings: ReturnType<typeof resolveExportSettings>;
}

export async function exportVideoFromCanvas(
  canvas: CompositionCanvas,
  options: ExportVideoOptions = {},
): Promise<ExportVideoResult> {
  const settings = resolveExportSettings(canvas, options);

  const { composition, revokeUrls } = await canvasElementsToComposition(canvas, {
    fps: settings.fps,
    width: settings.width,
    height: settings.height,
    format: settings.format,
    outputFilename: settings.outputFilename,
    playbackRate: settings.playbackRate,
  });

  const encoderOptions: CompositionExportOptions = {
    bitrate: settings.bitrate,
  };

  const exporter = new CompositionExporter();

  try {
    const blob = await exporter.export(
      composition,
      (progress: ExportProgress) => {
        options.onProgress?.(progress);
      },
      encoderOptions,
    );

    return {
      blob,
      filename: composition.outputFilename,
      settings,
    };
  } finally {
    for (const url of revokeUrls) {
      URL.revokeObjectURL(url);
    }
  }
}
