import {
  AudioClip,
  Composition,
  ImageClip,
  VideoClip,
} from '@opensource/gpu-video-encode';

const demoAssetUrl = (path: string): string => `${import.meta.env.BASE_URL}${path}`;

/**
 * Demo timeline: video layers, image overlays, and explicit MP4-backed audio clips.
 * Durations <= 0 are resolved from loaded source media length.
 */
export const DEMO_COMPOSITION = new Composition(30, 1280, 720, {
  outputFilename: 'composition-export.mp4',
})
  .addLayer(new VideoClip(demoAssetUrl('samples/video.mp4'), 0))
  .addLayer(new VideoClip(demoAssetUrl('samples/video-2.mp4'), 5, 5, 0.5, 0.5, 0.5, 0.5))
  .addLayer(new AudioClip(demoAssetUrl('samples/video.mp4'), 0))
  .addLayer(new AudioClip(demoAssetUrl('samples/video-2.mp4'), 5, 5))
  .addLayer(new ImageClip(demoAssetUrl('samples/overlay.png'), 1, 3, 0.62, 0.08, 0.32, 0.32, 0.92))
  .addLayer(new ImageClip(demoAssetUrl('samples/overlay-2.png'), 1, 3, 0, 0.08, 0.32, 0.32, 0.92));
