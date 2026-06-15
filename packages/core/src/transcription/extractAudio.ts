import {
  ALL_FORMATS,
  AudioBufferSink,
  BlobSource,
  Input,
} from 'mediabunny';

export interface ExtractAudioOptions {
  /** Trim offset into the source file, in seconds. */
  sourceOffset?: number;
  /** Clip duration in seconds. When omitted, audio is extracted to the end of the source. */
  duration?: number;
}

async function mergeTrackBuffers(
  audioTrack: Awaited<ReturnType<Input['getPrimaryAudioTrack']>>,
  options: ExtractAudioOptions = {},
): Promise<AudioBuffer | null> {
  if (!audioTrack) {
    return null;
  }

  const sourceDuration = await audioTrack.computeDuration();
  if (sourceDuration <= 0) {
    return null;
  }

  const sourceOffset = Math.max(0, options.sourceOffset ?? 0);
  const requestedDuration = options.duration;
  const availableDuration = Math.max(0, sourceDuration - sourceOffset);
  const duration =
    requestedDuration !== undefined && requestedDuration > 0
      ? Math.min(requestedDuration, availableDuration)
      : availableDuration;

  if (duration <= 0) {
    return null;
  }

  const sampleRate = audioTrack.sampleRate;
  const channels = Math.min(2, Math.max(1, audioTrack.numberOfChannels));
  const startTime = sourceOffset;
  const endTime = sourceOffset + duration;
  const frameCount = Math.ceil(duration * sampleRate);
  const audioContext = new AudioContext({ sampleRate });
  const merged = audioContext.createBuffer(channels, frameCount, sampleRate);
  const sink = new AudioBufferSink(audioTrack);

  for await (const wrapped of sink.buffers(startTime, endTime)) {
    const offset = Math.round((wrapped.timestamp - startTime) * sampleRate);
    if (offset >= frameCount) {
      continue;
    }

    const source = wrapped.buffer;
    for (let channel = 0; channel < channels; channel += 1) {
      const sourceChannel = source.getChannelData(
        Math.min(channel, source.numberOfChannels - 1),
      );
      const destinationChannel = merged.getChannelData(channel);
      const copyLength = Math.min(sourceChannel.length, frameCount - offset);

      for (let index = 0; index < copyLength; index += 1) {
        destinationChannel[offset + index] = sourceChannel[index];
      }
    }
  }

  return merged;
}

function sliceAudioBuffer(
  audioBuffer: AudioBuffer,
  options: ExtractAudioOptions = {},
): AudioBuffer {
  const sourceOffset = Math.max(0, options.sourceOffset ?? 0);
  const startFrame = Math.round(sourceOffset * audioBuffer.sampleRate);
  const requestedFrames =
    options.duration !== undefined && options.duration > 0
      ? Math.round(options.duration * audioBuffer.sampleRate)
      : audioBuffer.length - startFrame;
  const frameCount = Math.min(
    Math.max(0, requestedFrames),
    Math.max(0, audioBuffer.length - startFrame),
  );

  if (frameCount <= 0) {
    throw new Error('No audio samples found in the selected clip range.');
  }

  const sliced = new AudioContext({ sampleRate: audioBuffer.sampleRate }).createBuffer(
    audioBuffer.numberOfChannels,
    frameCount,
    audioBuffer.sampleRate,
  );

  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel += 1) {
    const sourceChannel = audioBuffer.getChannelData(channel);
    sliced.getChannelData(channel).set(sourceChannel.subarray(startFrame, startFrame + frameCount));
  }

  return sliced;
}

async function decodeAudioFile(
  url: string,
  options: ExtractAudioOptions = {},
): Promise<AudioBuffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch audio source: ${url} (${response.status})`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const audioContext = new AudioContext();

  try {
    const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    return sliceAudioBuffer(decoded, options);
  } finally {
    await audioContext.close();
  }
}

async function decodeMediaWithMediabunny(
  url: string,
  options: ExtractAudioOptions = {},
): Promise<AudioBuffer | null> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch media source: ${url} (${response.status})`);
  }

  const blob = await response.blob();
  const input = new Input({
    source: new BlobSource(blob),
    formats: ALL_FORMATS,
  });

  try {
    const audioTrack = await input.getPrimaryAudioTrack();
    if (!audioTrack) {
      return null;
    }

    return await mergeTrackBuffers(audioTrack, options);
  } finally {
    input.dispose();
  }
}

/**
 * Decodes audio from a media URL for Whisper transcription.
 * Uses Mediabunny for container files and falls back to decodeAudioData for raw audio.
 */
export async function extractAudioFromMediaUrl(
  url: string,
  mediaType: 'video' | 'audio',
  options: ExtractAudioOptions = {},
): Promise<AudioBuffer> {
  const fromContainer = await decodeMediaWithMediabunny(url, options);
  if (fromContainer) {
    return fromContainer;
  }

  if (mediaType === 'audio') {
    return decodeAudioFile(url, options);
  }

  throw new Error('No audio track found in the selected media.');
}
