/**
 * Overlap-add time stretch that preserves pitch when changing playback speed.
 * Used for export because OfflineAudioContext buffer sources shift pitch with playbackRate.
 */
export function timeStretchAudioBuffer(
  audioContext: BaseAudioContext,
  buffer: AudioBuffer,
  rate: number,
): AudioBuffer {
  if (rate === 1) {
    return buffer;
  }

  const channels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const inputLength = buffer.length;
  const outputLength = Math.max(1, Math.round(inputLength / rate));
  const output = audioContext.createBuffer(channels, outputLength, sampleRate);

  const frameSize = 4096;
  const overlap = 0.5;
  const analysisHop = Math.max(1, Math.floor(frameSize * (1 - overlap)));
  const synthesisHop = Math.max(1, Math.round(analysisHop / rate));

  const window = new Float32Array(frameSize);
  for (let index = 0; index < frameSize; index++) {
    window[index] = 0.5 - 0.5 * Math.cos((2 * Math.PI * index) / frameSize);
  }

  for (let channel = 0; channel < channels; channel++) {
    const input = buffer.getChannelData(channel);
    const result = output.getChannelData(channel);

    let inputPos = 0;
    let outputPos = 0;

    while (inputPos + frameSize <= inputLength && outputPos + frameSize <= outputLength) {
      for (let index = 0; index < frameSize; index++) {
        result[outputPos + index] += input[inputPos + index] * window[index];
      }

      inputPos += analysisHop;
      outputPos += synthesisHop;
    }

    let peak = 0;
    for (let index = 0; index < outputLength; index++) {
      const sample = Math.abs(result[index]);
      if (sample > peak) {
        peak = sample;
      }
    }

    if (peak > 1) {
      const gain = 1 / peak;
      for (let index = 0; index < outputLength; index++) {
        result[index] *= gain;
      }
    }
  }

  return output;
}
