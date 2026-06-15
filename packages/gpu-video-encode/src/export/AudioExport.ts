import type {AudioClip, ExportProgress} from '../types';
import {AudioEncoderService} from './AudioEncoderService';
import {timeStretchAudioBuffer} from './timeStretchAudioBuffer';
import {VideoEncoderService} from './VideoEncoderService';

export type AudioExportProgressCallback = (progress: ExportProgress) => void;

export interface AudioExportSettings {
  audioClips: readonly AudioClip[];
  duration: number;
  totalFrames: number;
  playbackRate: number;
  onProgress: AudioExportProgressCallback;
}

export class AudioExport {
  private constructor(private readonly audioBuffer: AudioBuffer | null) {}

  static async create(settings: AudioExportSettings): Promise<AudioExport> {
    const audioSupported = await AudioEncoderService.isSupported();
    let audioBuffer: AudioBuffer | null = null;

    if (audioSupported && settings.audioClips.length > 0) {
      settings.onProgress({
        phase: 'audio',
        frame: 0,
        totalFrames: settings.totalFrames,
        percent: 0,
        message: 'Decoding and mixing timeline audio (MediaBunny)…',
      });

      audioBuffer = await this.createTimelineAudioBuffer(
        settings.audioClips,
        settings.duration,
        settings.playbackRate,
      );

      if (!audioBuffer) {
        console.warn('No audio track found — exporting video only');
      }
    }

    return new AudioExport(audioBuffer);
  }

  get hasAudio(): boolean {
    return this.audioBuffer !== null;
  }

  async encodeInto(videoEncoder: VideoEncoderService): Promise<void> {
    if (!this.audioBuffer) {
      return;
    }

    const audioEncoder = new AudioEncoderService(this.audioBuffer.sampleRate, 2, 192_000);
    await audioEncoder.encodeBuffer(this.audioBuffer, (chunk, metadata) => {
      videoEncoder.addAudioChunk(chunk, metadata);
    });
  }

  private static async createTimelineAudioBuffer(
    audioClips: readonly AudioClip[],
    duration: number,
    playbackRate: number,
  ): Promise<AudioBuffer | null> {
    const sampleRate = 48_000;
    const channels = 2;
    const frameCount = Math.ceil(duration * sampleRate);

    if (frameCount <= 0 || !('OfflineAudioContext' in window)) {
      return null;
    }

    const decodedClips = await Promise.all(
      audioClips.map(async (clip) => ({
        clip,
        buffer: await clip.getAudioBuffer(),
      })),
    );

    const offlineContext = new OfflineAudioContext(channels, frameCount, sampleRate);
    let scheduledAudio = false;

    for (const {clip, buffer} of decodedClips) {
      if (!buffer) {
        continue;
      }

      const exportStart = clip.start / playbackRate;
      if (exportStart >= duration) {
        continue;
      }

      const timelineDuration = Math.min(
        clip.duration,
        buffer.duration,
        duration * playbackRate - clip.start,
      );
      if (timelineDuration <= 0) {
        continue;
      }

      const exportDuration = Math.min(timelineDuration / playbackRate, duration - exportStart);
      if (exportDuration <= 0) {
        continue;
      }

      const stretched = timeStretchAudioBuffer(offlineContext, buffer, playbackRate);
      const source = offlineContext.createBufferSource();
      source.buffer = stretched;
      source.connect(offlineContext.destination);
      source.start(exportStart, 0, exportDuration);
      scheduledAudio = true;
    }

    if (!scheduledAudio) {
      return null;
    }

    return offlineContext.startRendering();
  }
}
