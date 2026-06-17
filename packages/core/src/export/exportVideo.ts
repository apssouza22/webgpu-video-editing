import {
  CompositionExporter,
  type CompositionExportOptions,
  type ExportProgress,
} from '@opensource/gpu-video-encode';
import type { CompositionPreview } from '@opensource/video-preview';
import { previewElementsToComposition } from './previewToComposition';
import { resolveExportSettings, type ExportVideoOptions } from './exportOptions';

export type { ExportVideoOptions } from './exportOptions';

export interface ExportVideoResult {
  blob: Blob;
  filename: string;
  settings: ReturnType<typeof resolveExportSettings>;
}

export async function exportVideoFromPreview(
  preview: CompositionPreview,
  options: ExportVideoOptions = {},
): Promise<ExportVideoResult> {
  const settings = resolveExportSettings(preview, options);

  const { composition, revokeUrls } = await previewElementsToComposition(preview, {
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
