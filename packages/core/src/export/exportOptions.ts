import type { CompositionPreview, CanvasSize } from '@opensource/video-preview';
import type { ExportProgress } from '@opensource/gpu-video-encode';

/** Supported container formats (currently MP4/H.264 + AAC only). */
export type ExportFormat = 'mp4';

/** Named quality presets mapped to video bitrates. */
export type ExportQuality = 'low' | 'medium' | 'high' | 'max';

export type ExportResolutionPreset =
  | 'source'
  | '480p'
  | '720p'
  | '1080p'
  | '1440p'
  | '4k';

export interface ExportResolution {
  /** Use a named height preset while preserving the canvas aspect ratio. */
  preset?: ExportResolutionPreset;
  /** Explicit output width in pixels (requires height). */
  width?: number;
  /** Explicit output height in pixels (requires width). */
  height?: number;
  /** Scale factor applied to the canvas player size (e.g. 0.5, 1, 2). */
  scale?: number;
}

export interface ExportVideoOptions {
  /** Frames per second. Defaults to 30. */
  fps?: number;
  /** Named preset or explicit bitrate in bits per second. */
  quality?: ExportQuality | number;
  /** Output container format. Defaults to `mp4`. */
  format?: ExportFormat;
  /** Output dimensions. Defaults to the canvas player size. */
  resolution?: ExportResolution;
  /** Override the downloaded filename (extension should match format). */
  outputFilename?: string;
  /** Timeline playback speed multiplier applied to export duration and media timing. */
  playbackRate?: number;
  onProgress?: (progress: ExportProgress) => void;
}

export interface ResolvedExportSettings {
  fps: number;
  width: number;
  height: number;
  bitrate: number;
  format: ExportFormat;
  outputFilename: string;
  sourceSize: CanvasSize;
  playbackRate: number;
}

export const DEFAULT_EXPORT_FPS = 30;
export const DEFAULT_EXPORT_FORMAT: ExportFormat = 'mp4';
export const DEFAULT_EXPORT_QUALITY: ExportQuality = 'high';

export const EXPORT_FPS_OPTIONS = [24, 25, 30, 50, 60] as const;

export const EXPORT_QUALITY_BITRATES: Record<ExportQuality, number> = {
  low: 2_500_000,
  medium: 5_000_000,
  high: 8_000_000,
  max: 16_000_000,
};

const RESOLUTION_PRESET_HEIGHTS: Record<Exclude<ExportResolutionPreset, 'source'>, number> = {
  '480p': 480,
  '720p': 720,
  '1080p': 1080,
  '1440p': 1440,
  '4k': 2160,
};

function toEvenDimension(value: number): number {
  return Math.max(2, Math.round(value / 2) * 2);
}

function resolveBitrate(quality: ExportQuality | number | undefined, pixels: number): number {
  if (typeof quality === 'number') {
    return Math.max(100_000, Math.round(quality));
  }

  const preset = quality ?? DEFAULT_EXPORT_QUALITY;
  const baseBitrate = EXPORT_QUALITY_BITRATES[preset];
  const referencePixels = 1280 * 720;
  const scale = Math.sqrt(pixels / referencePixels);

  return Math.round(baseBitrate * Math.max(0.5, Math.min(2.5, scale)));
}

export function resolveExportDimensions(
  sourceSize: CanvasSize,
  resolution: ExportResolution = {},
): CanvasSize {
  if (resolution.width != null && resolution.height != null) {
    return {
      width: toEvenDimension(resolution.width),
      height: toEvenDimension(resolution.height),
    };
  }

  if (resolution.scale != null && resolution.scale > 0) {
    return {
      width: toEvenDimension(sourceSize.width * resolution.scale),
      height: toEvenDimension(sourceSize.height * resolution.scale),
    };
  }

  const preset = resolution.preset ?? 'source';
  if (preset === 'source') {
    return {
      width: toEvenDimension(sourceSize.width),
      height: toEvenDimension(sourceSize.height),
    };
  }

  const targetHeight = RESOLUTION_PRESET_HEIGHTS[preset];
  const aspect = sourceSize.width / sourceSize.height;

  return {
    width: toEvenDimension(targetHeight * aspect),
    height: toEvenDimension(targetHeight),
  };
}

export function resolveOutputFilename(
  format: ExportFormat,
  outputFilename?: string,
): string {
  if (outputFilename) {
    return outputFilename;
  }

  return `composition-export.${format}`;
}

function normalizePlaybackRate(rate: number | undefined): number {
  if (rate == null || !Number.isFinite(rate) || rate <= 0) {
    return 1;
  }

  return rate;
}

export function resolveExportSettings(
  preview: CompositionPreview,
  options: ExportVideoOptions = {},
): ResolvedExportSettings {
  const sourceSize = preview.getPlayerSize();
  const format = options.format ?? DEFAULT_EXPORT_FORMAT;
  const { width, height } = resolveExportDimensions(sourceSize, options.resolution);
  const fps = options.fps ?? DEFAULT_EXPORT_FPS;

  return {
    fps,
    width,
    height,
    bitrate: resolveBitrate(options.quality, width * height),
    format,
    outputFilename: resolveOutputFilename(format, options.outputFilename),
    sourceSize,
    playbackRate: normalizePlaybackRate(options.playbackRate),
  };
}
