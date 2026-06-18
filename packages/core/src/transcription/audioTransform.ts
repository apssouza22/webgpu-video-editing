export const WHISPER_SAMPLE_RATE = 16_000;

/**
 * Downmixes to mono and resamples to 16 kHz for Whisper.
 * Whisper assumes 16 kHz input; passing native file sample rates produces garbage output.
 */
export async function prepareAudioForWhisper(audioData: AudioBuffer): Promise<Float32Array> {
  const frameCount = Math.ceil(audioData.duration * WHISPER_SAMPLE_RATE);
  const offlineContext = new OfflineAudioContext(1, frameCount, WHISPER_SAMPLE_RATE);
  const monoBuffer = offlineContext.createBuffer(1, audioData.length, audioData.sampleRate);
  const monoChannel = monoBuffer.getChannelData(0);

  if (audioData.numberOfChannels === 2) {
    const scalingFactor = Math.sqrt(2);
    const left = audioData.getChannelData(0);
    const right = audioData.getChannelData(1);

    for (let index = 0; index < audioData.length; index += 1) {
      monoChannel[index] = (scalingFactor * (left[index] + right[index])) / 2;
    }
  } else {
    monoChannel.set(audioData.getChannelData(0));
  }

  const source = offlineContext.createBufferSource();
  source.buffer = monoBuffer;
  source.connect(offlineContext.destination);
  source.start(0);

  const rendered = await offlineContext.startRendering();
  return rendered.getChannelData(0);
}

